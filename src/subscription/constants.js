/** Apple IAP product identifiers — must match App Store Connect. */
export const TRAINER_PRO_MONTHLY_PRODUCT_ID = 'com.coachconnect.month';

export const TRAINER_SUBSCRIPTION_PRICE_LABEL = '$59.99/month';
export const TRAINER_SUBSCRIPTION_TRIAL_LABEL = '3-day free trial';

export const TRAINER_SUBSCRIPTION_BENEFITS = [
  'Unlimited clients',
  'AI workout generation',
  'Nutrition tracking',
  'Progress dashboard',
  'Coaching chat',
];

export const TRAINER_SUBSCRIPTION_LEGAL =
  'Auto-renews for $59.99. Cancel anytime in settings.';

/** Selectable trainer platform tiers (productId must match App Store Connect). */
export const TRAINER_SUBSCRIPTION_TIERS = [
  {
    id: 'pro_monthly',
    productId: TRAINER_PRO_MONTHLY_PRODUCT_ID,
    name: 'Coach Connect Pro',
    priceLabel: TRAINER_SUBSCRIPTION_PRICE_LABEL,
    trialLabel: TRAINER_SUBSCRIPTION_TRIAL_LABEL,
    benefits: TRAINER_SUBSCRIPTION_BENEFITS,
    recommended: true,
  },
];
