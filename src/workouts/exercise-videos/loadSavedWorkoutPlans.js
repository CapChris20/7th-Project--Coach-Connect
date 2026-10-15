// Loads every workout plan a client should see in the AI Workout Library.
// Flow: mirror "current" into the library if needed → saved subcollection → current doc → legacy global + savedWorkoutPlans → optional trainer filter → newest first.
// Used by: the client workout library screen (and the trainer dashboard when trainerId is passed).

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
import { fetchSavedWorkoutPlans, getCurrentWorkoutPlan, setCurrentWorkoutPlan } from '../create-plan/saveAndLoadWorkoutPlan';

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
const DEDUPE_TEXT_SLICE = 80;
const SAVED_PLANS_LIMIT = 50;

const BENIGN_PERMISSION_CODE = 'permission-denied';
const BENIGN_INDEX_CODE = 'failed-precondition';

const DATE_LABEL_OPTIONS = { month: 'short', day: 'numeric', year: 'numeric' };

// ===== HELPER FUNCTIONS =====

function isBenignLoadError(error) {
  if (!error) return false;
  const code = error.code;
  if (code === BENIGN_PERMISSION_CODE || code === BENIGN_INDEX_CODE) return true;
  const messageLower = String(error.message || '').toLowerCase();
  return messageLower.includes('missing or insufficient permissions') || messageLower.includes('index');
}

function planDedupeKey(item) {
  if (item?.id === CURRENT_PLAN_DOC_ID || item?._singleDoc) return DEDUPE_KEY_CURRENT;
  const textSlice = String(item?.rawPlan || item?.planText || '').slice(0, DEDUPE_TEXT_SLICE);
  return `plan:${item?.id || ''}:${textSlice}`;
}

function generatedAtDate(data) {
  if (data.generatedAt?.toDate) return data.generatedAt.toDate();
  if (data.generatedAt) return new Date(data.generatedAt);
  return new Date();
}

function decorateCurrentPlan(data) {
  if (!data?.rawPlan && !data?.planText) return null;
  const when = generatedAtDate(data);
  const label = when.toLocaleDateString(undefined, DATE_LABEL_OPTIONS);
  return {
    id: CURRENT_PLAN_DOC_ID,
    ...data,
    title: data.title || data.name || `Workout plan · ${label}`,
    name: data.name || data.title || `Workout plan · ${label}`,
    planText: data.planText || data.rawPlan,
    rawPlan: data.rawPlan || data.planText,
    source: data.source || SOURCE_GENERATOR,
    status: data.status || PLAN_STATUS_ACTIVE,
    _singleDoc: true,
    _path: data._path,
    _source: data._source || SOURCE_WORKOUT_PLAN_CURRENT,
  };
}

function trainerStampCandidates(plan) {
  return [
    plan.trainerId,
    plan.createdBy,
    plan.assignedBy,
    plan.authorId,
    plan.ownerTrainerId,
    plan._firebase?.trainerId,
  ]
    .filter((value) => value != null && String(value).trim() !== '')
    .map((value) => String(value));
}

function isUnscopedLegacyAiPlan(plan) {
  const sourceName = String(plan.source || plan._source || '');
  return (
    sourceName === SOURCE_GENERATOR ||
    sourceName === SOURCE_GLOBAL ||
    sourceName === SOURCE_SAVED_WORKOUT_PLANS
  );
}

/**
 * Keep plans that explicitly belong to this trainer; also keep plans with no trainer stamp
 * only when they are that trainer's assigned/manual entries (never all clients' AI spam).
 * @param {object} plan
 * @param {string|null} trainerId
 * @returns {boolean}
 */
function planBelongsToTrainer(plan, trainerId) {
  if (!trainerId || !plan) return true;
  const trainerIdText = String(trainerId);
  const candidates = trainerStampCandidates(plan);
  if (candidates.length === 0) {
    if (isUnscopedLegacyAiPlan(plan)) return false;
    return true;
  }
  return candidates.includes(trainerIdText);
}

function rememberFatalError(fatalError, error) {
  if (isBenignLoadError(error)) return fatalError;
  return fatalError || error;
}

function addUniquePlan(item, seenKeys, results) {
  if (!item) return;
  const key = planDedupeKey(item);
  if (seenKeys.has(key)) return;
  seenKeys.add(key);
  results.push(item);
}

function hasCurrentPlanCard(results) {
  return results.some((plan) => plan.id === CURRENT_PLAN_DOC_ID || plan._singleDoc);
}

function currentPlanPath(clientId) {
  return [USERS_COLLECTION, clientId, WORKOUT_PLAN_DOC_COLLECTION, CURRENT_PLAN_DOC_ID];
}

/**
 * One-time mirror for plans saved before library sync existed (client session only).
 * @param {string} clientId
 */
async function ensureCurrentPlanMirroredToLibrary(clientId) {
  if (!clientId || !db || auth?.currentUser?.uid !== clientId) return;
  try {
    const librarySnap = await getDoc(doc(db, USERS_COLLECTION, clientId, WORKOUT_PLANS_SUBCOLLECTION, CURRENT_PLAN_DOC_ID));
    if (librarySnap.exists()) return;
    const current = await getCurrentWorkoutPlan(clientId);
    if (!current?.rawPlan && !current?.planText) return;
    await setCurrentWorkoutPlan(clientId, {
      rawPlan: current.rawPlan || current.planText,
      planText: current.planText || current.rawPlan,
      structuredPlan: current.structuredPlan || null,
      title: current.title || current.name,
      generatedAt: current.generatedAt,
    });
  } catch (_ignoredError) {
    // non-fatal
  }
}

