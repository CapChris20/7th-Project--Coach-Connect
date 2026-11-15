// Turns a trainer's manual plan builder draft into Firestore docs and client copies.
// Flow: draft → structured plan rows → trainer_workout_plans → users/{clientId}/workoutPlans/{planId}.
// Used by ManualWorkoutPlanBuilderScreen. Collection and field letters stay frozen.

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import {
  searchManualExerciseLibrary,
  filterManualExerciseLibrary,
  inferExerciseEquipment,
} from './builtInExerciseList';

export { inferExerciseEquipment };

// ===== NAMED CONSTANTS =====

/** Firestore collection for trainer-owned manual plans. Letters must stay. */
export const TRAINER_WORKOUT_PLANS_COLLECTION = 'trainer_workout_plans';

const USERS_COLLECTION = 'users';
const WORKOUT_PLANS_SUBCOLLECTION = 'workoutPlans';
const MANUAL_BUILDER_SOURCE = 'manualBuilder';
const MANUAL_PLAN_KIND = 'manual';
const MANUAL_PLAN_GOAL = 'manual';
const PLAN_STATUS_ACTIVE = 'active';
const DEFAULT_PLAN_TYPE = 'Custom';
const DEFAULT_DURATION_LABEL = '4 weeks';
const DEFAULT_DURATION_WEEKS = 4;
const ONGOING_DURATION_WEEKS = 12;
const MAX_DURATION_WEEKS = 52;
const MIN_DURATION_WEEKS = 1;
const DEFAULT_SESSION_MINUTES = 50;
const DEFAULT_SETS_COUNT = 3;
const DEFAULT_REPS_SINGLE = 10;
const DEFAULT_REPS_MIN = 8;
const DEFAULT_REPS_MAX = 12;
const DEFAULT_REST_SECONDS = 120;
const EMPTY_REPS_LABEL = '—';
const EMPTY_REST_LABEL = '—';
const DEFAULT_EXERCISE_NAME = 'Exercise';
const FOCUS_COLOR_PINK = 'pink';
const LOCAL_ID_RANDOM_SLICE_END = 9;
const LOCAL_ID_RANDOM_SLICE_START = 2;
// Manipulate here: Firestore writeBatch hard limit is 500; stay under with margin
const FIRESTORE_BATCH_LIMIT = 400;
const DAYS_IN_WEEK = 7;
const SECONDS_PER_MINUTE = 60;
const DEFAULT_LIST_MAX = 50;
const MIN_TRAINING_DAY_COUNT = 1;
const PAD_REST_SECONDS_TO_TWO = 2;
const PAD_REST_SECONDS_CHAR = '0';

// Day-name → short label used by the plan viewer (MON…SUN). Do not rename keys.
const DAY_NAME_TO_SHORT = {
  sunday: 'SUN',
  monday: 'MON',
  tuesday: 'TUE',
  wednesday: 'WED',
  thursday: 'THU',
  friday: 'FRI',
  saturday: 'SAT',
};

const SHORT_DAY_CYCLE = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// ===== HELPER FUNCTIONS =====

/**
 * Local-only id for a new day or exercise row before Firestore assigns a real id.
 * @param {string} [prefix='id']
 * @returns {string}
 */
export function newLocalId(prefix = 'id') {
  // 1. Time part so ids sort roughly by creation.
  const timePart = Date.now().toString(36);
  // 2. Random slice so two taps in the same ms still get unique ids.
  const randomPart = Math.random()
    .toString(36)
    .slice(LOCAL_ID_RANDOM_SLICE_START, LOCAL_ID_RANDOM_SLICE_END);
  return `${prefix}_${timePart}_${randomPart}`;
}

/**
 * Parse "4 weeks" / "Ongoing" into a week count (1–52). Empty → 4. Ongoing → 12.
 * @param {string} durationLabel
 * @returns {number}
 */
export function parseDurationWeeks(durationLabel) {
  // 1. Empty label → default four weeks.
  const labelText = String(durationLabel || '').toLowerCase();
  if (!labelText.trim()) return DEFAULT_DURATION_WEEKS;

  // 2. "Ongoing" programs store twelve weeks as the planning horizon.
  if (labelText.includes('ongoing')) return ONGOING_DURATION_WEEKS;

  // 3. First digit run in the label, clamped to 1–52.
  const digitMatch = labelText.match(/(\d+)/);
  if (!digitMatch) return DEFAULT_DURATION_WEEKS;
  const weeks = parseInt(digitMatch[1], 10);
  if (!Number.isFinite(weeks)) return DEFAULT_DURATION_WEEKS;
  return Math.min(MAX_DURATION_WEEKS, Math.max(MIN_DURATION_WEEKS, weeks));
}

