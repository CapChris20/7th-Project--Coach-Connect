// Onboarding-style Pro paywall: hero, benefit cards, subscribe CTA, restore, legal links.
// Flow: theme palette → benefit list + copy for expired vs paywall → IAP buttons + ProLegalFooter.
// Used by trainer Pro upgrade and expired screens. SKU ids stay in ProPlanPurchases, not here.
//
// vocab: NbCard / NbButton / NbListRow = Design Law neobrutalist shells
// vocab: HardShadow = hard offset shadow (not a soft glow)
// vocab: SafeAreaView edges = which device insets this screen respects

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  TRAINER_SUBSCRIPTION_BENEFITS,
  TRAINER_SUBSCRIPTION_PRICE_LABEL,
  TRAINER_SUBSCRIPTION_TRIAL_LABEL,
} from './proPlanSwitches';
import ProLegalFooter from './ProLegalFooter';
import { lightColors, darkColors, nb, spacing } from '../look-and-feel/colorPalette';
import NbCard from '../look-and-feel/NbCard';
import NbButton from '../look-and-feel/NbButton';
import NbListRow from '../look-and-feel/NbListRow';
import HardShadow from '../look-and-feel/HardShadow';

// ===== NAMED CONSTANTS =====

const SUBSCRIPTION_HERO = require('../assets/icons/digital-gift-card-abstract-concept-illustration.png');
const VARIANT_EXPIRED = 'expired';
const VARIANT_PAYWALL = 'paywall';
const DEFAULT_FEATURE_ICON = 'checkmark-circle';
const ERROR_TYPE_NETWORK = 'network';
const ERROR_TYPE_VERIFICATION = 'verification';
const FEATURE_CHECKMARK_SIZE = 18;
const PAYWALL_STEP_HINT = 'Trainer platform subscription';
const RESTORE_PURCHASES_LABEL = 'Restore purchases';
const SETTINGS_LINK_LABEL = 'Settings';
const RETRY_LINK_LABEL = 'Retry';
const CONTACT_SUPPORT_LINK_LABEL = 'Contact support';

// Manipulate here: icon per benefit row — extra benefits fall back to checkmark
const FEATURE_ICON_BY_INDEX = [
  { icon: 'people' },
  { icon: 'flash' },
  { icon: 'restaurant-outline' },
  { icon: 'stats-chart' },
  { icon: 'chatbubbles' },
];

// ===== HELPER FUNCTIONS =====

/**
 * Error card under the benefit list. Retry for network; support for verification.
 * @param {object} props
 */
