// Builds the clients/{uid} Firestore document from a user record or onboarding answers.
// Flow: require an id → copy the fields the marketplace reads → drop empty values on merge.
// Used by signup, onboarding, and the server sync that mirrors trainers/{uid}.

// ===== NAMED CONSTANTS =====

const CLIENT_ROLE = 'client';
const ACTIVE_STATUS = 'active';

// ===== HELPER FUNCTIONS =====

/**
 * @param {object} [source]
 * @returns {string|null}
 */
function pickName(source = {}) {
  const combinedName = [source.firstName, source.lastName].filter(Boolean).join(' ').trim();
  const directName = source.name || source.displayName || combinedName;
  return directName || null;
}

// ===== MAIN FUNCTION =====

/**
 * @param {string} uid
 * @param {object} [source]
 * @returns {object|null}
 */
export function buildClientRegistryDoc(uid, source = {}) {
  const clientId = String(uid || source.uid || source.id || '').trim();
  if (!clientId) return null;

  const trainerId = source.trainerId != null ? String(source.trainerId) : null;

  return {
    uid: clientId,
    id: clientId,
    role: CLIENT_ROLE,
    name: pickName(source),
    email: source.email || null,
    photoURL: source.photoURL || source.photoUrl || null,
    trainerId: trainerId || null,
    onboardingCompleted: source.onboardingCompleted === true,
    goals: source.primaryGoal || source.goals || null,
    fitnessLevel: source.fitnessLevel || null,
    equipmentAccess: source.equipmentAccess || [],
    daysPerWeek: source.daysPerWeek ?? null,
    injuries: source.injuries || null,
    height: source.height ?? null,
    weight: source.weight ?? null,
    startingWeight: source.startingWeight ?? source.weight ?? null,
    age: source.age ?? null,
    gender: source.gender || null,
    preferredWorkoutTime: source.preferredWorkoutTime || null,
    trainingEnvironment: source.trainingEnvironment || null,
    currentStressLevel: source.currentStressLevel ?? null,
    sleepQuality: source.sleepQuality || null,
    energyLevels: source.energyLevels || null,
    phone: source.phone || null,
    bio: source.bio || null,
    status: source.status || ACTIVE_STATUS,
    authProvider: source.authProvider || null,
    createdAt: source.createdAt || null,
  };
}

/**
 * Firestore merge treats null as a write. Drop those keys so a blank does not erase a stored value.
 * @param {object} record
 * @returns {object}
 */
export function stripEmptyForFirestore(record) {
  const filledFields = {};
  for (const [fieldName, fieldValue] of Object.entries(record || {})) {
    if (fieldValue === undefined || fieldValue === null) continue;
    filledFields[fieldName] = fieldValue;
  }
  return filledFields;
}

module.exports = {
  buildClientRegistryDoc,
  stripEmptyForFirestore,
};
