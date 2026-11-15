// Trainer Pro paywall during new-trainer setup (step 8) — FitFlow scroll body + sticky footer CTA.
// Flow: list purchasable tiers → pick plan → trial or continue setup (footer pins the primary button).
// Used by NewUserSetupScreen. Exports TrainerProOfferStep and TrainerSubscriptionCtaFooter stay frozen.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { getOnboardingUiTokens } from './setupStepPieces';
import AppLogo from '../icons/AppLogo';
import { useSubscription } from '../../trainer-pro-plan/ProPlanSetup';
import {
  TRAINER_SUBSCRIPTION_TIERS,
  TRAINER_SUBSCRIPTION_TRIAL_LABEL,
  TRAINER_PLATFORM_SUBSCRIPTION_ENABLED,
  TRAINER_PRO_MONTHLY_PRODUCT_ID,
} from '../../trainer-pro-plan/proPlanSwitches';
import ProLegalFooter from '../../trainer-pro-plan/ProLegalFooter';
import { lightColors, nb, borderRadius } from '../../look-and-feel/colorPalette';
import NbButton from '../../look-and-feel/NbButton';
import NbCard from '../../look-and-feel/NbCard';
import HardShadow from '../../look-and-feel/HardShadow';

// ===== NAMED CONSTANTS =====

const SUBSCRIPTION_HERO = require('../../assets/icons/digital-gift-card-abstract-concept-illustration.png');

// FitFlow marketing gradient — paywall accent only (not theme tokens).
// Manipulate here: hero/CTA gradient stops — keep marketing pink/orange, never theme purple borders.
const PAYWALL_GRADIENT = ['#FF8C42', '#FF4F7B', '#E63FA8'];
const PAYWALL_PINK = '#FF4F7B';
const PAYWALL_CYAN = '#4DD8F0';
const PAYWALL_GOLD = '#FCD34D';
const TESTING_BADGE_AMBER = '#FBBF24';
const SUCCESS_GREEN = '#34D399';
const DEFAULT_PRICE_LABEL = '$19 / month';
const ACCESS_FREE_TRIAL = 'free_trial';
const CTA_START_TRIAL = 'Start 3-day free trial';
const CTA_CONNECT_STORE = 'Connect to App Store…';
const CTA_GOT_IT = 'Got it — continue setup';
const CTA_COMPLETE_SETUP = 'Complete setup';

const FITFLOW_FEATURE_ROWS = [
  {
    icon: 'people',
    label: 'Unlimited clients',
    detail: 'Onboard as many clients as you want — no per-seat fees.',
  },
  {
    icon: 'sparkles',
    label: 'AI-generated workouts',
    detail: 'Personalized programs in seconds, tuned to each client.',
  },
  {
    icon: 'trending-up',
    label: "See who's improving",
    detail: 'Progress dashboards flag clients who need attention.',
  },
  {
    icon: 'nutrition',
    label: 'Nutrition & macros',
    detail: 'Meal logging and macro targets built right in.',
  },
  {
    icon: 'chatbubbles',
    label: 'Real-time chat & check-ins',
    detail: 'Message clients and keep every check-in in one place.',
  },
  {
    icon: 'barbell',
    label: 'Scheduling & booking',
    detail: 'Availability, session formats, and invite codes in one place.',
  },
];

const DESIGN_LAW_PRO_ROWS = [
  { title: 'Take unlimited clients', sub: 'Free plans cap how many you can accept' },
  { title: 'Documents and spreadsheets', sub: 'Intake forms, meal guides, programs' },
  { title: 'Weekly reports', sub: 'Every client, built from their logs' },
];

const PRICE_CARD_BULLETS = [
  `${TRAINER_SUBSCRIPTION_TRIAL_LABEL} for new subscribers`,
  'Full access to every Pro feature',
  'Cancel anytime in your Apple ID settings',
];

const TRUST_BADGE_LABELS = [
  'Cancel anytime',
  'App Store secure billing',
  'Transparent pricing',
];

// ===== HELPER FUNCTIONS =====

/**
 * Keep only tiers the store currently sells (or all tiers when the platform flag is off).
 * @param {Array} allTiers
 * @param {object} storeProductsById
 * @returns {Array}
 */
