// Shared onboarding building blocks — Design Law tokens + NbButton CTA wrapper.
// Flow: getOnboardingUiTokens → SelectionCard / inputs in NewUserSetupScreen → Continue via OnboardingPrimaryButton.
// Used by NewUserSetupScreen, AIPermissionStep, TrainerProOfferStep.

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
import { lightColors, darkColors } from '../../look-and-feel/colorPalette';
import NbButton from '../../look-and-feel/NbButton';

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

// Design Law onboarding tokens — fill selected, 3px borders, bright dark shadow.
function darkOnboardingTokens() {
  return {
    bg: darkColors.nbBackground,
    cardBg: darkColors.nbSurface,
    cardBorder: darkColors.nbBorder,
    cardSelectedBg: darkColors.nbFill,
    cardSelectedBorder: darkColors.nbBorder,
    cardSelectedText: darkColors.nbOnFill,
    textPrimary: darkColors.nbInk,
    textSecondary: darkColors.nbMuted,
    textLabel: darkColors.nbMuted,
    inputBg: darkColors.nbSurface,
    inputBorder: darkColors.nbBorder,
    toggleTrack: darkColors.nbFill,
    dayBtnBg: darkColors.nbSurface,
    progressTrack: darkColors.nbSoft,
    backBtnBg: darkColors.nbSurface,
    disabledBg: darkColors.nbSoft,
    disabledText: darkColors.nbMuted,
    shadow: darkColors.nbShadow,
    soft: darkColors.nbSoft,
    fill: darkColors.nbFill,
    onFill: darkColors.nbOnFill,
  };
}

function lightOnboardingTokens() {
  return {
    bg: lightColors.nbBackground,
    cardBg: lightColors.nbSurface,
    cardBorder: lightColors.nbBorder,
    cardSelectedBg: lightColors.nbFill,
    cardSelectedBorder: lightColors.nbBorder,
    cardSelectedText: lightColors.nbOnFill,
    textPrimary: lightColors.nbInk,
    textSecondary: lightColors.nbMuted,
    textLabel: lightColors.nbMuted,
    inputBg: lightColors.nbSurface,
    inputBorder: lightColors.nbBorder,
    toggleTrack: lightColors.nbFill,
    dayBtnBg: lightColors.nbSurface,
    progressTrack: lightColors.nbSoft,
    backBtnBg: lightColors.nbSurface,
    disabledBg: lightColors.nbSoft,
    disabledText: lightColors.nbMuted,
    shadow: lightColors.nbShadow,
    soft: lightColors.nbSoft,
    fill: lightColors.nbFill,
    onFill: lightColors.nbOnFill,
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
 * Design Law Continue CTA — wraps NbButton so the footer keeps working.
 * vocab: onDisabledPress = fires when the user taps while validateStep() failed (explain blockers).
 */
export function OnboardingPrimaryButton({
  disabled = false,
  onPress,
  onDisabledPress,
  label = 'Continue',
  t,
  variant,
}) {
  // Keep pressable while “invalid” so onDisabledPress can explain blockers (NbButton
  // would swallow taps if we passed disabled={true}).
  return (
    <NbButton
      variant="fill"
      onPress={() => {
        if (disabled) {
          onDisabledPress?.();
          return;
        }
        onPress?.();
      }}
      // Design Law footer Continue fills the bar (beside the back square). Do not cap width.
      style={{ width: '100%', opacity: disabled ? 0.45 : 1 }}
    >
      {label}
    </NbButton>
  );
}
