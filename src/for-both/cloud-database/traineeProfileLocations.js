// Builds the clients/{uid} Firestore document from a user record or onboarding answers.
// Flow: require an id → copy the fields the marketplace reads → drop empty values on merge.
// Used by signup, onboarding, and the server sync that mirrors trainers/{uid}.

// ===== NAMED CONSTANTS =====

const CLIENT_ROLE = 'client';
const ACTIVE_STATUS = 'active';

// ===== MAIN FUNCTION =====

/**
 * Build the clients/{uid} document shape the marketplace and coach list read.
 * @param {string} uid
 * @param {object} [source]
 * @returns {object|null}
 */
export function buildClientRegistryDoc(uid, source = {}) {
  // 1. Need an id or we cannot write the clients/{uid} document.
  const clientId = firstNonEmptyId(uid, source);
  if (!clientId) {
    return null;
  }

  // 2. Trainer link and photo — keep null when missing so merge does not invent ids.
  const trainerIdText = trainerIdAsTextOrNull(source.trainerId);
  const photoAddress = source.photoURL || source.photoUrl || null;

  // 3. Display fields the marketplace cards read.
  const clientName = pickDisplayName(source);
  const emailAddress = source.email || null;

  // 4. Goals and schedule. ?? keeps 0 height / weight / age when the user entered zero.
  // vocab/symbol: ?? = use the right side only when the left is null or undefined (0 stays 0).
  const goalsText = source.primaryGoal || source.goals || null;
  const daysPerWeek = source.daysPerWeek ?? null;
  const startingWeight = source.startingWeight ?? source.weight ?? null;

  return {
    uid: clientId,
    id: clientId,
    role: CLIENT_ROLE,
    name: clientName,
    email: emailAddress,
    photoURL: photoAddress,
    trainerId: trainerIdText || null,
    onboardingCompleted: source.onboardingCompleted === true,
    goals: goalsText,
    fitnessLevel: source.fitnessLevel || null,
    equipmentAccess: source.equipmentAccess || [],
    daysPerWeek,
    injuries: source.injuries || null,
    height: source.height ?? null,
    weight: source.weight ?? null,
    startingWeight,
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
  // 1. Walk every key on the record we are about to merge.
  const filledFields = {};
  const fieldEntries = Object.entries(record || {});

  for (const [fieldName, fieldValue] of fieldEntries) {
    // 2. Skip undefined and null — only ship real values.
    if (fieldValue === undefined || fieldValue === null) {
      continue;
    }
    filledFields[fieldName] = fieldValue;
  }

  return filledFields;
}

module.exports = {
  buildClientRegistryDoc,
  stripEmptyForFirestore,
};

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging name / id picking.

function firstNonEmptyId(uid, source) {
  const fromArgument = String(uid || '').trim();
  if (fromArgument) {
    return fromArgument;
  }

  const fromSourceUid = String(source.uid || '').trim();
  if (fromSourceUid) {
    return fromSourceUid;
  }

  return String(source.id || '').trim();
}

function trainerIdAsTextOrNull(trainerId) {
  if (trainerId == null) {
    return null;
  }
  return String(trainerId);
}

function pickDisplayName(source = {}) {
  const firstName = source.firstName;
  const lastName = source.lastName;
  const nameParts = [firstName, lastName].filter(Boolean);
  const combinedName = nameParts.join(' ').trim();

  const directName = source.name || source.displayName || combinedName;
  if (directName) {
    return directName;
  }
  return null;
}