function listAvailableTrainerTiers(allTiers, storeProductsById) {
  if (!TRAINER_PLATFORM_SUBSCRIPTION_ENABLED) return allTiers;
  const onSaleTiers = [];
  for (let tierIndex = 0; tierIndex < allTiers.length; tierIndex += 1) {
    const tier = allTiers[tierIndex];
    if (!tierIsOnSaleNow(tier, storeProductsById)) continue;
    onSaleTiers.push(tier);
  }
  return onSaleTiers;
}

function tierIsOnSaleNow(tier, storeProductsById) {
  // Monthly Pro is always offered; other tiers need a live StoreKit product.
  if (tier.productId === TRAINER_PRO_MONTHLY_PRODUCT_ID) return true;
  if (!storeProductsById) return false;
  const storeKnowsThisProduct = Boolean(storeProductsById[tier.productId]);
  return storeKnowsThisProduct;
}

function pickSelectedTier(availableTiers, selectedPlanId) {
  const matchById = availableTiers.find((tier) => tier.id === selectedPlanId);
  if (matchById) return matchById;
  const recommendedTier = availableTiers.find((tier) => tier.recommended);
  if (recommendedTier) return recommendedTier;
  return availableTiers[0];
}

function productIdFromTier(selectedTier) {
  if (!selectedTier) return undefined;
  return selectedTier.productId;
}

function priceLineFromTier(selectedTier) {
  if (!selectedTier) return undefined;
  if (selectedTier.ctaPriceLine) return selectedTier.ctaPriceLine;
  return selectedTier.priceLabel;
}

function pickFooterCtaAction({
  liveBilling,
  alreadySubscribed,
  storeConnected,
  selectedTier,
  startFreeTrial,
  onComplete,
}) {
  if (!liveBilling) {
    return { ctaLabel: CTA_GOT_IT, onPress: onComplete };
  }
  if (alreadySubscribed) {
    return { ctaLabel: CTA_COMPLETE_SETUP, onPress: onComplete };
  }
  const ctaLabel = storeConnected ? CTA_START_TRIAL : CTA_CONNECT_STORE;
  const productId = productIdFromTier(selectedTier);
  return {
    ctaLabel,
    onPress: () => startFreeTrial(productId),
  };
}

function pickFooterMetaLine({ liveBilling, alreadySubscribed, selectedTier }) {
  if (!liveBilling) return 'Payments are not active in this build';
  if (alreadySubscribed) return 'Your Pro access is ready';
  const priceLine = priceLineFromTier(selectedTier);
  return `Then ${priceLine} · Cancel anytime`;
}

function pickStickyFooterBackground(isDark) {
  if (isDark) return 'rgba(10,10,15,0.92)';
  return 'rgba(255,255,255,0.92)';
}

function pickBrandPillBackground(isDark, uiTokens) {
  if (isDark) return 'rgba(255,255,255,0.04)';
  return uiTokens.cardBg;
}

function pickFeatureCardBackground(isDark, uiTokens) {
  if (isDark) return 'rgba(255,255,255,0.03)';
  return uiTokens.cardBg;
}

function pickPriceCardBackground(isDark, uiTokens) {
  if (isDark) return 'rgba(255,255,255,0.04)';
  return uiTokens.cardBg;
}

function pickPlanTabsBackground(isDark, uiTokens) {
  if (isDark) return 'rgba(255,255,255,0.04)';
  return uiTokens.cardBg;
}

function pickSuccessMessage(accessKind) {
  if (accessKind === ACCESS_FREE_TRIAL) return 'Free trial started!';
  return 'Subscription active!';
}

