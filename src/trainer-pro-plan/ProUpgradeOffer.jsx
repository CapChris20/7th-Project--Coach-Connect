// Onboarding-style Pro paywall: hero, benefit cards, subscribe CTA, restore, legal links.
// Flow: pick expired vs first-subscribe copy → list TRAINER_SUBSCRIPTION_BENEFITS → primary IAP action.
// Used by trainer Pro upgrade / expired-subscription screens. Product ids live in the parent, not here.
//
// vocab: NbCard / NbButton / NbListRow = neobrutalist shells; brand gradient is the single CTA moment

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

// ===== NAMED CONSTANTS =====

const SUBSCRIPTION_HERO = require('../assets/icons/digital-gift-card-abstract-concept-illustration.png');
const VARIANT_EXPIRED = 'expired';
const VARIANT_PAYWALL = 'paywall';
const DEFAULT_FEATURE_ICON = 'checkmark-circle';
const ERROR_TYPE_NETWORK = 'network';
const ERROR_TYPE_VERIFICATION = 'verification';

const FEATURE_META = [
  { icon: 'people' },
  { icon: 'flash' },
  { icon: 'restaurant-outline' },
  { icon: 'stats-chart' },
  { icon: 'chatbubbles' },
];

// ===== HELPER FUNCTIONS =====

/**
 * Pair each benefit string with an icon. Extra benefits reuse the checkmark fallback.
 * @returns {Array<{ title: string, icon: string }>}
 */
function featureCardsFromBenefits() {
  return TRAINER_SUBSCRIPTION_BENEFITS.map((title, index) => ({
    title,
    icon: FEATURE_META[index]?.icon || DEFAULT_FEATURE_ICON,
  }));
}

/**
 * @param {string} variant
 * @returns {boolean}
 */
function isExpiredOfferVariant(variant) {
  return variant === VARIANT_EXPIRED;
}

/**
 * Expired vs first-subscribe headlines. Price line from the parent wins on the paywall variant.
 * @param {object} args
 */
function buildOfferCopy({ variant, priceLine, primaryLabel }) {
  const isExpired = isExpiredOfferVariant(variant);
  const defaultSubtitle = `${TRAINER_SUBSCRIPTION_PRICE_LABEL} · ${TRAINER_SUBSCRIPTION_TRIAL_LABEL}`;
  const expiredSubtitle = `Renew Pro (${TRAINER_SUBSCRIPTION_PRICE_LABEL}) to keep managing clients, AI tools, and your dashboard.`;
  const defaultCta = isExpired ? 'Re-subscribe' : 'Start free trial';
  const paywallSubtitle = priceLine || defaultSubtitle;
  return {
    title: isExpired ? 'Subscription expired' : 'Coach Connect Pro',
    subtitle: isExpired ? expiredSubtitle : paywallSubtitle,
    ctaLabel: primaryLabel || defaultCta,
    showPaywallHint: variant === VARIANT_PAYWALL,
  };
}

/**
 * StoreKit / network failures. Only the matching type shows its extra link.
 * @param {object} props
 */
function OfferErrorBox({ lastError, onPrimary, onContactSupport, palette }) {
  if (!lastError) return null;
  const showRetry = lastError.type === ERROR_TYPE_NETWORK && onPrimary;
  const showSupport = lastError.type === ERROR_TYPE_VERIFICATION && onContactSupport;
  return (
    <NbCard style={[styles.errorBox, { borderColor: palette.nbBorder }]}>
      <Text style={[styles.errorText, { color: palette.nbInk }]}>{lastError.message}</Text>
      {showRetry ? (
        <TouchableOpacity onPress={onPrimary}>
          <Text style={[styles.errorLink, { color: palette.nbInk }]}>Retry</Text>
        </TouchableOpacity>
      ) : null}
      {showSupport ? (
        <TouchableOpacity onPress={onContactSupport}>
          <Text style={[styles.errorLink, { color: palette.nbInk }]}>Contact support</Text>
        </TouchableOpacity>
      ) : null}
    </NbCard>
  );
}

/**
 * @param {object} props
 */
function FeatureCardList({ features, palette }) {
  return (
    <View style={styles.featuresContainer}>
      {features.map((feature) => (
        <NbListRow
          key={feature.title}
          title={feature.title}
          right={<Ionicons name="checkmark-circle" size={18} color={palette.nbInk} />}
          style={styles.featureRow}
        />
      ))}
    </View>
  );
}

/**
 * Subscribe stays tappable while StoreKit is still connecting so the user can retry and see lastError.
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
  return (
    <View style={styles.buttonContainer}>
      {actionLoading ? (
        <View style={styles.loadingBtn}>
          <ActivityIndicator color={palette.nbInk} />
        </View>
      ) : (
        <NbButton variant="brand" onPress={onPrimary} disabled={ctaDisabled} style={styles.ctaWidth}>
          {ctaLabel}
        </NbButton>
      )}

      {typeof onRestore === 'function' ? (
        <NbButton variant="plain" onPress={onRestore} disabled={actionLoading} style={styles.ctaWidth}>
          Restore purchases
        </NbButton>
      ) : null}

      {typeof onOpenSettings === 'function' ? (
        <TouchableOpacity onPress={onOpenSettings} style={styles.settingsLink}>
          <Text style={[styles.settingsLinkText, { color: palette.nbMuted }]}>Settings</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Onboarding step-9 style Pro subscription offer (hero image + feature cards + CTA).
 * IAP product ids (com.coachconnect.month / year) stay in the purchase parent — this screen only labels the CTA.
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
  const palette = isDark ? darkColors : lightColors;
  void connected;

  const features = useMemo(() => featureCardsFromBenefits(), []);
  const copy = buildOfferCopy({ variant, priceLine, primaryLabel });
  // Don't hard-disable when StoreKit is still connecting — user can retry and see lastError.
  const ctaDisabled = actionLoading;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.nbBackground }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroWrap}>
          <Image source={SUBSCRIPTION_HERO} style={styles.heroImage} contentFit="contain" accessibilityIgnoresInvertColors />
        </View>

        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: palette.nbInk }]}>{copy.title}</Text>
          <Text style={[styles.subtitle, { color: palette.nbMuted }]}>{copy.subtitle}</Text>
          {copy.showPaywallHint ? (
            <Text style={[styles.stepHint, { color: palette.nbMuted }]}>Trainer platform subscription</Text>
          ) : null}
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

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  heroWrap: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
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
  featureRow: {
    // NbListRow already has thick border
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
  settingsLink: { paddingVertical: 8, minHeight: nb.minTouchTarget, justifyContent: 'center', alignItems: 'center' },
  settingsLinkText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
