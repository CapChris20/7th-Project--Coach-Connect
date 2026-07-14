/**
 * Onboarding Screen
 *
 * Purpose: UI screen or component: Onboarding Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/auth
 * Key exports: OnboardingProgressBar, SelectionCard, OnboardingTextArea, OnboardingSectionLabel, OnboardingInputRow, OnboardingDayPicker, OnboardingOptionChips, OnboardingMultiSelectPills
 *
 * @file-header
 */
/**
 * OnboardingWizardScreen - Combined onboarding flow for clients and trainers
 * 
 * Handles all 6 onboarding steps for both client and trainer roles
 * with Apple-style subtle gradients throughout.
 */

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut } from 'firebase/auth';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../shared-ui/ThemeContext';
import { auth, db } from '../app-start/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import {
  uploadTrainerCertificationSheet,
  uploadTrainerFaceVerification,
} from '../shared/notes-files/manageNotesAndFiles';
import {
  verifyTrainerCertification,
  certificationStatusLabel,
  certificationStatusDetail,
} from '../shared/api/verifyTrainerCertification';
import BlurBackdropPlate from '../shared-ui/BlurBackdropPlate';
import { validateTrainerCodeWithDeps } from './validateTrainerInviteCode';
import { completeOnboardingClient, buildOnboardingUpdatePayload } from './finishOnboarding';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseCandidates } from '../shared/api/baseUrl';
import { queuePendingOnboardingSync } from '../shared/api/syncOnboardingToServer';
import { useAI } from '../shared/contexts/AIContext';
import { AIOptInStep } from '../shared/components/onboarding/AIOptInStep';
import {
  TrainerSubscriptionOnboardingStep,
  TrainerSubscriptionCtaFooter,
} from '../shared/components/onboarding/TrainerSubscriptionOnboardingStep';
import { useSubscription } from '../subscription/SubscriptionProvider';
import { TRAINER_PLATFORM_SUBSCRIPTION_ENABLED } from '../subscription/constants';
import ExerciseDislikePicker from '../workouts/exercise-library/ExerciseDislikePicker';
import LottieView from 'lottie-react-native';
import LiquidBackground from '../shared-ui/liquid/LiquidBackground';
import LiquidBackgroundLight from '../shared-ui/liquid/LiquidBackgroundLight';
import { getOnboardingIconSource } from '../shared/assets/onboardingIconRegistry';
import {
  formatHeightInputDisplay,
  parseHeightInputText,
  isHeightComplete,
  finalizeHeightFromDraft,
} from '../shared-utils/convertHeightUnits';
import { Ionicons } from '@expo/vector-icons';
import lottieClient1 from '../assets/animations/app-flows/personal-info';
import lottieClient2 from '../assets/animations/app-flows/fitness-experience';
import lottieClient3 from '../assets/animations/app-flows/fitness-goal';
import lottieClient4 from '../assets/animations/legacy/fitness (1)';
import lottieClient5 from '../assets/animations/app-flows/training-frequency';
import lottieClient6 from '../assets/animations/app-flows/injuries';
import lottieClient7 from '../assets/icons/weightlifting-competition';
import lottieClientDescribeSituation from '../shared/assets/Walking steps';
import lottieTrainer1 from '../assets/animations/app-flows/certifications';
import lottieTrainer2 from '../assets/animations/app-flows/experience-timeline';
import lottieTrainer3 from '../assets/animations/app-flows/specialties';
import lottieTrainer4 from '../assets/animations/app-flows/philosophy';
import lottieTrainer5 from '../assets/animations/app-flows/rates';
import lottieTrainer6 from '../assets/animations/app-flows/invite-code';
import {
  FOOD_CARD_MACRO_GRADIENTS,
  ONBOARDING_GLASS_TINTS,
  ONBOARDING_PALETTE,
  ONBOARDING_CTA_GRADIENT,
  ONBOARDING_BRAND_GRADIENT,
  TRAINER_ONBOARDING_GRADIENT,
  ONBOARDING_ACCENT,
  ONBOARDING_ACCENT_SOFT,
  pillBackgroundGradient,
  onboardingOptionGradient,
  IconGradientWrap,
  getOnboardingUiTokens,
  OnboardingPrimaryButton,
} from '../shared/components/onboarding/onboardingAiDeps';

const { width } = Dimensions.get('window');
const SCREEN_PAD = 16;
const GRID_GUTTER = 16;
const TWO_COL_ITEM = (width - SCREEN_PAD * 2 - GRID_GUTTER) / 2;

// --- Onboarding UI primitives (rest of components live in this file; tokens + primary CTA in onboardingAiDeps.jsx) ---

function CardLeadingIcon({ iconSource, iconName, iconColor, grid, large, row }) {
  const [imageFailed, setImageFailed] = useState(false);
  const dim = grid ? 40 : large ? 36 : row ? 28 : 28;
  const ionSize = grid ? 26 : large ? 24 : 20;

  useEffect(() => {
    setImageFailed(false);
  }, [iconSource]);

  if (iconSource && !imageFailed) {
    return (
      <Image
        source={iconSource}
        style={{ width: dim, height: dim }}
        resizeMode="contain"
        onError={() => setImageFailed(true)}
      />
    );
  }
  if (iconName) {
    return <Ionicons name={iconName} size={ionSize} color={iconColor} />;
  }
  return null;
}

