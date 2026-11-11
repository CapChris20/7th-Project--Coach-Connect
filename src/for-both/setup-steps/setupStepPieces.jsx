// Shared onboarding building blocks for Neobrutalist redesign.
// Flow: components use Neobrutalist design tokens and shared components.
// Used by NewUserSetupScreen, AIPermissionStep, TrainerProOfferStep.
//
// vocab: This file now provides minimal utilities; most styling comes from Nb* components.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  FOOD_CARD_BRAND,
  FOOD_CARD_MACRO_GRADIENTS,
  ONBOARDING_PALETTE,
  ONBOARDING_OPTION_GRADIENTS,
  ONBOARDING_CTA_GRADIENT,
  ONBOARDING_BRAND_GRADIENT,
  TRAINER_ONBOARDING_GRADIENT,
  ONBOARDING_ACCENT,
  ONBOARDING_ACCENT_SOFT,
  ONBOARDING_GLASS_TINTS,
  onboardingOptionGradient,
  hexToRgba,
  pillBackgroundGradient,
} from './setupColors';

// Re-export legacy color utilities for any remaining old code
export {
  FOOD_CARD_BRAND,
  FOOD_CARD_BRAND as brandColors,
  FOOD_CARD_MACRO_GRADIENTS,
  FOOD_CARD_MACRO_GRADIENTS as gradients,
  ONBOARDING_PALETTE,
  ONBOARDING_GLASS_TINTS,
  ONBOARDING_OPTION_GRADIENTS,
  ONBOARDING_CTA_GRADIENT,
  ONBOARDING_BRAND_GRADIENT,
  TRAINER_ONBOARDING_GRADIENT,
  ONBOARDING_ACCENT,
  ONBOARDING_ACCENT_SOFT,
  onboardingOptionGradient,
  hexToRgba,
  pillBackgroundGradient,
};

// ===== HELPER FUNCTIONS =====

// Legacy token function - kept for backward compatibility with remaining old code
function darkOnboardingTokens() {
  return {
    bg: '#0A0A0F',
    cardBg: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(255,255,255,0.08)',
    cardSelectedBg: hexToRgba(ONBOARDING_PALETTE.pink, 0.12),
    cardSelectedBorder: ONBOARDING_ACCENT,
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.5)',
    textLabel: 'rgba(255,255,255,0.35)',
    inputBg: 'rgba(255,255,255,0.05)',
    inputBorder: 'rgba(255,255,255,0.08)',
    toggleTrack: ONBOARDING_ACCENT,
    dayBtnBg: 'rgba(255,255,255,0.06)',
    progressTrack: 'rgba(255,255,255,0.08)',
    backBtnBg: 'rgba(255,255,255,0.06)',
    disabledBg: 'rgba(255,255,255,0.08)',
    disabledText: 'rgba(255,255,255,0.25)',
  };
}

function lightOnboardingTokens() {
  return {
    bg: '#F5F5F7',
    cardBg: '#FFFFFF',
    cardBorder: '#E5E7EB',
    cardSelectedBg: hexToRgba(ONBOARDING_PALETTE.pink, 0.1),
    cardSelectedBorder: ONBOARDING_ACCENT,
    textPrimary: '#0A0A0F',
    textSecondary: '#6B7280',
    textLabel: '#9CA3AF',
    inputBg: '#FFFFFF',
    inputBorder: '#E5E7EB',
    toggleTrack: ONBOARDING_ACCENT,
    dayBtnBg: '#FFFFFF',
    progressTrack: '#E5E7EB',
    backBtnBg: 'rgba(0,0,0,0.05)',
    disabledBg: '#E5E7EB',
    disabledText: '#9CA3AF',
  };
}

// ===== MAIN FUNCTION =====

/**
 * Food-card style icon well — thin gradient accent + soft pill fill.
 * @param {{ gradient?: string[], selected?: boolean, size: number, radius: number, style?: object, children: * }} props
 */
export function IconGradientWrap({ gradient, selected, size, radius, style, children }) {
  const stops = gradient || ONBOARDING_BRAND_GRADIENT;
  const backgroundStops = pillBackgroundGradient(stops, { strong: selected });
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <LinearGradient
        colors={backgroundStops}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}

/**
 * Dark vs light colors for onboarding cards, inputs, and the continue button.
 * Legacy function kept for backward compatibility.
 * @param {boolean} isDark
 * @returns {object}
 */
export function getOnboardingUiTokens(isDark) {
  return isDark ? darkOnboardingTokens() : lightOnboardingTokens();
}

/**
 * Legacy OnboardingPrimaryButton - kept for backward compatibility.
 * New code should use NbButton from look-and-feel.
 * @deprecated Use NbButton instead
 */
export function OnboardingPrimaryButton({
  disabled = false,
  onPress,
  onDisabledPress,
  label = 'Continue',
  t,
  variant,
}) {
  // This is a thin legacy wrapper - actual onboarding uses NbButton now
  return null;
}
