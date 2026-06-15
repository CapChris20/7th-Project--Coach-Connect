/**
 * AIOpt In Step
 *
 * Purpose: AIOpt In Step — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: AIOptInStep
 *
 * @file-header
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { getOnboardingUiTokens, OnboardingPrimaryButton } from './onboardingAiDeps';

const AI_LOTTIE = require('../../../assets/Lotties for Anatrox/Artificial intelligence digital technology (1).json');

export function AIOptInStep({
  isDark,
  currentStep,
  totalSteps,
  onEnableAI,
  onSkipAI,
}) {
  const t = getOnboardingUiTokens(isDark);

  const features = useMemo(
    () => [
      {
        icon: 'chatbubble',
        title: 'AI Fitness Coach',
        description: 'Chat anytime for personalized coaching advice',
        color: '#FF6B9D',
      },
      {
        icon: 'flash',
        title: 'Workout Generator',
        description: 'Auto-create custom plans tailored to your goals',
        color: '#FCD34D',
      },
      {
        icon: 'locate',
        title: 'Smart Progress Tracking',
        description: 'Get insights and adjustments as you improve',
        color: '#06B6D4',
      },
      {
        icon: 'sparkles',
        title: 'Form & Recovery Tips',
        description: 'Suggestions to train smarter and recover better',
        color: '#10B981',
      },
    ],
    []
  );

  return (
    <View style={{ width: '100%' }}>
      <View style={styles.animationContainer}>
        <LottieView source={AI_LOTTIE} autoPlay loop style={styles.lottie} />
      </View>

      <View style={styles.titleSection}>
        <Text style={[styles.title, { color: t.textPrimary }]}>AI-Powered Features</Text>
        <Text style={[styles.subtitle, { color: t.textSecondary }]}>
          CoachConnect includes optional smart tools to support your fitness journey. Enable them or skip for trainer-powered coaching.
        </Text>
        <Text style={[styles.stepHint, { color: t.textLabel }]}>
          Step {currentStep} of {totalSteps}
        </Text>
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
              <Text style={[styles.featureDescription, { color: t.textSecondary }]}>{feature.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={[styles.meterHint, { color: t.textSecondary }]}>
        This choice does not use your monthly switch allowance. Later, you can turn AI on or off in Settings — each flip uses
        part of a small monthly allowance, so choose wisely. If you turn it off repeatedly and leave it off, we may keep it off
        for about a month so you can decide what you want.
      </Text>

      <View style={[styles.buttonContainer, { alignItems: 'center' }]}>
        <OnboardingPrimaryButton t={t} onPress={onEnableAI} label="Yes, Enable AI" />

        <TouchableOpacity
          activeOpacity={0.88}
          style={[
            styles.secondaryButton,
            {
              alignSelf: 'center',
              width: '80%',
              maxWidth: 400,
              borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'transparent',
            },
          ]}
          onPress={onSkipAI}
        >
          <Text style={[styles.secondaryButtonText, { color: t.textPrimary }]}>No, Skip AI</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  animationContainer: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  lottie: {
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
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  meterHint: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 10,
  },
  buttonContainer: {
    gap: 12,
    marginTop: 6,
    paddingBottom: 8,
  },
  secondaryButton: {
    width: '100%',
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
});