/**
 * Maps manual builder state → CreateWorkoutPlanScreen `structuredPlan.workoutPlan` rows.
 * @param {{ planName: string, planType: string, duration: string, description: string, workoutDays: object[] }} draft
 * @returns {{ overview: string, workoutPlan: object[] }}
 */
export function buildStructuredWorkoutPlanFromManualDraft({
  planName,
  planType,
  duration,
  description,
  workoutDays,
}) {
  // 1. Overview sentence the viewer shows above the days.
  const overviewParts = [
    String(description || '').trim(),
    `Program: ${planName}.`,
    `Focus: ${planType}.`,
    `Duration target: ${duration}.`,
  ].filter(Boolean);
  const overview = overviewParts.join(' ');

  // 2. One structured day per builder day (exercises mapped to viewer shape).
  const workoutPlan = [];
  const days = workoutDays || [];
  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    workoutPlan.push(structuredDayFromDraft(days[dayIndex], dayIndex, planType));
  }

  return { overview, workoutPlan };
}

/**
 * Firestore payload for trainer_workout_plans/{planId}. Field letters stay frozen.
 * @param {object} draft
 * @param {string} trainerId
 * @param {string} planId
 * @returns {object}
 */
export function buildTrainerPlanFirestorePayload(draft, trainerId, planId) {
  // 1. Derive week count, Mon–Sun training flags, and structured viewer rows.
  const durationWeeks = parseDurationWeeks(draft.duration);
  const dayNames = collectDayNamesFromDraft(draft);
  const trainingDays = inferTrainingDayFlags(dayNames);
  const structuredPlan = buildStructuredWorkoutPlanFromManualDraft(draft);
  const planText = JSON.stringify(structuredPlan);
  const assignedClients = uniqueAssignedClientIds(draft.assignedClients);
  const planName = String(draft.planName || '').trim();
  const planType = String(draft.planType || DEFAULT_PLAN_TYPE).trim();

  // 2. One flat doc the trainer list and client mirror both read.
  return {
    id: planId,
    trainerId,
    source: MANUAL_BUILDER_SOURCE,
    planKind: MANUAL_PLAN_KIND,
    planName,
    category: planType,
    duration: String(draft.duration || DEFAULT_DURATION_LABEL),
    durationWeeks,
    description: String(draft.description || '').trim(),
    workoutDays: draft.workoutDays || [],
    assignedClients,
    structuredPlan,
    planText,
    trainingDays,
    daysPerWeek: (draft.workoutDays || []).length || 0,
    totalWeeks: durationWeeks,
    weeksCompleted: 0,
    sessionMinutes: DEFAULT_SESSION_MINUTES,
    title: planName,
    name: planName,
    focus: planType,
    goal: MANUAL_PLAN_GOAL,
    assigned: false,
    updatedAt: serverTimestamp(),
  };
}

/**
 * Client copy under users/{clientId}/workoutPlans/{planId}.
 * @param {object} trainerPayload
 * @param {{ trainerId: string, clientId: string, planId: string }} ids
 * @returns {object}
 */
export function buildClientAssignedPlanDoc(trainerPayload, { trainerId, clientId, planId }) {
  // 1. Mark assigned when this client id is on the trainer payload list.
  const clientIds = trainerPayload.assignedClients || [];
  const clientIsOnAssignedList = clientIds.includes(clientId);
  const assigned = clientIsOnAssignedList || true;

  // 2. Mirror the fields the client workout plan screens already read.
  return {
    id: planId,
    title: trainerPayload.title || trainerPayload.planName,
    name: trainerPayload.name || trainerPayload.planName,
    planText: trainerPayload.planText,
    structuredPlan: trainerPayload.structuredPlan,
    trainerId,
    trainerPlanId: planId,
    clientId,
    userId: clientId,
    source: MANUAL_BUILDER_SOURCE,
    planKind: MANUAL_PLAN_KIND,
    category: trainerPayload.category,
    duration: trainerPayload.duration,
    durationWeeks: trainerPayload.durationWeeks,
    trainingDays: trainerPayload.trainingDays,
    daysPerWeek: trainerPayload.daysPerWeek,
    totalWeeks: trainerPayload.totalWeeks,
    weeksCompleted:
      trainerPayload.weeksCompleted != null ? trainerPayload.weeksCompleted : 0,
    sessionMinutes: trainerPayload.sessionMinutes,
    focus: trainerPayload.focus || trainerPayload.category,
    goal: MANUAL_PLAN_GOAL,
    assigned,
    status: PLAN_STATUS_ACTIVE,
    generatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    _source: 'usersSubcollection',
  };
}

