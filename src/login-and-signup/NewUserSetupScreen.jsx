// NewUserSetupScreen.jsx
//
// First-run setup questionnaire for clients and trainers (role comes from signup).
// Flow: answer each step → validate → save phone + Firestore + server → enter the app.
// Used by: LoginGate after signup. Named exports are shared onboarding UI primitives.

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
import { useTheme } from '../look-and-feel/lightDarkMode';
import { auth, db } from '../app-start/cloudConnection';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import {
  uploadTrainerCertificationSheet,
  uploadTrainerFaceVerification,
} from '../for-both/files-and-notes/saveNotesAndFiles';
import {
  checkTrainerCertificate,
  certificationStatusLabel,
  certificationStatusDetail,
} from '../for-both/online-connection/checkTrainerCertificate';
import BlurredBackground from '../look-and-feel/BlurredBackground';
import { validateTrainerCodeWithDeps } from './checkTrainerCode';
import { completeOnboardingClient, buildOnboardingUpdatePayload } from './finishSetup';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseCandidates } from '../for-both/online-connection/whereToConnect';
import { queuePendingOnboardingSync } from '../for-both/online-connection/uploadSetupAnswers';
import { useAI } from '../for-both/app-wide-settings/AIPermission';
import { AIPermissionStep } from '../for-both/setup-steps/AIPermissionStep';
import { useSubscription } from '../trainer-pro-plan/ProPlanSetup';
import { TRAINER_PLATFORM_SUBSCRIPTION_ENABLED } from '../trainer-pro-plan/proPlanSwitches';
import DislikedExercisesPicker from '../workouts/exercise-videos/DislikedExercisesPicker';
import LottieView from 'lottie-react-native';
import GlassBackgroundDark from '../look-and-feel/GlassBackgroundDark';
import GlassBackgroundLight from '../look-and-feel/GlassBackgroundLight';
import { getOnboardingIconSource } from '../for-both/setup-icons/onboardingIconRegistry';
import {
  formatHeightInputDisplay,
  parseHeightInputText,
  isHeightComplete,
  finalizeHeightFromDraft,
} from '../helpers/convertHeight';
import { Ionicons } from '@expo/vector-icons';
import lottieClient1 from '../assets/animations/app-flows/personal-info';
import lottieClient2 from '../assets/animations/app-flows/fitness-experience';
import lottieClient3 from '../assets/animations/app-flows/fitness-goal';
import lottieClient4 from '../assets/animations/legacy/fitness (1)';
import lottieClient5 from '../assets/animations/app-flows/training-frequency';
import lottieClient6 from '../assets/animations/app-flows/injuries';
import lottieClient7 from '../assets/icons/weightlifting-competition';
import lottieClientDescribeSituation from '../for-both/assets/Walking steps';
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
} from '../for-both/setup-steps/setupStepPieces';
import NbProgressSteps from '../look-and-feel/NbProgressSteps';
import NbButton from '../look-and-feel/NbButton';
import ClientOnboardingStep, {
  CLIENT_ONBOARDING_STEPS,
  getClientChapterMeta,
  getClientScreenTitle,
  validateClientOnboardingStep,
  withClientSliderDefaults,
} from './ClientOnboardingScreens';
import DesignLawTrainerOnboardingStep, {
  TRAINER_ONBOARDING_STEPS,
  TRAINER_INVITE_STEP,
  TRAINER_PRO_STEP,
  TRAINER_COMPLETE_STEP,
  TRAINER_PAYOUT_STEP,
  getTrainerChapterMeta,
  getTrainerScreenTitle,
  validateTrainerOnboardingStep,
  withTrainerSliderDefaults,
} from './DesignLawTrainerOnboardingScreens';
import NbHero from '../look-and-feel/NbHero';
import NbChip from '../look-and-feel/NbChip';
import NbChipRow from '../look-and-feel/NbChipRow';
import NbSegmented from '../look-and-feel/NbSegmented';
import NbOptionRow, { NbOptionGrid } from '../look-and-feel/NbOptionRow';
import NbScreen from '../look-and-feel/NbScreen';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { lightColors, darkColors, spacing, gradients } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const { width } = Dimensions.get('window');
const SCREEN_PAD = 16;
const GRID_GUTTER = 16;
const TWO_COL_ITEM = (width - SCREEN_PAD * 2 - GRID_GUTTER) / 2;

// Manipulate here: icon size when SelectionCard is "large".
const ICON_SIZE_LARGE = 24;
// Manipulate here: default max length for onboarding text areas.
const DEFAULT_TEXTAREA_MAX_CHARS = 500;
// Manipulate here: trainer philosophy / bio hard cap.
const PHILOSOPHY_MAX_CHARS = 1000;
const PHILOSOPHY_MIN_CHARS = 50;
// Day-of-week picker shows Mon–Sun as 1…7.
const DAYS_IN_WEEK = 7;
const DAY_OF_WEEK_NUMBERS = [1, 2, 3, 4, 5, 6, DAYS_IN_WEEK];
// Client step tint index for trainer-code / invite step.
const CLIENT_INVITE_STEP = 7;
// Trainer invite-code step — Design Law part 1 step 4 (see DesignLawTrainerOnboardingScreens).
// Invite code display "XXX-XXX" is 7 chars including the dash.
const INVITE_CODE_DISPLAY_LENGTH = 7;
// Manipulate here: orange warning when bio is near the limit.
const BIO_WARN_NEAR_LIMIT = 450;
const BIO_WARN_AT_LIMIT = 500;
// Manipulate here: spinning border duration on the invite-code card.
const INVITE_BORDER_SPIN_MS = 6000;
// Manipulate here: onboarding API request timeout.
const ONBOARDING_API_TIMEOUT_MS = 15000;
const HTTP_UNAUTHORIZED = 401;
// Manipulate here: extra bottom pad on the trainer paywall step.
const TRAINER_PAYWALL_EXTRA_PAD = 60;
// Layout tokens used by getStyles (plain object, not StyleSheet.create).
const STYLE_SPACE_LG = 24;
const STYLE_FONT_TITLE = 24;
const STYLE_UNIT_MIN_WIDTH = 60;

