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
import { getOnboardingUiTokens } from './onboardingAiDeps';
import { useSubscription } from '../../../subscription/SubscriptionProvider';
import {
  TRAINER_SUBSCRIPTION_TIERS,
  TRAINER_SUBSCRIPTION_TRIAL_LABEL,
  TRAINER_PLATFORM_SUBSCRIPTION_ENABLED,
  TRAINER_PRO_MONTHLY_PRODUCT_ID,
} from '../../../subscription/constants';
import SubscriptionLegalFooter from '../../../subscription/SubscriptionLegalFooter';

const SUBSCRIPTION_HERO = require('../../../assets/icons/digital-gift-card-abstract-concept-illustration.png');

/** FitFlow paywall gradient: orange → pink → magenta. */
const PAYWALL_GRADIENT = ['#FF8C42', '#FF4F7B', '#E63FA8'];
const PAYWALL_PINK = '#FF4F7B';
const PAYWALL_CYAN = '#4DD8F0';
const PAYWALL_GOLD = '#FCD34D';

const PAYWALL_FEATURES = [
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

const PRICE_CARD_CHECKLIST = [
  `${TRAINER_SUBSCRIPTION_TRIAL_LABEL} for new subscribers`,
  'Full access to every Pro feature',
  'Cancel anytime in your Apple ID settings',
];

const TRUST_ROW = [
  'Cancel anytime',
  'App Store secure billing',
  'Transparent pricing',
];

/**
 * Resolve which tiers are purchasable right now and the effective selection.
 * In live IAP builds a tier only shows once StoreKit returns its product
 * (monthly is always shown — it is the shipping App Store Connect product).
 */
export function useTrainerPaywallPlans(selectedPlanId) {
  const subscription = useSubscription();
  const { storeProducts } = subscription;

  const availableTiers = useMemo(() => {
    if (!TRAINER_PLATFORM_SUBSCRIPTION_ENABLED) return TRAINER_SUBSCRIPTION_TIERS;
    return TRAINER_SUBSCRIPTION_TIERS.filter(
      (tier) =>
        tier.productId === TRAINER_PRO_MONTHLY_PRODUCT_ID ||
        Boolean(storeProducts?.[tier.productId]),
    );
  }, [storeProducts]);

  const selectedTier =
    availableTiers.find((tier) => tier.id === selectedPlanId) ||
    availableTiers.find((tier) => tier.recommended) ||
    availableTiers[0];

  return { subscription, availableTiers, selectedTier };
}

function GradientText({ children, style }) {
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

function BrandRow({ t, isDark }) {
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandLeft}>
        <LinearGradient
          colors={PAYWALL_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.brandLogo}
        >
          <Ionicons name="barbell" size={18} color="#FFFFFF" />
        </LinearGradient>
        <Text style={[styles.brandName, { color: t.textPrimary }]}>Coach Connect</Text>
      </View>
      <View
        style={[
          styles.brandPill,
          {
            borderColor: t.cardBorder,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : t.cardBg,
          },
        ]}
      >
        <Ionicons name="star" size={13} color={PAYWALL_GOLD} />
        <Text style={[styles.brandPillText, { color: t.textSecondary }]}>
          {TRAINER_SUBSCRIPTION_TRIAL_LABEL}
        </Text>
      </View>
    </View>
  );
}