function GradientMaskedText({ children, style }) {
  // vocab: MaskedView = child gradient shows only where the mask Text has opaque pixels
  return (
    <MaskedView
      maskElement={
        <Text style={[style, { backgroundColor: 'transparent' }]}>{children}</Text>
      }
    >
      <LinearGradient colors={PAYWALL_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

function PaywallBrandRow({ uiTokens, isDark }) {
  const pillBackground = pickBrandPillBackground(isDark, uiTokens);
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandLeft}>
        <AppLogo width={36} />
        <Text style={[styles.brandName, { color: uiTokens.textPrimary }]}>Coach Connect</Text>
      </View>
      <View
        style={[
          styles.brandPill,
          {
            borderColor: uiTokens.cardBorder,
            backgroundColor: pillBackground,
          },
        ]}
      >
        <Ionicons name="star" size={13} color={PAYWALL_GOLD} />
        <Text style={[styles.brandPillText, { color: uiTokens.textSecondary }]}>
          {TRAINER_SUBSCRIPTION_TRIAL_LABEL}
        </Text>
      </View>
    </View>
  );
}

function FitFlowFeatureRow({ row, uiTokens, isDark }) {
  const cardBackground = pickFeatureCardBackground(isDark, uiTokens);
  return (
    <View
      style={[
        styles.featureCard,
        {
          backgroundColor: cardBackground,
          borderColor: uiTokens.cardBorder,
        },
      ]}
    >
      <LinearGradient
        colors={['rgba(255,140,66,0.20)', 'rgba(230,63,168,0.16)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.featureIconWell}
      >
        <Ionicons name={row.icon} size={19} color={PAYWALL_PINK} />
      </LinearGradient>
      <View style={styles.featureContent}>
        <Text style={[styles.featureLabel, { color: uiTokens.textPrimary }]}>{row.label}</Text>
        <Text style={[styles.featureDetail, { color: uiTokens.textSecondary }]}>{row.detail}</Text>
      </View>
    </View>
  );
}

function buildFitFlowFeatureRowElements(uiTokens, isDark) {
  const rowElements = [];
  for (let rowIndex = 0; rowIndex < FITFLOW_FEATURE_ROWS.length; rowIndex += 1) {
    const row = FITFLOW_FEATURE_ROWS[rowIndex];
    rowElements.push(
      <FitFlowFeatureRow key={row.label} row={row} uiTokens={uiTokens} isDark={isDark} />,
    );
  }
  return rowElements;
}

function FitFlowFeatureList({ uiTokens, isDark }) {
  const featureRowElements = buildFitFlowFeatureRowElements(uiTokens, isDark);
  return <View style={styles.featureList}>{featureRowElements}</View>;
}

function SubscriptionPlanTab({ tier, isActive, uiTokens, onSelectTier }) {
  const tabLabelColor = isActive ? lightColors.white : uiTokens.textSecondary;
  const tabInner = (
    <View style={styles.planTabInner}>
      <Text style={[styles.planTabText, { color: tabLabelColor }]}>{tier.tabLabel}</Text>
      {tier.badge ? (
        <View style={[styles.planTabBadge, isActive && styles.planTabBadgeActive]}>
          <Text style={[styles.planTabBadgeText, isActive && styles.planTabBadgeTextActive]}>
            {tier.badge}
          </Text>
        </View>
      ) : null}
    </View>
  );

  let tabBody = tabInner;
  if (isActive) {
    tabBody = (
      <LinearGradient
        colors={PAYWALL_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.planTabActiveBg}
      >
        {tabInner}
      </LinearGradient>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onSelectTier}
      style={styles.planTab}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      {tabBody}
    </TouchableOpacity>
  );
}

function MonthlyPriceCard({ tier, uiTokens, isDark }) {
  const cardBackground = pickPriceCardBackground(isDark, uiTokens);
  return (
    <View
      style={[
        styles.priceCard,
        {
          backgroundColor: cardBackground,
          borderColor: uiTokens.cardBorder,
        },
      ]}
    >
      <View style={styles.priceRow}>
        <GradientMaskedText style={styles.priceAmount}>{tier.priceAmount}</GradientMaskedText>
        <Text style={[styles.priceUnit, { color: uiTokens.textSecondary }]}>/month</Text>
      </View>
      <Text style={[styles.priceBillingLine, { color: uiTokens.textSecondary }]}>
        {tier.billingLine}
      </Text>

      <View style={[styles.priceDivider, { backgroundColor: uiTokens.cardBorder }]} />

      <View style={styles.priceChecklist}>{buildPriceCheckRows(uiTokens)}</View>
    </View>
  );
}

function buildPriceCheckRows(uiTokens) {
  const checkRows = [];
  for (let bulletIndex = 0; bulletIndex < PRICE_CARD_BULLETS.length; bulletIndex += 1) {
    const line = PRICE_CARD_BULLETS[bulletIndex];
    checkRows.push(
      <View key={line} style={styles.priceCheckRow}>
        <Ionicons name="checkmark" size={16} color={PAYWALL_CYAN} />
        <Text style={[styles.priceCheckText, { color: uiTokens.textSecondary }]}>{line}</Text>
      </View>,
    );
  }
  return checkRows;
}

function buildTrustBadgeItems(uiTokens) {
  const badgeItems = [];
  for (let badgeIndex = 0; badgeIndex < TRUST_BADGE_LABELS.length; badgeIndex += 1) {
    const label = TRUST_BADGE_LABELS[badgeIndex];
    badgeItems.push(
      <View key={label} style={styles.trustItem}>
        <Ionicons name="shield-checkmark" size={13} color={PAYWALL_CYAN} />
        <Text style={[styles.trustText, { color: uiTokens.textSecondary }]}>{label}</Text>
      </View>,
    );
  }
  return badgeItems;
}

function PaywallTrustStrip({ uiTokens }) {
  const badgeItems = buildTrustBadgeItems(uiTokens);
  return <View style={styles.trustRow}>{badgeItems}</View>;
}

function DesignLawBenefitRow({ row, rowIndex, uiTokens }) {
  const showTopBorder = rowIndex > 0;
  const rowBorderTopWidth = showTopBorder ? nb.borderWidth : 0;
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 14,
        borderTopWidth: rowBorderTopWidth,
        borderTopColor: uiTokens.cardBorder,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          borderWidth: nb.borderWidth,
          borderColor: uiTokens.cardBorder,
          backgroundColor: uiTokens.textPrimary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="checkmark" size={14} color={uiTokens.cardBg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: uiTokens.textPrimary }}>
          {row.title}
        </Text>
        <Text
          style={{
            fontSize: 12,
            fontWeight: '600',
            color: uiTokens.textSecondary,
            marginTop: 2,
          }}
        >
          {row.sub}
        </Text>
      </View>
    </View>
  );
}

function priceLabelFromTier(selectedTier) {
  if (selectedTier && selectedTier.priceLabel) return selectedTier.priceLabel;
  return DEFAULT_PRICE_LABEL;
}

function trialLabelFromTier(selectedTier) {
  if (selectedTier && selectedTier.trialLabel) return selectedTier.trialLabel;
  return TRAINER_SUBSCRIPTION_TRIAL_LABEL;
}

function buildDesignLawBenefitRows(uiTokens) {
  const benefitRows = [];
  for (let rowIndex = 0; rowIndex < DESIGN_LAW_PRO_ROWS.length; rowIndex += 1) {
    const row = DESIGN_LAW_PRO_ROWS[rowIndex];
    benefitRows.push(
      <DesignLawBenefitRow
        key={row.title}
        row={row}
        rowIndex={rowIndex}
        uiTokens={uiTokens}
      />,
    );
  }
  return benefitRows;
}

function DesignLawProOfferCard({
  isDark,
  selectedTier,
  onSkip,
  onStartTrial,
  trialLoading,
}) {
  const uiTokens = getOnboardingUiTokens(isDark);
  const priceLabel = priceLabelFromTier(selectedTier);
  const trialLabel = trialLabelFromTier(selectedTier);
  const trialSubtitle = `${trialLabel}. Cancel any time.`;
  const startTrialLabel = trialLoading ? 'Starting…' : 'Start free trial';
  const benefitRows = buildDesignLawBenefitRows(uiTokens);

  const heroCardStyle = {
    borderWidth: nb.borderWidth,
    borderColor: uiTokens.cardBorder,
    borderRadius: borderRadius.nbHero,
    backgroundColor: uiTokens.textPrimary,
    padding: 16,
    gap: 4,
  };

  return (
    <View style={{ gap: 14, paddingBottom: 8 }}>
      <HardShadow>
        <View style={heroCardStyle}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '900',
              color: uiTokens.textSecondary,
              letterSpacing: 1.1,
            }}
          >
            TRAINER PLATFORM SUBSCRIPTION
          </Text>
          <Text style={{ fontSize: 40, fontWeight: '900', color: uiTokens.cardBg }}>
            {priceLabel}
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: uiTokens.cardBg,
              opacity: 0.9,
            }}
          >
            {trialSubtitle}
          </Text>
        </View>
      </HardShadow>

      <HardShadow>
        <NbCard style={{ paddingVertical: 0 }}>{benefitRows}</NbCard>
      </HardShadow>

      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: uiTokens.textSecondary,
          lineHeight: 17,
        }}
      >
        The subscription renews automatically unless it is canceled at least 24 hours before the
        period ends. Manage it in your store account settings.
      </Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <NbButton variant="plain" onPress={onSkip} style={{ flex: 1 }}>
          Skip
        </NbButton>
        <NbButton
          variant="fill"
          onPress={onStartTrial}
          disabled={trialLoading}
          style={{ flex: 1 }}
        >
          {startTrialLabel}
        </NbButton>
      </View>
    </View>
  );
}

