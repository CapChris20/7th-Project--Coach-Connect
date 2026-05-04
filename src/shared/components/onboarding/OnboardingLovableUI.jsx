/**
 * CoachConnect onboarding UI primitives (Lovable-style cards + brand gradients).
 * Used by src/auth/OnboardingScreen.js — keeps the same data model; visuals only.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width: SW } = Dimensions.get('window');

/** Logo-aligned gradient */
export const ONBOARDING_BRAND_GRADIENT = ['#E94EAD', '#A348D0', '#6B3AD9'];
/** Trainer onboarding (purple → pink) */
export const TRAINER_ONBOARDING_GRADIENT = ['#7C3AED', '#EC4899'];
export const ONBOARDING_ACCENT = '#A348D0';
export const ONBOARDING_ACCENT_SOFT = 'rgba(163, 72, 208, 0.15)';

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

export function OnboardingProgressBar({ current, total, t }) {
  const pct = Math.min((current / total) * 100, 100);
  return (
    <View
      style={{
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: t.progressTrack,
        marginHorizontal: 12,
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={[ONBOARDING_BRAND_GRADIENT[0], ONBOARDING_BRAND_GRADIENT[2]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: `${pct}%`, height: 4, borderRadius: 2 }}
      />
    </View>
  );
}

function CardLeadingIcon({ iconSource, iconName, iconColor, grid, large, row }) {
  if (iconSource) {
    const dim = grid ? 40 : large ? 36 : row ? 28 : 28;
    return <Image source={iconSource} style={{ width: dim, height: dim }} resizeMode="contain" />;
  }
  if (iconName) {
    const size = grid ? 26 : large ? 24 : 20;
    return <Ionicons name={iconName} size={size} color={iconColor} />;
  }
  return null;
}

export function SelectionCard({
  selected,
  onPress,
  iconName,
  iconSource,
  label,
  description,
  variant = 'full',
  t,
}) {
  const bg = selected ? t.cardSelectedBg : t.cardBg;
  const border = selected ? t.cardSelectedBorder : t.cardBorder;
  const iconColor = selected ? ONBOARDING_ACCENT : t.textSecondary;
  const hasIcon = !!(iconSource || iconName);

  if (variant === 'grid') {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={{
          flex: 1,
          minHeight: 100,
          backgroundColor: bg,
          borderWidth: 1.5,
          borderColor: border,
          borderRadius: 14,
          padding: 14,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {hasIcon ? (
          <CardLeadingIcon iconSource={iconSource} iconName={iconName} iconColor={iconColor} grid />
        ) : null}
        <Text style={{ fontSize: 13, fontWeight: '600', color: t.textPrimary, textAlign: 'center' }}>
          {label}
        </Text>
        {selected ? (
          <View style={{ position: 'absolute', top: 8, right: 8 }}>
            <Ionicons name="checkmark" size={14} color={ONBOARDING_ACCENT} />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }

  if (variant === 'large') {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={{
          flex: 1,
          backgroundColor: bg,
          borderWidth: 1.5,
          borderColor: border,
          borderRadius: 14,
          padding: 24,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        {hasIcon ? (
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: ONBOARDING_ACCENT_SOFT,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CardLeadingIcon iconSource={iconSource} iconName={iconName} iconColor={ONBOARDING_ACCENT} large />
          </View>
        ) : null}
        <Text style={{ fontSize: 16, fontWeight: '700', color: t.textPrimary }}>{label}</Text>
        {description ? (
          <Text style={{ fontSize: 13, color: t.textSecondary, textAlign: 'center' }}>{description}</Text>
        ) : null}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        minHeight: 64,
        backgroundColor: bg,
        borderWidth: 1.5,
        borderColor: border,
        borderRadius: 14,
        paddingHorizontal: 14,
        marginBottom: 8,
      }}
    >
      {hasIcon ? (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: ONBOARDING_ACCENT_SOFT,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <CardLeadingIcon iconSource={iconSource} iconName={iconName} iconColor={ONBOARDING_ACCENT} row />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: t.textPrimary }}>{label}</Text>
        {description ? (
          <Text style={{ fontSize: 13, color: t.textSecondary, marginTop: 1 }}>{description}</Text>
        ) : null}
      </View>
      {selected ? <Ionicons name="checkmark" size={20} color={ONBOARDING_ACCENT} style={{ marginLeft: 8 }} /> : null}
    </TouchableOpacity>
  );
}

export function OnboardingTextArea({
  value,
  onChangeText,
  placeholder,
  maxLength = 500,
  numberOfLines = 5,
  t,
  editable = true,
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 4, opacity: editable ? 1 : 0.55 }}>
      <TextInput
        value={value}
        editable={editable}
        onChangeText={(v) => onChangeText(v.slice(0, maxLength))}
        placeholder={placeholder}
        placeholderTextColor={t.textLabel}
        multiline
        numberOfLines={numberOfLines}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          backgroundColor: focused ? t.cardBg : t.inputBg,
          borderWidth: 1.5,
          borderColor: focused ? ONBOARDING_ACCENT : t.cardBorder,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 14,
          color: t.textPrimary,
          textAlignVertical: 'top',
          minHeight: numberOfLines * 22 + 24,
        }}
      />
      <Text style={{ fontSize: 11, color: t.textLabel, textAlign: 'right', marginTop: 4 }}>
        {value.length}/{maxLength}
      </Text>
    </View>
  );
}

export function OnboardingPrimaryButton({ disabled = false, onPress, label = 'Continue', t }) {
  if (disabled) {
    return (
      <View
        style={{
          width: '100%',
          height: 56,
          borderRadius: 16,
          backgroundColor: t.disabledBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: t.disabledText }}>{label}</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={{
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        ...(Platform.OS === 'ios'
          ? {
              shadowColor: ONBOARDING_BRAND_GRADIENT[2],
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
            }
          : {}),
      }}
    >
      <LinearGradient
        colors={ONBOARDING_BRAND_GRADIENT}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 16 }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function OnboardingSectionLabel({ text, t, style }) {
  return (
    <Text
      style={[
        {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1.2,
          color: t.textLabel,
          marginBottom: 10,
          marginTop: 20,
        },
        style,
      ]}
    >
      {text}
    </Text>
  );
}

export function OnboardingInputRow({
  iconName,
  iconSource,
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  rightElement,
  t,
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: focused ? t.cardBg : t.inputBg,
        borderWidth: 1.5,
        borderColor: focused ? ONBOARDING_ACCENT : t.cardBorder,
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 64,
        marginBottom: 10,
      }}
    >
      {iconSource ? (
        <Image source={iconSource} style={{ width: 22, height: 22, marginRight: 12 }} resizeMode="contain" />
      ) : iconName ? (
        <Ionicons name={iconName} size={20} color={t.textSecondary} style={{ marginRight: 12 }} />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: t.textLabel, marginBottom: 2 }}>
          {label}
        </Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.textLabel}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ fontSize: 15, color: t.textPrimary, padding: 0 }}
        />
      </View>
      {rightElement}
    </View>
  );
}