// ===== MAIN FUNCTION =====

/**
 * Create a new trainer_workout_plans doc from a builder draft.
 * @param {string} trainerId
 * @param {object} draft
 * @returns {Promise<{success: boolean, planId?: string, error?: string}>}
 */
export async function createManualWorkoutPlan(trainerId, draft) {
  // 1. Fail fast when Firestore or trainer id is missing.
  if (!db || !trainerId) return { success: false, error: 'Missing db or trainer' };

  // 2. New auto-id under trainer_workout_plans, then write the full payload.
  const planRef = doc(collection(db, TRAINER_WORKOUT_PLANS_COLLECTION));
  const planId = planRef.id;
  const draftWithClients = {
    ...draft,
    assignedClients: draft.assignedClients || [],
  };
  await setDoc(planRef, {
    ...buildTrainerPlanFirestorePayload(draftWithClients, trainerId, planId),
    id: planId,
    createdAt: serverTimestamp(),
  });
  return { success: true, planId };
}

/**
 * Overwrite an existing trainer plan (same id). Keeps createdAt when present.
 * @param {string} trainerId
 * @param {string} planId
 * @param {object} draft
 * @returns {Promise<{success: boolean, planId?: string, error?: string}>}
 */
export async function updateManualWorkoutPlan(trainerId, planId, draft) {
  // 1. Need db + both ids.
  if (!db || !trainerId || !planId) return { success: false, error: 'Missing ids' };

  // 2. Load existing; refuse if missing or owned by someone else.
  const planRef = doc(db, TRAINER_WORKOUT_PLANS_COLLECTION, planId);
  const snapshot = await getDoc(planRef);
  if (!snapshot.exists()) return { success: false, error: 'Plan not found' };
  const existingData = snapshot.data() || {};
  if (String(existingData.trainerId) !== String(trainerId)) {
    return { success: false, error: 'Forbidden' };
  }

  // 3. Merge draft clients over existing when the draft omitted the field.
  // Prefer draft.assignedClients when present (including []); else keep existing; else [].
  let assignedClients = [];
  if (draft.assignedClients != null) {
    assignedClients = draft.assignedClients;
  } else if (existingData.assignedClients != null) {
    assignedClients = existingData.assignedClients;
  }
  await setDoc(
    planRef,
    {
      ...buildTrainerPlanFirestorePayload(
        { ...draft, assignedClients },
        trainerId,
        planId,
      ),
      id: planId,
      createdAt: existingData.createdAt || serverTimestamp(),
    },
    { merge: true },
  );
  return { success: true, planId };
}

/**
 * Load one trainer plan if the caller owns it (or trainerId is omitted).
 * @param {string} trainerId
 * @param {string} planId
 * @returns {Promise<object|null>}
 */
export async function getManualWorkoutPlan(trainerId, planId) {
  // 1. Fail soft when db or plan id is missing.
  if (!db || !planId) return null;

  // 2. Read the doc; hide it when a trainerId was passed and does not match.
  const snapshot = await getDoc(doc(db, TRAINER_WORKOUT_PLANS_COLLECTION, planId));
  if (!snapshot.exists()) return null;
  const planData = snapshot.data() || {};
  if (trainerId && String(planData.trainerId) !== String(trainerId)) return null;
  return { id: snapshot.id, ...planData };
}

async function tryListManualPlansFallback(trainerId, max) {
  try {
    return await listManualPlansWithoutCompoundIndex(trainerId, max);
  } catch (fallbackError) {
    let fallbackMessage = fallbackError;
    if (fallbackError != null && fallbackError.message) {
      fallbackMessage = fallbackError.message;
    }
    console.warn('listManualWorkoutPlansForTrainer:', fallbackMessage);
    return [];
  }
}

/**
 * List this trainer's manual-builder plans, newest first.
 * @param {string} trainerId
 * @param {number} [max=50]
 * @returns {Promise<object[]>}
 */
export async function listManualWorkoutPlansForTrainer(trainerId, max = DEFAULT_LIST_MAX) {
  // 1. Empty list when we cannot query.
  if (!db || !trainerId) return [];

  // 2. Prefer the compound index (trainerId + source + updatedAt).
  try {
    const indexedQuery = query(
      collection(db, TRAINER_WORKOUT_PLANS_COLLECTION),
      where('trainerId', '==', trainerId),
      where('source', '==', MANUAL_BUILDER_SOURCE),
      orderBy('updatedAt', 'desc'),
    );
    const snapshot = await getDocs(indexedQuery);
    return collectPlansFromSnapshotUpToMax(snapshot, max);
  } catch (_indexedQueryError) {
    // 3. Fallback when the composite index is missing — filter source in memory.
    return tryListManualPlansFallback(trainerId, max);
  }
}

