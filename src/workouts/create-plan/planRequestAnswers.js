// Builds the small JSON body sent to /api/workout/generate.
// Flow: copy the profile fields the prompt needs → turn Firestore dates into strings → clamp days per week.
// Used by: askForWorkoutPlan. The field list must stay in sync with server/lib/workoutPlanPrompt.js.

import { normalizeClientProfileFields } from '../../helpers/fillTraineeProfile';

// ===== NAMED CONSTANTS =====

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

// ===== HELPER FUNCTIONS =====

/**
 * Firestore Timestamp objects have toDate(). Plain JSON does not.
 * @param {unknown} value
 * @returns {boolean}
 */
function isFirestoreTimestamp(value) {
  return typeof value === 'object' && value != null && typeof value.toDate === 'function';
}

/**
 * Some Firestore values expose toJSON() instead of toDate().
 * @param {unknown} value
 * @returns {boolean}
 */
function hasToJson(value) {
  return typeof value === 'object' && value != null && typeof value.toJSON === 'function';
}

/**
 * @param {object} plainObject
 * @returns {object}
 */
function copyPlainObject(plainObject) {
  const copy = {};
  for (const [fieldName, fieldValue] of Object.entries(plainObject)) {
    if (fieldValue !== undefined) copy[fieldName] = firestoreValueToPlain(fieldValue);
  }
  return copy;
}

/**
 * Strip Firestore class instances so JSON.stringify will not throw.
 * @param {unknown} value
 * @returns {unknown}
 */
function firestoreValueToPlain(value) {
  if (value == null) return value;

  if (isFirestoreTimestamp(value)) {
    try {
      return value.toDate().toISOString();
    } catch (_) {
      return String(value);
    }
  }

  if (hasToJson(value)) {
    try {
      return value.toJSON();
    } catch (_) {
      /* fall through to the array or object copy below */
    }
  }

  if (Array.isArray(value)) return value.map(firestoreValueToPlain);

  const isPlainObject = Object.prototype.toString.call(value) === '[object Object]';
  if (isPlainObject) return copyPlainObject(value);
  return value;
}

/**
 * daysPerWeek, frequency, and workoutsPerWeek all mean the same answer.
 * Out-of-range numbers are dropped so the prompt does not invent an 8-day week.
 * @param {object} profile
 * @returns {number|null}
 */
function resolveDaysPerWeek(profile) {
  const normalizedProfile = normalizeClientProfileFields(profile);
  const rawDays = normalizedProfile.daysPerWeek ?? normalizedProfile.frequency ?? normalizedProfile.workoutsPerWeek;
  if (rawDays == null || rawDays === '') return null;

  const numericDays = Number(rawDays);
  if (!Number.isFinite(numericDays)) return null;

  const roundedDays = Math.round(numericDays);
  const daysAreInRange = roundedDays >= MIN_DAYS_PER_WEEK && roundedDays <= MAX_DAYS_PER_WEEK;
  if (!daysAreInRange) return null;
  return roundedDays;
}

// ===== MAIN FUNCTION =====

/**
 * Strip extra user-doc fields before POSTing to /api/workout/generate.
 * Flow: 1. normalize the profile  2. copy the prompt fields  3. overwrite days per week
 * @param {object} data
 * @returns {object}
 */
export function buildWorkoutOnboardingPayload(data) {
  const profile = normalizeClientProfileFields(data && typeof data === 'object' ? data : {});
  const payload = {};

  for (const fieldName of WORKOUT_ONBOARDING_FIELDS) {
    if (profile[fieldName] === undefined || profile[fieldName] === null) continue;
    payload[fieldName] = firestoreValueToPlain(profile[fieldName]);
  }

  const daysPerWeek = resolveDaysPerWeek(profile);
  if (daysPerWeek != null) payload.daysPerWeek = daysPerWeek;
  return payload;
}
