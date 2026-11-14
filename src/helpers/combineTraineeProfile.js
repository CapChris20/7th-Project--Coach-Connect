// Combines the trainer's private notes about a client with the client's own live profile.
// Flow: start from the trainer row → overlay fields the client owns → fill goals the UI cannot leave blank.
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

// ===== MAIN FUNCTION =====

/**
 * Merge a trainer's client row with the client's users document.
 * Trainer-only keys (notes, tags, ids) are kept. Shared keys prefer the client.
 * @param {object} [trainerClientRow] trainer_clients/{trainerId}/clients/{clientId}
 * @param {object} [userData] users/{clientId}
 * @returns {object}
 */
export function combineTraineeProfile(trainerClientRow = {}, userData = {}) {
  // 1. Guard the trainer row so a bad caller cannot pass a string or null through spread.
  const trainerRow = safeTrainerRow(trainerClientRow);

  // 2. Normalize the client doc so legacy spellings (goal → primaryGoal) are already resolved.
  const clientProfile = normalizeClientProfileFields(userData);

  // 3. Start from the trainer row so private fields survive; only listed fields may change.
  const combinedProfile = { ...trainerRow };

  // 4. For each shared field, prefer the client's answer, then fill gaps from the trainer row.
  writeClientOwnedFieldsOntoProfile(combinedProfile, clientProfile, trainerRow);

  // 5. Goals drive the trainer UI — never leave them empty when the trainer row still has a fallback.
  return fillMissingGoalsFromTrainerRow(combinedProfile, trainerRow);
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging =====

/**
 * Spread-safe trainer row. Non-objects become {}.
 * @param {*} trainerClientRow
 * @returns {object}
 */
function safeTrainerRow(trainerClientRow) {
  const trainerRowIsObject = trainerClientRow && typeof trainerClientRow === 'object';
  if (trainerRowIsObject) return trainerClientRow;
  return {};
}

/**
 * Empty array counts as "no answer". A cleared multi-select must not wipe a real trainer value.
 * @param {*} fieldValue
 * @returns {boolean}
 */
function clientAnsweredThisField(fieldValue) {
  if (fieldValue == null || fieldValue === '') return false;
  if (Array.isArray(fieldValue) && fieldValue.length === 0) return false;
  return true;
}

/**
 * Pick one shared field: client wins when answered; else trainer fills only if combined is empty.
 * @param {object} clientProfile
 * @param {object} trainerClientRow
 * @param {object} combinedProfile
 * @param {string} fieldName
 * @returns {*}
 */
function pickSharedFieldValue(clientProfile, trainerClientRow, combinedProfile, fieldName) {
  const clientValue = clientProfile[fieldName];
  if (clientAnsweredThisField(clientValue)) return clientValue;

  const combinedValue = combinedProfile[fieldName];
  const trainerValue = trainerClientRow[fieldName];
  const combinedIsEmpty = !clientAnsweredThisField(combinedValue);
  const trainerHasValue = clientAnsweredThisField(trainerValue);
  if (combinedIsEmpty && trainerHasValue) return trainerValue;

  return combinedValue;
}

/**
 * Write every TRAINER_CLIENT_PROFILE_FIELDS entry onto the combined profile in place.
 * @param {object} combinedProfile
 * @param {object} clientProfile
 * @param {object} trainerClientRow
 * @returns {object}
 */
function writeClientOwnedFieldsOntoProfile(combinedProfile, clientProfile, trainerClientRow) {
  for (const fieldName of TRAINER_CLIENT_PROFILE_FIELDS) {
    combinedProfile[fieldName] = pickSharedFieldValue(
      clientProfile,
      trainerClientRow,
      combinedProfile,
      fieldName,
    );
  }
  return combinedProfile;
}

/**
 * Goals lead the trainer UI. An empty goal looks like a broken screen, so the trainer row is last resort.
 * @param {object} combinedProfile
 * @param {object} trainerClientRow
 * @returns {object}
 */
function fillMissingGoalsFromTrainerRow(combinedProfile, trainerClientRow) {
  // primaryGoal: copy from trainer when combined still has no answer.
  const primaryGoalMissing = !clientAnsweredThisField(combinedProfile.primaryGoal);
  const trainerHasPrimaryGoal = clientAnsweredThisField(trainerClientRow.primaryGoal);
  if (primaryGoalMissing && trainerHasPrimaryGoal) {
    combinedProfile.primaryGoal = trainerClientRow.primaryGoal;
  }

  // goals list: only when both goals and primaryGoal are still empty after the step above.
  const goalsMissing = !clientAnsweredThisField(combinedProfile.goals);
  const primaryStillMissing = !clientAnsweredThisField(combinedProfile.primaryGoal);
  // Manipulate here: `|| null` turns undefined into null so the saved shape stays Firestore-safe.
  if (goalsMissing && primaryStillMissing) {
    combinedProfile.goals = trainerClientRow.goals || null;
  }

  return combinedProfile;
}