/**
 * Writes / merges client copies under users/{clientId}/workoutPlans/{planId}.
 * Also refreshes the trainer_workout_plans doc.
 * @param {string} trainerId
 * @param {string} planId
 * @param {object} draft
 * @returns {Promise<{success: boolean, planId?: string, assignedClients?: string[], error?: string}>}
 */
export async function syncManualPlanAssignments(trainerId, planId, draft) {
  // 1. Need db + ids; refuse missing / foreign plans.
  if (!db || !trainerId || !planId) {
    return { success: false, error: 'Missing parameters' };
  }
  const baseRef = doc(db, TRAINER_WORKOUT_PLANS_COLLECTION, planId);
  const snapshot = await getDoc(baseRef);
  if (!snapshot.exists()) return { success: false, error: 'Plan not found' };
  const previousData = snapshot.data() || {};
  if (String(previousData.trainerId) !== String(trainerId)) {
    return { success: false, error: 'Forbidden' };
  }

  // 2. Refresh the trainer-owned plan doc with the new client list.
  const clientIds = uniqueAssignedClientIds(draft.assignedClients);
  const payload = buildTrainerPlanFirestorePayload(
    { ...draft, assignedClients: clientIds },
    trainerId,
    planId,
  );
  await setDoc(
    baseRef,
    {
      ...payload,
      assignedClients: clientIds,
      assigned: clientIds.length > 0,
      createdAt: previousData.createdAt || serverTimestamp(),
    },
    { merge: true },
  );

  // 3. Diff previous vs new client lists.
  const previousClients = Array.isArray(previousData.assignedClients)
    ? previousData.assignedClients
    : [];
  const removedClientIds = clientsRemovedFromList(previousClients, clientIds);
  const addedClientIds = clientsAddedToList(previousClients, clientIds);
  const keptClientIds = clientsKeptOnBothLists(previousClients, clientIds);

  // 4. Delete removed client copies; write added + kept.
  await deleteClientPlanCopiesInBatches(removedClientIds, planId);
  const writeClientIds = uniqueAssignedClientIds([...addedClientIds, ...keptClientIds]);
  await writeClientPlanCopiesInBatches(writeClientIds, payload, trainerId, planId);

  return { success: true, planId, assignedClients: clientIds };
}

/**
 * Create (if needed) then sync assignments — one save path for the builder screen.
 * @param {string} trainerId
 * @param {object} draft
 * @param {string|null|undefined} existingPlanId
 * @returns {Promise<{success: boolean, planId?: string, assignedClients?: string[], error?: string}>}
 */
export async function saveManualPlanDraft(trainerId, draft, existingPlanId) {
  // 1. Need a trainer and a live db.
  if (!db || !trainerId) return { success: false, error: 'Missing trainer' };

  // 2. First save creates a trainer_workout_plans doc and returns its id.
  let planId = existingPlanId;
  if (!planId) {
    const created = await createManualWorkoutPlan(trainerId, draft);
    if (!created.success) return created;
    planId = created.planId;
  }

  // 3. Refresh the trainer doc and mirror copies under each assigned client.
  return syncManualPlanAssignments(trainerId, planId, draft);
}

/**
 * Delete the trainer plan and every client copy under users/.../workoutPlans.
 * @param {string} trainerId
 * @param {string} planId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteManualWorkoutPlan(trainerId, planId) {
  // 1. Need db + ids; refuse missing / foreign plans.
  if (!db || !trainerId || !planId) {
    return { success: false, error: 'Missing parameters' };
  }
  const planRef = doc(db, TRAINER_WORKOUT_PLANS_COLLECTION, planId);
  const snapshot = await getDoc(planRef);
  if (!snapshot.exists()) return { success: false, error: 'Not found' };
  const planData = snapshot.data() || {};
  if (String(planData.trainerId) !== String(trainerId)) {
    return { success: false, error: 'Forbidden' };
  }

  // 2. Delete every client copy, then the trainer-owned doc.
  const clientIds = Array.isArray(planData.assignedClients)
    ? planData.assignedClients
    : [];
  await deleteClientPlanCopiesInBatches(clientIds, planId);
  await deleteDoc(planRef);
  return { success: true };
}

/**
 * Thin wrapper so the builder screen does not import the library helper directly.
 * @param {string} query
 * @param {number} limit
 * @param {object} [filters]
 * @returns {Array}
 */
