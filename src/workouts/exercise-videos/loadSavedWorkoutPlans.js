// Loads every workout plan a client should see in the AI Workout Library.
// Flow: mirror current → saved subcollection → current doc → legacy global + savedWorkoutPlans → trainer filter → sort.
// Used by: client workout library screen; trainer dashboard when opts.trainerId is set.
// Read order: constants → small helpers → main recipe → PLUMBING at the bottom.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { auth, db } from '../../app-start/cloudConnection';
import {
  fetchSavedWorkoutPlans,
  getCurrentWorkoutPlan,
  setCurrentWorkoutPlan,
} from '../create-plan/saveAndLoadWorkoutPlan';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const WORKOUT_PLANS_SUBCOLLECTION = 'workoutPlans';
const WORKOUT_PLAN_DOC_COLLECTION = 'workoutPlan';
const CURRENT_PLAN_DOC_ID = 'current';
const GLOBAL_PLANS_COLLECTION = 'workoutPlans';
const LEGACY_SAVED_PLANS_COLLECTION = 'savedWorkoutPlans';

const SOURCE_USERS_SUBCOLLECTION = 'usersSubcollection';
const SOURCE_WORKOUT_PLAN_CURRENT = 'workoutPlanCurrent';
const SOURCE_GLOBAL = 'global';
const SOURCE_SAVED_WORKOUT_PLANS = 'savedWorkoutPlans';
const SOURCE_GENERATOR = 'generator';

const PLAN_STATUS_ACTIVE = 'active';
const DEDUPE_KEY_CURRENT = 'workoutPlan:current';
// Manipulate here: how many characters of plan text feed the dedupe key.
const DEDUPE_TEXT_SLICE = 80;
// Manipulate here: max saved plans pulled from the users/{id}/workoutPlans subcollection.
const SAVED_PLANS_LIMIT = 50;

const BENIGN_PERMISSION_CODE = 'permission-denied';
const BENIGN_INDEX_CODE = 'failed-precondition';

const DATE_LABEL_OPTIONS = { month: 'short', day: 'numeric', year: 'numeric' };

// ===== HELPER FUNCTIONS =====
// Tiny helpers the main recipe names out loud. Firestore loaders live under PLUMBING.

/**
 * Permission / missing-index noise should not wipe the library UI.
 * vocab: Firestore error.code = machine string like "permission-denied"
 */
function errorIsBenignLibraryNoise(error) {
  if (!error) return false;
  const errorCode = error.code;
  if (errorCode === BENIGN_PERMISSION_CODE || errorCode === BENIGN_INDEX_CODE) {
    return true;
  }
  const messageLower = String(error.message || '').toLowerCase();
  const mentionsPermissions = messageLower.includes('missing or insufficient permissions');
  const mentionsIndex = messageLower.includes('index');
  return mentionsPermissions || mentionsIndex;
}

/**
 * Keep the first real (non-benign) error; ignore permission/index noise.
 */
function keepFirstFatalError(currentWorstError, nextError) {
  if (errorIsBenignLibraryNoise(nextError)) return currentWorstError;
  return currentWorstError || nextError;
}

/**
 * One library card per plan body — "current" collapses to a fixed key.
 */
function dedupeKeyForPlanCard(planItem) {
  // Pull id / flags / body text into named locals (no optional chaining).
  let planId = null;
  let isSingleDocFlag = false;
  let rawPlanText = '';
  let planTextField = '';
  if (planItem != null) {
    planId = planItem.id;
    isSingleDocFlag = Boolean(planItem._singleDoc);
    if (planItem.rawPlan) {
      rawPlanText = planItem.rawPlan;
    }
    if (planItem.planText) {
      planTextField = planItem.planText;
    }
  }

  const isCurrentCard = planId === CURRENT_PLAN_DOC_ID || isSingleDocFlag;
  if (isCurrentCard) return DEDUPE_KEY_CURRENT;

  const bodyForDedupe = rawPlanText || planTextField || '';
  const planTextSlice = String(bodyForDedupe).slice(0, DEDUPE_TEXT_SLICE);
  const idForKey = planId || '';
  return `plan:${idForKey}:${planTextSlice}`;
}

/**
 * Push a plan only once (by dedupe key).
 */
