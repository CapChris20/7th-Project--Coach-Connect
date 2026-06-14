/**
 * Shared onboarding tokens + primary CTA only.
 * Used by AIOptInStep (avoids circular import with OnboardingScreen.js).
 */
import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const ONBOARDING_CTA_GRADIENT = ['#C1265A', '#D84315'];
export const ONBOARDING_BRAND_GRADIENT = ONBOARDING_CTA_GRADIENT;
export const TRAINER_ONBOARDING_GRADIENT = ONBOARDING_CTA_GRADIENT;
export const ONBOARDING_ACCENT = '#C1265A';
export const ONBOARDING_ACCENT_SOFT = 'rgba(193, 38, 90, 0.15)';

export function getOnboardingUiTokens(isDark) {
  return isDark
    ? {
        bg: '#0A0A0F',
        cardBg: 'rgba(255,255,255,0.04)',
        cardBorder: 'rgba(255,255,255,0.08)',
        cardSelectedBg: 'rgba(233, 78, 173, 0.12)',
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
      }
    : {
        bg: '#F5F5F7',
        cardBg: '#FFFFFF',
        cardBorder: '#E5E7EB',
        cardSelectedBg: 'rgba(233, 78, 173, 0.1)',
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

/**
 * @param {'inline' | 'footer'} [variant] — `inline` keeps vertical margins for use inside scroll content.
 *   `footer` removes margins for the fixed onboarding bottom bar (avoids overlap with scroll content).
 */
export function OnboardingPrimaryButton({
  disabled = false,
  onPress,
  onDisabledPress,
  label = 'Continue',
  t,
  variant = 'inline',
}) {
  const footer = variant === 'footer';
  const marginY = footer ? 0 : 16;
  const widthPct = footer ? '100%' : '80%';
  const shadowStyle =
    footer || Platform.OS !== 'ios'
      ? {}
      : {
          shadowColor: ONBOARDING_CTA_GRADIENT[0],
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
        };

  if (disabled) {
    return (
      <TouchableOpacity
        activeOpacity={onDisabledPress ? 0.7 : 1}
        onPress={onDisabledPress}
        disabled={!onDisabledPress}
        style={{
          alignSelf: 'center',
          width: widthPct,
          maxWidth: 400,
          marginTop: marginY,
          marginBottom: marginY,
          height: 56,
          borderRadius: 16,
          backgroundColor: t.disabledBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: t.disabledText }}>{label}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={{
        alignSelf: 'center',
        width: widthPct,
        maxWidth: 400,
        marginTop: marginY,
        marginBottom: marginY,
        borderRadius: 16,
        overflow: 'hidden',
        ...shadowStyle,
      }}
    >
      <LinearGradient
        colors={ONBOARDING_CTA_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 16 }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}
