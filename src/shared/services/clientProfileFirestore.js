/**
 * Canonical Firestore registry: clients/{uid} — one doc per account with role "client".
 * Mirrors trainers/{uid} for marketplace/discovery. Populated on signup, onboarding, and server sync.
 */

function pickName(source = {}) {
  const direct =
    source.name ||
    source.displayName ||
    [source.firstName, source.lastName].filter(Boolean).join(' ').trim();
  return direct || null;
}

/**
 * @param {string} uid
 * @param {Record<string, unknown>} source — users doc and/or onboarding payload
 * @returns {Record<string, unknown>}
 */
export function buildClientRegistryDoc(uid, source = {}) {
  const id = String(uid || source.uid || source.id || '').trim();
  if (!id) return null;

  const trainerId = source.trainerId != null ? String(source.trainerId) : null;

  return {
    uid: id,
    id,
    role: 'client',
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
    status: source.status || 'active',
    authProvider: source.authProvider || null,
    createdAt: source.createdAt || null,
  };
}

/** Strip null/undefined for Firestore merge (RN). */
export function stripEmptyForFirestore(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

module.exports = {
  buildClientRegistryDoc,
  stripEmptyForFirestore,
};
