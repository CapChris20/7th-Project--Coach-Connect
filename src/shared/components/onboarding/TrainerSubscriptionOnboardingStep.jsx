import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getOnboardingUiTokens, OnboardingPrimaryButton, ONBOARDING_ACCENT } from './onboardingAiDeps';
import { useSubscription } from '../../../subscription/SubscriptionProvider';
import {
  TRAINER_SUBSCRIPTION_LEGAL,
  TRAINER_SUBSCRIPTION_TIERS,
} from '../../../subscription/constants';

const SUBSCRIPTION_HERO = require('../../../assets/icons/digital-gift-card-abstract-concept-illustration.png');

const FEATURE_META = [
  { icon: 'people', color: '#FF6B9D' },
  { icon: 'flash', color: '#FCD34D' },
  { icon: 'restaurant-outline', color: '#06B6D4' },
  { icon: 'stats-chart', color: '#A78BFA' },
  { icon: 'chatbubbles', color: '#10B981' },
];

/**
 * Trainer onboarding step 8 — pick a Pro tier and complete StoreKit purchase.
 */
export function TrainerSubscriptionOnboardingStep({
  isDark,
  currentStep,
  totalSteps,
  onComplete,
}) {
  const t = getOnboardingUiTokens(isDark);
  const {
    accessState,
    firestoreLoading,
    actionLoading,
    lastError,
    connected,
    storeProduct,
    startFreeTrial,
    restorePurchases,
  } = useSubscription();

  const [selectedTierId, setSelectedTierId] = useState(TRAINER_SUBSCRIPTION_TIERS[0]?.id || 'pro_monthly');

  const selectedTier = useMemo(
    () => TRAINER_SUBSCRIPTION_TIERS.find((tier) => tier.id === selectedTierId) || TRAINER_SUBSCRIPTION_TIERS[0],
    [selectedTierId],
  );

  const storePrice =
    storeProduct?.displayPrice ||
    storeProduct?.localizedPrice ||
    selectedTier?.priceLabel;

  const subscribed = accessState?.hasFullAccess === true;

  if (Platform.OS !== 'ios') {
    return (
      <View style={styles.root}>
        <Text style={[styles.title, { color: t.textPrimary }]}>Coach Connect Pro</Text>
        <Text style={[styles.subtitle, { color: t.textSecondary }]}>
          Trainer subscriptions are available on iOS. You can finish setup here and subscribe later from the trainer app on an iPhone.
        </Text>
        <OnboardingPrimaryButton t={t} label="Complete setup" onPress={onComplete} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.heroWrap}>
        <Image source={SUBSCRIPTION_HERO} style={styles.heroImage} contentFit="contain" accessibilityIgnoresInvertColors />
      </View>

      <View style={styles.titleSection}>
        <Text style={[styles.title, { color: t.textPrimary }]}>Choose your plan</Text>
        <Text style={[styles.subtitle, { color: t.textSecondary }]}>
          Trainers need an active Pro subscription to manage clients, AI tools, and your dashboard.
        </Text>
        <Text style={[styles.stepHint, { color: t.textLabel }]}>
          Step {currentStep} of {totalSteps}
        </Text>
      </View>

      <View style={styles.tierList}>
        {TRAINER_SUBSCRIPTION_TIERS.map((tier) => {
          const selected = tier.id === selectedTierId;
          return (
            <TouchableOpacity
              key={tier.id}
              activeOpacity={0.88}
              onPress={() => setSelectedTierId(tier.id)}
              style={[
                styles.tierCard,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : t.cardBg,
                  borderColor: selected ? '#FF6B9D' : t.cardBorder,
                },
                selected && styles.tierCardSelected,
              ]}
            >
              <View style={styles.tierHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tierName, { color: t.textPrimary }]}>{tier.name}</Text>
                  <Text style={[styles.tierPrice, { color: t.textSecondary }]}>
                    {storePrice} · {tier.trialLabel}
                  </Text>
                </View>
                <View
                  style={[
                    styles.tierRadio,
                    {
                      borderColor: selected ? '#FF6B9D' : t.cardBorder,
                      backgroundColor: selected ? '#FF6B9D' : 'transparent',
                    },
                  ]}
                >
                  {selected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                </View>
              </View>

              {tier.recommended ? (
                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedText}>Recommended</Text>
                </View>
              ) : null}

              <View style={styles.benefitList}>
                {tier.benefits.map((benefit, index) => (
                  <View key={benefit} style={styles.benefitRow}>
                    <Ionicons
                      name={FEATURE_META[index]?.icon || 'checkmark-circle'}
                      size={16}
                      color={FEATURE_META[index]?.color || '#34D399'}
                    />
                    <Text style={[styles.benefitText, { color: t.textPrimary }]}>{benefit}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {subscribed ? (
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={22} color="#34D399" />
          <Text style={styles.successText}>
            {accessState.access === 'free_trial' ? 'Free trial started!' : 'Subscription active!'}
          </Text>
        </View>
      ) : null}

      {lastError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{lastError.message}</Text>
        </View>
      ) : null}

      <Text style={[styles.legal, { color: t.textSecondary }]}>{TRAINER_SUBSCRIPTION_LEGAL}</Text>

      <View style={styles.buttonContainer}>
        {subscribed ? (
          <OnboardingPrimaryButton t={t} label="Complete setup" onPress={onComplete} />
        ) : actionLoading || firestoreLoading ? (
          <View style={styles.loadingBtn}>
            <ActivityIndicator color={ONBOARDING_ACCENT} />
          </View>
        ) : (
          <>
            <OnboardingPrimaryButton
              t={t}
              label="Start free trial"
              disabled={!connected}
              onPress={startFreeTrial}
            />
            <TouchableOpacity
              activeOpacity={0.88}
              style={[
                styles.secondaryButton,
                {
                  borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'transparent',
                },
              ]}
              onPress={restorePurchases}
            >
              <Text style={[styles.secondaryButtonText, { color: t.textPrimary }]}>Restore purchases</Text>
            </TouchableOpacity>
            {!connected ? (
              <Text style={[styles.hint, { color: t.textSecondary }]}>
                Connecting to the App Store…
              </Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  heroWrap: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  stepHint: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  tierList: {
    gap: 14,
    marginBottom: 14,
  },
  tierCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  tierCardSelected: {
    shadowColor: '#FF6B9D',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tierName: {
    fontSize: 18,
    fontWeight: '800',
  },
  tierPrice: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  tierRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,107,157,0.15)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  recommendedText: {
    color: '#FF6B9D',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  benefitList: {
    gap: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
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
  legal: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  buttonContainer: {
    gap: 12,
    marginTop: 4,
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
  hint: {
    fontSize: 13,
    textAlign: 'center',
  },
});