function OfferErrorBox({ lastError, onPrimary, onContactSupport, palette }) {
  if (!lastError) {
    return null;
  }

  const showRetryLink = lastError.type === ERROR_TYPE_NETWORK && onPrimary;
  const showSupportLink = lastError.type === ERROR_TYPE_VERIFICATION && onContactSupport;
  const errorBoxStyle = [styles.errorBox, { borderColor: palette.nbBorder }];
  const errorTextStyle = [styles.errorText, { color: palette.nbInk }];
  const errorLinkStyle = [styles.errorLink, { color: palette.nbInk }];

  let retryLinkNode = null;
  if (showRetryLink) {
    retryLinkNode = (
      <TouchableOpacity onPress={onPrimary}>
        <Text style={errorLinkStyle}>{RETRY_LINK_LABEL}</Text>
      </TouchableOpacity>
    );
  }

  let supportLinkNode = null;
  if (showSupportLink) {
    supportLinkNode = (
      <TouchableOpacity onPress={onContactSupport}>
        <Text style={errorLinkStyle}>{CONTACT_SUPPORT_LINK_LABEL}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <NbCard style={errorBoxStyle}>
      <Text style={errorTextStyle}>{lastError.message}</Text>
      {retryLinkNode}
      {supportLinkNode}
    </NbCard>
  );
}

/**
 * HardShadow + NbListRow stack for each Pro benefit title.
 * @param {{ features: Array<{ title: string }>, palette: object }} props
 */
function FeatureCardList({ features, palette }) {
  return (
    <View style={styles.featuresContainer}>
      {features.map((feature) => (
        <HardShadow key={feature.title} offset={nb.shadowOffsetCard} radius={10}>
          <NbListRow
            title={feature.title}
            right={
              <Ionicons
                name="checkmark-circle"
                size={FEATURE_CHECKMARK_SIZE}
                color={palette.nbInk}
              />
            }
          />
        </HardShadow>
      ))}
    </View>
  );
}

/**
 * Primary CTA (or spinner), Restore, optional Settings link.
 * @param {object} props
 */
function OfferActionButtons({
  actionLoading,
  palette,
  ctaLabel,
  ctaDisabled,
  onPrimary,
  onRestore,
  onOpenSettings,
}) {
  const showRestoreButton = typeof onRestore === 'function';
  const showSettingsLink = typeof onOpenSettings === 'function';
  const settingsLinkTextStyle = [styles.settingsLinkText, { color: palette.nbMuted }];

  let primaryActionNode = null;
  if (actionLoading) {
    primaryActionNode = (
      <View style={styles.loadingBtn}>
        <ActivityIndicator color={palette.nbInk} />
      </View>
    );
  } else {
    primaryActionNode = (
      <NbButton variant="brand" onPress={onPrimary} disabled={ctaDisabled} style={styles.ctaWidth}>
        {ctaLabel}
      </NbButton>
    );
  }

  let restoreButtonNode = null;
  if (showRestoreButton) {
    restoreButtonNode = (
      <NbButton
        variant="plain"
        onPress={onRestore}
        disabled={actionLoading}
        style={styles.ctaWidth}
      >
        {RESTORE_PURCHASES_LABEL}
      </NbButton>
    );
  }

  let settingsLinkNode = null;
  if (showSettingsLink) {
    settingsLinkNode = (
      <TouchableOpacity onPress={onOpenSettings} style={styles.settingsLink}>
        <Text style={settingsLinkTextStyle}>{SETTINGS_LINK_LABEL}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.buttonContainer}>
      {primaryActionNode}
      {restoreButtonNode}
      {settingsLinkNode}
    </View>
  );
}

/**
 * Full scroll layout for the offer screen.
 * @param {object} props
 */
function ProUpgradeOfferLayout({
  palette,
  copy,
  features,
  actionLoading,
  lastError,
  ctaDisabled,
  onPrimary,
  onRestore,
  onOpenSettings,
  onContactSupport,
  onOpenTerms,
  onOpenPrivacy,
}) {
  const safeAreaStyle = [styles.safe, { backgroundColor: palette.nbBackground }];
  const heroWrapStyle = [
    styles.heroWrap,
    { backgroundColor: palette.nbSurface, borderColor: palette.nbBorder },
  ];
  const titleStyle = [styles.title, { color: palette.nbInk }];
  const subtitleStyle = [styles.subtitle, { color: palette.nbMuted }];
  const stepHintStyle = [styles.stepHint, { color: palette.nbMuted }];

  let paywallHintNode = null;
  if (copy.showPaywallHint) {
    paywallHintNode = <Text style={stepHintStyle}>{PAYWALL_STEP_HINT}</Text>;
  }

  return (
    <SafeAreaView style={safeAreaStyle} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <HardShadow offset={nb.shadowOffsetCard} radius={10} style={styles.heroShadow}>
          <View style={heroWrapStyle}>
            <Image
              source={SUBSCRIPTION_HERO}
              style={styles.heroImage}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          </View>
        </HardShadow>

        <View style={styles.titleSection}>
          <Text style={titleStyle}>{copy.title}</Text>
          <Text style={subtitleStyle}>{copy.subtitle}</Text>
          {paywallHintNode}
        </View>

        <FeatureCardList features={features} palette={palette} />

        <OfferErrorBox
          lastError={lastError}
          onPrimary={onPrimary}
          onContactSupport={onContactSupport}
          palette={palette}
        />

        <ProLegalFooter
          textColor={palette.nbMuted}
          linkColor={palette.nbInk}
          priceLine={copy.subtitle}
          onOpenTerms={onOpenTerms}
          onOpenPrivacy={onOpenPrivacy}
        />

        <OfferActionButtons
          actionLoading={actionLoading}
          palette={palette}
          ctaLabel={copy.ctaLabel}
          ctaDisabled={ctaDisabled}
          onPrimary={onPrimary}
          onRestore={onRestore}
          onOpenSettings={onOpenSettings}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Shared Pro offer chrome for paywall and expired variants.
 * @param {object} props
 */
export default function ProUpgradeOffer({
  isDark = true,
  variant = VARIANT_PAYWALL,
  priceLine,
  actionLoading = false,
  lastError = null,
  onPrimary,
  primaryLabel,
  onRestore,
  onOpenSettings,
  onContactSupport,
  onOpenTerms,
  onOpenPrivacy,
  connected = true,
}) {
  // 1. Theme tokens for every Nb shell on this screen.
  const palette = isDark ? darkColors : lightColors;
  // Parent still passes connected; keep accepting it without gating the CTA.
  void connected;

  // 2. Benefit cards — stable list from proPlanSwitches copy.
  const features = useMemo(() => benefitRowsWithIcons(), []);

  // 3. Headlines and CTA label depend on expired vs first-subscribe variant.
  const copy = buildOfferCopy({ variant, priceLine, primaryLabel });

  // Keep CTA tappable while StoreKit connects so retry can surface lastError (not hard-disabled).
  const ctaDisabled = actionLoading;

  return (
    <ProUpgradeOfferLayout
      palette={palette}
      copy={copy}
      features={features}
      actionLoading={actionLoading}
      lastError={lastError}
      ctaDisabled={ctaDisabled}
      onPrimary={onPrimary}
      onRestore={onRestore}
      onOpenSettings={onOpenSettings}
      onContactSupport={onContactSupport}
      onOpenTerms={onOpenTerms}
      onOpenPrivacy={onOpenPrivacy}
    />
  );
}

// PLUMBING — skip unless debugging

/**
 * Pair each benefit title with an icon name (UI currently shows a checkmark).
 * @returns {Array<{ title: string, icon: string }>}
 */
function benefitRowsWithIcons() {
  return TRAINER_SUBSCRIPTION_BENEFITS.map((title, index) => ({
    title,
    icon: FEATURE_ICON_BY_INDEX[index]?.icon || DEFAULT_FEATURE_ICON,
  }));
}

function offerIsExpiredVariant(variant) {
  return variant === VARIANT_EXPIRED;
}

/**
 * Title / subtitle / CTA strings for paywall vs expired.
 * @param {{ variant: string, priceLine?: string, primaryLabel?: string }} args
 */
function buildOfferCopy({ variant, priceLine, primaryLabel }) {
  const isExpired = offerIsExpiredVariant(variant);
  const defaultSubtitle = `${TRAINER_SUBSCRIPTION_PRICE_LABEL} · ${TRAINER_SUBSCRIPTION_TRIAL_LABEL}`;
  const expiredSubtitle = `Renew Pro (${TRAINER_SUBSCRIPTION_PRICE_LABEL}) to keep managing clients, AI tools, and your dashboard.`;
  const defaultCtaLabel = isExpired ? 'Re-subscribe' : 'Start free trial';
  const paywallSubtitle = priceLine || defaultSubtitle;

  let title = 'Coach Connect Pro';
  let subtitle = paywallSubtitle;
  if (isExpired) {
    title = 'Subscription expired';
    subtitle = expiredSubtitle;
  }

  return {
    title,
    subtitle,
    ctaLabel: primaryLabel || defaultCtaLabel,
    showPaywallHint: variant === VARIANT_PAYWALL,
  };
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  heroShadow: {
    marginBottom: spacing.sm,
  },
  // Manipulate here: hero frame height — keep edge-to-edge feel inside the HardShadow card
  heroWrap: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  titleSection: {
    alignItems: 'flex-start',
    marginBottom: 22,
    paddingHorizontal: spacing.sm,
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 24,
    lineHeight: 30,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  stepHint: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  featuresContainer: {
    gap: 12,
    marginBottom: 14,
  },
  errorBox: {
    padding: 14,
    marginBottom: 12,
  },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  errorLink: { fontFamily: 'SpaceGrotesk_700Bold', marginTop: 8, fontSize: 14 },
  buttonContainer: {
    gap: 12,
    marginTop: 6,
    alignItems: 'stretch',
  },
  loadingBtn: {
    height: nb.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  ctaWidth: {
    width: '100%',
  },
  settingsLink: {
    paddingVertical: 8,
    minHeight: nb.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsLinkText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
