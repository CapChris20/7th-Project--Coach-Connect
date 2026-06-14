'use strict';

/**
 * Build a top-level clients/{uid} document from users/{uid} profile data.
 * Shape aligned with TrainerApp CRM + onboarding fields.
 */

function pickString(...vals) {
  for (const v of vals) {
    const s = v != null ? String(v).trim() : '';
    if (s) return s;
  }
  return '';
}

function stripUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * @param {string} uid
 * @param {Record<string, unknown>} userData - users/{uid} fields
 * @param {{ trainerId?: string|null, FieldValue?: { serverTimestamp: () => unknown } }} [opts]
 */
function buildClientRegistryDoc(uid, userData = {}, opts = {}) {
  const u = userData || {};
  const name =
    pickString(u.name, u.displayName) ||
    [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
    '';

  const trainerId =
    opts.trainerId != null && opts.trainerId !== ''
      ? String(opts.trainerId)
      : u.trainerId != null && u.trainerId !== ''
        ? String(u.trainerId)
        : null;

  const ts = opts.FieldValue?.serverTimestamp?.() ?? null;

  return stripUndefined({
    uid,
    id: uid,
    role: 'client',
    name: name || null,
    email: pickString(u.email) || null,
    photoURL: u.photoURL || u.photoUrl || null,
    trainerId,
    height: u.height ?? null,
    weight: u.weight ?? null,
    startingWeight: u.startingWeight ?? u.weight ?? null,
    age: u.age ?? null,
    gender: u.gender || null,
    goals: pickString(u.primaryGoal, u.goals) || null,
    fitnessLevel: u.fitnessLevel || null,
    equipmentAccess: Array.isArray(u.equipmentAccess) ? u.equipmentAccess : [],
    daysPerWeek: u.daysPerWeek ?? null,
    injuries: u.injuries ?? null,
    exercisesDislike: pickString(u.exercisesDislike) || null,
    preferredWorkoutTime: u.preferredWorkoutTime || null,
    trainingEnvironment: u.trainingEnvironment || null,
    currentStressLevel: u.currentStressLevel ?? null,
    sleepQuality: u.sleepQuality ?? null,
    energyLevels: u.energyLevels ?? null,
    supplementsCurrentlyTaking: pickString(u.supplementsCurrentlyTaking) || null,
    hydrationHabits: u.hydrationHabits ?? null,
    phone: pickString(u.phone) || null,
    bio: pickString(u.bio) || null,
    onboardingCompleted:
      u.onboardingCompleted === true || u.onboardingCompleted === 'true' || u.onboardingCompleted === 1,
    status: 'active',
    createdAt: u.createdAt || ts,
    updatedAt: ts,
    backfilledAt: ts,
    backfillSource: 'scripts/backfillClientsCollection.js',
  });
}

module.exports = { buildClientRegistryDoc, stripUndefined };
