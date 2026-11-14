// Build-time switches and storefront copy for trainer Pro in-app purchases.
// Flow: read EXPO_PUBLIC_TRAINER_IAP_ENABLED → fall back to EAS profile → export product ids, tiers, legal text.
// Used by ProUpgradeScreen, ProPlanSetup, and verifyProPurchase (product id letters stay frozen).
// Read order: constants → tier builders → MAIN (resolve flag) → exports.

// ===== NAMED CONSTANTS =====

// Manipulate here: only the strings 'true' and 'false' count as an explicit override from .env.
const ENV_FLAG_MEANS_IAP_ON = 'true';
const ENV_FLAG_MEANS_IAP_OFF = 'false';
const EAS_PROFILE_PRODUCTION = 'production';
const EAS_PROFILE_PREVIEW = 'preview';

// App Store product id letters — freeze list; verifyProPurchase matches these exactly.
const TRAINER_PRO_MONTHLY_PRODUCT_ID = 'com.coachconnect.month';
const TRAINER_PRO_ANNUAL_PRODUCT_ID = 'com.coachconnect.year';

const TRAINER_SUBSCRIPTION_TITLE = 'Coach Connect Pro';
const TRAINER_SUBSCRIPTION_DURATION = '1 month';
const TRAINER_SUBSCRIPTION_PRICE_LABEL = '$59.99/month';
const TRAINER_SUBSCRIPTION_TRIAL_LABEL = '3-day free trial';

// Manipulate here: benefit bullets shown on every Pro tier card.
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

// ===== HELPER FUNCTIONS =====

/**
 * Shared benefit list for every tier card (same array reference is fine — UI only reads).
 * @returns {string[]}
 */
function benefitListForEveryTier() {
  return TRAINER_SUBSCRIPTION_BENEFITS;
}

/**
 * Annual tier row — recommended, billed yearly, “Save 20%” badge.
 * Object keys (id, productId, tabLabel, …) are frozen for ProUpgradeScreen.
 * @returns {object}
 */
function buildAnnualTierRow() {
  return {
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
    benefits: benefitListForEveryTier(),
    recommended: true,
  };
}

/**
 * Monthly tier row — default duration/price labels from the constants above.
 * @returns {object}
 */
function buildMonthlyTierRow() {
  return {
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
    benefits: benefitListForEveryTier(),
    recommended: false,
  };
}

/**
 * Paywall tier list: annual first (recommended), then monthly.
 * @returns {object[]}
 */
function buildSubscriptionTierRows() {
  return [buildAnnualTierRow(), buildMonthlyTierRow()];
}

// ===== MAIN FUNCTION =====

/**
 * Decides whether this binary should talk to the App Store for trainer Pro.
 * Flow: 1. honor explicit env flag  2. else enable only on production/preview EAS profiles
 * @returns {boolean}
 */
function resolveTrainerIapEnabled() {
  // 1. Honor an explicit public env flag when the developer set one.
  const publicFlag = process.env.EXPO_PUBLIC_TRAINER_IAP_ENABLED;
  if (publicFlag === ENV_FLAG_MEANS_IAP_ON) return true;
  if (publicFlag === ENV_FLAG_MEANS_IAP_OFF) return false;

  // 2. No flag → only production and preview builds enable IAP (local Dev Client stays off).
  const easProfile = process.env.EAS_BUILD_PROFILE;
  const isProductionBuild = easProfile === EAS_PROFILE_PRODUCTION;
  const isPreviewBuild = easProfile === EAS_PROFILE_PREVIEW;
  return isProductionBuild || isPreviewBuild;
}

const TRAINER_PLATFORM_SUBSCRIPTION_ENABLED = resolveTrainerIapEnabled();

const TRAINER_SUBSCRIPTION_TIERS = buildSubscriptionTierRows();

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
