// Turns the build flags into the live App Store paywall switch and the product copy.
// Flow: read the env flag → otherwise use the EAS profile → export the product ids and legal text.
// Used by the trainer Pro paywall and the purchase verification call.

// ===== NAMED CONSTANTS =====

const IAP_FLAG_ON = 'true';
const IAP_FLAG_OFF = 'false';
const PRODUCTION_PROFILE = 'production';
const PREVIEW_PROFILE = 'preview';

const TRAINER_PRO_MONTHLY_PRODUCT_ID = 'com.coachconnect.month';
const TRAINER_PRO_ANNUAL_PRODUCT_ID = 'com.coachconnect.year';

const TRAINER_SUBSCRIPTION_TITLE = 'Coach Connect Pro';
const TRAINER_SUBSCRIPTION_DURATION = '1 month';
const TRAINER_SUBSCRIPTION_PRICE_LABEL = '$59.99/month';
const TRAINER_SUBSCRIPTION_TRIAL_LABEL = '3-day free trial';

const TRAINER_SUBSCRIPTION_BENEFITS = [
  'Unlimited clients',
  'AI workout generation',
  'Nutrition tracking',
  'Progress dashboard',
  'Coaching chat',
];

const APPLE_MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

const TRAINER_SUBSCRIPTION_LEGAL =
  'Payment is charged to your Apple ID. Subscription auto-renews each month unless canceled at least 24 hours before the period ends. Manage or cancel in Settings → Apple ID → Subscriptions.';

const TRAINER_SUBSCRIPTION_PRODUCT_IDS = [
  TRAINER_PRO_MONTHLY_PRODUCT_ID,
  TRAINER_PRO_ANNUAL_PRODUCT_ID,
];

const TRAINER_SUBSCRIPTION_TIERS = [
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

// ===== HELPER FUNCTIONS =====

/**
 * An explicit env flag wins. Otherwise only production and preview builds sell Pro.
 * @returns {boolean}
 */
function resolveTrainerIapEnabled() {
  const flagValue = process.env.EXPO_PUBLIC_TRAINER_IAP_ENABLED;
  if (flagValue === IAP_FLAG_ON) return true;
  if (flagValue === IAP_FLAG_OFF) return false;
  const buildProfile = process.env.EAS_BUILD_PROFILE;
  return buildProfile === PRODUCTION_PROFILE || buildProfile === PREVIEW_PROFILE;
}

// ===== MAIN FUNCTION =====

const TRAINER_PLATFORM_SUBSCRIPTION_ENABLED = resolveTrainerIapEnabled();

export {
  TRAINER_PLATFORM_SUBSCRIPTION_ENABLED,
  TRAINER_PRO_MONTHLY_PRODUCT_ID,
  TRAINER_PRO_ANNUAL_PRODUCT_ID,
  TRAINER_SUBSCRIPTION_PRODUCT_IDS,
  TRAINER_SUBSCRIPTION_TITLE,
  TRAINER_SUBSCRIPTION_DURATION,
  TRAINER_SUBSCRIPTION_PRICE_LABEL,
  TRAINER_SUBSCRIPTION_TRIAL_LABEL,
  TRAINER_SUBSCRIPTION_BENEFITS,
  APPLE_MANAGE_SUBSCRIPTIONS_URL,
  TRAINER_SUBSCRIPTION_LEGAL,
  TRAINER_SUBSCRIPTION_TIERS,
};