export function searchExercisesForBuilder(query, limit, filters = {}) {
  let muscleChip = null;
  if (filters != null && filters.muscle) {
    muscleChip = filters.muscle;
  }

  let equipmentChips = [];
  if (filters != null && Array.isArray(filters.equipments)) {
    equipmentChips = filters.equipments;
  }

  const hasChipFilters = Boolean(muscleChip) || equipmentChips.length > 0;

  // 1. PNG 21 muscle/equipment pills — run filtered search.
  if (hasChipFilters) {
    return filterManualExerciseLibrary({
      query,
      muscle: muscleChip,
      equipments: equipmentChips,
      limit,
    });
  }

  // 2. Search box only — rank by substring score.
  return searchManualExerciseLibrary(query, limit);
}

/**
 * Hydrates builder UI state from a Firestore trainer plan doc.
 * @param {object} docData
 * @returns {object|null}
 */
export function draftFromTrainerPlanDoc(docData) {
  // 1. Refuse non-objects.
  if (!docData || typeof docData !== 'object') return null;

  // 2. Rebuild each day/exercise into builder-editable rows.
  const workoutDays = [];
  if (Array.isArray(docData.workoutDays)) {
    for (let dayIndex = 0; dayIndex < docData.workoutDays.length; dayIndex += 1) {
      workoutDays.push(builderDayFromSavedDoc(docData.workoutDays[dayIndex], dayIndex));
    }
  }

  // 3. Flat draft the ManualWorkoutPlanBuilderScreen form expects.
  return {
    planName: docData.planName || docData.title || '',
    planType: docData.category || docData.planType || DEFAULT_PLAN_TYPE,
    duration: docData.duration || DEFAULT_DURATION_LABEL,
    description: docData.description || '',
    workoutDays,
    assignedClients: Array.isArray(docData.assignedClients)
      ? [...docData.assignedClients]
      : [],
  };
}

// ===== PLUMBING — skip unless debugging =====

/**
 * Day names from a draft's workoutDays rows (for training-day inference).
 * @param {object} draft
 * @returns {string[]}
 */
function collectDayNamesFromDraft(draft) {
  const dayNames = [];
  const days = draft.workoutDays || [];
  for (let index = 0; index < days.length; index += 1) {
    dayNames.push(days[index].dayName);
  }
  return dayNames;
}

/**
 * Clients on previous list but not on the new list.
 * @param {string[]} previousClients
 * @param {string[]} newClients
 * @returns {string[]}
 */
function clientsRemovedFromList(previousClients, newClients) {
  const removed = [];
  for (let index = 0; index < previousClients.length; index += 1) {
    const clientId = previousClients[index];
    if (!newClients.includes(clientId)) {
      removed.push(clientId);
    }
  }
  return removed;
}

/**
 * Clients on the new list but not on the previous list.
 * @param {string[]} previousClients
 * @param {string[]} newClients
 * @returns {string[]}
 */
function clientsAddedToList(previousClients, newClients) {
  const added = [];
  for (let index = 0; index < newClients.length; index += 1) {
    const clientId = newClients[index];
    if (!previousClients.includes(clientId)) {
      added.push(clientId);
    }
  }
  return added;
}

/**
 * Clients present on both lists (still need a refreshed copy).
 * @param {string[]} previousClients
 * @param {string[]} newClients
 * @returns {string[]}
 */
function clientsKeptOnBothLists(previousClients, newClients) {
  const kept = [];
  for (let index = 0; index < newClients.length; index += 1) {
    const clientId = newClients[index];
    if (previousClients.includes(clientId)) {
      kept.push(clientId);
    }
  }
  return kept;
}

/**
 * Collect plan rows from a query snapshot up to `max`.
 * @param {object} snapshot
 * @param {number} max
 * @returns {object[]}
 */
function collectPlansFromSnapshotUpToMax(snapshot, max) {
  const plans = [];
  snapshot.forEach((planDoc) => {
    if (plans.length >= max) return;
    plans.push({ id: planDoc.id, ...planDoc.data() });
  });
  return plans;
}

/**
 * Strip "Day 1 — " style prefixes so "Monday" still maps to MON.
 * @param {string} rawDayLabel
 * @returns {string}
 */
function dayNameKeyWithoutDayPrefix(rawDayLabel) {
  return String(rawDayLabel || '')
    .toLowerCase()
    .replace(/^day\s*\d+\s*[—\-–:]*\s*/i, '')
    .trim();
}