function addPlanCardIfNew(planRow, seenDedupeKeys, mergedPlans) {
  if (!planRow) return;
  const dedupeKey = dedupeKeyForPlanCard(planRow);
  if (seenDedupeKeys.has(dedupeKey)) return;
  seenDedupeKeys.add(dedupeKey);
  mergedPlans.push(planRow);
}

/**
 * True when the merged list already has the single "current" card.
 */
function libraryAlreadyHasCurrentCard(mergedPlans) {
  for (let index = 0; index < mergedPlans.length; index += 1) {
    const plan = mergedPlans[index];
    if (plan.id === CURRENT_PLAN_DOC_ID || plan._singleDoc) return true;
  }
  return false;
}

/**
 * Newest generated/created first. Mutates the array in place (same as before).
 */
function sortPlansNewestFirst(plans) {
  plans.sort((leftPlan, rightPlan) => {
    const rightMillis = sortMillisForPlan(rightPlan);
    const leftMillis = sortMillisForPlan(leftPlan);
    return rightMillis - leftMillis;
  });
}

/**
 * Only surface a string error when the library is empty and something real failed.
 */
function userFacingErrorWhenLibraryEmpty(plans, fatalError) {
  if (plans.length > 0) return null;
  if (!fatalError) return null;
  return String(fatalError.message || fatalError);
}

/**
 * Trainer dashboard filter: drop other trainers' AI spam; keep assigned/manual rows.
 */
function plansVisibleForTrainerScope(mergedPlans, trainerId) {
  if (!trainerId) return mergedPlans;
  const visiblePlans = [];
  for (let index = 0; index < mergedPlans.length; index += 1) {
    const plan = mergedPlans[index];
    if (planMatchesTrainerScope(plan, trainerId)) {
      visiblePlans.push(plan);
    }
  }
  return visiblePlans;
}

// ===== MAIN FUNCTION =====

/**
 * All library-visible plans for one client (deduped, newest first).
 * Flow: 1. mirror  2. load every Firestore source  3. trainer filter  4. sort
 * @param {string} clientId
 * @param {{ trainerId?: string|null }} [opts]
 * @returns {Promise<{ plans: object[], error: string|null }>}
 */
export async function fetchClientWorkoutPlansForLibrary(clientId, opts = {}) {
  if (!clientId || !db) return { plans: [], error: null };

  // 1. Optional trainer scope from the dashboard caller.
  let trainerId = null;
  if (opts != null && opts.trainerId) {
    trainerId = String(opts.trainerId);
  }

  // 2. One-time sync so pre-library "current" plans appear in the saved subcollection.
  await mirrorCurrentPlanIntoLibraryIfNeeded(clientId);

  const mergedPlans = [];
  const seenDedupeKeys = new Set();
  let worstFatalError = null;

  // 3. Load each Firestore source; keep the first fatal error that is not permission/index noise.
  worstFatalError = keepFirstFatalError(
    worstFatalError,
    await appendSavedSubcollectionPlans(clientId, seenDedupeKeys, mergedPlans),
  );
  worstFatalError = keepFirstFatalError(
    worstFatalError,
    await appendDecoratedCurrentPlan(clientId, seenDedupeKeys, mergedPlans),
  );

  if (!libraryAlreadyHasCurrentCard(mergedPlans)) {
    worstFatalError = keepFirstFatalError(
      worstFatalError,
      await appendCurrentPlanDocument(clientId, seenDedupeKeys, mergedPlans),
    );
  }

  worstFatalError = keepFirstFatalError(
    worstFatalError,
    await appendGlobalPlansForClient(clientId, seenDedupeKeys, mergedPlans),
  );
  worstFatalError = keepFirstFatalError(
    worstFatalError,
    await appendLegacySavedPlans(clientId, seenDedupeKeys, mergedPlans),
  );

  // 4. Trainer dashboard: only this trainer's scoped rows (legacy AI spam dropped).
  const visiblePlans = plansVisibleForTrainerScope(mergedPlans, trainerId);

  // 5. Newest first for the library list.
  sortPlansNewestFirst(visiblePlans);

  return {
    plans: visiblePlans,
    error: userFacingErrorWhenLibraryEmpty(visiblePlans, worstFatalError),
  };
}

// ===== PLUMBING — skip unless debugging Firestore plan sources / trainer stamps =====

function dateFromGeneratedAt(data) {
  if (data != null && data.generatedAt) {
    const generatedAtValue = data.generatedAt;
    if (typeof generatedAtValue.toDate === 'function') {
      return generatedAtValue.toDate();
    }
    return new Date(generatedAtValue);
  }
  return new Date();
}