export function OnboardingProgressBar({ current, total, t, gradientColors }) {
  const pct = Math.min((current / total) * 100, 100);
  const g =
    Array.isArray(gradientColors) && gradientColors.length >= 2 ? gradientColors : ONBOARDING_BRAND_GRADIENT;
  const gEnd = g[g.length - 1];
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
        colors={[g[0], gEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: `${pct}%`, height: 4, borderRadius: 2 }}
      />
    </View>
  );
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
  accentGradient,
}) {
  const bg = selected ? t.cardSelectedBg : t.cardBg;
  const border = selected ? t.cardSelectedBorder : t.cardBorder;
  const gradient = accentGradient || ONBOARDING_BRAND_GRADIENT;
  const iconColor = selected ? gradient[1] : gradient[0];
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
          <IconGradientWrap gradient={gradient} selected={selected} size={40} radius={10}>
            <CardLeadingIcon iconSource={iconSource} iconName={iconName} iconColor={iconColor} grid />
          </IconGradientWrap>
        ) : null}
        <Text style={{ fontSize: 13, fontWeight: '600', color: t.textPrimary, textAlign: 'center' }}>{label}</Text>
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
          <IconGradientWrap gradient={gradient} selected={selected} size={48} radius={24}>
            <CardLeadingIcon iconSource={iconSource} iconName={iconName} iconColor={iconColor} large />
          </IconGradientWrap>
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
        <IconGradientWrap gradient={gradient} selected={selected} size={40} radius={10} style={{ marginRight: 12 }}>
          <CardLeadingIcon iconSource={iconSource} iconName={iconName} iconColor={iconColor} row />
        </IconGradientWrap>
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
  onBlur,
  placeholder,
  keyboardType = 'default',
  rightElement,
  t,
  textInputProps = {},
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
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          textContentType="none"
          importantForAutofill="no"
          style={{ fontSize: 15, color: t.textPrimary, padding: 0 }}
          {...textInputProps}
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
              colors={ONBOARDING_CTA_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
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
                colors={ONBOARDING_CTA_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
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

export function OnboardingMultiSelectPills({ options, selectedValues, onToggle, t }) {
  const set = new Set(selectedValues || []);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
      {options.map((o, index) => {
        const on = set.has(o.value);
        const gradient = o.accentGradient || onboardingOptionGradient(index);
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
              borderColor: on ? 'transparent' : t.cardBorder,
              backgroundColor: on ? 'transparent' : t.cardBg,
              overflow: 'hidden',
            }}
          >
            {on ? (
              <LinearGradient
                colors={pillBackgroundGradient(gradient, { strong: true })}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            ) : null}
            <Text style={{ fontSize: 13, fontWeight: '600', color: on ? gradient[1] : t.textPrimary }}>{o.label}</Text>
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

export function onboardingGridHalfWidth() {
  return (width - 48) / 2;
}
// --- end inlined onboarding UI primitives ---

// Liquid Glass accent tints — food-card macro hues
const GLASS_TINTS = ONBOARDING_GLASS_TINTS;

const getClientStepTint = (step, section) => {
  // Keep backgrounds unchanged; tint only the glass surfaces.
  // section is optional and used for Step 1 (inputs vs gender).
  if (step === 1) return section === 'gender' ? GLASS_TINTS.violet : GLASS_TINTS.cyan;
  if (step === 2) return GLASS_TINTS.violet;
  if (step === 3) return GLASS_TINTS.magenta;
  if (step === 4) return GLASS_TINTS.cyan;
  if (step === 5) return GLASS_TINTS.violet;
  if (step === 6) return GLASS_TINTS.orange;
  if (step === 7) return GLASS_TINTS.magenta;
  if (step === 8) return GLASS_TINTS.cyan;
  return GLASS_TINTS.cyan;
};

// Design System Colors
const COLORS = {
  background: '#FAF8F5',
  textPrimary: '#2D3748',
  textSecondary: '#718096',
  border: '#E2E8F0',
  white: '#FFFFFF',
};

// Design System Gradients
const GRADIENTS = {
  bluePurple: ['#5B86E5', '#A855F7'],
  tealBlue: ['#14B8A6', '#3B82F6'],
  indigoPurple: ['#6366F1', '#8B5CF6'],
  greenBlue: ['#10B981', '#3B82F6'],
  orangeRed: FOOD_CARD_MACRO_GRADIENTS.protein,
  green: ['#10B981', '#059669'],
  purplePink: FOOD_CARD_MACRO_GRADIENTS.calories,
  goldPink: FOOD_CARD_MACRO_GRADIENTS.carbs,
  goldAmber: ['#A67C00', '#9A3412'],
  success: ['#10B981', '#059669'],
  disabled: ['#CBD5E0', '#E2E8F0'],
};

// Lottie Animation Mapping
const LOTTIE_ANIMATIONS = {
  // Client Steps
  'client-1': lottieClient1,
  'client-2': lottieClient2,
  'client-3': lottieClient3,
  'client-4': lottieClient4,
  'client-5': lottieClient5,
  'client-6': lottieClient6,
  'client-7': lottieClient7,
  'client-8': lottieClientDescribeSituation, // Describe your situation (wide layout step)
  // Trainer Steps
  'trainer-1': lottieTrainer1,
  'trainer-2': lottieTrainer2,
  'trainer-3': lottieTrainer3,
  'trainer-4': lottieTrainer4,
  'trainer-5': lottieTrainer5,
  'trainer-6': lottieTrainer5,
  'trainer-7': lottieTrainer6,
};

/** Large Lottie layout for client onboarding `StepLottie` */
const CLIENT_ONBOARDING_LOTTIE_STYLE = Object.freeze({
  width: 260,
  height: 260,
  alignSelf: 'center',
});
/** Step 4 (equipment) illustration runs small; bump size */
const CLIENT_ONBOARDING_LOTTIE_STYLE_EQUIPMENT = Object.freeze({
  width: 330,
  height: 330,
  alignSelf: 'center',
  marginTop: -6,
  marginBottom: -4,
});
/** Step 8 (wide illustration) */
const CLIENT_ONBOARDING_LOTTIE_STYLE_WIDE = Object.freeze({
  width: 300,
  height: 240,
  alignSelf: 'center',
});

  // Enhanced gradient text input component
  const GradientTextInput = ({ icon, iconSource, label, value, onChangeText, keyboardType, placeholder, unit, field, isDark = true, tintColor }) => {
    const [isFocused, setIsFocused] = useState(false);
    const [iconFailed, setIconFailed] = useState(false);
    const animatedLabelY = useRef(new Animated.Value(value ? -10 : 18)).current;
    const animatedLabelScale = useRef(new Animated.Value(value ? 0.75 : 1)).current;
    const pressScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      // If the icon source changes (or hot reload happens), retry loading the icon
      setIconFailed(false);
    }, [iconSource]);

    useEffect(() => {
      Animated.timing(animatedLabelY, {
        toValue: (isFocused || value) ? -10 : 18,
        duration: 200,
        useNativeDriver: false,
      }).start();
      
      Animated.timing(animatedLabelScale, {
        toValue: (isFocused || value) ? 0.75 : 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }, [isFocused, value]);

    useEffect(() => {
      Animated.spring(pressScale, {
        toValue: isFocused ? 0.98 : 1,
        stiffness: 320,
        damping: 22,
        useNativeDriver: true,
      }).start();
    }, [isFocused]);

    const borderColors = isDark
      ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.00)']
      : ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.00)'];
    const surfaceColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)';
    const tintOpacity = isDark ? 0.10 : 0.06;
    const labelIdle = isDark ? 'rgba(255,255,255,0.72)' : 'rgba(30,41,59,0.65)';
    const labelActive = isDark ? 'rgba(255,255,255,0.90)' : 'rgba(15,23,42,0.92)';
    const valueColor = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)';
    const unitColor = isDark ? 'rgba(255,255,255,0.62)' : 'rgba(51,65,85,0.65)';
    const chipBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
    const chipBorder = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.10)';

    return (
      <View style={styles.gradientInputContainer}>
        <Animated.View style={[styles.liquidFieldOuter, { transform: [{ scale: pressScale }] }]}>
          <LinearGradient
            colors={borderColors}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.liquidFieldBorder}
          >
            <BlurBackdropPlate intensity={isFocused ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.liquidFieldBlur}>
              <View style={[styles.liquidFieldSurface, { backgroundColor: surfaceColor }]}>
                {tintColor ? (
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFillObject,
                      { backgroundColor: tintColor, opacity: tintOpacity },
                    ]}
                  />
                ) : null}
          <View style={styles.gradientInputContent}>
                  <View style={styles.inputIconSlot}>
                    {iconSource !== undefined && iconSource !== null && !iconFailed ? (
                      <Image
                        source={iconSource}
                        style={styles.inputIconImage}
                        onError={(e) => {
                          setIconFailed(true);
                          console.warn('❌ Failed to load input icon:', { label, iconSource, nativeEvent: e?.nativeEvent });
                        }}
                      />
                    ) : (
                      <Text style={styles.inputIcon}>{icon || '•'}</Text>
                    )}
                  </View>
            <View style={styles.inputFieldContainer}>
              <Animated.Text
                style={[
                  styles.floatingLabel,
                  {
                    transform: [{ translateY: animatedLabelY }, { scale: animatedLabelScale }],
                          color: isFocused ? labelActive : labelIdle,
                  }
                ]}
              >
                      {String(label || '').toUpperCase()}
              </Animated.Text>
              <TextInput
                      style={[styles.gradientTextInput, { color: valueColor }]}
                placeholder=""
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.45)'}
                keyboardType={keyboardType}
                value={value?.toString() || ''}
                onChangeText={onChangeText}
                onFocus={() => {
                  setIsFocused(true);
                  Haptics.selectionAsync?.();
                }}
                onBlur={() => setIsFocused(false)}
              />
            </View>
                  {unit && <Text style={[styles.unitLabel, { color: unitColor }]}>{String(unit || '').toUpperCase()}</Text>}
            {value && (
              <TouchableOpacity
                onPress={() => onChangeText('')}
                      style={[styles.clearButton, { backgroundColor: chipBg, borderColor: chipBorder }]}
              >
                      <Text style={[styles.clearButtonText, { color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.62)' }]}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
            </BlurBackdropPlate>
          </LinearGradient>
        </Animated.View>
      </View>
    );
  };

  // Liquid Glass selection card (used across onboarding)
  const NeumorphicCard = ({ selected, onPress, icon, iconSource, title, subtitle, isDark = true, tintColor }) => {
    const scale = useRef(new Animated.Value(1)).current;
    const [pressed, setPressed] = useState(false);

    const pressIn = () => {
      setPressed(true);
      Animated.spring(scale, { toValue: 0.98, stiffness: 320, damping: 22, useNativeDriver: true }).start();
    };
    const pressOut = () => {
      setPressed(false);
      Animated.spring(scale, { toValue: 1, stiffness: 320, damping: 22, useNativeDriver: true }).start();
      onPress?.();
    };

    const borderColors = isDark
      ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.00)']
      : ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.00)'];
    const surfaceColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)';
    const tintOpacity = isDark ? 0.10 : 0.06;
    const titleColor = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)';
    const subColor = isDark ? 'rgba(255,255,255,0.66)' : 'rgba(51,65,85,0.72)';

    return (
      <TouchableOpacity onPressIn={pressIn} onPressOut={pressOut} activeOpacity={1} style={styles.liquidCardHit}>
        <Animated.View style={[styles.liquidCardOuter, { transform: [{ scale }] }, selected && styles.liquidCardOuterSelected]}>
          <LinearGradient colors={borderColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.liquidCardBorder}>
            <BlurBackdropPlate intensity={pressed || selected ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.liquidCardBlur}>
              <View style={[styles.liquidCardSurface, { backgroundColor: surfaceColor }]}>
                {tintColor ? (
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFillObject,
                      { backgroundColor: tintColor, opacity: tintOpacity },
                    ]}
                  />
                ) : null}
                <View style={styles.liquidCardContent}>
                  {iconSource ? (
                    <Image
                      source={iconSource}
                      style={styles.liquidCardIcon}
                      onError={(e) => console.warn('❌ Failed to load card icon:', { title, iconSource, nativeEvent: e?.nativeEvent })}
                    />
                  ) : (
                    icon && <Text style={[styles.liquidCardEmoji, { color: titleColor }]}>{icon}</Text>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.liquidCardTitle, { color: titleColor }]}>{title}</Text>
                    {subtitle ? <Text style={[styles.liquidCardSubtitle, { color: subColor }]}>{subtitle}</Text> : null}
                  </View>
                  {selected ? (
                    <View style={[styles.liquidCardCheck, { borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.10)' }]}>
                      <Text style={[styles.liquidCardCheckText, { color: titleColor }]}>✓</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </BlurBackdropPlate>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  // Liquid Glass select card (used on Step 1: Gender)
  const LiquidGlassSelectCard = ({ selected, onPress, iconSource, ionicon, title, isDark = true, tintColor }) => {
    const scale = useRef(new Animated.Value(1)).current;
    const [pressed, setPressed] = useState(false);
    const tintOpacity = isDark ? 0.10 : 0.06;

    const pressIn = () => {
      setPressed(true);
      Animated.spring(scale, {
        toValue: 0.98,
        stiffness: 320,
        damping: 22,
        useNativeDriver: true,
      }).start();
    };

    const pressOut = () => {
      setPressed(false);
      Animated.spring(scale, {
        toValue: 1,
        stiffness: 320,
        damping: 22,
        useNativeDriver: true,
      }).start();
      onPress?.();
    };

    return (
      <TouchableOpacity
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={1}
        style={styles.liquidSelectHit}
      >
        <Animated.View
          style={[
            styles.liquidSelectOuter,
            { transform: [{ scale }] },
            selected && styles.liquidSelectOuterSelected,
          ]}
        >
            <LinearGradient
            colors={
              isDark
                ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.00)']
                : ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.00)']
            }
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.liquidSelectBorder}
          >
            <BlurBackdropPlate
              intensity={pressed || selected ? 42 : 30}
              tint={isDark ? 'dark' : 'light'}
              style={styles.liquidSelectBlur}
            >
              <View
                style={[
                  styles.liquidSelectSurface,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)' },
                ]}
              >
                {tintColor ? (
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFillObject,
                      { backgroundColor: tintColor, opacity: tintOpacity },
                    ]}
                  />
                ) : null}
                {ionicon ? (
                  <Ionicons 
                    name={ionicon} 
                    size={32} 
                    color="rgba(255,255,255,0.50)"
                    style={styles.liquidSelectIcon}
                  />
                ) : (
                  <Image
                    source={iconSource}
                    style={styles.liquidSelectIcon}
                    onError={(e) => {
                      console.warn('❌ Failed to load liquid select icon:', { title, iconSource, nativeEvent: e?.nativeEvent });
                    }}
                  />
                )}
                <Text
                  style={[
                    styles.liquidSelectTitle,
                    { color: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)' },
                  ]}
                >
                {title}
              </Text>
                {selected && (
                  <View style={styles.liquidSelectCheck}>
                    <Text
                      style={[
                        styles.liquidSelectCheckText,
                        { color: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)' },
                      ]}
                    >
                      ✓
                </Text>
              </View>
            )}
          </View>
            </BlurBackdropPlate>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  // Liquid Glass pill option (used for goals + multi-select grids)
  const GradientPill = ({ icon, iconSource, label, selected, onPress, colors, isDark = true, tintColor }) => {
    const scale = useRef(new Animated.Value(1)).current;
    const [pressed, setPressed] = useState(false);

    const pressIn = () => {
      setPressed(true);
      Animated.spring(scale, { toValue: 0.98, stiffness: 320, damping: 22, useNativeDriver: true }).start();
    };
    const pressOut = () => {
      setPressed(false);
      Animated.spring(scale, { toValue: 1, stiffness: 320, damping: 22, useNativeDriver: true }).start();
      onPress?.();
    };

    const borderColors = isDark
      ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.00)']
      : ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.00)'];
    const surfaceColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)';
    const tintOpacity = isDark ? 0.10 : 0.06;
    const textColor = isDark ? 'rgba(255,255,255,0.90)' : 'rgba(15,23,42,0.90)';

    return (
      <TouchableOpacity onPressIn={pressIn} onPressOut={pressOut} activeOpacity={1} style={styles.gradientPillContainer}>
        <Animated.View style={[styles.gradientPill, { transform: [{ scale }] }]}>
          <LinearGradient colors={borderColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.gradientPillBorder}>
            <BlurBackdropPlate intensity={pressed || selected ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.gradientPillBlur}>
              <View style={[styles.gradientPillSurface, { backgroundColor: surfaceColor }]}>
                {tintColor ? (
                  <View
                    pointerEvents="none"
          style={[
                      StyleSheet.absoluteFillObject,
                      { backgroundColor: tintColor, opacity: tintOpacity },
                    ]}
                  />
                ) : null}
                {selected ? (
          <LinearGradient
                    colors={colors || ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.00)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
                    style={styles.gradientPillSelectedOverlay}
                  />
                ) : null}
            <View style={styles.gradientPillContent}>
                  {iconSource ? (
                    <Image source={iconSource} style={styles.gradientPillIconImage} />
                  ) : (
                    icon && <Text style={[styles.gradientPillIcon, { color: textColor }]}>{icon}</Text>
                  )}
                  <Text style={[styles.gradientPillText, { color: textColor }]}>{label}</Text>
                  {selected ? <Text style={[styles.gradientPillCheckmark, { color: textColor }]}>✓</Text> : null}
            </View>
              </View>
            </BlurBackdropPlate>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const SelectablePill = ({ label, selected, onPress, colors }) => {
    const scale = useRef(new Animated.Value(1)).current;

    const pressIn = () => {
      Animated.spring(scale, { toValue: 0.97, stiffness: 300, damping: 20, useNativeDriver: true }).start();
    };
    const pressOut = () => {
      Animated.spring(scale, { toValue: 1, stiffness: 300, damping: 20, useNativeDriver: true }).start();
      onPress();
    };

    return (
      <TouchableOpacity activeOpacity={1} onPressIn={pressIn} onPressOut={pressOut} style={styles.selectablePillHit}>
        <Animated.View style={{ transform: [{ scale }] }}>
          {selected ? (
            <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.selectablePillSelected}>
              <Text style={styles.selectablePillTextSelected}>{label}</Text>
            </LinearGradient>
          ) : (
            <View style={styles.selectablePill}>
              <Text style={styles.selectablePillText}>{label}</Text>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  };

  // Multi-select equipment tile (2-column grid) — Liquid Glass
  const EquipmentCard = ({ icon, iconSource, label, selected, onPress, colors, isDark = true, containerStyle, tintColor }) => {
    const scale = useRef(new Animated.Value(1)).current;
    const [pressed, setPressed] = useState(false);

    const pressIn = () => {
      setPressed(true);
      Animated.spring(scale, {
        toValue: 0.98,
        stiffness: 300,
        damping: 20,
        useNativeDriver: true,
      }).start();
    };

    const pressOut = () => {
      setPressed(false);
      Animated.spring(scale, {
        toValue: 1,
        stiffness: 300,
        damping: 20,
        useNativeDriver: true,
      }).start();
      onPress();
    };

    const borderColors = isDark
      ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.00)']
      : ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.00)'];
    const surfaceColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)';
    const tintOpacity = isDark ? 0.10 : 0.06;
    const labelColor = isDark ? 'rgba(255,255,255,0.90)' : 'rgba(15,23,42,0.90)';

    return (
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[styles.equipmentCardHit, containerStyle]}
      >
        <Animated.View style={[styles.equipmentCardShell, { transform: [{ scale }] }, selected && styles.equipmentCardShellSelected]}>
          <LinearGradient colors={borderColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.equipmentCardBorder}>
            <BlurBackdropPlate intensity={pressed || selected ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.equipmentCardBlur}>
              <View style={[styles.equipmentCardInner, { backgroundColor: surfaceColor }]}>
                {tintColor ? (
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFillObject,
                      { backgroundColor: tintColor, opacity: tintOpacity },
                    ]}
                  />
                ) : null}
          {selected ? (
                  <LinearGradient colors={colors || borderColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.equipmentSelectedOverlay} />
                ) : null}

                {iconSource ? (
                  <Image
                    source={iconSource}
                    style={styles.equipmentIconImage}
                    onError={(e) => console.warn('❌ Failed to load equipment icon:', { label, iconSource, nativeEvent: e?.nativeEvent })}
                  />
                ) : (
                  <Text style={[styles.equipmentIcon, { color: labelColor }]}>{icon}</Text>
                )}
                <Text style={[styles.equipmentLabel, { color: labelColor }]}>{label}</Text>

                {selected ? (
                  <View style={styles.equipmentCheckbox}>
                    <Text style={[styles.equipmentCheckboxText, { color: labelColor }]}>✓</Text>
              </View>
          ) : (
              <View style={styles.equipmentCheckboxOutline} />
          )}
              </View>
            </BlurBackdropPlate>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const DayCircle = ({ day, selected, onSelect, isDark = true, tintColor }) => {
    const scale = useRef(new Animated.Value(1)).current;
    const [pressed, setPressed] = useState(false);

    const pressIn = () => {
      setPressed(true);
      Animated.spring(scale, { toValue: 0.98, stiffness: 320, damping: 22, useNativeDriver: true }).start();
    };
    const pressOut = () => {
      setPressed(false);
      Animated.spring(scale, { toValue: 1, stiffness: 320, damping: 22, useNativeDriver: true }).start();
      onSelect?.();
    };

    const borderColors = isDark
      ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.00)']
      : ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.00)'];
    const surfaceColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)';
    const tintOpacity = isDark ? 0.10 : 0.06;
    const textColor = isDark ? 'rgba(255,255,255,0.90)' : 'rgba(15,23,42,0.90)';

    return (
      <TouchableOpacity onPressIn={pressIn} onPressOut={pressOut} activeOpacity={1} style={styles.dayCircleHit}>
        <Animated.View style={[styles.dayCircleOuter, { transform: [{ scale }] }, selected && styles.dayCircleOuterSelected]}>
          <LinearGradient colors={borderColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.dayCircleBorder}>
            <BlurBackdropPlate
              intensity={pressed || selected ? 42 : 30}
              tint={isDark ? 'dark' : 'light'}
              style={styles.dayCircleBlur}
              contentWrapperStyle={{ flex: 1 }}
            >
              <View style={[styles.dayCircleSurface, { backgroundColor: surfaceColor }]}>
                {tintColor ? (
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFillObject,
                      { backgroundColor: tintColor, opacity: tintOpacity },
                    ]}
                  />
                ) : null}
          {selected ? (
                  <LinearGradient
                    colors={ONBOARDING_CTA_GRADIENT}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.dayCircleSelectedOverlay}
                  />
                ) : null}
                <Text style={[styles.dayCircleText, { color: textColor }]}>{day}</Text>
              </View>
            </BlurBackdropPlate>
            </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const MultiLineCounterInput = ({ label, value, onChangeText, placeholder, disabled, isDark = true, tintColor }) => {
    const [isFocused, setIsFocused] = useState(false);
    const count = value?.length || 0;
    const counterColor =
      count >= 500 ? '#EF4444' : count >= 450 ? '#F97316' : isFocused ? (isDark ? 'rgba(255,255,255,0.90)' : 'rgba(15,23,42,0.92)') : (isDark ? 'rgba(255,255,255,0.62)' : 'rgba(51,65,85,0.65)');

    const borderColors = isDark
      ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.00)']
      : ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.00)'];
    const surfaceColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)';
    const tintOpacity = isDark ? 0.10 : 0.06;
    const labelColor = isDark ? 'rgba(255,255,255,0.76)' : 'rgba(30,41,59,0.70)';
    const textColor = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)';
    const placeholderColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.45)';

    return (
      <View style={styles.multiLineWrapper}>
        <Text style={[styles.multiLineLabel, { color: labelColor }]}>{String(label || '').toUpperCase()}</Text>
        <View style={[styles.multiLineShell, disabled && { opacity: 0.6 }]}>
          <LinearGradient colors={borderColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.multiLineBorder}>
            <BlurBackdropPlate intensity={isFocused ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.multiLineBlur}>
              <View style={[styles.multiLineInner, { backgroundColor: surfaceColor }]}>
                {tintColor ? (
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFillObject,
                      { backgroundColor: tintColor, opacity: tintOpacity },
                    ]}
                  />
          ) : null}
            <TextInput
                  style={[styles.multiLineInput, { color: textColor }]}
              placeholder={placeholder}
                  placeholderTextColor={placeholderColor}
              value={value}
              onChangeText={(t) => onChangeText(t)}
              multiline
              numberOfLines={7}
              maxLength={500}
              editable={!disabled}
              textAlignVertical="top"
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
            <Text style={[styles.multiLineCounter, { color: counterColor }]}>{count}/500</Text>
          </View>
            </BlurBackdropPlate>
          </LinearGradient>
        </View>
      </View>
    );
  };

  const DescribeSituationStep = ({
    lottie,
    heading,
    situationDescription,
    setSituationDescription,
    shakeAnimation,
    isDark,
    tintColor,
  }) => {
    const dynamicStyles = getStyles(!!isDark);
    const [isFocused, setIsFocused] = useState(false);
    const charCount = situationDescription.length;
    const minChars = 50;
    const maxChars = 1000;
    
    const getCharCountColor = () => {
      if (charCount < minChars) return isDark ? '#9CA3AF' : '#6B7280';
      if (charCount <= 800) return isDark ? '#9CA3AF' : '#6B7280';
      if (charCount <= 950) return '#F59E0B';
      return '#EF4444';
    };

    // User requested: no suggestion chips / tip card on this step.

    const borderColors = isDark
      ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.00)']
      : ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.00)'];
    const surfaceColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)';
    const titleColor = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)';
    const subColor = isDark ? 'rgba(255,255,255,0.70)' : 'rgba(51,65,85,0.72)';
    const placeholderColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.45)';
    const tintOpacity = isDark ? 0.10 : 0.06;

    return (
      <View style={styles.stepContainer}>
        {lottie && (
          <LottieView
            source={lottie}
            autoPlay
            loop
            style={{ width: 280, height: 168, marginBottom: 24, alignSelf: 'center' }} // Reduced height by 40%
          />
        )}
        <Text style={dynamicStyles.liquidHeading}>{heading}</Text>
        <Text style={dynamicStyles.liquidSubtitle}>Help us understand your fitness journey and goals</Text>

        <View style={{ position: 'relative', width: '100%', marginBottom: 16 }}>
          <View style={styles.liquidAreaOuter}>
            <LinearGradient colors={borderColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.liquidAreaBorder}>
              <BlurBackdropPlate intensity={isFocused ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.liquidAreaBlur}>
                <View style={[styles.liquidAreaSurface, { backgroundColor: surfaceColor }]}>
                  {tintColor ? (
                    <View
                      pointerEvents="none"
            style={[
                        StyleSheet.absoluteFillObject,
                        { backgroundColor: tintColor, opacity: tintOpacity },
                      ]}
                    />
                  ) : null}
          <TextInput
                    style={[styles.liquidAreaInput, { color: titleColor }]}
                    placeholder={`Tell us about yourself...

Examples:
• What's your current fitness routine?
• What challenges are you facing?
• What motivates you?
• What specific goals do you want to achieve?
• When do you want to see results?
• Any lifestyle factors we should know?`}
                    placeholderTextColor={placeholderColor}
            value={situationDescription}
            onChangeText={(text) => {
                      if (text.length <= maxChars) setSituationDescription(text);
            }}
            multiline
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
                    textAlignVertical="top"
            />
                  <View style={styles.liquidAreaCounter}>
                    <Text style={{ fontSize: 12, color: getCharCountColor() }}>{charCount}/{maxChars}</Text>
          </View>
        </View>
              </BlurBackdropPlate>
            </LinearGradient>
        </View>
        </View>

        {charCount > 0 && charCount < minChars && (
          <Text style={{ fontSize: 14, color: '#F59E0B', textAlign: 'center', marginBottom: 8 }}>
            Minimum {minChars} characters (currently: {charCount})
          </Text>
        )}
      </View>
    );
  };

  const TrainerCodeStep = ({
    lottie,
    heading,
    trainerCode,
    setTrainerCode,
    codeValid,
    setCodeValid,
    setCodeError,
    validateTrainerCode,
    shakeAnimation,
    isDark = true,
  }) => {
    const t = getOnboardingUiTokens(isDark);
    const H = onboardingHeadingStyles;
    const [choice, setChoice] = useState(trainerCode ? 'yes' : 'no');
    const debounceTimer = useRef(null);

    const setYes = () => setChoice('yes');

    const setNo = () => {
      setChoice('no');
      setTrainerCode('');
      setCodeValid(null);
      setCodeError(null);
    };

    const safeTrainerLottie = lottie;

    const rowCard = (selected) => ({
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      minHeight: 64,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: selected ? ONBOARDING_ACCENT : t.cardBorder,
      backgroundColor: selected ? t.cardSelectedBg : t.cardBg,
      marginBottom: 10,
    });

    return (
      <View style={styles.stepContainer}>
        {safeTrainerLottie ? (
          <LottieView source={safeTrainerLottie} autoPlay loop style={CLIENT_ONBOARDING_LOTTIE_STYLE} />
        ) : (
          <View style={[styles.iconPlaceholder, { width: 260, height: 260 }]}>
            <Ionicons name="person-add-outline" size={72} color={t.textSecondary} />
          </View>
        )}
        <Text style={[H.heading, { color: t.textPrimary }]}>{heading}</Text>
        <Text style={[H.subtitle, { color: t.textSecondary, marginBottom: 16 }]}>
          Have an invite from a coach? Enter it below. Otherwise choose independent training.
        </Text>

        <TouchableOpacity activeOpacity={0.88} onPress={setYes} style={rowCard(choice === 'yes')}>
          <IconGradientWrap
            gradient={onboardingOptionGradient(0)}
            selected={choice === 'yes'}
            size={40}
            radius={10}
            style={{ marginRight: 12 }}
          >
            <Ionicons name="key-outline" size={20} color={choice === 'yes' ? onboardingOptionGradient(0)[1] : onboardingOptionGradient(0)[0]} />
          </IconGradientWrap>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: t.textPrimary }}>Yes, I have a trainer code</Text>
          </View>
          {choice === 'yes' ? (
            <Ionicons name="checkmark-circle" size={22} color={ONBOARDING_ACCENT} />
          ) : null}
        </TouchableOpacity>

        {choice === 'yes' ? (
          <View style={{ marginBottom: 14 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1.2,
                color: t.textLabel,
                marginBottom: 8,
              }}
            >
              TRAINER CODE
            </Text>
            <Animated.View style={{ transform: [{ translateX: shakeAnimation }] }}>
              <TextInput
                style={{
                  height: 52,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: codeValid === false ? '#F87171' : ONBOARDING_ACCENT,
                  backgroundColor: t.inputBg,
                  paddingHorizontal: 16,
                  fontSize: 17,
                  fontWeight: '700',
                  letterSpacing: 3,
                  color: t.textPrimary,
                  textAlign: 'center',
                }}
                placeholder="ABC-123"
                placeholderTextColor={t.textLabel}
                value={trainerCode}
                onChangeText={(text) => {
                  const next = text.toUpperCase();
                  setTrainerCode(next);
                  setCodeValid(null);
                  setCodeError?.(null);
                  if (debounceTimer.current) clearTimeout(debounceTimer.current);
                  if (next.trim().length > 0) {
                    debounceTimer.current = setTimeout(() => {
                      validateTrainerCode(next);
                    }, 400);
                  }
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={24}
              />
            </Animated.View>
            {codeValid === true ? (
              <Text style={[styles.validationSuccess, { marginTop: 8 }]}>{'✓ Valid code — you\u2019re linked'}</Text>
            ) : null}
            {codeValid === false ? (
              <Text style={[styles.validationError, { marginTop: 8 }]}>✕ Invalid code — check and try again</Text>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity activeOpacity={0.88} onPress={setNo} style={rowCard(choice === 'no')}>
          <IconGradientWrap
            gradient={onboardingOptionGradient(1)}
            selected={choice === 'no'}
            size={40}
            radius={10}
            style={{ marginRight: 12 }}
          >
            <Ionicons name="barbell-outline" size={20} color={choice === 'no' ? onboardingOptionGradient(1)[1] : onboardingOptionGradient(1)[0]} />
          </IconGradientWrap>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: t.textPrimary }}>{'No, I\u2019ll train independently'}</Text>
            <Text style={{ fontSize: 13, color: t.textSecondary, marginTop: 2 }}>
              Browse trainers anytime from the app
            </Text>
          </View>
          {choice === 'no' ? (
            <Ionicons name="checkmark-circle" size={22} color={ONBOARDING_ACCENT} />
          ) : null}
        </TouchableOpacity>
      </View>
    );
  };

/** Role comes from signup / Firestore via AuthGate; default client — never show a duplicate full-screen role picker. */
function normalizeOnboardingRole(roleProp, routeRole) {
  const s = String(roleProp ?? routeRole ?? '').toLowerCase().trim();
  return s === 'trainer' ? 'trainer' : 'client';
}

export default function OnboardingWizardScreen({
  route,
  onComplete,
  role: roleProp,
  previewMode = false,
  previewInitialStep = 1,
  onPreviewClose,
}) {
  const { colors, typography, spacing, isDark: contextIsDark = true } = useTheme();
  const insets = useSafeAreaInsets();
  const [isDark, setIsDark] = useState(contextIsDark);
  const [role, setRole] = useState(() => normalizeOnboardingRole(roleProp, route?.params?.role));

  const [currentStep, setCurrentStep] = useState(previewMode ? previewInitialStep : 1);
  /** Step 1 height field — feet'in" text while typing (e.g. 5'11"). */
  const [heightDraft, setHeightDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAIFromOnboarding } = useAI();
  const { accessState: trainerSubscriptionAccess } = useSubscription();
  // Paywall plan selected on trainer step 8 (annual is the recommended default).
  const [trainerPlanId, setTrainerPlanId] = useState('pro_annual');
  const [faceCamOpen, setFaceCamOpen] = useState(false);
  const [faceCapturing, setFaceCapturing] = useState(false);
  const [certUploading, setCertUploading] = useState(false);
  const faceCamRef = useRef(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [onboardingData, setOnboardingData] = useState({
    // Client fields - Basic Info
    weight: null, // in kg or lbs
    height: null, // { feet, inches } from input like 5'11"
    age: null,
    gender: null, // 'male', 'female', 'other', 'prefer_not_to_say'
    // Client fields - Fitness Info
    fitnessLevel: null,
    primaryGoal: null,
    goals: [],
    equipmentAccess: [],
    daysPerWeek: null,
    // Default to editable input; `null` is reserved to mean "no limitations"
    injuries: '',
    exercisesDislike: '', // recommended
    preferredWorkoutTime: null, // 'morning' | 'afternoon' | 'evening'
    trainingEnvironment: null, // 'home' | 'gym' | 'both'
    currentStressLevel: null, // 'low' | 'moderate' | 'high'
    sleepQuality: null, // 'poor' | 'fair' | 'good'
    energyLevels: null, // 'low' | 'moderate' | 'high'
    supplementsCurrentlyTaking: '',
    hydrationHabits: null, // 'less_than_4' | '4_8' | 'more_than_8'
    trainerId: null,
    situationDescription: '', // Step 8 - detailed situation/goals description
    aiEnabled: null, // Step 9 - AI opt-in (client only)
    // Trainer fields
    certifications: [],
    yearsExperience: null,
    location: '',
    specialties: [],
    trainingPhilosophy: '',
    sessionType: null,
    offerFreeConsultation: false,
    flexiblePricingAvailable: false,
    pricing: { perSession: null, perMonth: null, initialConsult: null },
    inviteCode: null,
    certificationOther: '',
    faceVerificationPhotoURL: null,
    faceVerificationStatus: 'unsubmitted',
    isVerified: false,
    certificationSheetURLs: [],
    /** Trainer display name (step 6) */
    name: '',
    /** Short public bio; long-form philosophy stays in trainingPhilosophy */
    trainerProfileBio: '',
    /** 'available' | 'waitlist' */
    trainerAvailabilityStatus: null,
  });

  useEffect(() => {
    // Load persisted theme mode for onboarding
    AsyncStorage.getItem('themeMode')
      .then((mode) => {
        if (mode === 'dark') setIsDark(true);
        if (mode === 'light') setIsDark(false);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Persist theme choice
    AsyncStorage.setItem('themeMode', isDark ? 'dark' : 'light').catch(() => {});
  }, [isDark]);

  useLayoutEffect(() => {
    const next = normalizeOnboardingRole(roleProp, route?.params?.role);
    setRole((prev) => (prev === next ? prev : next));
  }, [roleProp, route?.params?.role]);

  const theme = isDark
    ? {
        bg: '#0A0A0F',
        card: 'rgba(255,255,255,0.05)',
        cardBorder: 'rgba(255,255,255,0.08)',
        cardSelected: 'rgba(255,107,157,0.15)',
        cardSelectedBorder: '#FF6B9D',
        text: '#FFFFFF',
        subtext: 'rgba(255,255,255,0.55)',
        input: 'rgba(255,255,255,0.05)',
        inputBorder: 'rgba(255,255,255,0.08)',
        inputText: '#FFFFFF',
        placeholder: 'rgba(255,255,255,0.3)',
        progressBg: 'rgba(255,255,255,0.08)',
        backBtn: 'rgba(255,255,255,0.08)',
        backBtnText: 'rgba(255,255,255,0.6)',
        toggleIcon: 'sunny-outline',
      }
    : {
        bg: '#F2F2F7',
        card: '#FFFFFF',
        cardBorder: 'rgba(0,0,0,0.08)',
        cardSelected: 'rgba(255,107,157,0.1)',
        cardSelectedBorder: '#FF6B9D',
        text: '#0A0A0F',
        subtext: 'rgba(0,0,0,0.5)',
        input: '#FFFFFF',
        inputBorder: 'rgba(0,0,0,0.12)',
        inputText: '#0A0A0F',
        placeholder: 'rgba(0,0,0,0.3)',
        progressBg: 'rgba(0,0,0,0.08)',
        backBtn: 'rgba(0,0,0,0.06)',
        backBtnText: 'rgba(0,0,0,0.5)',
        toggleIcon: 'moon-outline',
      };

  // Trainer invite code generation state
  const [inviteCode, setInviteCode] = useState('');
  const [generatingCode, setGeneratingCode] = useState(false);
  const inviteBorderRotation = useRef(new Animated.Value(0)).current;
  const inviteBorderPulse = useRef(new Animated.Value(0)).current;
  
  // Client trainer code validation state
  const [trainerCode, setTrainerCode] = useState('');
  const [validatingCode, setValidatingCode] = useState(false);
  const [codeValid, setCodeValid] = useState(null);
  const [codeError, setCodeError] = useState(null);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  
  // Enhanced input animations
  const [focusedInputs, setFocusedInputs] = useState({});
  const [inputValues, setInputValues] = useState({});
  
  // Animation values for neumorphic cards
  const cardAnimations = useRef({}).current;

  // Generate unique invite code for trainers (final step)
  useEffect(() => {
    if (role === 'trainer' && currentStep === 7 && !inviteCode) {
      if (previewMode) {
        setInviteCode('DEM-O12');
        setOnboardingData((prev) => ({ ...prev, inviteCode: 'DEM-O12' }));
        return;
      }
      generateInviteCode();
    }
  }, [role, currentStep, previewMode]);

  useEffect(() => {
    if (!(role === 'trainer' && currentStep === 7)) return;

    inviteBorderRotation.stopAnimation();
    inviteBorderPulse.stopAnimation();
    inviteBorderRotation.setValue(0);
    inviteBorderPulse.setValue(0);

    const rotateLoop = Animated.loop(
      Animated.timing(inviteBorderRotation, { toValue: 1, duration: 6000, useNativeDriver: true })
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(inviteBorderPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(inviteBorderPulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );

    rotateLoop.start();
    pulseLoop.start();
    return () => {
      rotateLoop.stop();
      pulseLoop.stop();
    };
  }, [role, currentStep, inviteBorderRotation, inviteBorderPulse]);

  // Get total steps based on role
  const totalSteps = role === 'client' ? 9 : 8;

  /** CTA gradient for onboarding Continue */
  const getStepGradient = () => ONBOARDING_CTA_GRADIENT;

  // Current step Lottie (all client + trainer steps that have a mapping)
  const getCurrentLottie = () => {
    const key = `${role}-${currentStep}`;
    const animation = LOTTIE_ANIMATIONS[key];
    return animation || null;
  };

  const getSafeLottie = () => {
    const src = getCurrentLottie();
    
    // If no source available, return null (will be handled by conditional render)
    if (!src) {
      return null;
    }

    // For require() statements that return numbers (asset refs)
    // NOTE: LottieView can accept the numeric asset ref directly; do NOT convert to { uri }.
    if (typeof src === 'number') {
      return src;
    }

    // For objects (already resolved JSON)
    if (typeof src === 'object' && src !== null) {
      return src;
    }
    
    // For strings (URI paths)
    if (typeof src === 'string') {
      return { uri: src };
    }
    
    return null;
  };

  const StepLottie = ({ style }) => {
    const src = getSafeLottie();
    if (!src) return null;
    return <LottieView source={src} autoPlay loop style={style || styles.lottieAnimation} />;
  };

  const postOnboardingApi = async (path, body) => {
    const baseUrls = getApiBaseCandidates();

    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) throw new Error('Missing Firebase auth user.');

    let lastErr = null;
    const fetchWithToken = async (baseUrl) => {
      await firebaseUser.reload();
      const idToken = await firebaseUser.getIdToken(true);
      if (!idToken || typeof idToken !== 'string') {
        throw new Error('Missing/invalid Firebase ID token');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        return await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(body ?? {}),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const tried = [];
    for (const baseUrl of baseUrls) {
      try {
        tried.push(baseUrl);
        let resp = await fetchWithToken(baseUrl);

        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          if (resp.status === 401) {
            resp = await fetchWithToken(baseUrl);
            if (!resp.ok) {
              const retryText = await resp.text().catch(() => '');
              throw new Error(`Server ${path} failed (${resp.status}) ${retryText}`.trim());
            }
          } else {
            throw new Error(`Server ${path} failed (${resp.status}) ${text}`.trim());
          }
        }

        return await resp.json();
      } catch (e) {
        const msg = e?.message || String(e);
        // Add a bit more context for the common RN error: "Network request failed"
        if (msg.includes('Network request failed')) {
          lastErr = new Error(`Network request failed for ${baseUrl}${path}`);
        } else if (msg.includes('aborted') || msg.includes('AbortError')) {
          lastErr = new Error(`Request timed out for ${baseUrl}${path}`);
        } else {
          lastErr = e;
        }
      }
    }

    if (lastErr) {
      const err = new Error(`${lastErr.message || String(lastErr)} (tried: ${tried.join(', ')})`);
      throw err;
    }
    throw new Error(`Request failed: ${path} (tried: ${tried.join(', ')})`);
  };

  const generateInviteCode = async () => {
    setGeneratingCode(true);
    let code = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      // Generate 6-character alphanumeric code
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const part1 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const part2 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      code = `${part1}-${part2}`;

      // Check if code exists on the server (avoids Expo Go Firestore transport)
      try {
        const resp = await postOnboardingApi('/api/onboarding/check-invite-code', { code });
        if (!resp?.exists) isUnique = true;
      } catch (error) {
        console.warn('Invite code uniqueness check failed; assuming unique:', error?.message || error);
        // If error, assume unique and continue so onboarding isn't blocked
        isUnique = true;
      }
      
      attempts++;
    }

    if (isUnique) {
      setInviteCode(code);
      setOnboardingData(prev => ({ ...prev, inviteCode: code }));
    } else {
      Alert.alert('Error', 'Could not generate unique invite code. Please try again.');
    }
    setGeneratingCode(false);
  };

  /** Normalize client input to match stored format (XXX-XXX). Returns null if invalid. */
  const normalizeInviteCodeForQuery = (raw) => {
    let s = String(raw || '').trim();
    if (!s) return null;
    // Strip TRAINER- prefix (case-insensitive)
    if (/^trainer/i.test(s)) s = s.replace(/^trainer[\-\s]*/i, '').trim();
    // Remove ALL non-alphanumeric characters, uppercase
    const cleaned = s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    // Must be exactly 6 alphanumeric chars for XXX-XXX format
    if (cleaned.length !== 6) return null;
    const result = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}`;
    return result.length === 7 ? result : null;
  };

  const validateTrainerCode = async (code) =>
    validateTrainerCodeWithDeps(code, {
      postOnboardingApi,
      setCodeValid,
      setCodeError,
      setOnboardingData,
      setValidatingCode,
      triggerShake,
    });

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const copyToClipboard = async (text) => {
    try {
      const { default: Clipboard } = await import('@react-native-clipboard/clipboard');
      await Clipboard.setString(text);
      Alert.alert('Copied!', 'Invite code copied to clipboard');
    } catch (error) {
      // Fallback for Expo
      Alert.alert('Copied!', `Invite code: ${text}`);
    }
  };

  const shareInviteCode = async () => {
    try {
      await Share.share({
        message: `Join me on CoachConnect! Use my invite code: ${inviteCode}`,
        title: 'CoachConnect Invite Code',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleSelect = (field, value, isMultiSelect = false) => {
    if (isMultiSelect) {
      const current = onboardingData[field] || [];
      const newValue = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      setOnboardingData(prev => ({ ...prev, [field]: newValue }));
    } else {
      setOnboardingData(prev => ({ ...prev, [field]: value }));
    }
  };

  useEffect(() => {
    if (role === 'client' && currentStep === 1) {
      setHeightDraft(formatHeightInputDisplay(onboardingData.height));
    }
  }, [role, currentStep]);

  const resolveClientHeight = () => {
    if (isHeightComplete(onboardingData.height)) return onboardingData.height;
    return finalizeHeightFromDraft(heightDraft);
  };

  const getClientStep1Blockers = () => {
    const missing = [];
    const weight = onboardingData.weight;
    if (weight == null || !Number.isFinite(weight) || weight <= 0) {
      missing.push('weight');
    }
    if (!isHeightComplete(resolveClientHeight())) {
      missing.push('height (e.g. 5\'11" or 5,11)');
    }
    if (onboardingData.age == null || !Number.isFinite(onboardingData.age) || onboardingData.age <= 0) {
      missing.push('age');
    }
    if (!onboardingData.gender) {
      missing.push('gender');
    }
    return missing;
  };

  const validateStep = () => {
    if (role === 'client') {
      switch (currentStep) {
        case 1:
          // Basic info: weight, height, age, gender all required
          return getClientStep1Blockers().length === 0;
        case 2:
          return onboardingData.fitnessLevel !== null;
        case 3:
          return Array.isArray(onboardingData.goals) && onboardingData.goals.length > 0;
        case 4:
          return onboardingData.equipmentAccess.length > 0;
        case 5:
          return onboardingData.daysPerWeek !== null;
        case 6:
          return true; // Optional
        case 7:
          return true; // Optional
        case 8:
          // Situation description required: 50-1000 characters
          const desc = onboardingData.situationDescription || '';
          return desc.length >= 50 && desc.length <= 1000;
        case 9:
          // AI opt-in required (must explicitly choose)
          return onboardingData.aiEnabled === true || onboardingData.aiEnabled === false;
        default:
          return false;
      }
    } else {
      // Trainer
      switch (currentStep) {
        case 1:
          return onboardingData.certifications.length > 0;
        case 2:
          return onboardingData.yearsExperience !== null;
        case 3:
          return onboardingData.specialties.length > 0;
        case 4:
          return true; // Training philosophy — optional
        case 5:
          // Availability + session format required
          return !!onboardingData.trainerAvailabilityStatus && !!onboardingData.sessionType;
        case 6:
          return !!(String(onboardingData.name || '').trim() && String(onboardingData.location || '').trim());
        case 7:
          return true; // Auto-generated invite code
        case 8:
          // Pro IAP is offered here but not required to finish setup / enter the app.
          return true;
        default:
          return false;
      }
    }
  };

  const handleNext = () => {
    if (role === 'client' && currentStep === 1) {
      const finalizedHeight = resolveClientHeight();
      if (finalizedHeight && !isHeightComplete(onboardingData.height)) {
        setOnboardingData((prev) => ({ ...prev, height: finalizedHeight }));
        setHeightDraft(formatHeightInputDisplay(finalizedHeight));
      }
    }
    if (!validateStep()) return;

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleLogout = async () => {
    if (previewMode) {
      onPreviewClose?.();
      return;
    }
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out and return to the login screen?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (error) {
              console.error('Error signing out:', error);
            }
          }
        },
      ]
    );
  };

  const handleSkip = () => {
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
    else handleFinish();
  };

  const handleFinish = async (overrideData = null) => {
    if (previewMode) {
      Alert.alert('Preview mode', 'Onboarding would finish here — nothing was saved.');
      return;
    }
    if (!auth?.currentUser) {
      Alert.alert('Error', 'You must be logged in to save onboarding data.');
      if (onComplete) onComplete();
      return;
    }

    setLoading(true);
    let firestoreSynced = false;
    let updateData = null;
    const userId = auth.currentUser.uid;
    const finalRole = role || onboardingData.role || 'client';

    const finishToApp = () => {
      if (onComplete) onComplete(finalRole, updateData);
    };

    try {
      const result = await completeOnboardingClient({
        userId,
        finalRole,
        onboardingData,
        overrideData,
        db,
        doc,
        setDoc,
        serverTimestamp,
        AsyncStorage,
        postOnboardingApi,
        displayName: auth.currentUser?.displayName || null,
      });

      updateData = result.updateData;
      firestoreSynced = result.firestoreSynced;

      if (result.error) {
        throw result.error;
      }

      if (firestoreSynced) {
        console.log('✅ Onboarding merged to Firestore (users/' + userId + ')');
      }
      console.log('✅ Onboarding data saved locally + synced to server');
      console.log('✅ Onboarding completed for user:', userId);

      Alert.alert("You're all set", 'Welcome to CoachConnect. Your profile is ready.', [
        { text: 'Continue', style: 'default', onPress: finishToApp },
      ]);
    } catch (error) {
      if (firestoreSynced) {
        // Do not console.error — LogBox shows it as a red overlay even though Firestore succeeded.
        // Typical cause: dev API (localhost / 127.0.0.1) unreachable from a physical device; payload is queued.
        if (__DEV__) {
          console.log(
            '[onboarding] Server sync deferred (Firestore OK):',
            error?.message || String(error)
          );
        }
        // Profile + onboardingCompleted are already on users/{uid}; queue server for trainer doc / CRM links.
        try {
          if (userId) {
            const queuedUpdate =
              updateData ||
              buildOnboardingUpdatePayload(finalRole, onboardingData, overrideData);
            await AsyncStorage.setItem(`onboarding_data_${userId}`, JSON.stringify(queuedUpdate)).catch(() => {});
            await queuePendingOnboardingSync(userId, {
              path: '/api/onboarding/complete',
              body: {
                finalRole,
                onboardingData: queuedUpdate,
                displayName: auth?.currentUser?.displayName || null,
              },
            });
          }
        } catch (_) {}

        Alert.alert(
          "You're all set",
          'Your profile was saved. Any remaining account setup will finish in the background when the connection is stable.',
          [{ text: 'Continue', style: 'default', onPress: finishToApp }]
        );
        return;
      }

      console.error('❌ Error saving onboarding data:', error);

      // Queue a sync attempt for next app start / when API becomes reachable.
      try {
        if (userId) {
          const queuedUpdate =
            updateData || buildOnboardingUpdatePayload(finalRole, onboardingData, overrideData);
          await AsyncStorage.setItem(`onboarding_data_${userId}`, JSON.stringify(queuedUpdate)).catch(() => {});
          await queuePendingOnboardingSync(userId, {
            path: '/api/onboarding/complete',
            body: {
              finalRole,
              onboardingData: queuedUpdate,
              displayName: auth?.currentUser?.displayName || null,
            },
          });
        }
      } catch (_) {}

      Alert.alert(
        'Save Failed',
        'Failed to save onboarding data. You can continue, but your preferences won\'t be saved.',
        [
          {
            text: 'Continue Anyway',
            onPress: () => {
              const fallback =
                updateData || buildOnboardingUpdatePayload(finalRole, onboardingData, overrideData);
              onComplete && onComplete(finalRole, fallback);
            },
          },
          { text: 'Try Again', onPress: handleFinish },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const isOptionalStep = () => {
    if (role === 'client') {
      return currentStep === 6 || currentStep === 7; // Injuries and Trainer Code (steps 8-9 are required)
    }
    return currentStep === 4 || currentStep === 8; // philosophy + Pro IAP optional
  };

  const getStepTitle = () => {
    if (role === 'client') {
      const titles = [
        "Tell us about yourself",
        "What's your fitness experience?",
        "What's your main goal?",
        "What equipment do you have access to?",
        "How many days per week can you train?",
        "Any injuries or limitations?",
        "Do you have a trainer?",
        "Describe Your Situation",
        "AI-Powered Features",
      ];
      return titles[currentStep - 1];
    } else {
      const titles = [
        'What certifications do you have?',
        'How long have you been training clients?',
        'What are your specialties?',
        'Describe your training philosophy',
        'Availability & session format',
        'Almost done!',
        'Your client invite code',
        'Coach Connect Pro',
      ];
      return titles[currentStep - 1];
    }
  };

  const renderClientStep = () => {
    const H = onboardingHeadingStyles;
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <StepLottie style={CLIENT_ONBOARDING_LOTTIE_STYLE} />
            <Text style={[H.heading, { color: ot.textPrimary }]}>{getStepTitle()}</Text>
            <Text style={[H.subtitle, { color: ot.textSecondary }]}>This helps us personalize your experience</Text>
            <OnboardingInputRow
              t={ot}
              iconSource={getOnboardingIconSource('weight')}
              iconName="scale-outline"
              label="WEIGHT"
              value={onboardingData.weight != null ? String(onboardingData.weight) : ''}
              onChangeText={(text) => {
                const num = text.replace(/[^0-9.]/g, '');
                setOnboardingData((prev) => ({ ...prev, weight: num ? parseFloat(num) : null }));
              }}
              placeholder="Enter weight"
              keyboardType="numeric"
              rightElement={<Text style={{ fontSize: 12, fontWeight: '700', color: ot.cardSelectedBorder }}>LBS</Text>}
            />
            <OnboardingInputRow
              t={ot}
              iconSource={getOnboardingIconSource('height')}
              iconName="resize-outline"
              label="HEIGHT"
              value={heightDraft}
              onChangeText={(text) => {
                const { text: formatted, height } = parseHeightInputText(text);
                setHeightDraft(formatted);
                setOnboardingData((prev) => ({ ...prev, height }));
              }}
              onBlur={() => {
                const finalized = finalizeHeightFromDraft(heightDraft);
                if (!finalized) return;
                setOnboardingData((prev) => ({ ...prev, height: finalized }));
                setHeightDraft(formatHeightInputDisplay(finalized));
              }}
              placeholder={'e.g., 5\'11" or 5,11'}
              keyboardType="default"
              textInputProps={{
                autoCapitalize: 'none',
                autoCorrect: false,
                smartInsertDelete: false,
              }}
            />
            <OnboardingInputRow
              t={ot}
              iconSource={getOnboardingIconSource('age')}
              iconName="calendar-outline"
              label="AGE"
              value={onboardingData.age != null ? String(onboardingData.age) : ''}
              onChangeText={(text) => {
                const num = text.replace(/[^0-9]/g, '');
                setOnboardingData((prev) => ({ ...prev, age: num ? parseInt(num, 10) : null }));
              }}
              placeholder="Enter age"
              keyboardType="numeric"
              rightElement={<Text style={{ fontSize: 12, fontWeight: '700', color: ot.textSecondary }}>YRS</Text>}
            />
            <OnboardingSectionLabel text="GENDER" t={ot} />
            {[
              { id: 'male', label: 'Male', icon: 'man-outline', accentGradient: onboardingOptionGradient(0) },
              { id: 'female', label: 'Female', icon: 'woman-outline', accentGradient: onboardingOptionGradient(1) },
              { id: 'other', label: 'Other', icon: 'person-outline', accentGradient: onboardingOptionGradient(2) },
              { id: 'prefer_not_to_say', label: 'Prefer not to say', icon: 'ellipsis-horizontal-circle-outline', accentGradient: onboardingOptionGradient(3) },
            ].map((g) => (
              <SelectionCard
                key={g.id}
                t={ot}
                selected={onboardingData.gender === g.id}
                onPress={() => handleSelect('gender', g.id)}
                iconSource={getOnboardingIconSource(g.id)}
                iconName={g.icon}
                label={g.label}
                accentGradient={g.accentGradient}
              />
            ))}
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <StepLottie style={CLIENT_ONBOARDING_LOTTIE_STYLE} />
            <Text style={[H.heading, { color: ot.textPrimary }]}>{getStepTitle()}</Text>
            <View style={{ marginTop: 12 }}>
              {[
                { id: 'beginner', label: 'Beginner', desc: 'New to working out', icon: 'leaf-outline', accentGradient: onboardingOptionGradient(0) },
                { id: 'intermediate', label: 'Intermediate', desc: 'Work out regularly', icon: 'trending-up-outline', accentGradient: onboardingOptionGradient(1) },
                { id: 'advanced', label: 'Advanced', desc: 'Experienced athlete', icon: 'flash-outline', accentGradient: onboardingOptionGradient(2) },
              ].map((l) => (
                <SelectionCard
                  key={l.id}
                  t={ot}
                  selected={onboardingData.fitnessLevel === l.id}
                  onPress={() => handleSelect('fitnessLevel', l.id)}
                  iconSource={getOnboardingIconSource(l.id)}
                  iconName={l.icon}
                  label={l.label}
                  description={l.desc}
                  accentGradient={l.accentGradient}
                />
              ))}
            </View>
            <Text style={{ fontSize: 12, color: ot.textSecondary, marginTop: 12, lineHeight: 18, textAlign: 'center' }}>
              Beginners (under 1 year of consistent training) often progress fastest with compound movements—keep it simple at first.
            </Text>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <StepLottie style={CLIENT_ONBOARDING_LOTTIE_STYLE} />
            <Text style={[H.heading, { color: ot.textPrimary }]}>{getStepTitle()}</Text>
            <Text style={[H.subtitle, { color: ot.textSecondary }]}>Select all that apply</Text>
            <View style={{ marginTop: 12 }}>
              {[
                { value: 'lose_fat', label: 'Lose Fat', icon: 'trending-down-outline', accentGradient: onboardingOptionGradient(0) },
                { value: 'build_muscle', label: 'Build Muscle', icon: 'barbell-outline', accentGradient: onboardingOptionGradient(1) },
                { value: 'maintain_health', label: 'Maintain Health', icon: 'heart-outline', accentGradient: onboardingOptionGradient(2) },
                { value: 'athletic_performance', label: 'Athletic Performance', icon: 'flash-outline', accentGradient: onboardingOptionGradient(3) },
                { value: 'improve_mental_health', label: 'Improve Mental Health', icon: 'sunny-outline', accentGradient: onboardingOptionGradient(4) },
                { value: 'build_habits', label: 'Build Consistency & Habits', icon: 'calendar-outline', accentGradient: onboardingOptionGradient(5) },
              ].map((item) => {
                const goalsArray = Array.isArray(onboardingData.goals) ? onboardingData.goals : [];
                const selected = goalsArray.includes(item.value);
                return (
                  <SelectionCard
                    key={item.value}
                    t={ot}
                    selected={selected}
                    onPress={() => {
                      setOnboardingData((prev) => {
                        const current = Array.isArray(prev.goals) ? prev.goals : [];
                        const exists = current.includes(item.value);
                        const nextGoals = exists ? current.filter((g) => g !== item.value) : [...current, item.value];
                        return { ...prev, goals: nextGoals, primaryGoal: nextGoals[0] || null };
                      });
                    }}
                    iconName={item.icon}
                    label={item.label}
                    accentGradient={item.accentGradient}
                  />
                );
              })}
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <StepLottie style={CLIENT_ONBOARDING_LOTTIE_STYLE_EQUIPMENT} />
            <Text style={[H.heading, { color: ot.textPrimary }]}>{getStepTitle()}</Text>
            <Text style={[H.subtitle, { color: ot.textSecondary }]}>Select all that apply</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 10 }}>
              {[
                { value: 'full_gym', label: 'Full Gym', icon: 'fitness-outline', accentGradient: onboardingOptionGradient(0) },
                { value: 'dumbbells', label: 'Dumbbells', icon: 'barbell-outline', accentGradient: onboardingOptionGradient(1) },
              ].map((e) => (
                <SelectionCard
                  key={e.value}
                  t={ot}
                  variant="grid"
                  selected={onboardingData.equipmentAccess.includes(e.value)}
                  onPress={() => handleSelect('equipmentAccess', e.value, true)}
                  iconSource={getOnboardingIconSource(e.value)}
                  iconName={e.icon}
                  label={e.label}
                  accentGradient={e.accentGradient}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              {[
                { value: 'resistance_bands', label: 'Resistance Bands', icon: 'infinite-outline', accentGradient: onboardingOptionGradient(2) },
                { value: 'pull_up_bar', label: 'Pull-up Bar', icon: 'move-outline', accentGradient: onboardingOptionGradient(3) },
              ].map((e) => (
                <SelectionCard
                  key={e.value}
                  t={ot}
                  variant="grid"
                  selected={onboardingData.equipmentAccess.includes(e.value)}
                  onPress={() => handleSelect('equipmentAccess', e.value, true)}
                  iconSource={getOnboardingIconSource(e.value)}
                  iconName={e.icon}
                  label={e.label}
                  accentGradient={e.accentGradient}
                />
              ))}
            </View>
            <View style={{ width: onboardingGridHalfWidth(), alignSelf: 'center', marginBottom: 4 }}>
              <SelectionCard
                t={ot}
                variant="grid"
                selected={onboardingData.equipmentAccess.includes('bodyweight')}
                onPress={() => handleSelect('equipmentAccess', 'bodyweight', true)}
                iconSource={getOnboardingIconSource('bodyweight')}
                iconName="body-outline"
                label="Bodyweight Only"
                accentGradient={onboardingOptionGradient(4)}
              />
            </View>
            {Array.isArray(onboardingData.equipmentAccess) && onboardingData.equipmentAccess.includes('bodyweight') ? (
              <Text style={{ fontSize: 12, color: ot.textSecondary, marginTop: 8, lineHeight: 18, textAlign: 'center' }}>
                Bodyweight works—adding even light dumbbells unlocks more progression over time.
              </Text>
            ) : null}
            <OnboardingSectionLabel text="WHERE DO YOU PREFER TO TRAIN?" t={ot} style={{ marginTop: 8 }} />
            {[
              { value: 'home', label: 'Home', icon: 'home-outline', desc: 'Work out from the comfort of your home', accentGradient: onboardingOptionGradient(0) },
              { value: 'gym', label: 'Gym', icon: 'barbell-outline', desc: 'Access to a full range of gym equipment', accentGradient: onboardingOptionGradient(1) },
              { value: 'both', label: 'Both', icon: 'shuffle-outline', desc: 'Flexible, combining home and gym', accentGradient: onboardingOptionGradient(2) },
            ].map((l) => (
              <SelectionCard
                key={l.value}
                t={ot}
                selected={onboardingData.trainingEnvironment === l.value}
                onPress={() => setOnboardingData((prev) => ({ ...prev, trainingEnvironment: l.value }))}
                iconName={l.icon}
                label={l.label}
                description={l.desc}
                accentGradient={l.accentGradient}
              />
            ))}
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContainer}>
            <StepLottie style={CLIENT_ONBOARDING_LOTTIE_STYLE} />
            <Text style={[H.heading, { color: ot.textPrimary }]}>{getStepTitle()}</Text>
            <OnboardingDayPicker
              t={ot}
              value={onboardingData.daysPerWeek}
              onChange={(n) => handleSelect('daysPerWeek', n)}
            />
            <Text style={{ fontSize: 12, color: ot.textSecondary, marginTop: 8, lineHeight: 18, textAlign: 'center' }}>
              Most muscle groups respond well to 2–3 sessions per week; 4 days/week is a sweet spot for many people.
            </Text>
            <OnboardingSectionLabel text="PREFERRED WORKOUT TIME" t={ot} />
            {[
              { value: 'morning', label: 'Morning', icon: 'sunny-outline', desc: '5am – 12pm', accentGradient: onboardingOptionGradient(0) },
              { value: 'afternoon', label: 'Afternoon', icon: 'partly-sunny-outline', desc: '12pm – 5pm', accentGradient: onboardingOptionGradient(1) },
              { value: 'evening', label: 'Evening', icon: 'moon-outline', desc: '5pm – 10pm', accentGradient: onboardingOptionGradient(2) },
              { value: 'no_preference', label: 'No preference', icon: 'time-outline', desc: 'Anytime works', accentGradient: onboardingOptionGradient(3) },
            ].map((item) => (
              <SelectionCard
                key={item.value}
                t={ot}
                selected={onboardingData.preferredWorkoutTime === item.value}
                onPress={() => setOnboardingData((prev) => ({ ...prev, preferredWorkoutTime: item.value }))}
                iconName={item.icon}
                label={item.label}
                description={item.desc}
                accentGradient={item.accentGradient}
              />
            ))}
          </View>
        );

      case 6: {
        const noLimitations = onboardingData.injuries === null;
        return (
          <View style={styles.stepContainer}>
            <StepLottie style={CLIENT_ONBOARDING_LOTTIE_STYLE} />
            <Text style={[H.heading, { color: ot.textPrimary }]}>{getStepTitle()}</Text>
            <Text style={[H.subtitle, { color: ot.textSecondary }]}>{"We'll help you work around them safely"}</Text>
            <OnboardingSectionLabel text="INJURIES OR PHYSICAL LIMITATIONS (RECOMMENDED)" t={ot} style={{ marginTop: 8 }} />
            <OnboardingTextArea
              t={ot}
              value={noLimitations ? '' : onboardingData.injuries || ''}
              onChangeText={(text) => setOnboardingData((prev) => ({ ...prev, injuries: text }))}
              placeholder="e.g., lower back pain, knee issues, shoulder injury..."
              numberOfLines={5}
              maxLength={500}
              editable={!noLimitations}
            />
            <Text style={{ fontSize: 12, color: ot.textSecondary, marginTop: 4, lineHeight: 18 }}>
              {"Be specific: area, movements that bother you, and whether it's recent or chronic."}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: ot.textPrimary }}>I have no limitations</Text>
              <Switch
                value={noLimitations}
                onValueChange={(value) => setOnboardingData((prev) => ({ ...prev, injuries: value ? null : '' }))}
                trackColor={{ false: ot.cardBorder, true: ot.toggleTrack }}
                thumbColor={COLORS.white}
              />
            </View>
            <OnboardingSectionLabel text="EXERCISES YOU WOULD PREFER (RECOMMENDED)" t={ot} />
            <ExerciseDislikePicker
              t={ot}
              intent="prefer"
              value={onboardingData.exercisesDislike || ''}
              onChange={(next) => setOnboardingData((prev) => ({ ...prev, exercisesDislike: next }))}
              animatePills
            />
            <OnboardingSectionLabel text="SUPPLEMENTS CURRENTLY TAKING (OPTIONAL)" t={ot} />
            <OnboardingTextArea
              t={ot}
              value={onboardingData.supplementsCurrentlyTaking || ''}
              onChangeText={(text) => setOnboardingData((prev) => ({ ...prev, supplementsCurrentlyTaking: text }))}
              placeholder="e.g., creatine, protein, multivitamin..."
              numberOfLines={3}
              maxLength={500}
            />
          </View>
        );
      }

      case 7:
        return (
          <TrainerCodeStep
            lottie={getSafeLottie()}
            heading={getStepTitle()}
            trainerCode={trainerCode}
            setTrainerCode={setTrainerCode}
            codeValid={codeValid}
            setCodeValid={setCodeValid}
            setCodeError={setCodeError}
            validateTrainerCode={validateTrainerCode}
            shakeAnimation={shakeAnimation}
            isDark={isDark}
          />
        );

      case 8: {
        const charCount = (onboardingData.situationDescription || '').length;
        const minChars = 50;
        const maxChars = 1000;
        return (
          <View style={styles.stepContainer}>
            <StepLottie style={CLIENT_ONBOARDING_LOTTIE_STYLE_WIDE} />
            <Text style={[H.heading, { color: ot.textPrimary }]}>{getStepTitle()}</Text>
            <Text style={[H.subtitle, { color: ot.textSecondary }]}>Optional details — then tell us your story below (required)</Text>
            <OnboardingSectionLabel text="CURRENT STRESS LEVEL (OPTIONAL)" t={ot} style={{ marginTop: 4 }} />
            <OnboardingOptionChips
              t={ot}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'high', label: 'High' },
              ]}
              selected={onboardingData.currentStressLevel}
              onSelect={(v) => setOnboardingData((prev) => ({ ...prev, currentStressLevel: v }))}
            />
            <OnboardingSectionLabel text="SLEEP QUALITY (OPTIONAL)" t={ot} />
            <OnboardingOptionChips
              t={ot}
              options={[
                { value: 'poor', label: 'Poor' },
                { value: 'fair', label: 'Fair' },
                { value: 'good', label: 'Good' },
              ]}
              selected={onboardingData.sleepQuality}
              onSelect={(v) => setOnboardingData((prev) => ({ ...prev, sleepQuality: v }))}
            />
            <OnboardingSectionLabel text="ENERGY LEVELS (OPTIONAL)" t={ot} />
            <OnboardingOptionChips
              t={ot}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'high', label: 'High' },
              ]}
              selected={onboardingData.energyLevels}
              onSelect={(v) => setOnboardingData((prev) => ({ ...prev, energyLevels: v }))}
            />
            <OnboardingSectionLabel text="HYDRATION HABITS (OPTIONAL)" t={ot} />
            <OnboardingOptionChips
              t={ot}
              options={[
                { value: 'less_than_4', label: 'Under 4 cups/day' },
                { value: '4_8', label: '4–8 cups/day' },
                { value: 'more_than_8', label: '8+ cups/day' },
              ]}
              selected={onboardingData.hydrationHabits}
              onSelect={(v) => setOnboardingData((prev) => ({ ...prev, hydrationHabits: v }))}
            />
            <OnboardingSectionLabel text="DESCRIBE YOUR SITUATION (REQUIRED)" t={ot} />
            <OnboardingTextArea
              t={ot}
              value={onboardingData.situationDescription || ''}
              onChangeText={(text) =>
                setOnboardingData((prev) => ({
                  ...prev,
                  situationDescription: text.slice(0, maxChars),
                }))
              }
              placeholder={`Tell us about yourself…

Examples:
• Current routine and challenges
• What motivates you
• Timeline for results
• Lifestyle factors we should know`}
              numberOfLines={8}
              maxLength={maxChars}
            />
            {charCount > 0 && charCount < minChars ? (
              <Text style={{ fontSize: 14, color: '#F59E0B', textAlign: 'center', marginBottom: 8 }}>
                Minimum {minChars} characters (currently: {charCount})
              </Text>
            ) : null}
          </View>
        );
      }

      case 9: {
        return (
          <View style={styles.stepContainer}>
            <AIOptInStep
              isDark={isDark}
              currentStep={currentStep}
              totalSteps={totalSteps}
              onEnableAI={async () => {
                setOnboardingData((prev) => ({ ...prev, aiEnabled: true }));
                await AsyncStorage.setItem('aiEnabled', 'true');
                setAIFromOnboarding(true);
                handleFinish({ aiEnabled: true });
              }}
              onSkipAI={async () => {
                setOnboardingData((prev) => ({ ...prev, aiEnabled: false }));
                await AsyncStorage.setItem('aiEnabled', 'false');
                setAIFromOnboarding(false);
                handleFinish({ aiEnabled: false });
              }}
            />
          </View>
        );
      }

      default:
        return null;
    }
  };

  // Render trainer step — purple/pink Lovable-style cards (matches TrainerOnboardingWizardScreen reference)
  const renderTrainerStep = () => {
    const ot = getOnboardingUiTokens(isDark);
    const H = onboardingHeadingStyles;
    const safeTrainerLottie = getSafeLottie();
    const trainerLottie =
      safeTrainerLottie != null ? (
        <LottieView source={safeTrainerLottie} autoPlay loop style={CLIENT_ONBOARDING_LOTTIE_STYLE} />
      ) : null;

    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            {trainerLottie}
            <Text style={[H.heading, { color: ot.textPrimary }]}>{getStepTitle()}</Text>
            <Text style={[H.subtitle, { color: ot.textSecondary }]}>Select all that apply.</Text>
            <View style={{ marginTop: 16 }}>
              {[
                { value: 'NASM-CPT', label: 'NASM-CPT', icon: 'medal-outline', accentGradient: onboardingOptionGradient(0) },
                { value: 'ACE', label: 'ACE', icon: 'ribbon-outline', accentGradient: onboardingOptionGradient(1) },
                { value: 'ISSA', label: 'ISSA', icon: 'school-outline', accentGradient: onboardingOptionGradient(2) },
                { value: 'ACSM', label: 'ACSM', icon: 'fitness-outline', accentGradient: onboardingOptionGradient(3) },
                { value: 'NSCA-CPT', label: 'NSCA-CPT', icon: 'barbell-outline', accentGradient: onboardingOptionGradient(4) },
                { value: 'Other', label: 'Other', icon: 'create-outline', accentGradient: onboardingOptionGradient(5) },
                { value: 'None', label: 'No formal certification', icon: 'person-outline', accentGradient: onboardingOptionGradient(0) },
              ].map((item) => (
                <SelectionCard
                  key={item.value}
                  t={ot}
                  selected={onboardingData.certifications.includes(item.value)}
                  onPress={() => {
                    handleSelect('certifications', item.value, true);
                    if (item.value !== 'Other' && onboardingData.certifications.includes('Other')) {
                      setOnboardingData((prev) => ({ ...prev, certificationOther: '' }));
                    }
                  }}
                  iconName={item.icon}
                  label={item.label}
                  description={
                    item.value === 'None' ? 'You have experience but no formal certification.' : undefined
                  }
                  accentGradient={item.accentGradient}
                />
              ))}
            </View>
            {onboardingData.certifications.includes('Other') ? (
              <View style={{ marginTop: 16 }}>
                <OnboardingSectionLabel text="SPECIFY CERTIFICATION" t={ot} style={{ marginTop: 0 }} />
                <TextInput
                  value={onboardingData.certificationOther}
                  onChangeText={(text) => setOnboardingData((prev) => ({ ...prev, certificationOther: text }))}
                  placeholder="e.g. Precision Nutrition Level 1"
                  placeholderTextColor={ot.textLabel}
                  style={{
                    backgroundColor: ot.inputBg,
                    borderWidth: 1.5,
                    borderColor: ot.inputBorder,
                    borderRadius: 14,
                    padding: 14,
                    minHeight: 52,
                    color: ot.textPrimary,
                    fontSize: 15,
                  }}
                />
              </View>
            ) : null}
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={certUploading || !auth?.currentUser?.uid}
              onPress={async () => {
                const tid = auth?.currentUser?.uid;
                if (!tid) {
                  Alert.alert('Sign in required', 'Finish signup first so we can save your certification sheet.');
                  return;
                }
                try {
                  const result = await DocumentPicker.getDocumentAsync({
                    type: [
                      'application/pdf',
                      'application/msword',
                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                      'image/*',
                      '*/*',
                    ],
                    copyToCacheDirectory: true,
                  });
                  if (result.canceled) return;
                  const file = result.assets[0];
                  setCertUploading(true);
                  const { url, meta } = await uploadTrainerCertificationSheet(tid, {
                    localUri: file.uri,
                    filename: file.name || 'certification.pdf',
                    mimeType: file.mimeType,
                    fileSize: file.size,
                  });
                  setOnboardingData((prev) => ({
                    ...prev,
                    certificationSheetURLs: [...(prev.certificationSheetURLs || []), url],
                    certificationSheets: [...(prev.certificationSheets || []), meta].filter(Boolean),
                  }));

                  const trainerName =
                    String(onboardingData.name || '').trim() ||
                    String(auth?.currentUser?.displayName || '').trim() ||
                    'Trainer';
                  let verifyMessage = 'Certification sheet saved for review.';
                  const mime = String(file.mimeType || meta?.fileType || '').toLowerCase();
                  if (mime.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(String(file.name || ''))) {
                    try {
                      setOnboardingData((prev) => ({
                        ...prev,
                        certificationVerificationStatus: 'checking',
                      }));
                      const verification = await verifyTrainerCertification({
                        trainerId: tid,
                        trainerName,
                        localUri: file.uri,
                        imageUrl: url,
                        mediaType: file.mimeType || 'image/jpeg',
                        storagePath: meta?.storagePath,
                        fileName: meta?.fileName,
                      });
                      verifyMessage =
                        verification.userMessage ||
                        certificationStatusLabel(verification.status) ||
                        verifyMessage;
                      if (verification.status === 'manual_review') {
                        verifyMessage = `${verifyMessage}\nUsually reviewed within 24–48 hours.`;
                      }
                      setOnboardingData((prev) => ({
                        ...prev,
                        aiVerification: verification.aiVerification || verification.analysis || null,
                        certificationVerificationStatus: verification.status,
                        isVerified: verification.isVerified === true,
                      }));
                    } catch (verifyErr) {
                      if (__DEV__) console.warn('cert AI verify:', verifyErr?.message || verifyErr);
                      setOnboardingData((prev) => ({
                        ...prev,
                        certificationVerificationStatus: 'manual_review',
                      }));
                      verifyMessage =
                        'Uploaded — Under review. AI check was unavailable; usually reviewed within 24–48 hours.';
                    }
                  } else {
                    setOnboardingData((prev) => ({
                      ...prev,
                      certificationVerificationStatus: 'manual_review',
                    }));
                    verifyMessage =
                      'Uploaded — Under review. Usually reviewed within 24–48 hours (use a JPG/PNG for instant AI check).';
                  }
                  Alert.alert('Certification', verifyMessage);
                } catch (e) {
                  Alert.alert('Upload failed', e?.message || 'Could not upload certification.');
                } finally {
                  setCertUploading(false);
                }
              }}
              style={{
                marginTop: 16,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: ot.cardBorder,
                paddingVertical: 14,
                paddingHorizontal: 16,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {certUploading ? (
                <ActivityIndicator color={ot.textPrimary} />
              ) : (
                <>
                  <Ionicons name="document-attach-outline" size={20} color={ot.textPrimary} />
                  <Text style={{ color: ot.textPrimary, fontWeight: '700' }}>
                    Upload cert sheet ({(onboardingData.certificationSheetURLs || []).length})
                  </Text>
                </>
              )}
            </TouchableOpacity>
            {certificationStatusLabel(onboardingData.certificationVerificationStatus) ? (
              <View style={{ marginTop: 12, paddingHorizontal: 2 }}>
                <Text style={{ color: ot.textPrimary, fontWeight: '700', fontSize: 13 }}>
                  {certificationStatusLabel(onboardingData.certificationVerificationStatus)}
                </Text>
                {certificationStatusDetail(onboardingData.certificationVerificationStatus) ? (
                  <Text style={{ color: ot.textMuted || ot.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                    {certificationStatusDetail(onboardingData.certificationVerificationStatus)}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            {trainerLottie}
            <Text style={[H.heading, { color: ot.textPrimary }]}>{getStepTitle()}</Text>
            <Text style={[H.subtitle, { color: ot.textSecondary }]}>Tell clients how long you've been coaching.</Text>
            <View style={{ marginTop: 16 }}>
              {[
                { value: 'less_than_1', label: 'Less than 1 year', icon: 'leaf-outline', accentGradient: onboardingOptionGradient(0) },
                { value: '1_2', label: '1–2 years', icon: 'time-outline', accentGradient: onboardingOptionGradient(1) },
                { value: '3_5', label: '3–5 years', icon: 'trending-up-outline', accentGradient: onboardingOptionGradient(2) },
                { value: '6_10', label: '6–10 years', icon: 'star-outline', accentGradient: onboardingOptionGradient(3) },
                { value: '10_plus', label: '10+ years', icon: 'trophy-outline', accentGradient: onboardingOptionGradient(4) },
              ].map((item) => (
                <SelectionCard
                  key={item.value}
                  t={ot}
                  selected={onboardingData.yearsExperience === item.value}
                  onPress={() => handleSelect('yearsExperience', item.value)}
                  iconName={item.icon}
                  label={item.label}
                  accentGradient={item.accentGradient}
                />
              ))}
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            {trainerLottie}
            <Text style={[H.heading, { color: ot.textPrimary }]}>{getStepTitle()}</Text>
            <Text style={[H.subtitle, { color: ot.textSecondary }]}>Select all that apply.</Text>
            <OnboardingMultiSelectPills
              t={ot}
              selectedValues={onboardingData.specialties}
              onToggle={(value) => handleSelect('specialties', value, true)}
              options={[
                { value: 'strength', label: 'Strength Training' },
                { value: 'weight_loss', label: 'Weight Loss' },
                { value: 'bodybuilding', label: 'Bodybuilding' },
                { value: 'athletic', label: 'Athletic Performance' },
                { value: 'rehabilitation', label: 'Rehabilitation' },
                { value: 'powerlifting', label: 'Powerlifting' },
                { value: 'crossfit', label: 'CrossFit' },
                { value: 'yoga', label: 'Yoga & Flexibility' },
                { value: 'senior', label: 'Senior Fitness' },
                { value: 'youth', label: 'Youth Training' },
                { value: 'hiit', label: 'HIIT' },
                { value: 'nutrition', label: 'Nutrition Coaching' },
              ]}
            />
          </View>
        );

      case 4: {
        return (
          <View style={styles.stepContainer}>
            {trainerLottie}
            <Text style={[H.heading, { color: ot.textPrimary }]}>{getStepTitle()}</Text>
            <Text style={[H.subtitle, { color: ot.textSecondary }]}>Help clients understand your approach.</Text>
            <View style={{ marginTop: 16 }}>
              <OnboardingTextArea
                t={ot}
                value={onboardingData.trainingPhilosophy}
                onChangeText={(text) => setOnboardingData((prev) => ({ ...prev, trainingPhilosophy: text }))}
                placeholder="e.g., I believe in progressive overload with strong form fundamentals..."
                numberOfLines={6}
                maxLength={500}
              />
            </View>
          </View>
        );
      }

      case 5:
        return (
          <View style={styles.stepContainer}>
            {trainerLottie}
            <Text style={[H.heading, { color: ot.textPrimary }]}>{getStepTitle()}</Text>
            <Text style={[H.subtitle, { color: ot.textSecondary }]}>Set how clients can book with you.</Text>

            <OnboardingSectionLabel text="AVAILABILITY" t={ot} />
            <SelectionCard
              t={ot}
              selected={onboardingData.trainerAvailabilityStatus === 'available'}
              onPress={() => setOnboardingData((prev) => ({ ...prev, trainerAvailabilityStatus: 'available' }))}
              iconName="checkmark-circle-outline"
              label="Available now"
              description="Accepting new clients"
              accentGradient={onboardingOptionGradient(0)}
            />
            <SelectionCard
              t={ot}
              selected={onboardingData.trainerAvailabilityStatus === 'waitlist'}
              onPress={() => setOnboardingData((prev) => ({ ...prev, trainerAvailabilityStatus: 'waitlist' }))}
              iconName="time-outline"
              label="Waitlist"
              description="Currently full — adding to waitlist"
              accentGradient={onboardingOptionGradient(1)}
            />

            <OnboardingSectionLabel text="SESSION TYPE" t={ot} />
            <SelectionCard
              t={ot}
              selected={onboardingData.sessionType === 'Remote'}
              onPress={() => setOnboardingData((prev) => ({ ...prev, sessionType: 'Remote' }))}
              iconName="videocam-outline"
              label="Remote"
              description="Online sessions only"
              accentGradient={onboardingOptionGradient(2)}
            />
            <SelectionCard
              t={ot}
              selected={onboardingData.sessionType === 'In-person'}
              onPress={() => setOnboardingData((prev) => ({ ...prev, sessionType: 'In-person' }))}
              iconName="location-outline"
              label="In-person"
              description="Local sessions"
              accentGradient={onboardingOptionGradient(3)}
            />
            <SelectionCard
              t={ot}
              selected={onboardingData.sessionType === 'Both'}
              onPress={() => setOnboardingData((prev) => ({ ...prev, sessionType: 'Both' }))}
              iconName="shuffle-outline"
              label="Both"
              description="Remote and in-person"
              accentGradient={onboardingOptionGradient(4)}
            />
          </View>
        );

      case 6:
        return (
          <View style={styles.stepContainer}>
            {trainerLottie}
            <Text style={[H.heading, { color: ot.textPrimary }]}>{getStepTitle()}</Text>
            <Text style={[H.subtitle, { color: ot.textSecondary }]}>A few last details for your profile.</Text>
            <View style={{ marginTop: 20, gap: 12 }}>
              <OnboardingInputRow
                t={ot}
                iconName="person-outline"
                label="FULL NAME"
                value={onboardingData.name || ''}
                onChangeText={(text) => setOnboardingData((prev) => ({ ...prev, name: text }))}
                placeholder="Your name as clients will see it"
              />
              <OnboardingInputRow
                t={ot}
                iconName="location-outline"
                label="CITY, STATE"
                value={onboardingData.location || ''}
                onChangeText={(text) => setOnboardingData((prev) => ({ ...prev, location: text }))}
                placeholder="e.g. Detroit, MI"
              />
              <OnboardingSectionLabel text="SHORT BIO (OPTIONAL)" t={ot} style={{ marginTop: 8 }} />
              <OnboardingTextArea
                t={ot}
                value={onboardingData.trainerProfileBio || ''}
                onChangeText={(text) => setOnboardingData((prev) => ({ ...prev, trainerProfileBio: text }))}
                placeholder="One or two sentences for your marketplace card..."
                numberOfLines={3}
                maxLength={250}
              />
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={faceCapturing}
                onPress={async () => {
                  if (!cameraPermission?.granted) {
                    const res = await requestCameraPermission();
                    if (!res.granted) {
                      Alert.alert('Camera needed', 'Allow camera access to verify your face for your trainer profile.');
                      return;
                    }
                  }
                  setFaceCamOpen(true);
                }}
                style={{ alignItems: 'center', marginTop: 8 }}
              >
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    borderWidth: 2,
                    borderStyle: 'dashed',
                    borderColor: onboardingData.faceVerificationPhotoURL ? '#22C55E' : ot.cardBorder,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {onboardingData.faceVerificationPhotoURL ? (
                    <Image
                      source={{ uri: onboardingData.faceVerificationPhotoURL }}
                      style={{ width: 96, height: 96, borderRadius: 48 }}
                    />
                  ) : (
                    <Ionicons name="scan-outline" size={28} color={ot.textSecondary} />
                  )}
                </View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: ot.textPrimary, marginTop: 8 }}>
                  {onboardingData.faceVerificationPhotoURL
                    ? 'Identity Verification submitted'
                    : 'Identity Verification (Face ID)'}
                </Text>
                <Text style={{ fontSize: 12, color: ot.textSecondary, textAlign: 'center', paddingHorizontal: 24 }}>
                  {onboardingData.faceVerificationPhotoURL
                    ? 'Pending manual review — Verified badge appears after approval. This is not a payment step.'
                    : 'Take a selfie for identity review only. Payment method (bank/debit via Stripe) is a separate step.'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 7: {
        const rotate = inviteBorderRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
        const pulseScale = inviteBorderPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
        const displayCode = inviteCode ? inviteCode.replace('-', '') : 'XXXXXX';
        return (
          <View style={styles.stepContainer}>
            {trainerLottie}
            <Text style={[H.heading, { color: ot.textPrimary }]}>{getStepTitle()}</Text>
            <Text style={[H.subtitle, { color: ot.textSecondary }]}>Share this with your clients to get started.</Text>

            <View style={styles.codeCardOuter}>
              <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
                <View style={styles.codeCardFrame}>
                  <Animated.View style={[styles.codeCardBorderAnim, { transform: [{ rotate }] }]}>
                    <LinearGradient
                      colors={TRAINER_ONBOARDING_GRADIENT}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                  <View style={styles.codeCardInner}>
                    {generatingCode ? (
                      <ActivityIndicator size="large" color={COLORS.textPrimary} />
                    ) : (
                      <Text style={styles.codeCardText}>{`TRAINER-${displayCode}`}</Text>
                    )}
                  </View>
                </View>
              </Animated.View>
            </View>

            <View style={styles.inviteButtons}>
              <TouchableOpacity style={styles.halfButton} onPress={() => copyToClipboard(inviteCode)} disabled={!inviteCode}>
                <LinearGradient
                  colors={TRAINER_ONBOARDING_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.halfButtonBorder}
                >
                  <View style={styles.halfButtonInner}>
                    <Text style={styles.halfButtonText}>Copy Code</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.halfButton} onPress={shareInviteCode} disabled={!inviteCode}>
                <LinearGradient
                  colors={TRAINER_ONBOARDING_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.halfButtonFill}
                >
                  <Text style={styles.halfButtonTextFilled}>Share</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      case 8:
        return (
          <View style={styles.stepContainer}>
            <TrainerSubscriptionOnboardingStep
              isDark={isDark}
              selectedPlanId={trainerPlanId}
              onSelectPlan={setTrainerPlanId}
            />
          </View>
        );

      default:
        return null;
    }
  };

  const dynamicStyles = getStyles(isDark);
  const ot = getOnboardingUiTokens(isDark);
  const hideBottomNav = (role === 'client' && currentStep === 9)
    || (role === 'trainer' && currentStep === 8);
  const isTrainerPaywallStep = role === 'trainer' && currentStep === 8;
  const onboardingFooterPadTop = 12;
  const onboardingFooterPadBottom = Math.max(insets.bottom, 12);
  const onboardingFooterBarHeight = onboardingFooterPadTop + 56 + onboardingFooterPadBottom;
  // Paywall footer is taller (CTA + price/restore row below it).
  const scrollBottomPad = onboardingFooterBarHeight + (isTrainerPaywallStep ? 60 : 28);
  const ScreenRoot = previewMode ? View : SafeAreaView;

  return (
    <ScreenRoot style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
          <ScrollView
            style={{ flex: 1, backgroundColor: theme.bg }}
            contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 24, paddingBottom: scrollBottomPad }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header row: back, progress bar, theme toggle */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 16,
                gap: 12,
              }}
            >
              <TouchableOpacity
                onPress={currentStep > 1 ? handleBack : handleLogout}
                activeOpacity={0.8}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: theme.backBtn,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={currentStep > 1 ? 'chevron-back' : 'close'}
                  size={18}
                  color={theme.backBtnText}
                />
              </TouchableOpacity>

              <OnboardingProgressBar
                current={currentStep}
                total={totalSteps}
                t={ot}
                gradientColors={role === 'trainer' ? TRAINER_ONBOARDING_GRADIENT : undefined}
              />

              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: theme.subtext,
                  minWidth: 36,
                  textAlign: 'right',
                }}
              >
                {`${currentStep}/${totalSteps}`}
              </Text>

              <TouchableOpacity
                onPress={() => setIsDark(!isDark)}
                activeOpacity={0.8}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: theme.backBtn,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={theme.toggleIcon} size={18} color={theme.subtext} />
              </TouchableOpacity>
            </View>

            {role === 'client' ? renderClientStep() : renderTrainerStep()}
          </ScrollView>

          {/* Trainer step 8: sticky paywall CTA (FitFlow-style fixed footer) */}
          {isTrainerPaywallStep ? (
            <TrainerSubscriptionCtaFooter
              isDark={isDark}
              selectedPlanId={trainerPlanId}
              onComplete={() => handleFinish()}
              bottomInset={onboardingFooterPadBottom}
            />
          ) : null}

          {/* Bottom bar: symmetric layout so Continue stays screen-centered; safe-area + no extra button margins */}
          {hideBottomNav ? null : (
            <View
              style={[
                dynamicStyles.navigationBar,
                {
                  paddingTop: onboardingFooterPadTop,
                  paddingBottom: onboardingFooterPadBottom,
                  paddingHorizontal: 16,
                },
              ]}
            >
              {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 56 }}>
                  <ActivityIndicator size="small" color={ONBOARDING_ACCENT} />
                </View>
              ) : (
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 80, justifyContent: 'center', alignItems: 'flex-start' }}>
                    {isOptionalStep() ? (
                      <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={loading}>
                        <Text style={dynamicStyles.skipButtonText}>Skip</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 0, paddingHorizontal: 6 }}>
                    <OnboardingPrimaryButton
                      variant="footer"
                      t={ot}
                      disabled={!validateStep()}
                      onDisabledPress={() => {
                        if (role === 'client' && currentStep === 1) {
                          const missing = getClientStep1Blockers();
                          if (missing.length) {
                            Alert.alert(
                              'Almost there',
                              `Please complete: ${missing.join(', ')}. Scroll up if you need to enter weight or height.`
                            );
                          }
                        }
                      }}
                      onPress={handleNext}
                      label={currentStep === totalSteps ? '✓ Complete Setup' : 'Continue'}
                    />
                  </View>
                  <View style={{ width: 80 }} />
                </View>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      </View>

      <Modal visible={faceCamOpen} animationType="slide" onRequestClose={() => setFaceCamOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
          <CameraView
            ref={faceCamRef}
            style={{ flex: 1 }}
            facing="front"
          />
          <View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFillObject,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 240,
                height: 300,
                borderRadius: 140,
                borderWidth: 3,
                borderColor: 'rgba(255,107,157,0.9)',
                backgroundColor: 'transparent',
              }}
            />
            <Text style={{ color: '#fff', marginTop: 24, fontWeight: '700', textAlign: 'center', paddingHorizontal: 32 }}>
              Center your face in the oval
            </Text>
          </View>
          <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              disabled={faceCapturing}
              onPress={async () => {
                const tid = auth?.currentUser?.uid;
                if (!tid) {
                  Alert.alert('Sign in required', 'Complete signup first.');
                  return;
                }
                try {
                  setFaceCapturing(true);
                  const photo = await faceCamRef.current?.takePictureAsync?.({
                    quality: 0.7,
                    skipProcessing: false,
                  });
                  if (!photo?.uri) throw new Error('Could not capture photo');
                  const { url } = await uploadTrainerFaceVerification(tid, { localUri: photo.uri });
                  setOnboardingData((prev) => ({
                    ...prev,
                    faceVerificationPhotoURL: url,
                    faceVerificationStatus: 'pending',
                    isVerified: false,
                    faceVerificationSubmittedAt: new Date().toISOString(),
                  }));
                  setFaceCamOpen(false);
                  Alert.alert('Submitted', 'Face photo uploaded for manual review.');
                } catch (e) {
                  Alert.alert('Capture failed', e?.message || 'Could not save face verification.');
                } finally {
                  setFaceCapturing(false);
                }
              }}
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: '#FF6B9D',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {faceCapturing ? <ActivityIndicator color="#fff" /> : <Ionicons name="camera" size={28} color="#fff" />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFaceCamOpen(false)}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenRoot>
  );
}

// Get theme-aware styles
const getStyles = (isDark = true) => ({
  liquidHeading: {
    fontSize: 28,
    fontWeight: '800',
    color: isDark ? 'rgba(255,255,255,0.96)' : 'rgba(15,23,42,0.96)',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.2,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Rounded' : undefined,
  },
  liquidSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: isDark ? 'rgba(255,255,255,0.70)' : 'rgba(51,65,85,0.72)',
    textAlign: 'center',
    marginBottom: 20,
  },
  liquidSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: isDark ? 'rgba(255,255,255,0.80)' : 'rgba(30,41,59,0.78)',
    letterSpacing: 0.9,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 16,
    color: isDark ? '#9CA3AF' : '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: isDark ? '#F9FAFB' : '#1F2937',
    textAlign: 'center',
    marginTop: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: isDark ? '#D1D5DB' : '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  textInput: {
    fontSize: 16,
    color: isDark ? '#F9FAFB' : '#1F2937',
    minHeight: 120,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
  },
  pricingInput: {
    fontSize: 24,
    fontWeight: '700',
    color: isDark ? '#F9FAFB' : '#1F2937',
    textAlign: 'center',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
  },
  pricingLabel: {
    fontSize: 14,
    color: isDark ? '#D1D5DB' : '#6B7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  charCounterText: {
    fontSize: 14,
    color: isDark ? '#9CA3AF' : '#6B7280',
  },
  navigationBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.8)',
  },
  backButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? '#3A3A3A' : '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonIcon: {
    fontSize: 24,
    color: isDark ? '#F9FAFB' : '#1F2937',
  },
  skipButtonText: {
    fontSize: 16,
    color: isDark ? '#9CA3AF' : '#6B7280',
    fontWeight: '500',
  },
  secondaryButton: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF',
    borderWidth: 2,
    borderColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  inputError: {
    borderWidth: 2,
    borderColor: isDark ? '#F87171' : '#FCA5A5',
  },
  modernInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: isDark ? '#D1D5DB' : '#6B7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modernNumberInput: {
    fontSize: 32,
    fontWeight: '700',
    color: isDark ? '#FFFFFF' : '#1F2937',
    textAlign: 'center',
    flex: 1,
    minWidth: 60,
  },
  modernUnitLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: isDark ? '#D1D5DB' : '#6B7280',
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: isDark ? '#F9FAFB' : '#1F2937',
    marginBottom: 16,
    marginTop: 8,
  },
  modernGenderLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: isDark ? '#E5E7EB' : '#4B5563',
    marginTop: 8,
    textAlign: 'center',
  },
  modernGenderLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 120,
  },
  stepContainer: {
    marginTop: 24,
  },
  cardsContainer: {
    gap: 12,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  gridCard: {
    width: (width - 60) / 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginTop: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  cardIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  horizontalScroll: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  frequencyCard: {
    width: 140,
    marginRight: 12,
  },
  frequencyNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  frequencyLabel: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  inputCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  inputGradient: {
    padding: 20,
    borderRadius: 16,
  },
  inputError: {
    borderWidth: 2,
    borderColor: '#FCA5A5',
  },
  textInput: {
    fontSize: 16,
    color: '#1F2937',
    minHeight: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  codeInput: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 16,
  },
  codeIndicator: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
  },
  checkmark: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -12,
    fontSize: 24,
    color: '#10B981',
    fontWeight: 'bold',
  },
  errorMark: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -12,
    fontSize: 24,
    color: '#EF4444',
    fontWeight: 'bold',
  },
  charCounter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  charCounterText: {
    fontSize: 14,
    color: '#6B7280',
  },
  charCounterValid: {
    color: '#10B981',
    fontWeight: '600',
  },
  pricingContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  neumorphicCard: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  pricingGradient: {
    padding: 20,
    borderRadius: 16,
  },
  pricingCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  pricingLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  pricingInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  inviteCardContainer: {
    marginBottom: 24,
  },
  inviteCard: {
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  inviteCode: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inviteButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  primaryButton: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  navigationBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: 'rgba(250, 250, 250, 0.95)',
  },
  backButton: {
    width: 44,
    height: 44,
  },
  backButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonIcon: {
    fontSize: 24,
    color: '#1F2937',
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  nextButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginLeft: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  nextButtonDisabledContainer: {
    shadowOpacity: 0,
    elevation: 0,
  },
  nextButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.8,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  nextButtonTextDisabled: {
    color: '#94A3B8',
  },
  // Modern input styles
  modernInputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  modernInputCard: {
    flex: 1,
    minWidth: (width - 60) / 3 - 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  modernInputCardDark: {
    backgroundColor: '#2D2D2D',
    borderColor: 'rgba(139, 92, 246, 0.6)',
    borderWidth: 2,
  },
  modernInputIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modernInputIconText: {
    fontSize: 28,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  numberInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    flex: 1,
  },
  unitLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  modernInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    width: '100%',
  },
  // Modern gender selection styles
  modernGenderSection: {
    marginTop: 8,
  },
  modernGenderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  modernGenderCard: {
    flex: 1,
    minWidth: (width - 60) / 2 - 6,
    height: 100,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modernGenderCardSelected: {
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    transform: [{ scale: 1.02 }],
  },
  modernGenderGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
  },
  modernGenderEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  modernGenderCheckmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  modernGenderCheckmarkText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  // Trainer pricing + invite code (spec-aligned)
  rateStack: {
    gap: 16,
    marginTop: 8,
  },
  rateCard: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  rateLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 10,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 4,
  },
  rateCurrency: {
    fontSize: 20,
    color: COLORS.textSecondary,
    width: 24,
    textAlign: 'center',
  },
  rateInput: {
    flex: 1,
    fontSize: 20,
    color: COLORS.textPrimary,
    paddingHorizontal: 12,
  },
  codeCardOuter: {
    marginTop: 8,
    marginBottom: 16,
  },
  codeCardFrame: {
    borderRadius: 20,
    padding: 3,
    overflow: 'hidden',
  },
  codeCardBorderAnim: {
    ...StyleSheet.absoluteFillObject,
  },
  codeCardInner: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  codeCardText: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 2,
    color: COLORS.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  halfButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  halfButtonBorder: {
    flex: 1,
    padding: 2,
    borderRadius: 28,
  },
  halfButtonInner: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halfButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5B86E5',
  },
  halfButtonFill: {
    flex: 1,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halfButtonTextFilled: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },

  heading: {
    fontSize: 28,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },

  // Equipment cards (2-column grid)
  equipmentGridCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  equipmentCardHit: {
    width: TWO_COL_ITEM,
    marginBottom: 16,
  },
  equipmentCardShell: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  equipmentCardShellSelected: {
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  equipmentCardBorder: {
    borderRadius: 24,
    padding: 0.5,
    overflow: 'hidden',
  },
  equipmentCardBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  equipmentCardInner: {
    borderRadius: 24,
    height: 120,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  equipmentSelectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.14,
  },
  equipmentIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  equipmentIconImage: {
    width: 44,
    height: 44,
    marginBottom: 10,
    resizeMode: 'contain',
  },
  equipmentLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  equipmentCheckboxOutline: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'transparent',
  },
  equipmentCheckbox: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#C084FC',
    borderColor: '#C084FC',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipmentCheckboxText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Day selector
  dayCircleHit: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  dayCircleOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  dayCircleOuterSelected: {
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  dayCircleBorder: {
    borderRadius: 26,
    padding: 0.5,
    overflow: 'hidden',
    flex: 1,
  },
  dayCircleBlur: {
    borderRadius: 26,
    overflow: 'hidden',
    flex: 1,
  },
  dayCircleSurface: {
    flex: 1,
    width: '100%',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dayCircleSelectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.18,
  },
  dayCircleText: {
    fontSize: 18,
    fontWeight: '900',
  },

  // Multi-line input w/ counter
  multiLineWrapper: {
    marginTop: 8,
  },
  multiLineLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  multiLineShell: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    overflow: 'hidden',
  },
  multiLineBorder: {
    borderRadius: 24,
    padding: 0.5,
    overflow: 'hidden',
  },
  multiLineBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  multiLineInner: {
    padding: 16,
    minHeight: 180,
    borderRadius: 24,
  },
  multiLineInput: {
    fontSize: 16,
    color: COLORS.textPrimary,
    minHeight: 120,
  },
  multiLineCounter: {
    position: 'absolute',
    right: 14,
    bottom: 12,
    fontSize: 12,
    fontWeight: '700',
  },

  validationHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 10,
    textAlign: 'center',
  },
  validationHintValid: {
    color: '#10B981',
    fontWeight: '700',
  },

  // Trainer code cards
  codeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 10,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Rate underline
  rateUnderline: {
    height: 2,
    marginTop: 10,
    borderRadius: 2,
    overflow: 'hidden',
  },
  rateUnderlineFill: {
    flex: 1,
    borderRadius: 2,
  },
  rateUnderlineBase: {
    flex: 1,
    backgroundColor: COLORS.border,
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 4,
  },

  otherCertContainer: {
    marginTop: 16,
  },

  // Core onboarding layout + components (spec-aligned)
  lottieAnimation: {
    width: 260,
    height: 260,
    alignSelf: 'center',
    marginBottom: 20,
  },
  iconPlaceholder: {
    width: 260,
    height: 260,
    alignSelf: 'center',
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },

  // Gradient floating-label input
  enhancedInputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 16,
  },
  gradientInputContainer: {
    width: '100%',
  },
  gradientInputWrapper: {
    height: 56,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  gradientInputBorder: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 18,
  },
  gradientInputContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  inputIconSlot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  inputIcon: {
    fontSize: 26,
    color: 'rgba(255,255,255,0.90)',
    width: 40,
    textAlign: 'center',
  },
  inputIconImage: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  inputFieldContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  floatingLabel: {
    position: 'absolute',
    left: 0,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  gradientTextInput: {
    height: 64,
    fontSize: 22,
    color: 'rgba(255,255,255,0.92)',
    paddingTop: 24,
    paddingBottom: 0,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Rounded' : undefined,
  },
  unitLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.62)',
    marginBottom: 6,
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.72)',
  },

  // Gender selection
  genderSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  liquidHeading: {
    fontSize: 28,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.96)',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.2,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Rounded' : undefined,
  },
  // Gender selection
  genderSection: {
    marginTop: 16,
  },
  genderGridContainer: {
    position: 'relative',
  },
  genderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  genderCard: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    minWidth: 90,
  },
  genderCardSelected: {
    backgroundColor: 'rgba(100,210,255,0.2)',
    borderColor: '#64D2FF',
  },
  genderCardText: {
    fontSize: 14,
    fontWeight: '600',
  },
  genderFadeGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 14,
    textTransform: 'uppercase',
  },

  // Neumorphic cards (Modernized)
  neumorphicCardsContainer: {
    gap: 16,
  },
  neumorphicCardContainer: {
    borderRadius: 20,
    width: '100%',
  },
  neumorphicCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Liquid Glass field + select cards (Step 1)
  liquidFieldOuter: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  liquidFieldBorder: {
    borderRadius: 24,
    padding: 0.5,
    overflow: 'hidden',
  },
  liquidFieldBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  liquidFieldSurface: {
    height: 64,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
  },
  liquidSelectHit: {
    width: '100%',
  },
  liquidSelectOuter: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  liquidSelectOuterSelected: {
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  liquidSelectBorder: {
    borderRadius: 24,
    padding: 0.5,
    overflow: 'hidden',
  },
  liquidSelectBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  liquidSelectSurface: {
    height: 92,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
  },
  liquidSelectIcon: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  liquidSelectTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Rounded' : undefined,
  },
  liquidSelectCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liquidSelectCheckText: {
    fontSize: 14,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.92)',
  },

  // Liquid Glass row card (replaces old neumorphic card visuals)
  liquidCardHit: {
    width: '100%',
  },
  liquidCardOuter: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  liquidCardOuterSelected: {
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  liquidCardBorder: {
    borderRadius: 24,
    padding: 0.5,
    overflow: 'hidden',
  },
  liquidCardBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  liquidCardSurface: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 24,
  },
  liquidCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  liquidCardIcon: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  liquidCardEmoji: {
    fontSize: 26,
    width: 30,
    textAlign: 'center',
  },
  liquidCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Rounded' : undefined,
  },
  liquidCardSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
  },
  liquidCardCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liquidCardCheckText: {
    fontSize: 14,
    fontWeight: '900',
  },

  // Liquid Glass textarea + tip (Step 8)
  liquidAreaOuter: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    overflow: 'hidden',
  },
  liquidAreaBorder: {
    borderRadius: 24,
    padding: 0.5,
    overflow: 'hidden',
  },
  liquidAreaBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  liquidAreaSurface: {
    minHeight: 220,
    padding: 16,
    borderRadius: 24,
  },
  liquidAreaInput: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    minHeight: 180,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Rounded' : undefined,
  },
  liquidAreaCounter: {
    position: 'absolute',
    bottom: 12,
    right: 16,
  },
  liquidTipOuter: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    overflow: 'hidden',
  },
  liquidTipBorder: {
    borderRadius: 24,
    padding: 0.5,
    overflow: 'hidden',
  },
  liquidTipBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  liquidTipSurface: {
    borderRadius: 24,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  neumorphicCardSelected: {
    borderWidth: 2,
  },
  neumorphicCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.05,
  },
  neumorphicCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  neumorphicCardIcon: {
    fontSize: 32,
  },
  neumorphicCardIconImage: {
    width: 34,
    height: 34,
    resizeMode: 'contain',
  },
  neumorphicCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  neumorphicCardTitleSelected: {
    color: '#7C3AED',
  },
  neumorphicCardSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  neumorphicCardSubtitleSelected: {
    color: '#64748B',
  },
  neumorphicCardCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#5B86E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  neumorphicCardCheckmarkText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.white,
  },

  // Gradient pill grid
  gradientPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  gradientPillContainer: {
    width: TWO_COL_ITEM,
    marginBottom: 16,
  },
  gradientPill: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  gradientPillBorder: {
    borderRadius: 24,
    padding: 0.5,
    overflow: 'hidden',
  },
  gradientPillBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  gradientPillSurface: {
    height: 76,
    borderRadius: 24,
    paddingHorizontal: 16,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gradientPillSelectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.14,
  },
  gradientPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  gradientPillIcon: {
    fontSize: 18,
  },
  gradientPillIconImage: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  gradientPillText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  gradientPillCheckmark: {
    fontSize: 16,
    fontWeight: '900',
  },

  // Day selector container
  circularDaySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
  },
  helperText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Switch row (client injuries)
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  switchLabel: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },

  // Client trainer code cards
  expandableCardsContainer: {
    gap: 16,
    marginTop: 16,
  },
  expandableCardOuter: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    overflow: 'hidden',
  },
  expandableCardBorder: {
    borderRadius: 24,
    padding: 0.5,
    overflow: 'hidden',
  },
  expandableCardBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  expandableCardSurface: {
    borderRadius: 24,
    padding: 18,
    justifyContent: 'center',
  },
  expandableCardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  codeInput: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  validationSuccess: {
    marginTop: 10,
    color: '#10B981',
    fontWeight: '800',
  },
  validationError: {
    marginTop: 10,
    color: '#EF4444',
    fontWeight: '800',
  },

  // Certifications wrap
  certificationPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },

  selectablePillHit: {
    marginRight: 8,
    marginBottom: 8,
  },
  selectablePill: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectablePillSelected: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  selectablePillText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  selectablePillTextSelected: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
  },

  inviteButtons: {
    flexDirection: 'row',
    gap: 8,
  },
});

