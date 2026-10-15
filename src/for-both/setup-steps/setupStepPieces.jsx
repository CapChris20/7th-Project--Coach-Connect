// Shared onboarding building blocks: color tokens, the gradient continue button, and the icon well.
// Flow: getOnboardingUiTokens(isDark) → screens style cards/inputs; OnboardingPrimaryButton submits the step.
// Used by NewUserSetupScreen, AIPermissionStep, TrainerProOfferStep, and ProUpgradeOffer.

import React from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
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

// ===== NAMED CONSTANTS =====

const VARIANT_FOOTER = 'footer';
const VARIANT_INLINE = 'inline';
const DEFAULT_CONTINUE_LABEL = 'Continue';
const FOOTER_WIDTH_PERCENT = '100%';
const INLINE_WIDTH_PERCENT = '80%';
const INLINE_MARGIN_Y = 16;
const BUTTON_MAX_WIDTH = 400;
const BUTTON_HEIGHT = 56;
const BUTTON_RADIUS = 16;
const ENABLED_ACTIVE_OPACITY = 0.88;
const DISABLED_ACTIVE_OPACITY = 0.7;

// ===== HELPER FUNCTIONS =====

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

function primaryButtonShadow(isFooterVariant) {
  if (isFooterVariant || Platform.OS !== 'ios') return {};
  return {
    shadowColor: ONBOARDING_CTA_GRADIENT[0],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
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
 * Callers read these keys (bg, cardBg, textPrimary, …) — do not rename them.
 * @param {boolean} isDark
 * @returns {object}
 */
export function getOnboardingUiTokens(isDark) {
  return isDark ? darkOnboardingTokens() : lightOnboardingTokens();
}

/**
 * Gradient Continue button. `t` is the tokens object from getOnboardingUiTokens.
 * Footer variant is full-width with no vertical margin; inline is 80% with a 16px gap.
 * @param {{ disabled?: boolean, onPress: Function, onDisabledPress?: Function, label?: string, t: object, variant?: string }} props
 */
export function OnboardingPrimaryButton({
  disabled = false,
  onPress,
  onDisabledPress,
  label = DEFAULT_CONTINUE_LABEL,
  t,
  variant = VARIANT_INLINE,
}) {
  const tokens = t;
  const isFooterVariant = variant === VARIANT_FOOTER;
  const marginY = isFooterVariant ? 0 : INLINE_MARGIN_Y;
  const widthPct = isFooterVariant ? FOOTER_WIDTH_PERCENT : INLINE_WIDTH_PERCENT;
  const shadowStyle = primaryButtonShadow(isFooterVariant);

  if (disabled) {
    return (
      <TouchableOpacity
        activeOpacity={onDisabledPress ? DISABLED_ACTIVE_OPACITY : 1}
        onPress={onDisabledPress}
        disabled={!onDisabledPress}
        style={{
          alignSelf: 'center',
          width: widthPct,
          maxWidth: BUTTON_MAX_WIDTH,
          marginTop: marginY,
          marginBottom: marginY,
          height: BUTTON_HEIGHT,
          borderRadius: BUTTON_RADIUS,
          backgroundColor: tokens.disabledBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.disabledText }}>{label}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={ENABLED_ACTIVE_OPACITY}
      style={{
        alignSelf: 'center',
        width: widthPct,
        maxWidth: BUTTON_MAX_WIDTH,
        marginTop: marginY,
        marginBottom: marginY,
        borderRadius: BUTTON_RADIUS,
        overflow: 'hidden',
        ...shadowStyle,
      }}
    >
      <LinearGradient
        colors={ONBOARDING_CTA_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: BUTTON_HEIGHT, alignItems: 'center', justifyContent: 'center', borderRadius: BUTTON_RADIUS }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}
