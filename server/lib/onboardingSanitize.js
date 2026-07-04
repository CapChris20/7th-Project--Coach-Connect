/**
 * Server-side allowlist for onboarding user doc writes.
 * Blocks privileged fields (subscription, role smuggling, etc.).
 */
const logger = require('./logger');

/** Fields clients may set during onboarding (users/{uid}). */
const PERMITTED_ONBOARDING_FIELDS = new Set([
  'firstName',
  'lastName',
  'name',
  'email',
  'phone',
  'bio',
  'profilePhoto',
  'photoURL',
  'photoUrl',
  'avatarUrl',
  'displayName',
  'certifications',
  'certificationOther',
  'specializations',
  'specialties',
  'availability',
  'rates',
  'pricing',
  'experience',
  'yearsExperience',
  'preferences',
  'weight',
  'height',
  'age',
  'gender',
  'fitnessLevel',
  'primaryGoal',
  'goals',
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
  'trainerId',
  'situationDescription',
  'aiEnabled',
  'location',
  'trainingPhilosophy',
  'trainerProfileBio',
  'sessionType',
  'offerFreeConsultation',
  'flexiblePricingAvailable',
  'inviteCode',
  'trainerAvailabilityStatus',
  'startingWeight',
]);

/** Never accept from client body — set server-side or via Admin only. */
const BLOCKED_ONBOARDING_FIELDS = new Set([
  'role',
  'subscription',
  'subscriptionTier',
  'subscriptionStatus',
  'planTier',
  'tier',
  'isAdmin',
  'admin',
  'linked',
  'onboardingCompleted',
  'onboardingCompletedAt',
  'expoPushToken',
  'pushToken',
  'stripeCustomerId',
  'stripeAccountId',
  'stripeStatus',
  'stripeConnectStatus',
  'stripeCreatedAt',
  'appleOriginalTransactionId',
]);

function sanitizeOnboardingData(onboardingData, { uid, logStripped = true } = {}) {
  if (!onboardingData || typeof onboardingData !== 'object') {
    return { sanitized: {}, stripped: [] };
  }

  const sanitized = {};
  const stripped = [];

  for (const [field, value] of Object.entries(onboardingData)) {
    if (BLOCKED_ONBOARDING_FIELDS.has(field)) {
      stripped.push(field);
      continue;
    }
    if (!PERMITTED_ONBOARDING_FIELDS.has(field)) {
      stripped.push(field);
      continue;
    }
    sanitized[field] = value;
  }

  if (logStripped && stripped.length > 0) {
    logger.info(
      `[onboarding] sanitized onboardingData for ${uid || 'unknown'} — stripped: ${stripped.join(', ')}`,
    );
  }

  return { sanitized, stripped };
}

module.exports = {
  PERMITTED_ONBOARDING_FIELDS,
  BLOCKED_ONBOARDING_FIELDS,
  sanitizeOnboardingData,
};