function FeatureList({ t, isDark }) {
  return (
    <View style={styles.featureList}>
      {PAYWALL_FEATURES.map(({ icon, label, detail }) => (
        <View
          key={label}
          style={[
            styles.featureCard,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : t.cardBg,
              borderColor: t.cardBorder,
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(255,140,66,0.20)', 'rgba(230,63,168,0.16)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.featureIconWell}
          >
            <Ionicons name={icon} size={19} color={PAYWALL_PINK} />
          </LinearGradient>
          <View style={styles.featureContent}>
            <Text style={[styles.featureLabel, { color: t.textPrimary }]}>{label}</Text>
            <Text style={[styles.featureDetail, { color: t.textSecondary }]}>{detail}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function PlanTab({ tier, active, t, onPress }) {
  const inner = (
    <View style={styles.planTabInner}>
      <Text style={[styles.planTabText, { color: active ? '#FFFFFF' : t.textSecondary }]}>
        {tier.tabLabel}
      </Text>
      {tier.badge ? (
        <View style={[styles.planTabBadge, active && styles.planTabBadgeActive]}>
          <Text style={[styles.planTabBadgeText, active && styles.planTabBadgeTextActive]}>
            {tier.badge}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={styles.planTab}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      {active ? (
        <LinearGradient
          colors={PAYWALL_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.planTabActiveBg}
        >
          {inner}
        </LinearGradient>
      ) : (
        inner
      )}
    </TouchableOpacity>
  );
}

function PriceCard({ tier, t, isDark }) {
  return (
    <View
      style={[
        styles.priceCard,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : t.cardBg,
          borderColor: t.cardBorder,
        },
      ]}
    >
      <View style={styles.priceRow}>
        <GradientText style={styles.priceAmount}>{tier.priceAmount}</GradientText>
        <Text style={[styles.priceUnit, { color: t.textSecondary }]}>/month</Text>
      </View>
      <Text style={[styles.priceBillingLine, { color: t.textSecondary }]}>{tier.billingLine}</Text>

      <View style={[styles.priceDivider, { backgroundColor: t.cardBorder }]} />

      <View style={styles.priceChecklist}>
        {PRICE_CARD_CHECKLIST.map((line) => (
          <View key={line} style={styles.priceCheckRow}>
            <Ionicons name="checkmark" size={16} color={PAYWALL_CYAN} />
            <Text style={[styles.priceCheckText, { color: t.textSecondary }]}>{line}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TrustRow({ t }) {
  return (
    <View style={styles.trustRow}>
      {TRUST_ROW.map((label) => (
        <View key={label} style={styles.trustItem}>
          <Ionicons name="shield-checkmark" size={13} color={PAYWALL_CYAN} />
          <Text style={[styles.trustText, { color: t.textSecondary }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Trainer onboarding step 8 — FitFlow-style Pro paywall (scroll content).
 * The CTA lives in TrainerSubscriptionCtaFooter, rendered sticky by the wizard.
 */
export function TrainerSubscriptionOnboardingStep({
  isDark,
  selectedPlanId,
  onSelectPlan,
}) {
  const t = getOnboardingUiTokens(isDark);
  const [internalPlanId, setInternalPlanId] = useState(null);
  const planId = selectedPlanId ?? internalPlanId;
  const selectPlan = onSelectPlan ?? setInternalPlanId;

  const { subscription, availableTiers, selectedTier } = useTrainerPaywallPlans(planId);
  const { accessState, lastError, connected } = subscription;

  const live = TRAINER_PLATFORM_SUBSCRIPTION_ENABLED;
  const subscribed = live && accessState?.hasFullAccess === true;

  return (
    <View style={styles.root}>
      <BrandRow t={t} isDark={isDark} />

      {!live ? (
        <View style={styles.testingBadge}>
          <Ionicons name="flask-outline" size={14} color="#FBBF24" />
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

      <Text style={[styles.headline, { color: t.textPrimary }]}>Unlimited coaching,</Text>
      <GradientText style={styles.headlineGradient}>one subscription.</GradientText>

      <Text style={[styles.subtitle, { color: t.textSecondary }]}>
        Run your entire coaching business from one app. Try every Pro tool free for 3 days.
      </Text>

      <FeatureList t={t} isDark={isDark} />

      {availableTiers.length > 1 ? (
        <View
          style={[
            styles.planTabs,
            {
              borderColor: t.cardBorder,
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : t.cardBg,
            },
          ]}
          accessibilityRole="tablist"
        >
          {availableTiers.map((tier) => (
            <PlanTab
              key={tier.id}
              tier={tier}
              active={tier.id === selectedTier?.id}
              t={t}
              onPress={() => selectPlan(tier.id)}
            />
          ))}
        </View>
      ) : null}

      {selectedTier ? <PriceCard tier={selectedTier} t={t} isDark={isDark} /> : null}

      <TrustRow t={t} />

      {subscribed ? (
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={22} color="#34D399" />
          <Text style={styles.successText}>
            {accessState.access === 'free_trial' ? 'Free trial started!' : 'Subscription active!'}
          </Text>
        </View>
      ) : null}

      {live && lastError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{lastError.message}</Text>
        </View>
      ) : null}

      {live && !connected && !subscribed ? (
        <Text style={[styles.hint, { color: t.textSecondary }]}>
          Connecting to the App Store…
        </Text>
      ) : null}

      <SubscriptionLegalFooter
        textColor={t.textSecondary}
        linkColor={PAYWALL_PINK}
        priceLine={`${selectedTier?.priceLabel || ''} · ${selectedTier?.trialLabel || TRAINER_SUBSCRIPTION_TRIAL_LABEL}`}
        durationLabel={selectedTier?.duration}
      />

      {!live ? (
        <Text style={[styles.hint, { color: t.textSecondary }]}>
          Payments are not active in this build.
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Sticky bottom CTA for trainer step 8 — mirrors the FitFlow fixed footer.
 * Rendered by OnboardingWizardScreen outside the ScrollView so it stays pinned.
 */
export function TrainerSubscriptionCtaFooter({
  isDark,
  selectedPlanId,
  onComplete,
  bottomInset = 12,
}) {
  const t = getOnboardingUiTokens(isDark);
  const { subscription, selectedTier } = useTrainerPaywallPlans(selectedPlanId);
  const {
    accessState,
    firestoreLoading,
    actionLoading,
    connected,
    startFreeTrial,
    restorePurchases,
  } = subscription;

  const live = TRAINER_PLATFORM_SUBSCRIPTION_ENABLED;
  const subscribed = live && accessState?.hasFullAccess === true;
  const busy = live && (actionLoading || firestoreLoading);
  const ctaDisabled = live && !subscribed && !connected;

  let ctaLabel = 'Start 3-day free trial';
  let onPress = () => startFreeTrial(selectedTier?.productId);
  if (!live) {
    ctaLabel = 'Got it — continue setup';
    onPress = onComplete;
  } else if (subscribed) {
    ctaLabel = 'Complete setup';
    onPress = onComplete;
  }

  return (
    <View
      style={[
        styles.footer,
        {
          paddingBottom: bottomInset,
          backgroundColor: isDark ? 'rgba(10,10,15,0.92)' : 'rgba(255,255,255,0.92)',
          borderTopColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      {busy ? (
        <View style={styles.footerLoading}>
          <ActivityIndicator color={PAYWALL_PINK} />
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.88}
          disabled={ctaDisabled}
          onPress={onPress}
          style={[styles.ctaButtonWrap, ctaDisabled && { opacity: 0.5 }]}
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
      )}

      <View style={styles.footerMetaRow}>
        <Text style={[styles.footerMetaText, { color: t.textSecondary }]} numberOfLines={1}>
          {!live
            ? 'Payments are not active in this build'
            : subscribed
              ? 'Your Pro access is ready'
              : `Then ${selectedTier?.ctaPriceLine || selectedTier?.priceLabel} · Cancel anytime`}
        </Text>
        {live && !subscribed ? (
          <TouchableOpacity onPress={restorePurchases} disabled={busy} accessibilityRole="link">
            <Text style={[styles.footerRestoreText, { color: t.textPrimary }]}>
              Restore purchases
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

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
    color: '#FBBF24',
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
    color: '#FFFFFF',
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
    color: '#34D399',
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
    borderTopWidth: 1,
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
    color: '#FFFFFF',
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
