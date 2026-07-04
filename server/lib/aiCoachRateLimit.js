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

function isAiCoachLimitsEnforced() {
  if (process.env.AI_COACH_ENFORCE_LIMITS !== '1') return false;
  if (process.env.NODE_ENV !== 'production') return false;
  return true;
}

module.exports = {
  resolveAiCoachDailyLimit,
  isAiCoachLimitsEnforced,
};
