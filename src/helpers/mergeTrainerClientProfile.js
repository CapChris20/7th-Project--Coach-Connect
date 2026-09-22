// Combines the trainer's own notes about a client with the client's live self-reported profile.
// Flow: start from the CRM row → for each shared field, let the client's users doc win if it
//       has a value → otherwise keep the trainer's CRM value → special-case the goal fields.
// Used by trainer client detail/roster screens so a coach sees fresh weight/goals, not stale copies.

// vocab: CRM row = the trainer's private copy of a client at trainer_clients/{trainerId}/clients/{clientId}
import { normalizeClientProfileFields } from './resolveClientProfileFields';

// The fields the client themselves owns. Anything listed here prefers the users doc,
// because the client updates these in their own app and the CRM copy goes stale.
// Manipulate here: adding a key here means "the client's value beats the trainer's".
//                  Trainer-only fields (private notes, tags) must stay OUT of this list.
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

// "Does this field actually hold an answer?" — the tie-breaker for every merge decision below.
// An empty array counts as absent, since a cleared multi-select shouldn't beat a real CRM value.
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
  // Normalize the users doc first so legacy key spellings (goal→primaryGoal,
  // frequency→daysPerWeek, etc.) are already resolved before we compare fields.
  const user = normalizeClientProfileFields(userData);
  // Start from the CRM row so trainer-only fields (notes, tags, ids) survive untouched —
  // only the keys in TRAINER_CLIENT_PROFILE_FIELDS get considered for replacement.
  const merged = { ...crm };

  // The core rule: client value wins when present, CRM value fills the gap otherwise.
  for (const key of TRAINER_CLIENT_PROFILE_FIELDS) {
    if (isPresent(user[key])) {
      merged[key] = user[key];
    } else if (!isPresent(merged[key]) && isPresent(crm[key])) {
      merged[key] = crm[key];
    }
  }

  // Goals get extra handling because they're what the trainer's UI leads with, and an
  // empty goal reads as a broken screen. If neither source produced a primaryGoal,
  // fall back explicitly to the CRM one.
  if (!isPresent(merged.primaryGoal) && isPresent(crm.primaryGoal)) {
    merged.primaryGoal = crm.primaryGoal;
  }
  // Last resort: with no goal at all, surface the CRM's `goals` list instead.
  // `|| null` normalizes undefined to null so the shape stays Firestore-safe.
  if (!isPresent(merged.goals) && !isPresent(merged.primaryGoal)) {
    merged.goals = crm.goals || null;
  }

  return merged;
}
