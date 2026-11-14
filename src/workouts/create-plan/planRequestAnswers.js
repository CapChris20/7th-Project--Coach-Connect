// Builds the small JSON body sent to /api/workout/generate.
// Flow: normalize profile → copy only prompt fields → strip Firestore types → clamp days per week.
// Used by askForWorkoutPlan. Field list must stay in sync with server/lib/workoutPlanPrompt.js.
// Export name stays frozen: buildWorkoutOnboardingPayload.

import { normalizeClientProfileFields } from '../../helpers/fillTraineeProfile';

// ===== NAMED CONSTANTS =====

// Letters frozen — server prompt reads these exact keys.
const WORKOUT_ONBOARDING_FIELDS = [
  'age',
  'gender',
  'weight',
  'height',
  'fitnessLevel',
  'primaryGoal',
  'equipmentAccess',
  'daysPerWeek',
  'injuries',
  'exercisesDislike',
  'preferredWorkoutTime',
  'trainingEnvironment',
  'currentStressLevel',
  'sleepQuality',
  'energyLevels',
  'supplementsCurrentlyTaking',
  'hydrationHabits',
  'situationDescription',
];

// Manipulate here: a week only has seven training days.
const MIN_DAYS_PER_WEEK = 1;
const MAX_DAYS_PER_WEEK = 7;

// ===== MAIN RECIPE (export) =====

/**
 * Strip extra user-doc fields before POSTing to /api/workout/generate.
 * @param {object} data
 * @returns {object}
 */
export function buildWorkoutOnboardingPayload(data) {
  // 1. Guard non-objects so normalize never sees null / a string.
  let safeInput = {};
  if (dataIsPlainObject(data)) {
    safeInput = data;
  }

  // 2. Shared trainee normalizer (same keys as profile screens).
  const profile = normalizeClientProfileFields(safeInput);

  // 3. Copy only fields the workout prompt cares about; skip undefined/null.
  const payload = copyOnboardingFieldsOntoPayload(profile);

  // 4. Overwrite daysPerWeek with a clamped integer when we can resolve one.
  const daysPerWeek = resolveDaysPerWeek(profile);
  if (daysPerWeek != null) {
    payload.daysPerWeek = daysPerWeek;
  }

  return payload;
}

// ===== PLUMBING — skip unless debugging =====

function dataIsPlainObject(data) {
  return data != null && typeof data === 'object';
}

/**
 * Walk the frozen field list and attach plain JSON-safe values.
 * @param {object} profile
 * @returns {object}
 */
function copyOnboardingFieldsOntoPayload(profile) {
  const payload = {};
  for (const fieldName of WORKOUT_ONBOARDING_FIELDS) {
    const fieldValue = profile[fieldName];
    if (fieldValue === undefined || fieldValue === null) continue;
    payload[fieldName] = firestoreValueToPlain(fieldValue);
  }
  return payload;
}

/**
 * Firestore Timestamp objects have toDate(). Plain JSON does not.
 * @param {unknown} value
 * @returns {boolean}
 */
function isFirestoreTimestamp(value) {
  if (typeof value !== 'object' || value == null) return false;
  return typeof value.toDate === 'function';
}

/**
 * Some Firestore values expose toJSON() instead of toDate().
 * @param {unknown} value
 * @returns {boolean}
 */
function valueHasToJson(value) {
  if (typeof value !== 'object' || value == null) return false;
  return typeof value.toJSON === 'function';
}

/**
 * @param {object} plainObject
 * @returns {object}
 */
function copyPlainObject(plainObject) {
  const copy = {};
  for (const [fieldName, fieldValue] of Object.entries(plainObject)) {
    if (fieldValue === undefined) continue;
    copy[fieldName] = firestoreValueToPlain(fieldValue);
  }
  return copy;
}

/**
 * Recursively turn Firestore class instances into JSON-safe plain values.
 * @param {unknown} value
 * @returns {unknown}
 */
function firestoreValueToPlain(value) {
  if (value == null) return value;

  if (isFirestoreTimestamp(value)) {
    return timestampToIsoOrString(value);
  }

  if (valueHasToJson(value)) {
    const jsonResult = tryCallToJson(value);
    if (jsonResult.didSucceed) return jsonResult.result;
  }

  if (Array.isArray(value)) {
    return plainArrayFromFirestore(value);
  }

  if (objectTagIsPlainObject(value)) {
    return copyPlainObject(value);
  }

  return value;
}

function timestampToIsoOrString(timestampValue) {
  try {
    return timestampValue.toDate().toISOString();
  } catch (_timestampError) {
    return String(timestampValue);
  }
}

function tryCallToJson(value) {
  try {
    return { didSucceed: true, result: value.toJSON() };
  } catch (_jsonError) {
    // Fall through — array/object handling will try next.
    return { didSucceed: false, result: null };
  }
}

function plainArrayFromFirestore(valueList) {
  const plainItems = [];
  for (const item of valueList) {
    plainItems.push(firestoreValueToPlain(item));
  }
  return plainItems;
}

function objectTagIsPlainObject(value) {
  const tag = Object.prototype.toString.call(value);
  return tag === '[object Object]';
}

/**
 * daysPerWeek, frequency, and workoutsPerWeek all mean the same answer.
 * Out-of-range numbers are dropped so the prompt does not invent an 8-day week.
 * vocab/symbol: ?? = if left is null/undefined, try the next (0 days must survive if ever stored)
 * @param {object} profile
 * @returns {number|null}
 */
function resolveDaysPerWeek(profile) {
  const normalizedProfile = normalizeClientProfileFields(profile);
  const rawDays =
    normalizedProfile.daysPerWeek
    ?? normalizedProfile.frequency
    ?? normalizedProfile.workoutsPerWeek;

  if (rawDays == null || rawDays === '') return null;

  const numericDays = Number(rawDays);
  if (!Number.isFinite(numericDays)) return null;

  const roundedDays = Math.round(numericDays);
  const daysAreInRange =
    roundedDays >= MIN_DAYS_PER_WEEK && roundedDays <= MAX_DAYS_PER_WEEK;
  if (!daysAreInRange) return null;

  return roundedDays;
}
