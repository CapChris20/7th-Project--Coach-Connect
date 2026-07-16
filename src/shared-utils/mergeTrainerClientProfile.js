/**
 * Merge trainer CRM roster rows with live users/{uid} profile fields.
 * users doc wins for metrics the client updates (weight, age, height, training prefs).
 */
import { normalizeClientProfileFields } from './resolveClientProfileFields';

export const TRAINER_CLIENT_PROFILE_FIELDS = [
  'weight',
  'startingWeight',
  'age',
  'height',
  'gender',
  'daysPerWeek',
  'fitnessLevel',
  'primaryGoal',
  'goals',
  'equipmentAccess',
  'injuries',
  'exercisesDislike',
  'preferredWorkoutTime',
  'trainingEnvironment',
  'currentStressLevel',
  'sleepQuality',
  'energyLevels',
  'supplementsCurrentlyTaking',
  'hydrationHabits',
  // Billing — prefer users/{clientId}, fall back to CRM row
  'monthlyRate',
  'paymentStatus',
];

function isPresent(value) {
  if (value == null || value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * @param {object} crmRow — trainer_clients/{trainerId}/clients/{clientId}
 * @param {object} userData — users/{clientId}
 */
export function mergeTrainerClientProfile(crmRow = {}, userData = {}) {
  const crm = crmRow && typeof crmRow === 'object' ? crmRow : {};
  const user = normalizeClientProfileFields(userData);
  const merged = { ...crm };

  for (const key of TRAINER_CLIENT_PROFILE_FIELDS) {
    if (isPresent(user[key])) {
      merged[key] = user[key];
    } else if (!isPresent(merged[key]) && isPresent(crm[key])) {
      merged[key] = crm[key];
    }
  }

  if (!isPresent(merged.primaryGoal) && isPresent(crm.primaryGoal)) {
    merged.primaryGoal = crm.primaryGoal;
  }
  if (!isPresent(merged.goals) && !isPresent(merged.primaryGoal)) {
    merged.goals = crm.goals || null;
  }

  return merged;
}
