/**
 * Live StoreKit paywall + real IAP in onboarding.
 * Enabled for EAS production/preview builds unless EXPO_PUBLIC_TRAINER_IAP_ENABLED=false.
 */
function resolveTrainerIapEnabled() {
  const raw = process.env.EXPO_PUBLIC_TRAINER_IAP_ENABLED;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const profile = process.env.EAS_BUILD_PROFILE;
  return profile === 'production' || profile === 'preview';
}

export const TRAINER_PLATFORM_SUBSCRIPTION_ENABLED = resolveTrainerIapEnabled();

/** Apple IAP product identifiers — must match App Store Connect. */
export const TRAINER_PRO_MONTHLY_PRODUCT_ID = 'com.coachconnect.month';
/**
 * Annual plan shown in the paywall toggle. The tab only renders in live IAP
 * builds once this product exists in App Store Connect and loads from StoreKit.
 */
export const TRAINER_PRO_ANNUAL_PRODUCT_ID = 'com.coachconnect.year';

export const TRAINER_SUBSCRIPTION_PRODUCT_IDS = [
  TRAINER_PRO_MONTHLY_PRODUCT_ID,
  TRAINER_PRO_ANNUAL_PRODUCT_ID,
];

export const TRAINER_SUBSCRIPTION_TITLE = 'Coach Connect Pro';
export const TRAINER_SUBSCRIPTION_DURATION = '1 month';
export const TRAINER_SUBSCRIPTION_PRICE_LABEL = '$59.99/month';
export const TRAINER_SUBSCRIPTION_TRIAL_LABEL = '3-day free trial';

export const TRAINER_SUBSCRIPTION_BENEFITS = [
  'Unlimited clients',
  'AI workout generation',
  'Nutrition tracking',
  'Progress dashboard',
  'Coaching chat',
];

export const APPLE_MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

export const TRAINER_SUBSCRIPTION_LEGAL =
  'Payment is charged to your Apple ID. Subscription auto-renews each month unless canceled at least 24 hours before the period ends. Manage or cancel in Settings → Apple ID → Subscriptions.';

/** Selectable trainer platform tiers (productId must match App Store Connect). */
export const TRAINER_SUBSCRIPTION_TIERS = [
  {
    id: 'pro_annual',
    productId: TRAINER_PRO_ANNUAL_PRODUCT_ID,
    name: TRAINER_SUBSCRIPTION_TITLE,
    tabLabel: 'Annual',
    badge: 'Save 20%',
    duration: '1 year',
    priceLabel: '$49/month',
    priceAmount: '$49',
    billingLine: 'Billed $588/year · save $131 vs monthly',
    ctaPriceLine: '$49/mo billed yearly',
    trialLabel: TRAINER_SUBSCRIPTION_TRIAL_LABEL,
    benefits: TRAINER_SUBSCRIPTION_BENEFITS,
    recommended: true,
  },
  {
    id: 'pro_monthly',
    productId: TRAINER_PRO_MONTHLY_PRODUCT_ID,
    name: TRAINER_SUBSCRIPTION_TITLE,
    tabLabel: 'Monthly',
    badge: null,
    duration: TRAINER_SUBSCRIPTION_DURATION,
    priceLabel: TRAINER_SUBSCRIPTION_PRICE_LABEL,
    priceAmount: '$59.99',
    billingLine: 'Billed monthly · switch to annual anytime',
    ctaPriceLine: '$59.99/month',
    trialLabel: TRAINER_SUBSCRIPTION_TRIAL_LABEL,
    benefits: TRAINER_SUBSCRIPTION_BENEFITS,
    recommended: false,
  },
];