// ===== HELPER FUNCTIONS =====


/**
 * AI-verify image cert sheets; non-images go straight to manual review.
 */
async function verifyUploadedCertificationSheet({
  trainerUid,
  trainerName,
  file,
  url,
  meta,
  setOnboardingData,
}) {
  let verifyMessage = 'Certification sheet saved for review.';
  const mime = String(file.mimeType || meta?.fileType || '').toLowerCase();
  const isImage =
    mime.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(String(file.name || ''));

  if (!isImage) {
    setOnboardingData((prev) => ({
      ...prev,
      certificationVerificationStatus: 'manual_review',
    }));
    return 'Uploaded — Under review. Usually reviewed within 24–48 hours (use a JPG/PNG for instant AI check).';
  }

  try {
    setOnboardingData((prev) => ({
      ...prev,
      certificationVerificationStatus: 'checking',
    }));
    const verification = await checkTrainerCertificate({
      trainerId: trainerUid,
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
    return verifyMessage;
  } catch (verifyErr) {
    if (__DEV__) console.warn('cert AI verify:', verifyErr?.message || verifyErr);
    setOnboardingData((prev) => ({
      ...prev,
      certificationVerificationStatus: 'manual_review',
    }));
    return 'Uploaded — Under review. AI check was unavailable; usually reviewed within 24–48 hours.';
  }
}

// --- Onboarding UI primitives (rest of components live in this file; tokens + primary CTA in setupStepPieces.jsx) ---

function CardLeadingIcon({ iconSource, iconName, iconColor, grid, large, row }) {
  const [imageFailed, setImageFailed] = useState(false);
  const dim = grid ? 40 : large ? 36 : row ? 28 : 28;
  const ionSize = grid ? 26 : large ? ICON_SIZE_LARGE : 20;

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

/**
 * Thin legacy % bar — prefer NbProgressSteps for Design Law chapter chrome.
 * @param {{current: number, total: number, t: object, gradientColors?: string[]}} props
 */
export function OnboardingProgressBar({ current, total, t, gradientColors }) {
  const pct = Math.min((current / total) * 100, 100);
  return (
    <View
      style={{
        flex: 1,
        height: 10,
        borderRadius: 999,
        borderWidth: 3,
        borderColor: t.cardBorder,
        backgroundColor: t.progressTrack,
        marginHorizontal: 12,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: t.fill || t.cardSelectedBg,
        }}
      />
    </View>
  );
}

/**
 * Design Law choice card — 3px border, hard shadow, selected = solid fill + check.
 * @param {object} props
 */
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
  const cardBackground = selected ? t.cardSelectedBg : t.cardBg;
  const border = t.cardBorder;
  const labelColor = selected ? (t.cardSelectedText || t.onFill || '#FFFFFF') : t.textPrimary;
  const descColor = selected ? labelColor : t.textSecondary;
  const gradient = accentGradient || ONBOARDING_BRAND_GRADIENT;
  const iconColor = selected ? labelColor : gradient[0];
  const hasIcon = !!(iconSource || iconName);
  const hardShadow = {
    shadowColor: t.shadow || t.cardBorder,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  };

  if (variant === 'grid') {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={{
          flex: 1,
          minHeight: 100,
          backgroundColor: cardBackground,
          borderWidth: 3,
          borderColor: border,
          borderRadius: 10,
          padding: 14,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          ...hardShadow,
        }}
      >
        {hasIcon ? (
          <IconGradientWrap gradient={gradient} selected={selected} size={40} radius={10}>
            <CardLeadingIcon iconSource={iconSource} iconName={iconName} iconColor={iconColor} grid />
          </IconGradientWrap>
        ) : null}
        <Text style={{ fontSize: 13, fontWeight: '800', color: labelColor, textAlign: 'center' }}>{label}</Text>
        {selected ? (
          <View style={{ position: 'absolute', top: 8, right: 8 }}>
            <Ionicons name="checkmark" size={16} color={labelColor} />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }

  if (variant === 'large') {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={{
          flex: 1,
          backgroundColor: cardBackground,
          borderWidth: 3,
          borderColor: border,
          borderRadius: 10,
          padding: 24,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          ...hardShadow,
        }}
      >
        {hasIcon ? (
          <IconGradientWrap gradient={gradient} selected={selected} size={48} radius={12}>
            <CardLeadingIcon iconSource={iconSource} iconName={iconName} iconColor={iconColor} large />
          </IconGradientWrap>
        ) : null}
        <Text style={{ fontSize: 16, fontWeight: '800', color: labelColor }}>{label}</Text>
        {description ? (
          <Text style={{ fontSize: 13, color: descColor, textAlign: 'center', fontWeight: '500' }}>{description}</Text>
        ) : null}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        minHeight: 64,
        backgroundColor: cardBackground,
        borderWidth: 3,
        borderColor: border,
        borderRadius: 10,
        paddingHorizontal: 14,
        marginBottom: 10,
        ...hardShadow,
      }}
    >
      {hasIcon ? (
        <IconGradientWrap gradient={gradient} selected={selected} size={40} radius={10} style={{ marginRight: 12 }}>
          <CardLeadingIcon iconSource={iconSource} iconName={iconName} iconColor={iconColor} row />
        </IconGradientWrap>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: labelColor }}>{label}</Text>
        {description ? (
          <Text style={{ fontSize: 13, color: descColor, marginTop: 1, fontWeight: '500' }}>{description}</Text>
        ) : null}
      </View>
      {selected ? <Ionicons name="checkmark" size={20} color={labelColor} style={{ marginLeft: 8 }} /> : null}
    </TouchableOpacity>
  );
}

/** Multiline text box with a character counter for onboarding answers. */
export function OnboardingTextArea({
  value,
  onChangeText,
  placeholder,
  maxLength = DEFAULT_TEXTAREA_MAX_CHARS,
  numberOfLines = 5,
  t,
  editable = true,
}) {
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
        style={{
          backgroundColor: t.inputBg,
          borderWidth: 3,
          borderColor: t.cardBorder,
          borderRadius: 8,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 14,
          fontWeight: '600',
          color: t.textPrimary,
          textAlignVertical: 'top',
          minHeight: numberOfLines * 22 + 24,
          shadowColor: t.shadow || t.cardBorder,
          shadowOffset: { width: 3, height: 3 },
          shadowOpacity: 1,
          shadowRadius: 0,
        }}
      />
      <Text style={{ fontSize: 12, color: t.textLabel, textAlign: 'right', marginTop: 4, fontWeight: '700' }}>
        {value.length}/{maxLength}
      </Text>
    </View>
  );
}

/** Small uppercase label above an onboarding field group. */
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

/** Single-line input row with optional leading icon and trailing unit. */
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
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.inputBg,
        borderWidth: 3,
        borderColor: t.cardBorder,
        borderRadius: 8,
        paddingHorizontal: 14,
        height: 64,
        marginBottom: 10,
        shadowColor: t.shadow || t.cardBorder,
        shadowOffset: { width: 3, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 3,
      }}
    >
      {iconSource ? (
        <Image source={iconSource} style={{ width: 22, height: 22, marginRight: 12 }} resizeMode="contain" />
      ) : iconName ? (
        <Ionicons name={iconName} size={20} color={t.textSecondary} style={{ marginRight: 12 }} />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 1.2, color: t.textLabel, marginBottom: 2 }}>
          {label}
        </Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.textLabel}
          keyboardType={keyboardType}
          onBlur={() => {
            onBlur?.();
          }}
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          textContentType="none"
          importantForAutofill="no"
          style={{ fontSize: 16, fontWeight: '700', color: t.textPrimary, padding: 0 }}
          {...textInputProps}
        />
      </View>
      {rightElement}
    </View>
  );
}