async function runDesignLawTrialOrSkip({ liveBilling, onSkip, startFreeTrial, productId }) {
  // Preview builds skip StoreKit and just advance the wizard.
  if (!liveBilling) {
    if (onSkip) {
      onSkip();
    }
    return;
  }
  try {
    await startFreeTrial(productId);
  } catch (trialError) {
    // Footer alert elsewhere — keep Design Law card quiet on purchase cancel.
    // Keep the catch so a cancelled StoreKit sheet does not throw into the wizard.
    if (trialError) {
      // no-op on purpose
    }
  }
}

function FitFlowPaywallBody({
  uiTokens,
  isDark,
  liveBilling,
  availableTiers,
  selectedTier,
  choosePlan,
  alreadySubscribed,
  successMessage,
  lastError,
  connected,
}) {
  const showPlanTabs = availableTiers.length > 1;
  const showTestingBadge = !liveBilling;
  const showSuccessBox = alreadySubscribed;
  const showErrorBox = liveBilling && lastError;
  const showConnectingHint = liveBilling && !connected && !alreadySubscribed;
  const showPaymentsOffHint = !liveBilling;
  const planTabsBackground = pickPlanTabsBackground(isDark, uiTokens);

  let selectedPriceLabel = '';
  if (selectedTier && selectedTier.priceLabel) {
    selectedPriceLabel = selectedTier.priceLabel;
  }
  const selectedTrialLabel = trialLabelFromTier(selectedTier);
  const legalPriceLine = `${selectedPriceLabel} · ${selectedTrialLabel}`;

  let selectedTierId = null;
  if (selectedTier) {
    selectedTierId = selectedTier.id;
  }

  let selectedDuration = undefined;
  if (selectedTier) {
    selectedDuration = selectedTier.duration;
  }

  const planTabElements = buildPlanTabElements(
    availableTiers,
    selectedTierId,
    uiTokens,
    choosePlan,
  );

  return (
    <View style={styles.root}>
      <PaywallBrandRow uiTokens={uiTokens} isDark={isDark} />

      {showTestingBadge ? (
        <View style={styles.testingBadge}>
          <Ionicons name="flask-outline" size={14} color={TESTING_BADGE_AMBER} />
          <Text style={styles.testingBadgeText}>Testing preview — not billing yet</Text>
        </View>
      ) : null}

      <View style={styles.heroWrap}>
        <Image
          source={SUBSCRIPTION_HERO}
          style={styles.heroImage}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </View>

      <Text style={[styles.headline, { color: uiTokens.textPrimary }]}>Unlimited coaching,</Text>
      <GradientMaskedText style={styles.headlineGradient}>one subscription.</GradientMaskedText>

      <Text style={[styles.subtitle, { color: uiTokens.textSecondary }]}>
        Run your entire coaching business from one app. Try every Pro tool free for 3 days.
      </Text>

      <FitFlowFeatureList uiTokens={uiTokens} isDark={isDark} />

      {showPlanTabs ? (
        <View
          style={[
            styles.planTabs,
            {
              borderColor: uiTokens.cardBorder,
              backgroundColor: planTabsBackground,
            },
          ]}
          accessibilityRole="tablist"
        >
          {planTabElements}
        </View>
      ) : null}

      {selectedTier ? (
        <MonthlyPriceCard tier={selectedTier} uiTokens={uiTokens} isDark={isDark} />
      ) : null}

      <PaywallTrustStrip uiTokens={uiTokens} />

      {showSuccessBox ? (
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={22} color={SUCCESS_GREEN} />
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      ) : null}

      {showErrorBox ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{lastError.message}</Text>
        </View>
      ) : null}

      {showConnectingHint ? (
        <Text style={[styles.hint, { color: uiTokens.textSecondary }]}>
          Connecting to the App Store…
        </Text>
      ) : null}

      <ProLegalFooter
        textColor={uiTokens.textSecondary}
        linkColor={PAYWALL_PINK}
        priceLine={legalPriceLine}
        durationLabel={selectedDuration}
      />

      {showPaymentsOffHint ? (
        <Text style={[styles.hint, { color: uiTokens.textSecondary }]}>
          Payments are not active in this build.
        </Text>
      ) : null}
    </View>
  );
}