/**
 * Map a free-text day label to MON…SUN when possible.
 * @param {string} dayLabel
 * @param {number} fallbackIndex
 * @returns {string}
 */
function shortDayLabelForBuilderDay(dayLabel, fallbackIndex) {
  const key = dayNameKeyWithoutDayPrefix(dayLabel);
  const fromName = DAY_NAME_TO_SHORT[key];
  if (fromName) return fromName;
  return SHORT_DAY_CYCLE[fallbackIndex % SHORT_DAY_CYCLE.length];
}

/**
 * Build seven Mon→Sun booleans from day names the trainer typed.
 * If no weekday names match, mark the first N days true instead.
 * @param {string[]} dayNames
 * @returns {boolean[]}
 */
function inferTrainingDayFlags(dayNames) {
  const flags = [false, false, false, false, false, false, false];
  let foundAnyWeekdayName = false;
  const safeDayNames = dayNames || [];

  for (let index = 0; index < safeDayNames.length; index += 1) {
    const key = dayNameKeyWithoutDayPrefix(safeDayNames[index]);
    const shortLabel = DAY_NAME_TO_SHORT[key];
    if (!shortLabel) continue;
    const cycleIndex = SHORT_DAY_CYCLE.indexOf(shortLabel);
    if (cycleIndex < 0) continue;
    flags[cycleIndex] = true;
    foundAnyWeekdayName = true;
  }

  if (foundAnyWeekdayName) return flags;

  const howManyDays = Math.min(
    DAYS_IN_WEEK,
    Math.max(MIN_TRAINING_DAY_COUNT, safeDayNames.length),
  );
  for (let dayIndex = 0; dayIndex < howManyDays; dayIndex += 1) {
    flags[dayIndex] = true;
  }
  return flags;
}

/**
 * Show reps as "10", "8-12", or "—" for empty.
 * @param {*} reps
 * @returns {string}
 */
function formatRepsLabel(reps) {
  if (reps == null) return EMPTY_REPS_LABEL;
  if (typeof reps === 'number' && Number.isFinite(reps)) return String(reps);

  const repsIsRangeObject =
    typeof reps === 'object' && reps.min != null && reps.max != null;
  if (repsIsRangeObject) {
    if (Number(reps.min) === Number(reps.max)) return String(reps.min);
    return `${reps.min}-${reps.max}`;
  }

  return String(reps);
}

/**
 * Show rest as "2 min", "1:30", "45s", or "—".
 * @param {*} restSeconds
 * @returns {string}
 */