/** Week-day chip row (1–7) for training-frequency answers. */
export function OnboardingDayPicker({ value, onChange, t }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 20, marginBottom: 8 }}>
      {DAY_OF_WEEK_NUMBERS.map((dayNumber) => {
        const on = value === dayNumber;
        return (
          <TouchableOpacity
            key={dayNumber}
            onPress={() => onChange(dayNumber)}
            activeOpacity={0.85}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? t.cardSelectedBg : t.dayBtnBg,
              borderWidth: 3,
              borderColor: t.cardBorder,
              shadowColor: t.shadow || t.cardBorder,
              shadowOffset: { width: 3, height: 3 },
              shadowOpacity: 1,
              shadowRadius: 0,
              elevation: 3,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '900',
                color: on ? (t.cardSelectedText || t.onFill || '#FFFFFF') : t.textPrimary,
              }}
            >
              {dayNumber}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Horizontal chip list for single-select onboarding options. */
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
              borderRadius: 999,
              borderWidth: 3,
              borderColor: t.cardBorder,
              backgroundColor: on ? t.cardSelectedBg : t.cardBg,
              minWidth: 104,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: t.shadow || t.cardBorder,
              shadowOffset: { width: 3, height: 3 },
              shadowOpacity: 1,
              shadowRadius: 0,
              elevation: 3,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '800',
                color: on ? (t.cardSelectedText || t.onFill || '#FFFFFF') : t.textPrimary,
              }}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Wrap of pills for multi-select answers (injuries, specialties, …). */
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
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 999,
              marginRight: 8,
              marginBottom: 8,
              minHeight: 44,
              justifyContent: 'center',
              borderWidth: 3,
              borderColor: t.cardBorder,
              backgroundColor: on ? t.cardSelectedBg : t.cardBg,
              shadowColor: t.shadow || t.cardBorder,
              shadowOffset: { width: 3, height: 3 },
              shadowOpacity: 1,
              shadowRadius: 0,
              elevation: 3,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '800',
                color: on ? (t.cardSelectedText || t.onFill || '#FFFFFF') : t.textPrimary,
              }}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const onboardingHeadingStyles = StyleSheet.create({
  heading: {
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'left',
    lineHeight: 32,
    marginTop: 8,
    marginBottom: 6,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'left',
    lineHeight: 22,
    marginBottom: 12,
    fontWeight: '500',
  },
});

/** Half-width for a 2-column SelectionCard grid on this screen. */
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
  if (step === CLIENT_INVITE_STEP) return GLASS_TINTS.magenta;
  if (step === 8) return GLASS_TINTS.cyan;
  return GLASS_TINTS.cyan;
};

// Design System Colors
const COLORS = {
  background: '#FAF8F5',
  textPrimary: '#2D3748',
  textSecondary: '#718096',
  border: '#E2E8F0',
  white: lightColors.white,
};

