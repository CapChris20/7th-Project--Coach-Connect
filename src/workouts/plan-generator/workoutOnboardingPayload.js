/** Fields used by server/lib/workoutPlanPrompt.js — keep payload small and JSON-safe. */
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

function normalizeFirestoreValue(value) {
  if (value == null) return value;
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    try {
      return value.toDate().toISOString();
    } catch (_) {
      return String(value);
    }
  }
  if (typeof value === 'object' && typeof value.toJSON === 'function') {
    try {
      return value.toJSON();
    } catch (_) {
      /* fall through */
    }
  }
  if (Array.isArray(value)) return value.map(normalizeFirestoreValue);
  if (Object.prototype.toString.call(value) === '[object Object]') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = normalizeFirestoreValue(v);
    }
    return out;
  }
  return value;
}

/** Strip Firestore types / extra user-doc fields before POSTing to /api/workout/generate. */
export function buildWorkoutOnboardingPayload(data) {
  const src = data && typeof data === 'object' ? data : {};
  const out = {};
  for (const key of WORKOUT_ONBOARDING_FIELDS) {
    if (src[key] === undefined) continue;
    out[key] = normalizeFirestoreValue(src[key]);
  }
  return out;
}