/**
 * Shape the single "current" plan doc into a library card.
 */
function decoratePlanAsCurrentCard(data) {
  if (data == null) return null;

  const hasRawPlan = Boolean(data.rawPlan);
  const hasPlanText = Boolean(data.planText);
  if (!hasRawPlan && !hasPlanText) return null;

  const generatedWhen = dateFromGeneratedAt(data);
  const dateLabel = generatedWhen.toLocaleDateString(undefined, DATE_LABEL_OPTIONS);
  const defaultTitle = `Workout plan · ${dateLabel}`;

  return {
    id: CURRENT_PLAN_DOC_ID,
    ...data,
    title: data.title || data.name || defaultTitle,
    name: data.name || data.title || defaultTitle,
    planText: data.planText || data.rawPlan,
    rawPlan: data.rawPlan || data.planText,
    source: data.source || SOURCE_GENERATOR,
    status: data.status || PLAN_STATUS_ACTIVE,
    _singleDoc: true,
    _path: data._path,
    _source: data._source || SOURCE_WORKOUT_PLAN_CURRENT,
  };
}

/**
 * Every field that might stamp which trainer owns/assigned this plan.
 * Letters of field names stay frozen for Firestore readers.
 */
function trainerIdStampValues(plan) {
  let firebaseTrainerId = null;
  if (plan != null && plan._firebase != null) {
    firebaseTrainerId = plan._firebase.trainerId;
  }

  const rawStamps = [
    plan.trainerId,
    plan.createdBy,
    plan.assignedBy,
    plan.authorId,
    plan.ownerTrainerId,
    firebaseTrainerId,
  ];
  const stampValues = [];
  for (let index = 0; index < rawStamps.length; index += 1) {
    const stampValue = rawStamps[index];
    if (stampValue == null) continue;
    if (String(stampValue).trim() === '') continue;
    stampValues.push(String(stampValue));
  }
  return stampValues;
}

function isLegacyUnscopedAiPlan(plan) {
  const sourceName = String(plan.source || plan._source || '');
  if (sourceName === SOURCE_GENERATOR) return true;
  if (sourceName === SOURCE_GLOBAL) return true;
  if (sourceName === SOURCE_SAVED_WORKOUT_PLANS) return true;
  return false;
}

function planMatchesTrainerScope(plan, trainerId) {
  if (!trainerId || !plan) return true;

  const trainerIdText = String(trainerId);
  const stampValues = trainerIdStampValues(plan);

  if (stampValues.length === 0) {
    if (isLegacyUnscopedAiPlan(plan)) return false;
    return true;
  }

  return stampValues.includes(trainerIdText);
}

function firestorePathToCurrentPlan(clientId) {
  return [USERS_COLLECTION, clientId, WORKOUT_PLAN_DOC_COLLECTION, CURRENT_PLAN_DOC_ID];
}

/**
 * Client signed in as themselves: copy "current" into the library subcollection once.
 * vocab: auth.currentUser.uid must match clientId — trainers reading a client skip this write.
 */
async function mirrorCurrentPlanIntoLibraryIfNeeded(clientId) {
  if (!clientId || !db) return;

  let signedInUid = null;
  if (auth != null && auth.currentUser != null) {
    signedInUid = auth.currentUser.uid;
  }
  if (signedInUid !== clientId) return;

  try {
    const librarySnap = await getDoc(
      doc(db, USERS_COLLECTION, clientId, WORKOUT_PLANS_SUBCOLLECTION, CURRENT_PLAN_DOC_ID),
    );
    if (librarySnap.exists()) return;

    const current = await getCurrentWorkoutPlan(clientId);
    let hasRawPlan = false;
    let hasPlanText = false;
    if (current != null) {
      hasRawPlan = Boolean(current.rawPlan);
      hasPlanText = Boolean(current.planText);
    }
    if (!hasRawPlan && !hasPlanText) return;

    await setCurrentWorkoutPlan(clientId, {
      rawPlan: current.rawPlan || current.planText,
      planText: current.planText || current.rawPlan,
      structuredPlan: current.structuredPlan || null,
      title: current.title || current.name,
      generatedAt: current.generatedAt,
    });
  } catch (_ignoredError) {
    // non-fatal — library can still load from other sources
  }
}

