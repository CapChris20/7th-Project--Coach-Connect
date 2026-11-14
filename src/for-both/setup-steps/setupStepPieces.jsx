// Shared onboarding building blocks — Design Law tokens + NbButton Continue wrapper.
// Flow: getOnboardingUiTokens → selection chrome in NewUserSetupScreen → OnboardingPrimaryButton in footer.
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

// ===== NAMED CONSTANTS =====

// Re-export frozen color keys so older setup files keep importing from one place.
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

// Manipulate here: ghosted Continue opacity when validateStep() failed.
const DISABLED_CONTINUE_OPACITY = 0.45;
const ENABLED_CONTINUE_OPACITY = 1;

// ===== MAIN FUNCTION =====

/**
 * Dark vs light Nb tokens for onboarding cards, inputs, and footer chrome.
 * @param {boolean} isDark
 * @returns {object}
 */
export function getOnboardingUiTokens(isDark) {
  // 1. Dark theme — Nb dark surfaces / ink / muted.
  if (isDark) {
    return buildDarkOnboardingTokenMap();
  }
  // 2. Light theme — Nb light surfaces / ink / muted.
  return buildLightOnboardingTokenMap();
}

/**
 * Food-card style icon well with a soft gradient fill behind children.
 */
export function IconGradientWrap({ gradient, selected, size, radius, style, children }) {
  // 1. Fall back to the brand CTA pair when the caller skips a gradient.
  const gradientStops = gradient || ONBOARDING_BRAND_GRADIENT;

  // 2. Soften the stops — selected chips use the stronger alpha pair.
  // vocab: pillBackgroundGradient = turns [#hex,#hex] into faded rgba pair for LinearGradient
  const fadedStops = pillBackgroundGradient(gradientStops, { strong: selected });

  // 3. Size the well to the caller's width/height/radius, then paint the fill under children.
  const wellSizeStyle = {
    width: size,
    height: size,
    borderRadius: radius,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const childrenCenterStyle = {
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <View style={[wellSizeStyle, style]}>
      <LinearGradient
        colors={fadedStops}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={childrenCenterStyle}>{children}</View>
    </View>
  );
}

/**
 * Design Law Continue CTA — stays pressable while invalid so onDisabledPress can explain blockers.
 * Frozen props `t` and `variant` stay in the signature for older call sites (unused here).
 */
export function OnboardingPrimaryButton({
  disabled = false,
  onPress,
  onDisabledPress,
  label = 'Continue',
  t,
  variant,
}) {
  // vocab: onDisabledPress — wizard calls this when validateStep() failed but we still want a tap explanation.
  // We keep NbButton enabled so ghosted Continue still receives presses; opacity shows the "blocked" state.
  void t;
  void variant;

  function handleContinuePress() {
    // 1. Invalid step — explain blockers instead of advancing.
    if (disabled) {
      onDisabledPress?.();
      return;
    }
    // 2. Valid step — run the wizard's Continue handler.
    onPress?.();
  }

  const continueLooksBlocked = disabled === true;
  const continueOpacity = continueLooksBlocked
    ? DISABLED_CONTINUE_OPACITY
    : ENABLED_CONTINUE_OPACITY;

  const continueButtonStyle = {
    width: '100%',
    alignSelf: 'stretch',
    flexGrow: 1,
    opacity: continueOpacity,
  };

  return (
    <NbButton variant="fill" onPress={handleContinuePress} style={continueButtonStyle}>
      {label}
    </NbButton>
  );
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging =====

function buildDarkOnboardingTokenMap() {
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

function buildLightOnboardingTokenMap() {
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