export function OnboardingDayPicker({ value, onChange, t }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 20, marginBottom: 8 }}>
      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
        <TouchableOpacity
          key={n}
          onPress={() => onChange(n)}
          activeOpacity={0.8}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {value === n ? (
            <LinearGradient
              colors={ONBOARDING_BRAND_GRADIENT}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          ) : (
            <View
              style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: t.dayBtnBg,
                borderWidth: 1.5,
                borderColor: t.cardBorder,
                borderRadius: 20,
              }}
            />
          )}
          <Text style={{ fontSize: 14, fontWeight: '700', color: value === n ? '#fff' : t.textPrimary }}>{n}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function OnboardingOptionChips({ options, selected, onSelect, t }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 10,
        marginTop: 10,
      }}
    >
      {options.map((o) => {
        const on = selected === o.value;
        return (
          <TouchableOpacity
            key={o.value}
            onPress={() => onSelect(o.value)}
            activeOpacity={0.85}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 18,
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: on ? 'transparent' : t.cardBorder,
              backgroundColor: on ? 'transparent' : t.cardBg,
              overflow: 'hidden',
              minWidth: 104,
              alignItems: 'center',
              ...(on && {
                shadowColor: ONBOARDING_ACCENT,
                shadowOpacity: 0.35,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                elevation: 6,
              }),
            }}
          >
            {on ? (
              <LinearGradient
                colors={ONBOARDING_BRAND_GRADIENT}
                locations={[0, 0.55, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            ) : null}
            <Text style={{ fontSize: 15, fontWeight: '700', color: on ? '#fff' : t.textPrimary }}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Multi-select pill tags (trainer specialties, etc.) */
export function OnboardingMultiSelectPills({ options, selectedValues, onToggle, t }) {
  const set = new Set(selectedValues || []);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
      {options.map((o) => {
        const on = set.has(o.value);
        return (
          <TouchableOpacity
            key={o.value}
            onPress={() => onToggle(o.value)}
            activeOpacity={0.85}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 50,
              marginRight: 8,
              marginBottom: 8,
              borderWidth: 1.5,
              borderColor: on ? t.cardSelectedBorder : t.cardBorder,
              backgroundColor: on ? t.cardSelectedBg : t.cardBg,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: t.textPrimary }}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const onboardingHeadingStyles = StyleSheet.create({
  heading: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 32,
    marginTop: 16,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 4,
  },
});

/** Half-width for last odd equipment tile */
export function onboardingGridHalfWidth() {
  return (SW - 48) / 2;
}