// Design System Gradients
const GRADIENTS = {
  bluePurple: ['#5B86E5', '#E07A32'],
  tealBlue: ['#14B8A6', '#3B82F6'],
  indigoPurple: ['#6366F1', '#E25588'],
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
  const ColorTextInput = ({ icon, iconSource, label, value, onChangeText, keyboardType, placeholder, unit, field, isDark = true, tintColor }) => {
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
            <BlurredBackground intensity={isFocused ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.liquidFieldBlur}>
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
            </BlurredBackground>
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
            <BlurredBackground intensity={pressed || selected ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.liquidCardBlur}>
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
            </BlurredBackground>
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
            <BlurredBackground
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
            </BlurredBackground>
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
            <BlurredBackground intensity={pressed || selected ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.gradientPillBlur}>
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
            </BlurredBackground>
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
            <BlurredBackground intensity={pressed || selected ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.equipmentCardBlur}>
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
            </BlurredBackground>
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
            <BlurredBackground
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
            </BlurredBackground>
            </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const MultiLineCounterInput = ({ label, value, onChangeText, placeholder, disabled, isDark = true, tintColor }) => {
    const [isFocused, setIsFocused] = useState(false);
    const count = value?.length || 0;
    const counterColor =
      count >= BIO_WARN_AT_LIMIT ? '#EF4444' : count >= BIO_WARN_NEAR_LIMIT ? '#F97316' : isFocused ? (isDark ? 'rgba(255,255,255,0.90)' : 'rgba(15,23,42,0.92)') : (isDark ? 'rgba(255,255,255,0.62)' : 'rgba(51,65,85,0.65)');

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
            <BlurredBackground intensity={isFocused ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.multiLineBlur}>
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
            </BlurredBackground>
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
    const maxChars = PHILOSOPHY_MAX_CHARS;
    
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
            style={{ width: 280, height: 168, marginBottom: STYLE_SPACE_LG, alignSelf: 'center' }} // Reduced height by 40%
          />
        )}
        <Text style={dynamicStyles.liquidHeading}>{heading}</Text>
        <Text style={dynamicStyles.liquidSubtitle}>Help us understand your fitness journey and goals</Text>

        <View style={{ position: 'relative', width: '100%', marginBottom: 16 }}>
          <View style={styles.liquidAreaOuter}>
            <LinearGradient colors={borderColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.liquidAreaBorder}>
              <BlurredBackground intensity={isFocused ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.liquidAreaBlur}>
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
              </BlurredBackground>
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
    const tokens = getOnboardingUiTokens(isDark);
    const headingStyles = onboardingHeadingStyles;
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
      borderColor: selected ? ONBOARDING_ACCENT : tokens.cardBorder,
      backgroundColor: selected ? tokens.cardSelectedBg : tokens.cardBg,
      marginBottom: 10,
    });

    return (
      <View style={styles.stepContainer}>
        {safeTrainerLottie ? (
          <LottieView source={safeTrainerLottie} autoPlay loop style={CLIENT_ONBOARDING_LOTTIE_STYLE} />
        ) : (
          <View style={[styles.iconPlaceholder, { width: 260, height: 260 }]}>
            <Ionicons name="person-add-outline" size={72} color={tokens.textSecondary} />
          </View>
        )}
        <Text style={[headingStyles.heading, { color: tokens.textPrimary }]}>{heading}</Text>
        <Text style={[headingStyles.subtitle, { color: tokens.textSecondary, marginBottom: 16 }]}>
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
            <Text style={{ fontSize: 15, fontWeight: '700', color: tokens.textPrimary }}>Yes, I have a trainer code</Text>
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
                color: tokens.textLabel,
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
                  backgroundColor: tokens.inputBg,
                  paddingHorizontal: 16,
                  fontSize: 17,
                  fontWeight: '700',
                  letterSpacing: 3,
                  color: tokens.textPrimary,
                  textAlign: 'center',
                }}
                placeholder="ABC-123"
                placeholderTextColor={tokens.textLabel}
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
            <Text style={{ fontSize: 15, fontWeight: '700', color: tokens.textPrimary }}>{'No, I\u2019ll train independently'}</Text>
            <Text style={{ fontSize: 13, color: tokens.textSecondary, marginTop: 2 }}>
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

/** Role comes from signup / Firestore via LoginGate; default client — never show a duplicate full-screen role picker. */
/** Normalize signup role to 'trainer' or 'client'. */
function cleanUpRoleName(roleProp, routeRole) {
  const roleText = String(roleProp ?? routeRole ?? '').toLowerCase().trim();
  return roleText === 'trainer' ? 'trainer' : 'client';
}

// ===== MAIN FUNCTION =====

/**
 * Full client/trainer onboarding wizard. Role is fixed from signup — no role picker here.
 * @param {object} props
 */