function buildPlanTabElements(availableTiers, selectedTierId, uiTokens, choosePlan) {
  const tabElements = [];
  for (let tierIndex = 0; tierIndex < availableTiers.length; tierIndex += 1) {
    const tier = availableTiers[tierIndex];
    const isActive = tier.id === selectedTierId;
    tabElements.push(
      <SubscriptionPlanTab
        key={tier.id}
        tier={tier}
        isActive={isActive}
        uiTokens={uiTokens}
        onSelectTier={() => choosePlan(tier.id)}
      />,
    );
  }
  return tabElements;
}

// ===== MAIN FUNCTION =====

/**
 * Shared hook: filter tiers StoreKit knows about, then resolve the selected tier object.
 * @param {string|null|undefined} selectedPlanId
 */
export function useTrainerPaywallPlans(selectedPlanId) {
  // Hook order frozen: useSubscription → useMemo(availableTiers).
  // vocab: useSubscription = StoreKit + Firestore Pro access state from ProPlanSetup
  // 1. Live StoreKit + Firestore Pro access bag.
  const subscription = useSubscription();
  const storeProductsById = subscription.storeProducts;

  // 2. Tiers the store sells right now (or all marketing tiers when the flag is off).
  const availableTiers = useMemo(
    () => listAvailableTrainerTiers(TRAINER_SUBSCRIPTION_TIERS, storeProductsById),
    [storeProductsById],
  );

  // 3. Which tier row is highlighted for the CTA.
  const selectedTier = pickSelectedTier(availableTiers, selectedPlanId);

  return { subscription, availableTiers, selectedTier };
}

