import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  getOnboardingUiTokens,
  OnboardingPrimaryButton,
} from '../shared/components/onboarding/onboardingAiDeps';
import {
  TRAINER_SUBSCRIPTION_BENEFITS,
  TRAINER_SUBSCRIPTION_PRICE_LABEL,
  TRAINER_SUBSCRIPTION_TRIAL_LABEL,
} from './constants';
import SubscriptionLegalFooter from './SubscriptionLegalFooter';

const SUBSCRIPTION_HERO = require('../assets/icons/digital-gift-card-abstract-concept-illustration.png');

const FEATURE_META = [
  { icon: 'people', color: '#FF6B9D' },
  { icon: 'flash', color: '#FCD34D' },
  { icon: 'restaurant-outline', color: '#06B6D4' },
  { icon: 'stats-chart', color: '#A78BFA' },
  { icon: 'chatbubbles', color: '#10B981' },
];

/**
 * Onboarding step-9 style Pro subscription offer (hero image + feature cards + CTA).
 */
export default function TrainerProSubscriptionOffer({
  isDark = true,
  variant = 'paywall',
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
  const t = getOnboardingUiTokens(isDark);

  const features = useMemo(
    () =>
      TRAINER_SUBSCRIPTION_BENEFITS.map((title, index) => ({
        title,
        icon: FEATURE_META[index]?.icon || 'checkmark-circle',
        color: FEATURE_META[index]?.color || '#FF6B9D',
      })),
    [],
  );

  const title = variant === 'expired' ? 'Subscription expired' : 'Coach Connect Pro';
  const subtitle =
    variant === 'expired'
      ? `Renew Pro (${TRAINER_SUBSCRIPTION_PRICE_LABEL}) to keep managing clients, AI tools, and your dashboard.`
      : priceLine ||
        `${TRAINER_SUBSCRIPTION_PRICE_LABEL} · ${TRAINER_SUBSCRIPTION_TRIAL_LABEL}`;

  const ctaLabel = primaryLabel || (variant === 'expired' ? 'Re-subscribe' : 'Start free trial');
  // Don't hard-disable when StoreKit is still connecting — user can retry and see lastError.
  const ctaDisabled = actionLoading;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroWrap}>
          <Image source={SUBSCRIPTION_HERO} style={styles.heroImage} contentFit="contain" accessibilityIgnoresInvertColors />
        </View>

        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: t.textPrimary }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: t.textSecondary }]}>{subtitle}</Text>
          {variant === 'paywall' ? (
            <Text style={[styles.stepHint, { color: t.textLabel }]}>Trainer platform subscription</Text>
          ) : null}
        </View>

        <View style={styles.featuresContainer}>
          {features.map((feature) => (
            <View
              key={feature.title}
              style={[
                styles.featureCard,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
                },
              ]}
            >
              <View style={[styles.featureIcon, { backgroundColor: `${feature.color}20` }]}>
                <Ionicons name={feature.icon} size={20} color={feature.color} />
              </View>
              <View style={styles.featureContent}>
                <Text style={[styles.featureTitle, { color: t.textPrimary }]}>{feature.title}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={18} color="#34D399" />
            </View>
          ))}
        </View>

        {lastError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{lastError.message}</Text>
            {lastError.type === 'network' && onPrimary ? (
              <TouchableOpacity onPress={onPrimary}>
                <Text style={styles.errorLink}>Retry</Text>
              </TouchableOpacity>
            ) : null}
            {lastError.type === 'verification' && onContactSupport ? (
              <TouchableOpacity onPress={onContactSupport}>
                <Text style={styles.errorLink}>Contact support</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <SubscriptionLegalFooter
          textColor={t.textSecondary}
          linkColor="#FF6B9D"
          priceLine={subtitle}
          onOpenTerms={onOpenTerms}
          onOpenPrivacy={onOpenPrivacy}
        />

        <View style={styles.buttonContainer}>
          {actionLoading ? (
            <View style={styles.loadingBtn}>
              <ActivityIndicator color="#C1265A" />
            </View>
          ) : (
            <OnboardingPrimaryButton
              t={t}
              label={ctaLabel}
              disabled={ctaDisabled}
              onPress={onPrimary}
            />
          )}

          {typeof onRestore === 'function' ? (
            <TouchableOpacity
              activeOpacity={0.88}
              style={[
                styles.secondaryButton,
                {
                  borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'transparent',
                },
              ]}
              onPress={onRestore}
              disabled={actionLoading}
            >
              <Text style={[styles.secondaryButtonText, { color: t.textPrimary }]}>Restore purchases</Text>
            </TouchableOpacity>
          ) : null}

          {typeof onOpenSettings === 'function' ? (
            <TouchableOpacity onPress={onOpenSettings} style={styles.settingsLink}>
              <Text style={[styles.settingsLinkText, { color: t.textSecondary }]}>Settings</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
  },
  heroWrap: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 10,
  },
  stepHint: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  featuresContainer: {
    gap: 12,
    marginBottom: 14,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
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
  errorLink: { color: '#F9A8D4', fontWeight: '700', marginTop: 8, fontSize: 14 },
  legal: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  buttonContainer: {
    gap: 12,
    marginTop: 6,
    alignItems: 'center',
  },
  loadingBtn: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
    maxWidth: 400,
  },
  secondaryButton: {
    width: '80%',
    maxWidth: 400,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  settingsLink: { paddingVertical: 8 },
  settingsLinkText: { fontSize: 14, fontWeight: '600' },
});