async function appendSavedSubcollectionPlans(clientId, seenDedupeKeys, mergedPlans) {
  try {
    const savedPlans = await fetchSavedWorkoutPlans(clientId, SAVED_PLANS_LIMIT);
    for (let index = 0; index < savedPlans.length; index += 1) {
      const plan = savedPlans[index];
      addPlanCardIfNew(
        { ...plan, _source: SOURCE_USERS_SUBCOLLECTION },
        seenDedupeKeys,
        mergedPlans,
      );
    }
    return null;
  } catch (error) {
    return error;
  }
}

async function appendDecoratedCurrentPlan(clientId, seenDedupeKeys, mergedPlans) {
  try {
    const current = await getCurrentWorkoutPlan(clientId);
    const decorated = decoratePlanAsCurrentCard({
      ...current,
      _path: firestorePathToCurrentPlan(clientId),
      _source: SOURCE_WORKOUT_PLAN_CURRENT,
    });
    if (decorated) addPlanCardIfNew(decorated, seenDedupeKeys, mergedPlans);
    return null;
  } catch (error) {
    return error;
  }
}

async function appendCurrentPlanDocument(clientId, seenDedupeKeys, mergedPlans) {
  try {
    const snapshot = await getDoc(
      doc(db, USERS_COLLECTION, clientId, WORKOUT_PLAN_DOC_COLLECTION, CURRENT_PLAN_DOC_ID),
    );
    if (!snapshot.exists()) return null;

    const decorated = decoratePlanAsCurrentCard({
      id: snapshot.id,
      ...snapshot.data(),
      _path: firestorePathToCurrentPlan(clientId),
      _source: SOURCE_WORKOUT_PLAN_CURRENT,
    });
    if (decorated) addPlanCardIfNew(decorated, seenDedupeKeys, mergedPlans);
    return null;
  } catch (error) {
    return error;
  }
}

/**
 * Prefer ordered query; fall back if the composite index is missing.
 * vocab: failed-precondition often means "create this Firestore index"
 */
async function queryGlobalPlansForClient(clientId) {
  const globalRef = collection(db, GLOBAL_PLANS_COLLECTION);
  try {
    return await getDocs(
      query(globalRef, where('clientId', '==', clientId), orderBy('generatedAt', 'desc')),
    );
  } catch (_missingIndex) {
    return await getDocs(query(globalRef, where('clientId', '==', clientId)));
  }
}

async function appendGlobalPlansForClient(clientId, seenDedupeKeys, mergedPlans) {
  try {
    const snapshot = await queryGlobalPlansForClient(clientId);
    snapshot.forEach((planDoc) => {
      addPlanCardIfNew(
        { id: planDoc.id, ...planDoc.data(), _source: SOURCE_GLOBAL },
        seenDedupeKeys,
        mergedPlans,
      );
    });
    return null;
  } catch (error) {
    return error;
  }
}

async function appendLegacySavedPlans(clientId, seenDedupeKeys, mergedPlans) {
  try {
    const legacyRef = collection(db, LEGACY_SAVED_PLANS_COLLECTION);
    const snapshot = await getDocs(query(legacyRef, where('userId', '==', clientId)));
    snapshot.forEach((planDoc) => {
      addPlanCardIfNew(
        { id: planDoc.id, ...planDoc.data(), _source: SOURCE_SAVED_WORKOUT_PLANS },
        seenDedupeKeys,
        mergedPlans,
      );
    });
    return null;
  } catch (error) {
    return error;
  }
}

/**
 * Convert a Timestamp / date string into epoch millis, or null.
 */
function dateValueToMillis(dateValue) {
  if (dateValue == null) return null;
  if (typeof dateValue.toDate === 'function') {
    const asDate = dateValue.toDate();
    return asDate ? asDate.getTime() : null;
  }
  const dateObj = new Date(dateValue);
  const time = dateObj.getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Milliseconds used to sort newest-first.
 * Firestore Timestamp objects expose .toDate(); plain strings/numbers use Date().
 */
function sortMillisForPlan(plan) {
  if (!plan) return 0;
  const generatedTime = dateValueToMillis(plan.generatedAt);
  if (generatedTime != null) return generatedTime;
  const createdTime = dateValueToMillis(plan.createdAt);
  if (createdTime != null) return createdTime;
  return 0;
}