function formatRestLabel(restSeconds) {
  const seconds = Number(restSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return EMPTY_REST_LABEL;

  const isWholeMinutes = seconds % SECONDS_PER_MINUTE === 0;
  if (isWholeMinutes) {
    return `${seconds / SECONDS_PER_MINUTE} min`;
  }

  if (seconds < SECONDS_PER_MINUTE) {
    return `${seconds}s`;
  }

  return formatMinutesAndLeftoverSeconds(seconds);
}

/**
 * Format rest that is at least one minute but not a whole number of minutes.
 * @param {number} seconds
 * @returns {string}
 */
function formatMinutesAndLeftoverSeconds(seconds) {
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const leftoverSeconds = seconds % SECONDS_PER_MINUTE;
  if (!leftoverSeconds) return `${minutes} min`;
  const paddedSeconds = String(leftoverSeconds).padStart(
    PAD_REST_SECONDS_TO_TWO,
    PAD_REST_SECONDS_CHAR,
  );
  return `${minutes}:${paddedSeconds}`;
}

/**
 * One exercise row in the structured plan viewer shape.
 * @param {object} exerciseDraft
 * @param {string} planType
 * @returns {object}
 */
function structuredExerciseFromDraft(exerciseDraft, planType) {
  const setsNumber = Number(exerciseDraft.sets);
  const setsLabel =
    Number.isFinite(setsNumber) && setsNumber > 0 ? String(setsNumber) : '1';
  const notesText = joinExerciseNoteLines(exerciseDraft);
  const firstMuscle =
    (exerciseDraft.muscleGroups && exerciseDraft.muscleGroups[0]) || planType || '';

  return {
    name: String(exerciseDraft.exerciseName || '').trim() || DEFAULT_EXERCISE_NAME,
    sets: setsLabel,
    reps: formatRepsLabel(exerciseDraft.reps),
    rest: formatRestLabel(exerciseDraft.restSeconds),
    muscle: firstMuscle,
    notes: notesText || undefined,
  };
}

/**
 * Join free-text notes + tempo/load/progression lines for the viewer.
 * @param {object} exerciseDraft
 * @returns {string}
 */
function joinExerciseNoteLines(exerciseDraft) {
  const notesParts = [
    exerciseDraft.notes,
    exerciseDraft.tempo ? `Tempo: ${exerciseDraft.tempo}` : '',
    exerciseDraft.weight ? `Target load: ${exerciseDraft.weight}` : '',
    exerciseDraft.progression ? `Progression: ${exerciseDraft.progression}` : '',
  ].filter(Boolean);
  return notesParts.join('\n');
}

/**
 * One day row in the structured plan viewer shape.
 * @param {object} dayDraft
 * @param {number} dayIndex
 * @param {string} planType
 * @returns {object}
 */
function structuredDayFromDraft(dayDraft, dayIndex, planType) {
  const dayLabel = String(
    dayDraft.dayName || `Day ${dayDraft.dayNumber || dayIndex + 1}`,
  ).trim();
  const shortLabel = shortDayLabelForBuilderDay(dayLabel, dayIndex);
  const exercises = [];
  const rawExercises = dayDraft.exercises || [];
  for (let exerciseIndex = 0; exerciseIndex < rawExercises.length; exerciseIndex += 1) {
    exercises.push(structuredExerciseFromDraft(rawExercises[exerciseIndex], planType));
  }

  return {
    short: shortLabel,
    day: dayLabel,
    focus: `${planType} — ${dayLabel}`,
    focusColor: FOCUS_COLOR_PINK,
    rest: exercises.length === 0,
    exercises,
  };
}

/**
 * Unique non-empty client ids from a draft.
 * @param {string[]|undefined} assignedClients
 * @returns {string[]}
 */
function uniqueAssignedClientIds(assignedClients) {
  if (!Array.isArray(assignedClients)) return [];
  const uniqueIds = [];
  const seen = new Set();
  for (let index = 0; index < assignedClients.length; index += 1) {
    const clientId = assignedClients[index];
    if (!clientId) continue;
    if (seen.has(clientId)) continue;
    seen.add(clientId);
    uniqueIds.push(clientId);
  }
  return uniqueIds;
}

/**
 * Split an array into chunks of at most `chunkSize` (Firestore batch limit).
 * @param {Array} items
 * @param {number} chunkSize
 * @returns {Array[]}
 */
function splitIdsIntoFirestoreBatches(items, chunkSize) {
  const chunks = [];
  for (let start = 0; start < items.length; start += chunkSize) {
    chunks.push(items.slice(start, start + chunkSize));
  }
  return chunks;
}

/**
 * Sort trainer plan rows newest-first by updatedAt / createdAt millis.
 * @param {object[]} rows
 * @returns {void}
 */
/**
 * Firestore Timestamp millis when the field has toMillis(); else 0.
 * @param {object|undefined} timestampField
 * @returns {number}
 */
function millisFromTimestampField(timestampField) {
  if (timestampField == null) return 0;
  if (typeof timestampField.toMillis !== 'function') return 0;
  return timestampField.toMillis();
}

/**
 * Newest-sort key for a plan row: updatedAt first, then createdAt, else 0.
 * @param {object} planRow
 * @returns {number}
 */
function planRowSortTimeMillis(planRow) {
  const updatedMillis = millisFromTimestampField(planRow.updatedAt);
  if (updatedMillis) return updatedMillis;
  return millisFromTimestampField(planRow.createdAt);
}

function sortPlansNewestFirst(rows) {
  rows.sort((left, right) => {
    const leftTime = planRowSortTimeMillis(left);
    const rightTime = planRowSortTimeMillis(right);
    return rightTime - leftTime;
  });
}

/**
 * Fallback list when the compound index query fails: filter source in memory.
 * @param {string} trainerId
 * @param {number} max
 * @returns {Promise<object[]>}
 */
async function listManualPlansWithoutCompoundIndex(trainerId, max) {
  const fallbackQuery = query(
    collection(db, TRAINER_WORKOUT_PLANS_COLLECTION),
    where('trainerId', '==', trainerId),
  );
  const snapshot = await getDocs(fallbackQuery);
  const rows = [];
  snapshot.forEach((planDoc) => {
    const planData = planDoc.data() || {};
    if (String(planData.source) === MANUAL_BUILDER_SOURCE) {
      rows.push({ id: planDoc.id, ...planData });
    }
  });
  sortPlansNewestFirst(rows);
  return rows.slice(0, max);
}

/**
 * Delete client plan copies in batches of FIRESTORE_BATCH_LIMIT.
 * @param {string[]} clientIds
 * @param {string} planId
 * @returns {Promise<void>}
 */
async function deleteClientPlanCopiesInBatches(clientIds, planId) {
  const groups = splitIdsIntoFirestoreBatches(clientIds, FIRESTORE_BATCH_LIMIT);
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const batch = writeBatch(db);
    const group = groups[groupIndex];
    for (let clientIndex = 0; clientIndex < group.length; clientIndex += 1) {
      const clientId = group[clientIndex];
      batch.delete(
        doc(db, USERS_COLLECTION, clientId, WORKOUT_PLANS_SUBCOLLECTION, planId),
      );
    }
    await batch.commit();
  }
}

