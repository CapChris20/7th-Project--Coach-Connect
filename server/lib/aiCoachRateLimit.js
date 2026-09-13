/**
 * AI Coach daily message limits — tier resolution from verified Firestore user profile.
 */
function resolveAiCoachDailyLimit(userProfile = {}) {
  const tier = String(
    userProfile?.subscriptionTier ||
      userProfile?.planTier ||
      userProfile?.tier ||
      userProfile?.subscription ||
      'free',
  ).toLowerCase();
  if (tier.includes('premium') || tier.includes('pro') || tier.includes('coach')) return 100;
  if (tier.includes('plus') || tier.includes('standard') || tier.includes('basic')) return 50;
  return 30;
}

/**
 * Daily AI caps are ON in production Cloud Run by default.
 * Local `npm run server` forces AI_COACH_ENFORCE_LIMITS=0 (see server/index.js).
 * Emergency overrides:
 *   AI_COACH_ENFORCE_LIMITS=0  → off
 *   AI_COACH_ENFORCE_LIMITS=1  → on (when NODE_ENV=production or K_SERVICE set)
 */
function isAiCoachLimitsEnforced() {
  if (process.env.AI_COACH_ENFORCE_LIMITS === '0') return false;
  if (process.env.AI_COACH_UNLIMITED === '1') return false;

  const onCloudRun = !!process.env.K_SERVICE;
  const isProd = process.env.NODE_ENV === 'production';

  if (process.env.AI_COACH_ENFORCE_LIMITS === '1') {
    return isProd || onCloudRun;
  }

  // Default: enforce on Cloud Run production (no flag required)
  return onCloudRun && isProd;
}

module.exports = {
  resolveAiCoachDailyLimit,
  isAiCoachLimitsEnforced,
};