async function loadSavedSubcollectionPlans(clientId, seenKeys, results) {
  try {
    const saved = await fetchSavedWorkoutPlans(clientId, SAVED_PLANS_LIMIT);
    saved.forEach((plan) => addUniquePlan({ ...plan, _source: SOURCE_USERS_SUBCOLLECTION }, seenKeys, results));
    return null;
  } catch (error) {
    return error;
  }
}

async function loadDecoratedCurrentPlan(clientId, seenKeys, results) {
  try {
    const current = await getCurrentWorkoutPlan(clientId);
    const decorated = decorateCurrentPlan({
      ...current,
      _path: currentPlanPath(clientId),
      _source: SOURCE_WORKOUT_PLAN_CURRENT,
    });
    if (decorated) addUniquePlan(decorated, seenKeys, results);
    return null;
  } catch (error) {
    return error;
  }
}

async function loadCurrentPlanDocument(clientId, seenKeys, results) {
  try {
    const snapshot = await getDoc(doc(db, USERS_COLLECTION, clientId, WORKOUT_PLAN_DOC_COLLECTION, CURRENT_PLAN_DOC_ID));
    if (!snapshot.exists()) return null;
    const decorated = decorateCurrentPlan({
      id: snapshot.id,
      ...snapshot.data(),
      _path: currentPlanPath(clientId),
      _source: SOURCE_WORKOUT_PLAN_CURRENT,
    });
    if (decorated) addUniquePlan(decorated, seenKeys, results);
    return null;
  } catch (error) {
    return error;
  }
}

async function queryGlobalPlansForClient(clientId) {
  const globalRef = collection(db, GLOBAL_PLANS_COLLECTION);
  try {
    return await getDocs(query(globalRef, where('clientId', '==', clientId), orderBy('generatedAt', 'desc')));
  } catch (_missingIndex) {
    return await getDocs(query(globalRef, where('clientId', '==', clientId)));
  }
}

async function loadGlobalPlans(clientId, seenKeys, results) {
  try {
    const snapshot = await queryGlobalPlansForClient(clientId);
    snapshot.forEach((planDoc) => {
      addUniquePlan({ id: planDoc.id, ...planDoc.data(), _source: SOURCE_GLOBAL }, seenKeys, results);
    });
    return null;
  } catch (error) {
    return error;
  }
}

async function loadLegacySavedPlans(clientId, seenKeys, results) {
  try {
    const legacyRef = collection(db, LEGACY_SAVED_PLANS_COLLECTION);
    const snapshot = await getDocs(query(legacyRef, where('userId', '==', clientId)));
    snapshot.forEach((planDoc) => {
      addUniquePlan({ id: planDoc.id, ...planDoc.data(), _source: SOURCE_SAVED_WORKOUT_PLANS }, seenKeys, results);
    });
    return null;
  } catch (error) {
    return error;
  }
}

function planSortMillis(plan) {
  return (
    plan.generatedAt?.toDate?.()?.getTime() ??
    (plan.generatedAt ? new Date(plan.generatedAt).getTime() : 0) ??
    plan.createdAt?.toDate?.()?.getTime() ??
    0
  );
}

function sortPlansNewestFirst(plans) {
  plans.sort((leftPlan, rightPlan) => planSortMillis(rightPlan) - planSortMillis(leftPlan));
}

function errorMessageIfEmpty(plans, fatalError) {
  if (plans.length > 0) return null;
  if (!fatalError) return null;
  return String(fatalError.message || fatalError);
}

// ===== MAIN FUNCTION =====

/**
 * Loads all workout plans visible in the AI Workout Library for a client
 * (subcollection, current doc, legacy global + savedWorkoutPlans).
 * @param {string} clientId
 * @param {{ trainerId?: string|null }} [opts]
 * @returns {Promise<{ plans: object[], error: string|null }>}
 */
export async function fetchClientWorkoutPlansForLibrary(clientId, opts = {}) {
  if (!clientId || !db) return { plans: [], error: null };
  const trainerId = opts?.trainerId ? String(opts.trainerId) : null;

  await ensureCurrentPlanMirroredToLibrary(clientId);

  const results = [];
  const seenKeys = new Set();
  let fatalError = null;

  fatalError = rememberFatalError(fatalError, await loadSavedSubcollectionPlans(clientId, seenKeys, results));
  fatalError = rememberFatalError(fatalError, await loadDecoratedCurrentPlan(clientId, seenKeys, results));

  if (!hasCurrentPlanCard(results)) {
    fatalError = rememberFatalError(fatalError, await loadCurrentPlanDocument(clientId, seenKeys, results));
  }

  fatalError = rememberFatalError(fatalError, await loadGlobalPlans(clientId, seenKeys, results));
  fatalError = rememberFatalError(fatalError, await loadLegacySavedPlans(clientId, seenKeys, results));

  const filtered = trainerId ? results.filter((plan) => planBelongsToTrainer(plan, trainerId)) : results;
  sortPlansNewestFirst(filtered);

  return {
    plans: filtered,
    error: errorMessageIfEmpty(filtered, fatalError),
  };
}