/**
 * Write / merge client plan copies in batches of FIRESTORE_BATCH_LIMIT.
 * @param {string[]} clientIds
 * @param {object} trainerPayload
 * @param {string} trainerId
 * @param {string} planId
 * @returns {Promise<void>}
 */
async function writeClientPlanCopiesInBatches(clientIds, trainerPayload, trainerId, planId) {
  const groups = splitIdsIntoFirestoreBatches(clientIds, FIRESTORE_BATCH_LIMIT);
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const batch = writeBatch(db);
    const group = groups[groupIndex];
    for (let clientIndex = 0; clientIndex < group.length; clientIndex += 1) {
      const clientId = group[clientIndex];
      const clientDoc = buildClientAssignedPlanDoc(trainerPayload, {
        trainerId,
        clientId,
        planId,
      });
      batch.set(
        doc(db, USERS_COLLECTION, clientId, WORKOUT_PLANS_SUBCOLLECTION, planId),
        clientDoc,
        { merge: true },
      );
    }
    await batch.commit();
  }
}

/**
 * Hydrate one exercise row for the builder UI from a saved Firestore exercise.
 * @param {object} exerciseDoc
 * @returns {object}
 */
function builderExerciseFromSavedDoc(exerciseDoc) {
  const repsIsObject =
    exerciseDoc.reps != null && typeof exerciseDoc.reps === 'object';
  const repsMin = repsIsObject ? Number(exerciseDoc.reps.min) : NaN;
  const repsMax = repsIsObject ? Number(exerciseDoc.reps.max) : NaN;
  const repsAreFixed =
    Number.isFinite(repsMin) && Number.isFinite(repsMax) && repsMin === repsMax;

  const setsNumber =
    typeof exerciseDoc.sets === 'number'
      ? exerciseDoc.sets
      : parseInt(exerciseDoc.sets, 10) || DEFAULT_SETS_COUNT;

  const restSeconds =
    typeof exerciseDoc.restSeconds === 'number'
      ? exerciseDoc.restSeconds
      : DEFAULT_REST_SECONDS;

  return {
    id: exerciseDoc.exerciseId || newLocalId('ex'),
    libraryExerciseId: exerciseDoc.libraryExerciseId || null,
    exerciseName: exerciseDoc.exerciseName || '',
    sets: setsNumber,
    repMode: repsAreFixed ? 'fixed' : 'range',
    repsSingle: repsAreFixed ? repsMin : DEFAULT_REPS_SINGLE,
    repsMin: Number.isFinite(repsMin) ? repsMin : DEFAULT_REPS_MIN,
    repsMax: Number.isFinite(repsMax) ? repsMax : DEFAULT_REPS_MAX,
    restSeconds,
    notes: exerciseDoc.notes || '',
    tempo: exerciseDoc.tempo || '',
    weight: exerciseDoc.weight != null ? String(exerciseDoc.weight) : '',
    progression: exerciseDoc.progression || '',
    muscleGroups: exerciseDoc.muscleGroups || [],
    setDetails: Array.isArray(exerciseDoc.setDetails) ? exerciseDoc.setDetails : [],
  };
}

/**
 * Hydrate one workout day for the builder UI from a saved Firestore day.
 * @param {object} dayDoc
 * @param {number} dayIndex
 * @returns {object}
 */
function builderDayFromSavedDoc(dayDoc, dayIndex) {
  const exercises = [];
  if (Array.isArray(dayDoc.exercises)) {
    for (let exerciseIndex = 0; exerciseIndex < dayDoc.exercises.length; exerciseIndex += 1) {
      exercises.push(builderExerciseFromSavedDoc(dayDoc.exercises[exerciseIndex]));
    }
  }
  let dayNumber = dayIndex + 1;
  if (dayDoc.dayNumber != null) {
    dayNumber = dayDoc.dayNumber;
  }

  return {
    id: dayDoc.dayId || newLocalId('day'),
    dayName: dayDoc.dayName || `Day ${dayIndex + 1}`,
    dayNumber,
    exercises,
  };
}