/**
 * Trainer onboarding step 8 scroll content — FitFlow paywall or Design Law compact card.
 */
export function TrainerProOfferStep({
  isDark,
  selectedPlanId,
  onSelectPlan,
  designLaw = false,
  onSkip,
}) {
  // Hook order frozen: useState → useTrainerPaywallPlans (useSubscription + useMemo inside).
  // 1. Theme tokens + which plan id is active (parent-controlled or local).
  const uiTokens = getOnboardingUiTokens(isDark);
  const [internalPlanId, setInternalPlanId] = useState(null);
  const activePlanId = selectedPlanId ?? internalPlanId;
  const choosePlan = onSelectPlan ?? setInternalPlanId;

  // 2. Subscription bag + purchasable tiers for this storefront.
  const { subscription, availableTiers, selectedTier } = useTrainerPaywallPlans(activePlanId);
  const { accessState, lastError, connected, startFreeTrial, actionLoading } = subscription;

  const liveBilling = TRAINER_PLATFORM_SUBSCRIPTION_ENABLED;
  const hasFullAccess = accessState && accessState.hasFullAccess === true;
  const alreadySubscribed = liveBilling && hasFullAccess;
  const selectedProductId = selectedTier ? selectedTier.productId : undefined;

  // 3. Design Law compact card — same trial path, different chrome.
  if (designLaw) {
    const handleDesignLawTrial = () =>
      runDesignLawTrialOrSkip({
        liveBilling,
        onSkip,
        startFreeTrial,
        productId: selectedProductId,
      });

    return (
      <DesignLawProOfferCard
        isDark={isDark}
        selectedTier={selectedTier}
        onSkip={onSkip}
        trialLoading={actionLoading}
        onStartTrial={handleDesignLawTrial}
      />
    );
  }

  // 4. Classic FitFlow paywall body for older onboarding chrome.
  const successMessage = pickSuccessMessage(accessState.access);

  return (
    <FitFlowPaywallBody
      uiTokens={uiTokens}
      isDark={isDark}
      liveBilling={liveBilling}
      availableTiers={availableTiers}
      selectedTier={selectedTier}
      choosePlan={choosePlan}
      alreadySubscribed={alreadySubscribed}
      successMessage={successMessage}
      lastError={lastError}
      connected={connected}
    />
  );
}

/**
 * Sticky footer CTA for trainer step 8 — rendered outside the setup ScrollView.
 */