export default function NewUserSetupScreen({
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
  const [role, setRole] = useState(() => cleanUpRoleName(roleProp, route?.params?.role));

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
  const [onboardingData, setOnboardingData] = useState(() => withClientSliderDefaults({
    // Client fields - Basic Info (Design Law sliders seed weight/height/age defaults)
    weight: null, // lbs
    height: null, // { feet, inches }
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
  }));

  // Design Law trainer step: Yes / Not yet segmented (not two separate old cards).
  const [trainerChoice, setTrainerChoice] = useState('yes');

  useEffect(() => {
    // Prefer light on first visit; only flip to dark when explicitly saved.
    AsyncStorage.getItem('themeMode')
      .then((mode) => {
        if (mode === 'dark') setIsDark(true);
        else setIsDark(false);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Persist theme choice
    AsyncStorage.setItem('themeMode', isDark ? 'dark' : 'light').catch(() => {});
  }, [isDark]);

  useLayoutEffect(() => {
    const next = cleanUpRoleName(roleProp, route?.params?.role);
    setRole((prev) => (prev === next ? prev : next));
  }, [roleProp, route?.params?.role]);

  const theme = isDark
    ? {
        bg: lightColors.nbInk,
        card: 'rgba(255,255,255,0.05)',
        cardBorder: 'rgba(255,255,255,0.08)',
        cardSelected: 'rgba(255,107,157,0.15)',
        cardSelectedBorder: lightColors.primary,
        text: lightColors.white,
        subtext: 'rgba(255,255,255,0.55)',
        input: 'rgba(255,255,255,0.05)',
        inputBorder: 'rgba(255,255,255,0.08)',
        inputText: lightColors.white,
        placeholder: 'rgba(255,255,255,0.3)',
        progressBg: 'rgba(255,255,255,0.08)',
        backBtn: 'rgba(255,255,255,0.08)',
        backBtnText: 'rgba(255,255,255,0.6)',
        toggleIcon: 'sunny-outline',
      }
    : {
        bg: lightColors.nbBackground,
        card: lightColors.white,
        cardBorder: 'rgba(0,0,0,0.08)',
        cardSelected: 'rgba(255,107,157,0.1)',
        cardSelectedBorder: lightColors.primary,
        text: lightColors.nbInk,
        subtext: 'rgba(0,0,0,0.5)',
        input: lightColors.white,
        inputBorder: 'rgba(0,0,0,0.12)',
        inputText: lightColors.nbInk,
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
    if (role === 'trainer' && currentStep === TRAINER_INVITE_STEP && !inviteCode) {
      if (previewMode) {
        setInviteCode('DEM-O12');
        setOnboardingData((prev) => ({ ...prev, inviteCode: 'DEM-O12' }));
        return;
      }
      generateInviteCode();
    }
  }, [role, currentStep, previewMode]);

  useEffect(() => {
    if (!(role === 'trainer' && currentStep === TRAINER_INVITE_STEP)) return;

    inviteBorderRotation.stopAnimation();
    inviteBorderPulse.stopAnimation();
    inviteBorderRotation.setValue(0);
    inviteBorderPulse.setValue(0);

    const rotateLoop = Animated.loop(
      Animated.timing(inviteBorderRotation, { toValue: 1, duration: INVITE_BORDER_SPIN_MS, useNativeDriver: true })
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

  // Design Law client = 8 screens (7 questions + All set). Trainer unchanged at 8.
  const totalSteps = role === 'client' ? CLIENT_ONBOARDING_STEPS : TRAINER_ONBOARDING_STEPS;

  // Design Law chapter bar — YOU / HOW YOU TRAIN / SUPPORT with partial fill per PNG.
  const trainerChapterMeta =
    role === 'trainer' ? getTrainerChapterMeta(currentStep) : null;

  const clientChapterMeta = role === 'client'
    ? getClientChapterMeta(currentStep)
    : { chapter: 1, fraction: 1, label: 'YOU', stepLabel: `${currentStep}/${totalSteps}` };

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


  /**
   * POST JSON to one onboarding API base with a Firebase ID token and timeout.
   */
  const fetchOnboardingWithToken = async (baseUrl, path, body, firebaseUser) => {
    await firebaseUser.reload();
    const idToken = await firebaseUser.getIdToken(true);
    if (!idToken || typeof idToken !== 'string') {
      throw new Error('Missing/invalid Firebase ID token');
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ONBOARDING_API_TIMEOUT_MS);
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

  /** Read error text; on 401 retry once with a fresh token. */
  const fetchOnboardingUntilOk = async (baseUrl, path, body, firebaseUser) => {
    let resp = await fetchOnboardingWithToken(baseUrl, path, body, firebaseUser);
    if (resp.ok) return resp;

    const text = await resp.text().catch(() => '');
    if (resp.status !== HTTP_UNAUTHORIZED) {
      throw new Error(`Server ${path} failed (${resp.status}) ${text}`.trim());
    }

    resp = await fetchOnboardingWithToken(baseUrl, path, body, firebaseUser);
    if (resp.ok) return resp;
    const retryText = await resp.text().catch(() => '');
    throw new Error(`Server ${path} failed (${resp.status}) ${retryText}`.trim());
  };

  /** Map a fetch failure into a clearer lastErr for the caller. */
  const onboardingFetchFailure = (error, baseUrl, path) => {
    const msg = error?.message || String(error);
    if (msg.includes('Network request failed')) {
      return new Error(`Network request failed for ${baseUrl}${path}`);
    }
    if (msg.includes('aborted') || msg.includes('AbortError')) {
      return new Error(`Request timed out for ${baseUrl}${path}`);
    }
    return error;
  };

  // 1. Try each API base until one accepts the onboarding POST.
  const postOnboardingApi = async (path, body) => {
    const baseUrls = getApiBaseCandidates();
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) throw new Error('Missing Firebase auth user.');

    let lastErr = null;
    const tried = [];
    for (const baseUrl of baseUrls) {
      tried.push(baseUrl);
      try {
        const resp = await fetchOnboardingUntilOk(baseUrl, path, body, firebaseUser);
        return await resp.json();
      } catch (error) {
        lastErr = onboardingFetchFailure(error, baseUrl, path);
      }
    }

    if (lastErr) {
      throw new Error(`${lastErr.message || String(lastErr)} (tried: ${tried.join(', ')})`);
    }
    throw new Error(`Request failed: ${path} (tried: ${tried.join(', ')})`);
  };

  /** Build one XXX-XXX invite code from random A–Z / 0–9 chars. */
  const buildRandomInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const part1 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const part2 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${part1}-${part2}`;
  };

  /** Ask the server if this invite code is free; on network error, assume unique. */
  const isInviteCodeAvailable = async (code) => {
    try {
      const resp = await postOnboardingApi('/api/onboarding/check-invite-code', { code });
      return !resp?.exists;
    } catch (error) {
      console.warn('Invite code uniqueness check failed; assuming unique:', error?.message || error);
      return true;
    }
  };

  const generateInviteCode = async () => {
    setGeneratingCode(true);
    let code = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      code = buildRandomInviteCode();
      isUnique = await isInviteCodeAvailable(code);
      attempts += 1;
    }

    if (isUnique) {
      setInviteCode(code);
      setOnboardingData((prev) => ({ ...prev, inviteCode: code }));
    } else {
      Alert.alert('Error', 'Could not generate unique invite code. Please try again.');
    }
    setGeneratingCode(false);
  };

  /** Normalize client input to match stored format (XXX-XXX). Returns null if invalid. */
  const normalizeInviteCodeForQuery = (raw) => {
    let rawText = String(raw || '').trim();
    if (!rawText) return null;
    // Strip TRAINER- prefix (case-insensitive)
    if (/^trainer/i.test(rawText)) {
      rawText = rawText.replace(/^trainer[\-\s]*/i, '').trim();
    }
    // Remove ALL non-alphanumeric characters, uppercase
    const cleaned = rawText.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    // Must be exactly 6 alphanumeric chars for XXX-XXX format
    if (cleaned.length !== 6) return null;
    const result = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}`;
    return result.length === INVITE_CODE_DISPLAY_LENGTH ? result : null;
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

  const validateStep = () => {
    if (role === 'client') {
      return validateClientOnboardingStep(currentStep, onboardingData, {
        trainerChoice,
        codeValid,
        trainerCode,
      });
    }
    return validateTrainerOnboardingStep(
      currentStep,
      withTrainerSliderDefaults(onboardingData),
    );
  };

  const handleNext = () => {
    // Client Design Law: height is a slider → already a complete {feet,inches} object.
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

  // Which steps may be skipped from the footer Skip button.
  // Client: step 6 (injuries) and step 7 (trainer invite code) — steps 8-9 are required.
  // Trainer: step 4 (training philosophy) and step 8 (Pro offer) are optional.
  const isOptionalStep = () => {
    if (role === 'client') {
      // Health + trainer are skippable in Design Law (Continue always enabled).
      return currentStep === 4 || currentStep === 5;
    }
    return currentStep === TRAINER_PAYOUT_STEP || currentStep === TRAINER_PRO_STEP;
  };

  const handleSkip = () => {
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
    else handleFinish();
  };

  /** Queue a deferred server sync when Firestore saved but API did not. */
  const queueOnboardingServerSync = async (userId, finalRole, updateData, overrideData) => {
    if (!userId) return;
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
  };

  /** Firestore OK but server failed — welcome the user and sync later. */
  const finishAfterDeferredServerSync = async ({
    userId,
    finalRole,
    updateData,
    overrideData,
    finishToApp,
    error,
  }) => {
    if (__DEV__) {
      console.log(
        '[onboarding] Server sync deferred (Firestore OK):',
        error?.message || String(error),
      );
    }
    try {
      await queueOnboardingServerSync(userId, finalRole, updateData, overrideData);
    } catch (_) {
      /* queue best-effort */
    }
    Alert.alert(
      "You're all set",
      'Your profile was saved. Any remaining account setup will finish in the background when the connection is stable.',
      [{ text: 'Continue', style: 'default', onPress: finishToApp }],
    );
  };

  /** Neither Firestore nor server — offer continue-anyway with a queued sync. */
  const finishAfterHardSaveFailure = async ({
    userId,
    finalRole,
    updateData,
    overrideData,
    error,
  }) => {
    console.error('❌ Error saving onboarding data:', error);
    try {
      await queueOnboardingServerSync(userId, finalRole, updateData, overrideData);
    } catch (_) {
      /* queue best-effort */
    }
    Alert.alert(
      'Save Failed',
      "Failed to save onboarding data. You can continue, but your preferences won't be saved.",
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
      ],
    );
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
      if (result.error) throw result.error;

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
        await finishAfterDeferredServerSync({
          userId,
          finalRole,
          updateData,
          overrideData,
          finishToApp,
          error,
        });
        return;
      }
      await finishAfterHardSaveFailure({
        userId,
        finalRole,
        updateData,
        overrideData,
        error,
      });
    } finally {
      setLoading(false);
    }
  };

  const getStepTitle = () => {
    if (role === 'client') {
      return getClientScreenTitle(currentStep);
    }
    return getTrainerScreenTitle(currentStep);
  };

  const enableAIFromStep = async () => {
    setOnboardingData((prev) => ({ ...prev, aiEnabled: true }));
    await AsyncStorage.setItem('aiEnabled', 'true');
    setAIFromOnboarding(true);
    setCurrentStep(8);
  };

  const skipAIFromStep = async () => {
    setOnboardingData((prev) => ({ ...prev, aiEnabled: false }));
    await AsyncStorage.setItem('aiEnabled', 'false');
    setAIFromOnboarding(false);
    setCurrentStep(8);
  };

  // Design Law client bodies — structure matches screens/client-onboarding PNGs 01–16.
  const renderClientStep = () => (
    <View style={styles.stepContainer}>
      <ClientOnboardingStep
        step={currentStep}
        data={onboardingData}
        setData={setOnboardingData}
        trainerChoice={trainerChoice}
        setTrainerChoice={setTrainerChoice}
        trainerCode={trainerCode}
        setTrainerCode={setTrainerCode}
        codeValid={codeValid}
        setCodeValid={setCodeValid}
        setCodeError={setCodeError}
        validateTrainerCode={validateTrainerCode}
        shakeAnimation={shakeAnimation}
        matchedTrainer={
          codeValid === true && onboardingData.trainerId
            ? { name: 'Trainer', subtitle: 'Coach Connect trainer', initials: 'TR' }
            : null
        }
        onEnableAI={enableAIFromStep}
        onSkipAI={skipAIFromStep}
      />
    </View>
  );


  /** Pick a cert sheet, upload it, then optionally AI-verify image uploads. */
  const handleUploadCertificationSheet = async () => {
    const trainerUid = auth?.currentUser?.uid;
    if (!trainerUid) {
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
      const { url, meta } = await uploadTrainerCertificationSheet(trainerUid, {
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
      const verifyMessage = await verifyUploadedCertificationSheet({
        trainerUid,
        trainerName,
        file,
        url,
        meta,
        setOnboardingData,
      });
      Alert.alert('Certification', verifyMessage);
    } catch (error) {
      Alert.alert('Upload failed', error?.message || 'Could not upload certification.');
    } finally {
      setCertUploading(false);
    }
  };

  // Design Law trainer bodies — trainer-setup + trainer-setup-part-2 PNGs.
  const renderTrainerStep = () => (
    <View style={styles.stepContainer}>
      <DesignLawTrainerOnboardingStep
        step={currentStep}
        data={onboardingData}
        setData={setOnboardingData}
        onToggleField={handleSelect}
        onUploadCert={handleUploadCertificationSheet}
        certUploading={certUploading}
        inviteCode={inviteCode}
        generatingCode={generatingCode}
        onCopyInvite={() => copyToClipboard(inviteCode)}
        onShareInvite={shareInviteCode}
        onEditReviewStep={(s) => setCurrentStep(s)}
        onReviewGoLive={handleNext}
        onReviewSaveLater={() => handleFinish()}
        onStartFace={async () => {
          if (!cameraPermission?.granted) {
            const res = await requestCameraPermission();
            if (!res.granted) {
              Alert.alert(
                'Allow camera access',
                'Allow camera access to verify your face for your trainer profile. The photo is used for review only.',
              );
              return;
            }
          }
          setFaceCamOpen(true);
        }}
        faceCapturing={faceCapturing}
        payoutEmail={auth?.currentUser?.email}
        identitySubmitted={!!onboardingData.faceVerificationPhotoURL}
        onPayoutSkip={() => setCurrentStep(TRAINER_PRO_STEP)}
        onPayoutComplete={() => setCurrentStep(TRAINER_PRO_STEP)}
        isDark={isDark}
        trainerPlanId={trainerPlanId}
        setTrainerPlanId={setTrainerPlanId}
        onProSkip={() => setCurrentStep(TRAINER_COMPLETE_STEP)}
        displayName={auth?.currentUser?.displayName}
      />
    </View>
  );

  const dynamicStyles = getStyles(isDark);
  const ot = getOnboardingUiTokens(isDark);
  // Trainer Pro paywall uses its sticky footer. Client Design Law always uses the bottom bar
  // (Continue / AI Not now+Turn on / Open my Today).
  const hideBottomNav =
    role === 'trainer' &&
    (currentStep === TRAINER_PAYOUT_STEP ||
      currentStep === TRAINER_PRO_STEP ||
      currentStep === 5);
  const isTrainerPaywallStep = false;
  const onboardingFooterPadTop = 12;
  const onboardingFooterPadBottom = Math.max(insets.bottom, 12);
  const onboardingFooterBarHeight = onboardingFooterPadTop + 56 + onboardingFooterPadBottom;
  // Paywall footer is taller (CTA + price/restore row below it).
  const scrollBottomPad = onboardingFooterBarHeight + (isTrainerPaywallStep ? TRAINER_PAYWALL_EXTRA_PAD : 28);
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
            {/* Design Law header: hard-shadow back + title + 3 chapter bars + step meta */}
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={currentStep > 1 ? handleBack : handleLogout}
                  activeOpacity={0.85}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    borderWidth: 3,
                    borderColor: ot.cardBorder,
                    backgroundColor: ot.cardBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: ot.shadow || ot.cardBorder,
                    shadowOffset: { width: 3, height: 3 },
                    shadowOpacity: 1,
                    shadowRadius: 0,
                    elevation: 3,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={currentStep > 1 ? 'Go back' : 'Close setup'}
                >
                  <Ionicons
                    // Design Law client PNGs always show a back chevron (step 1 exits setup).
                    name={role === 'client' || currentStep > 1 ? 'chevron-back' : 'close'}
                    size={22}
                    color={ot.textPrimary}
                  />
                </TouchableOpacity>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 25,
                    fontWeight: '900',
                    letterSpacing: -0.6,
                    color: ot.textPrimary,
                  }}
                  numberOfLines={1}
                >
                  {role === 'client' ? getClientScreenTitle(currentStep) : getTrainerScreenTitle(currentStep)}
                </Text>
                {role === 'client' ? null : (
                  <TouchableOpacity
                    onPress={() => setIsDark(!isDark)}
                    activeOpacity={0.85}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      borderWidth: 3,
                      borderColor: ot.cardBorder,
                      backgroundColor: ot.cardBg,
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: ot.shadow || ot.cardBorder,
                      shadowOffset: { width: 3, height: 3 },
                      shadowOpacity: 1,
                      shadowRadius: 0,
                      elevation: 3,
                    }}
                  >
                    <Ionicons name={theme.toggleIcon} size={20} color={ot.textPrimary} />
                  </TouchableOpacity>
                )}
              </View>

              {role === 'client' ? (
                <>
                  <NbProgressSteps
                    total={3}
                    current={clientChapterMeta.done ? 4 : clientChapterMeta.chapter}
                    fraction={clientChapterMeta.done ? 1 : clientChapterMeta.fraction}
                    style={{ marginBottom: clientChapterMeta.done ? 16 : 8 }}
                  />
                  {/* Design Law All set (PNG 15): filled bars only — no CHAPTER / 7/7 row */}
                  {clientChapterMeta.done ? null : (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '900',
                          letterSpacing: 1.1,
                          color: ot.textLabel,
                        }}
                      >
                        {`CHAPTER ${clientChapterMeta.chapter} OF ${clientChapterMeta.of} · ${clientChapterMeta.label}`}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '900',
                          color: ot.textLabel,
                        }}
                      >
                        {clientChapterMeta.stepLabel}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <NbProgressSteps
                    total={3}
                    current={trainerChapterMeta?.done ? 4 : trainerChapterMeta?.chapter}
                    fraction={trainerChapterMeta?.done ? 1 : trainerChapterMeta?.fraction}
                    style={{ marginBottom: trainerChapterMeta?.done ? 16 : 8 }}
                  />
                  {trainerChapterMeta?.done ? null : (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '900',
                          letterSpacing: 1.1,
                          color: ot.textLabel,
                        }}
                      >
                        {`CHAPTER ${trainerChapterMeta?.chapter} OF ${trainerChapterMeta?.of} · ${trainerChapterMeta?.label}`}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '900',
                          color: ot.textLabel,
                        }}
                      >
                        {trainerChapterMeta?.stepLabel}
                      </Text>
                    </View>
                  )}
                  {trainerChapterMeta?.heroTime && currentStep === 1 ? (
                    <Text style={{ fontSize: 13, fontWeight: '700', color: ot.textSecondary, marginTop: 6 }}>
                      {trainerChapterMeta.heroTime}
                    </Text>
                  ) : null}
                </>
              )}
            </View>

            {role === 'client' ? renderClientStep() : renderTrainerStep()}
          </ScrollView>

          {/* Design Law bottom bar: back square + Continue / AI pair / Open my Today */}
          {hideBottomNav ? null : (
            <View
              style={[
                dynamicStyles.navigationBar,
                {
                  paddingTop: onboardingFooterPadTop,
                  paddingBottom: onboardingFooterPadBottom,
                  paddingHorizontal: 16,
                  borderTopWidth: 3,
                  borderTopColor: ot.cardBorder,
                  gap: 10,
                },
              ]}
            >
              {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 56 }}>
                  <ActivityIndicator size="small" color={ot.textPrimary} />
                </View>
              ) : role === 'client' && currentStep === 7 ? (
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <NbButton variant="ghost" onPress={skipAIFromStep} style={{ flex: 1 }}>
                    Not now
                  </NbButton>
                  <NbButton variant="fill" onPress={enableAIFromStep} style={{ flex: 1 }}>
                    Turn on
                  </NbButton>
                </View>
              ) : role === 'client' && currentStep === 8 ? (
                <NbButton variant="fill" onPress={() => handleFinish()} style={{ flex: 1 }}>
                  Open my Today >
                </NbButton>
              ) : role === 'trainer' && currentStep === TRAINER_COMPLETE_STEP ? (
                <NbButton variant="fill" onPress={() => handleFinish()} style={{ flex: 1 }}>
                  Open my trainer home >
                </NbButton>
              ) : (
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {(role === 'client' || role === 'trainer') && currentStep > 1 ? (
                    <TouchableOpacity
                      onPress={handleBack}
                      activeOpacity={0.85}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 12,
                        borderWidth: 3,
                        borderColor: ot.cardBorder,
                        backgroundColor: ot.cardBg,
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: ot.shadow || ot.cardBorder,
                        shadowOffset: { width: 3, height: 3 },
                        shadowOpacity: 1,
                        shadowRadius: 0,
                        elevation: 3,
                      }}
                      accessibilityLabel="Back"
                    >
                      <Ionicons name="chevron-back" size={22} color={ot.textPrimary} />
                    </TouchableOpacity>
                  ) : role === 'trainer' && isOptionalStep() ? (
                    <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={loading}>
                      <Text style={dynamicStyles.skipButtonText}>Skip</Text>
                    </TouchableOpacity>
                  ) : null}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <OnboardingPrimaryButton
                      variant="footer"
                      t={ot}
                      disabled={!validateStep()}
                      onDisabledPress={() => {
                        if (role === 'client') {
                          Alert.alert('Almost there', 'Finish the required fields on this screen to continue.');
                        }
                      }}
                      onPress={handleNext}
                      label={
                        role === 'client'
                          ? 'Continue >'
                          : currentStep === 3
                            ? 'Get my invite code >'
                            : currentStep === 2
                              ? 'Continue to rates >'
                              : currentStep === 1
                                ? 'Continue to proof >'
                                : currentStep === totalSteps
                                  ? 'Continue'
                                  : 'Continue >'
                      }
                    />
                  </View>
                </View>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      </View>

      <Modal visible={faceCamOpen} animationType="slide" onRequestClose={() => setFaceCamOpen(false)}>
        <View style={{ flex: 1, backgroundColor: lightColors.nbInk }}>
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
                backgroundColor: lightColors.primary,
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
    marginBottom: STYLE_SPACE_LG,
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
    fontSize: STYLE_FONT_TITLE,
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
    fontSize: STYLE_FONT_TITLE,
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
    backgroundColor: isDark ? '#2A2A2A' : lightColors.white,
    borderWidth: 2,
    borderColor: '#E25588',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E25588',
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
    color: isDark ? lightColors.white : '#1F2937',
    textAlign: 'center',
    flex: 1,
    minWidth: STYLE_UNIT_MIN_WIDTH,
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
    color: lightColors.white,
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
    color: lightColors.white,
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
    fontSize: STYLE_FONT_TITLE,
    color: '#10B981',
    fontWeight: 'bold',
  },
  errorMark: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -12,
    fontSize: STYLE_FONT_TITLE,
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
    fontSize: STYLE_FONT_TITLE,
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
    marginBottom: STYLE_SPACE_LG,
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
    color: lightColors.white,
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
    backgroundColor: lightColors.white,
    borderWidth: 2,
    borderColor: '#E25588',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E25588',
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
    color: lightColors.white,
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
    fontSize: STYLE_FONT_TITLE,
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
    color: lightColors.white,
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
    backgroundColor: lightColors.white,
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
    fontSize: STYLE_FONT_TITLE,
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
    borderColor: lightColors.white,
  },
  modernGenderCheckmarkText: {
    fontSize: 16,
    color: lightColors.white,
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
    fontSize: STYLE_FONT_TITLE,
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
    backgroundColor: '#E25588',
    borderColor: '#E25588',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipmentCheckboxText: {
    fontSize: 14,
    fontWeight: '800',
    color: lightColors.white,
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
    marginBottom: STYLE_SPACE_LG,
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
    color: '#BE185D',
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

