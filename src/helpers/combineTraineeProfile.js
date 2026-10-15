// Combines the trainer's private notes about a client with the client's own live profile.
// Flow: start from the trainer row → for each shared field, the client's value wins when it exists → then fill a missing goal.
// Used by: the trainer home and the linked-client loader so the coach sees fresh weight, not a stale copy.
// vocab: trainer row = trainer_clients/{trainerId}/clients/{clientId}. The users doc is users/{clientId}.

import { normalizeClientProfileFields } from './fillTraineeProfile';

// ===== NAMED CONSTANTS =====

// The client owns these. A value here beats the trainer's copy because the client updates it in their app.
// Manipulate here: adding a key means "the client's value beats the trainer's".
// Trainer-only fields (private notes, tags, program name) must stay off this list.
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
  // Billing — prefer users/{clientId}, fall back to the trainer row
  'monthlyRate',
  'paymentStatus',
];

// ===== HELPER FUNCTIONS =====

/**
 * Empty array counts as "no answer". A cleared multi-select must not wipe a real trainer value.
 * @param {*} fieldValue
 * @returns {boolean}
 */
function isFieldPresent(fieldValue) {
  if (fieldValue == null || fieldValue === '') return false;
  if (Array.isArray(fieldValue) && fieldValue.length === 0) return false;
  return true;
}

/**
 * Copy each shared field from the client when they answered it; otherwise keep or fill from the trainer row.
 * @param {object} combinedProfile
 * @param {object} clientProfile
 * @param {object} trainerClientRow
 * @returns {object}
 */
function valueForSharedField(clientProfile, trainerClientRow, combinedProfile, fieldName) {
  if (isFieldPresent(clientProfile[fieldName])) return clientProfile[fieldName];
  const shouldFillFromTrainer =
    !isFieldPresent(combinedProfile[fieldName]) && isFieldPresent(trainerClientRow[fieldName]);
  if (shouldFillFromTrainer) return trainerClientRow[fieldName];
  return combinedProfile[fieldName];
}

function copyClientOwnedFields(combinedProfile, clientProfile, trainerClientRow) {
  for (const fieldName of TRAINER_CLIENT_PROFILE_FIELDS) {
    combinedProfile[fieldName] = valueForSharedField(
      clientProfile,
      trainerClientRow,
      combinedProfile,
      fieldName,
    );
  }
  return combinedProfile;
}

/**
 * Goals lead the trainer UI. An empty goal looks like a broken screen, so the trainer row is the last resort.
 * @param {object} combinedProfile
 * @param {object} trainerClientRow
 * @returns {object}
 */
function applyGoalFallbacks(combinedProfile, trainerClientRow) {
  if (!isFieldPresent(combinedProfile.primaryGoal) && isFieldPresent(trainerClientRow.primaryGoal)) {
    combinedProfile.primaryGoal = trainerClientRow.primaryGoal;
  }
  // `|| null` turns undefined into null so the saved shape stays Firestore-safe.
  if (!isFieldPresent(combinedProfile.goals) && !isFieldPresent(combinedProfile.primaryGoal)) {
    combinedProfile.goals = trainerClientRow.goals || null;
  }
  return combinedProfile;
}

// ===== MAIN FUNCTION =====

/**
 * Merge a trainer's client row with the client's users document.
 * Trainer-only keys (notes, tags, ids) are kept. Shared keys prefer the client.
 * @param {object} [trainerClientRow] trainer_clients/{trainerId}/clients/{clientId}
 * @param {object} [userData] users/{clientId}
 * @returns {object}
 */
export function combineTraineeProfile(trainerClientRow = {}, userData = {}) {
  const trainerRow =
    trainerClientRow && typeof trainerClientRow === 'object' ? trainerClientRow : {};
  // Normalize first so legacy spellings (goal → primaryGoal, frequency → daysPerWeek) are already resolved.
  const clientProfile = normalizeClientProfileFields(userData);
  // Start from the trainer row so private fields survive. Only TRAINER_CLIENT_PROFILE_FIELDS can be replaced.
  const combinedProfile = { ...trainerRow };

  copyClientOwnedFields(combinedProfile, clientProfile, trainerRow);
  return applyGoalFallbacks(combinedProfile, trainerRow);
}