export function TrainerSubscriptionCtaFooter({
  isDark,
  selectedPlanId,
  onComplete,
  bottomInset = 12,
}) {
  // Hook order frozen: getOnboardingUiTokens (not a hook) → useTrainerPaywallPlans.
  const uiTokens = getOnboardingUiTokens(isDark);
  const { subscription, selectedTier } = useTrainerPaywallPlans(selectedPlanId);
  const {
    accessState,
    firestoreLoading,
    actionLoading,
    connected,
    startFreeTrial,
    restorePurchases,
  } = subscription;

  const liveBilling = TRAINER_PLATFORM_SUBSCRIPTION_ENABLED;
  let hasFullAccess = false;
  if (accessState && accessState.hasFullAccess === true) {
    hasFullAccess = true;
  }
  const alreadySubscribed = liveBilling && hasFullAccess;
  const footerBusy = liveBilling && (actionLoading || firestoreLoading);
  const { ctaLabel, onPress } = pickFooterCtaAction({
    liveBilling,
    alreadySubscribed,
    storeConnected: connected,
    selectedTier,
    startFreeTrial,
    onComplete,
  });
  const metaLine = pickFooterMetaLine({ liveBilling, alreadySubscribed, selectedTier });
  const showRestoreAndSkip = liveBilling && !alreadySubscribed;
  const footerBg = pickStickyFooterBackground(isDark);
  const dimPrimaryCta = footerBusy ? { opacity: 0.5 } : null;

  let primaryCta = (
    <TouchableOpacity
      activeOpacity={0.88}
      disabled={footerBusy}
      onPress={onPress}
      style={[styles.ctaButtonWrap, dimPrimaryCta]}
    >
      <LinearGradient
        colors={PAYWALL_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.ctaButton}
      >
        <Text style={styles.ctaButtonText}>{ctaLabel}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  if (footerBusy) {
    primaryCta = (
      <View style={styles.footerLoading}>
        <ActivityIndicator color={PAYWALL_PINK} />
      </View>
    );
  }

  return (
    <View style={[styles.footer, { paddingBottom: bottomInset, backgroundColor: footerBg }]}>
      {primaryCta}

      <View style={styles.footerMetaRow}>
        <Text style={[styles.footerMetaText, { color: uiTokens.textSecondary }]} numberOfLines={1}>
          {metaLine}
        </Text>
        {showRestoreAndSkip ? (
          <TouchableOpacity
            onPress={restorePurchases}
            disabled={footerBusy}
            accessibilityRole="link"
          >
            <Text style={[styles.footerRestoreText, { color: uiTokens.textPrimary }]}>
              Restore purchases
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {showRestoreAndSkip ? (
        <TouchableOpacity
          onPress={onComplete}
          disabled={footerBusy}
          accessibilityRole="button"
          style={{ marginTop: 10, alignItems: 'center', paddingVertical: 6 }}
        >
          <Text style={[styles.footerRestoreText, { color: uiTokens.textSecondary }]}>
            Continue without Pro for now
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  root: { width: '100%' },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogo: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  brandPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  testingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: 'rgba(251,191,36,0.14)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
  },
  testingBadgeText: {
    color: TESTING_BADGE_AMBER,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroWrap: {
    height: 176,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  headline: {
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: -0.8,
    marginTop: 8,
  },
  headlineGradient: {
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  featureList: {
    gap: 12,
    marginBottom: 28,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  featureIconWell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,79,123,0.25)',
  },
  featureContent: {
    flex: 1,
    minWidth: 0,
  },
  featureLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  featureDetail: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  planTabs: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    padding: 6,
    gap: 6,
    marginBottom: 14,
  },
  planTab: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  planTabActiveBg: {
    borderRadius: 12,
  },
  planTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 42,
    paddingHorizontal: 8,
  },
  planTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  planTabBadge: {
    backgroundColor: 'rgba(77,216,240,0.15)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  planTabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  planTabBadgeText: {
    color: PAYWALL_CYAN,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  planTabBadgeTextActive: {
    color: lightColors.white,
  },
  priceCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    marginBottom: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  priceAmount: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 50,
  },
  priceUnit: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
  },
  priceBillingLine: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  priceDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16,
  },
  priceChecklist: {
    gap: 9,
  },
  priceCheckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  priceCheckText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 18,
    rowGap: 8,
    marginBottom: 18,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trustText: {
    fontSize: 12,
    fontWeight: '500',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  successText: {
    color: SUCCESS_GREEN,
    fontSize: 15,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    padding: 14,
    marginBottom: 12,
  },
  errorText: { color: '#FCA5A5', fontSize: 14, lineHeight: 20 },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  footerLoading: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: PAYWALL_PINK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  ctaButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    color: lightColors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  footerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },
  footerMetaText: {
    fontSize: 12,
    flexShrink: 1,
  },
  footerRestoreText: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
