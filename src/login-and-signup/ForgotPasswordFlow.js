// Design Law reset password — request link, then “check your inbox” with resend cooldown.
// Flow: validate email → sendPasswordResetEmail → inbox step → optional resend / open mail / back.
// Used from sign-in via LoginGate (ResetPasswordScreen). PNGs: welcome-and-sign-in 09–12.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../app-start/cloudConnection';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import NbButton from '../look-and-feel/NbButton';
import NbCard from '../look-and-feel/NbCard';
import NbPageHeader from '../look-and-feel/NbPageHeader';
import HardShadow from '../look-and-feel/HardShadow';
import { nb, borderRadius, spacing, accentGradients } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const AUTH_ERROR_INVALID_EMAIL = 'auth/invalid-email';
const AUTH_ERROR_MISSING_EMAIL = 'auth/missing-email';
const FLOW_STEP_REQUEST = 'request';
const FLOW_STEP_INBOX = 'inbox';
const KEYBOARD_OFFSET_IOS = 10;
const KEYBOARD_OFFSET_ANDROID = 0;
const SCROLL_BOTTOM_PAD_MIN = 16;
const SCROLL_BOTTOM_PAD_EXTRA = 24;
// Manipulate here: seconds before “Resend link” unlocks on the inbox step
const RESEND_COOLDOWN_SEC = 30;
const COOLDOWN_TICK_MS = 1000;
const COOLDOWN_PROGRESS_FLOOR_PCT = 3;
const SECONDS_PER_MINUTE = 60;
const TIP_GRADIENT = accentGradients[4];
const INBOX_HERO_GRADIENT = accentGradients[0];
const RESEND_PROGRESS_GRADIENT = accentGradients[0];
const MAIL_URL_PRIMARY = 'message://';
const MAIL_URL_FALLBACK = 'mailto:';

// ===== HELPER FUNCTIONS =====

/**
 * Check email before we touch Firebase.
 * Returns either { trimmedEmail } or { errorMessage }.
 */
function validateResetEmail(email, emailRegex) {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) return { errorMessage: 'Email is required' };
  if (!emailRegex.test(trimmedEmail)) {
    return { errorMessage: 'Please enter a valid email address' };
  }
  if (!auth) {
    return { errorMessage: 'Auth is not ready. Please try again in a moment.' };
  }
  return { trimmedEmail };
}

/** Map Firebase auth error codes into short user copy. */
function messageForPasswordResetError(error) {
  const errorCode = error?.code || '';
  if (errorCode === AUTH_ERROR_INVALID_EMAIL) return 'Invalid email address';
  if (errorCode === AUTH_ERROR_MISSING_EMAIL) return 'Email is required';
  if (error?.message) return error.message;
  return 'Failed to send reset email';
}

function keyboardAvoidBehavior() {
  if (Platform.OS === 'ios') return 'padding';
  return 'height';
}

function keyboardVerticalOffset() {
  if (Platform.OS === 'ios') return KEYBOARD_OFFSET_IOS;
  return KEYBOARD_OFFSET_ANDROID;
}

function scrollBottomPadding(bottomInset) {
  return Math.max(bottomInset, SCROLL_BOTTOM_PAD_MIN) + SCROLL_BOTTOM_PAD_EXTRA;
}

/** Format leftover cooldown as m:ss for the inbox timer. */
function formatCooldown(secondsLeft) {
  const safeSeconds = Math.max(0, secondsLeft);
  const wholeMinutes = Math.floor(safeSeconds / SECONDS_PER_MINUTE);
  const remainderSeconds = safeSeconds % SECONDS_PER_MINUTE;
  const paddedSeconds = String(remainderSeconds).padStart(2, '0');
  return `${wholeMinutes}:${paddedSeconds}`;
}

/** 0–100 how far through the resend cooldown we are. */
function cooldownProgressPercent(secondsLeft) {
  if (RESEND_COOLDOWN_SEC <= 0) return 0;
  const elapsedSeconds = RESEND_COOLDOWN_SEC - secondsLeft;
  const ratio = elapsedSeconds / RESEND_COOLDOWN_SEC;
  const percent = ratio * 100;
  return Math.max(0, Math.min(100, percent));
}

/** Progress bar width — never fully empty so the chip still reads as a bar. */
function progressBarWidthPercent(secondsLeft) {
  const progress = cooldownProgressPercent(secondsLeft);
  return Math.max(progress, COOLDOWN_PROGRESS_FLOOR_PCT);
}

function statusBarStyleForTheme(isDark) {
  if (isDark) return 'light-content';
  return 'dark-content';
}

function inputBorderStyleForError(errorMessage) {
  if (errorMessage) return 'dashed';
  return 'solid';
}

function resendLabelColorForCooldown(cooldownSecondsLeft, colors) {
  if (cooldownSecondsLeft > 0) return colors.nbMuted;
  return colors.nbInk;
}

function sendButtonLabel(isSubmitting) {
  if (isSubmitting) return 'Sending…';
  return 'Send reset link';
}

/** PNG 09/10 — email field + send + tip card. */
function RequestResetStep({
  colors,
  email,
  errorMessage,
  isSubmitting,
  onEmailChange,
  onSendResetLink,
  onBackToSignIn,
}) {
  const inputBorderStyle = inputBorderStyleForError(errorMessage);
  const submitLabel = sendButtonLabel(isSubmitting);
  const showErrorRow = !!errorMessage;

  return (
    <>
      <Text style={[styles.heroTitle, { color: colors.nbInk }]}>Forgot it? It happens.</Text>
      <Text style={[styles.heroSub, { color: colors.nbMuted }]}>
        Enter the email on your account and we will send a reset link.
      </Text>

      <Text style={[styles.fieldLabel, { color: colors.nbMuted }]}>EMAIL ADDRESS</Text>
      <View
        style={[
          styles.inputShell,
          {
            borderColor: colors.nbBorder,
            backgroundColor: colors.nbSurface,
            borderWidth: nb.borderWidth,
            shadowColor: colors.nbShadow,
            borderStyle: inputBorderStyle,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: colors.nbInk }]}
          placeholder="alex@example.com"
          placeholderTextColor={colors.nbMuted}
          value={email}
          onChangeText={onEmailChange}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isSubmitting}
        />
      </View>

      {showErrorRow ? (
        <View style={styles.errorRow}>
          <View
            style={[
              styles.errorDot,
              { borderColor: colors.nbBorder, backgroundColor: colors.nbFill },
            ]}
          >
            <Text style={[styles.errorBang, { color: colors.nbOnFill }]}>!</Text>
          </View>
          <Text style={[styles.errorText, { color: colors.nbInk }]}>{errorMessage}</Text>
        </View>
      ) : null}

      <NbButton
        variant="fill"
        onPress={onSendResetLink}
        disabled={isSubmitting}
        style={styles.submitButton}
      >
        {submitLabel}
      </NbButton>

      <NbCard style={styles.tipCard}>
        <View style={styles.tipRow}>
          <View style={[styles.tipIcon, { borderColor: colors.nbBorder }]}>
            <LinearGradient
              colors={TIP_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tipIconFill}
            >
              <Image
                source={require('../assets/icons/handoff/settings.png')}
                style={{ width: 28, height: 28, resizeMode: 'contain' }}
              />
            </LinearGradient>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tipTitle, { color: colors.nbInk }]}>No account found?</Text>
            <Text style={[styles.tipBody, { color: colors.nbMuted }]}>
              Check the spelling, or create an account with this email.
            </Text>
          </View>
        </View>
      </NbCard>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onBackToSignIn}
        style={styles.textLinkHit}
      >
        <Text
          style={[
            styles.textLink,
            { color: colors.nbInk, borderBottomColor: colors.nbBorder },
          ]}
        >
          Back to sign in
        </Text>
      </TouchableOpacity>
    </>
  );
}

/** PNG 11/12 — inbox hero, open mail, resend cooldown bar. */
function InboxResetStep({
  colors,
  inboxEmailDisplay,
  errorMessage,
  resendIsLocked,
  resendLabelColor,
  progressWidth,
  cooldownSecondsLeft,
  onOpenMailApp,
  onResendResetLink,
  onBackToSignIn,
}) {
  const cooldownLabel = formatCooldown(cooldownSecondsLeft);
  const showErrorText = !!errorMessage;

  return (
    <>
      <HardShadow
        offset={nb.shadowOffsetCard}
        radius={borderRadius.nbIconChip}
        style={styles.clockWrap}
      >
        <View style={[styles.clockChip, { borderColor: colors.nbBorder }]}>
          <LinearGradient
            colors={INBOX_HERO_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.clockFill}
          >
            <Image
              source={require('../assets/icons/handoff/checkin.png')}
              style={{ width: 36, height: 36, resizeMode: 'contain' }}
            />
          </LinearGradient>
        </View>
      </HardShadow>

      <Text style={[styles.heroTitle, { color: colors.nbInk }]}>Check your inbox.</Text>
      <Text style={[styles.heroSub, { color: colors.nbMuted }]}>
        We sent a reset link to{' '}
        <Text style={{ fontWeight: '900', color: colors.nbInk }}>{inboxEmailDisplay}</Text>
        . Open it on this phone.
      </Text>

      <NbButton variant="fill" onPress={onOpenMailApp} style={styles.submitButton}>
        Open mail app
      </NbButton>

      <NbCard style={styles.resendCard}>
        <View style={styles.resendHeader}>
          <TouchableOpacity
            onPress={onResendResetLink}
            disabled={resendIsLocked}
            activeOpacity={0.85}
          >
            <Text style={[styles.resendLabel, { color: resendLabelColor }]}>
              Resend link
            </Text>
          </TouchableOpacity>
          <Text style={[styles.resendTimer, { color: colors.nbInk }]}>
            {cooldownLabel}
          </Text>
        </View>
        <View
          style={[
            styles.progressTrack,
            { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
          ]}
        >
          <LinearGradient
            colors={RESEND_PROGRESS_GRADIENT}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.progressFill, { width: progressWidth }]}
          />
        </View>
        <Text style={[styles.resendHint, { color: colors.nbMuted }]}>
          Nothing yet? Look in spam, then resend.
        </Text>
      </NbCard>

      {showErrorText ? (
        <Text style={[styles.errorText, { color: colors.nbInk, marginTop: spacing.sm }]}>
          {errorMessage}
        </Text>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onBackToSignIn}
        style={styles.textLinkHit}
      >
        <Text
          style={[
            styles.textLink,
            { color: colors.nbInk, borderBottomColor: colors.nbBorder },
          ]}
        >
          Back to sign in
        </Text>
      </TouchableOpacity>
    </>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Forgot-password flow — email form then inbox step with resend cooldown (Design Law PNGs 09–12).
 * Flow: 1. theme/state  2. cooldown tick  3. send/resend handlers  4. paint request or inbox
 */
export default function ResetPasswordScreen({ navigation, initialEmail = '' }) {
  // 1. Theme + safe area
  // vocab: useTheme = Design Law colors + isDark for StatusBar
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState(String(initialEmail || '').trim());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  // vocab: flowStep = which Design Law screen we show — request (09/10) or inbox (11/12)
  const [flowStep, setFlowStep] = useState(FLOW_STEP_REQUEST);
  const [sentToEmail, setSentToEmail] = useState('');
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState(0);

  const handleNavigateBack = navigation?.goBack ?? navigation?.navigate;
  // vocab: useMemo = keep the same RegExp object across renders
  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);

  // 2. Tick the resend cooldown once per second while it is running
  // vocab: useEffect = run after paint; cleanup clears the pending timer
  useEffect(() => {
    if (cooldownSecondsLeft <= 0) return undefined;
    const timerId = setTimeout(() => {
      setCooldownSecondsLeft((previous) => Math.max(0, previous - 1));
    }, COOLDOWN_TICK_MS);
    return () => clearTimeout(timerId);
  }, [cooldownSecondsLeft]);

  // 3. Firebase send — shared by first send and resend
  const sendResetEmailToFirebase = async ({ isResend = false } = {}) => {
    // 1. Clear stale error
    setErrorMessage('');

    // 2. Validate before we touch Firebase
    const validation = validateResetEmail(email, emailRegex);
    if (validation.errorMessage) {
      setErrorMessage(validation.errorMessage);
      return;
    }

    try {
      // 3. Firebase sends the email link — password does not change on this screen
      // vocab: sendPasswordResetEmail = Firebase Auth mailer (projectId stays anatrox-auth)
      setIsSubmitting(true);
      await sendPasswordResetEmail(auth, validation.trimmedEmail);
      setSentToEmail(validation.trimmedEmail);
      setFlowStep(FLOW_STEP_INBOX);
      setCooldownSecondsLeft(RESEND_COOLDOWN_SEC);
      if (isResend) {
        // Stay on inbox — only refresh the timer after a successful resend
      }
    } catch (error) {
      setErrorMessage(messageForPasswordResetError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendResetLink = async () => {
    await sendResetEmailToFirebase({ isResend: false });
  };

  const handleResendResetLink = async () => {
    if (cooldownSecondsLeft > 0) return;
    if (isSubmitting) return;
    await sendResetEmailToFirebase({ isResend: true });
  };

  const handleOpenMailApp = () => {
    // Try iOS Messages URL first, then generic mailto
    Linking.openURL(MAIL_URL_PRIMARY).catch(() => {
      Linking.openURL(MAIL_URL_FALLBACK).catch(() => {});
    });
  };

  const handleEmailChange = (nextEmail) => {
    setEmail(nextEmail);
    if (errorMessage) setErrorMessage('');
  };

  const handleBackToSignIn = () => {
    handleNavigateBack?.();
  };

  // 4. Named decisions for the paint step
  const isRequestStep = flowStep === FLOW_STEP_REQUEST;
  const resendIsLocked = cooldownSecondsLeft > 0 || isSubmitting;
  const resendLabelColor = resendLabelColorForCooldown(cooldownSecondsLeft, colors);
  const progressWidth = `${progressBarWidthPercent(cooldownSecondsLeft)}%`;
  const inboxEmailDisplay = sentToEmail || email;
  const statusBarStyle = statusBarStyleForTheme(isDark);
  const bottomPad = scrollBottomPadding(insets.bottom);

  return (
    <View style={[styles.root, { backgroundColor: colors.nbBackground }]}>
      <StatusBar barStyle={statusBarStyle} />

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        <KeyboardAvoidingView
          behavior={keyboardAvoidBehavior()}
          style={{ flex: 1 }}
          keyboardVerticalOffset={keyboardVerticalOffset()}
        >
          <NbPageHeader title="Reset password" onBack={handleBackToSignIn} />

          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: nb.screenGutter,
              paddingBottom: bottomPad,
              maxWidth: 440,
              width: '100%',
              alignSelf: 'center',
            }}
            keyboardShouldPersistTaps="handled"
          >
            {isRequestStep ? (
              <RequestResetStep
                colors={colors}
                email={email}
                errorMessage={errorMessage}
                isSubmitting={isSubmitting}
                onEmailChange={handleEmailChange}
                onSendResetLink={handleSendResetLink}
                onBackToSignIn={handleBackToSignIn}
              />
            ) : (
              <InboxResetStep
                colors={colors}
                inboxEmailDisplay={inboxEmailDisplay}
                errorMessage={errorMessage}
                resendIsLocked={resendIsLocked}
                resendLabelColor={resendLabelColor}
                progressWidth={progressWidth}
                cooldownSecondsLeft={cooldownSecondsLeft}
                onOpenMailApp={handleOpenMailApp}
                onResendResetLink={handleResendResetLink}
                onBackToSignIn={handleBackToSignIn}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginBottom: 8,
    lineHeight: 34,
  },
  heroSub: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginBottom: 8,
  },
  inputShell: {
    borderRadius: borderRadius.nbInput,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  input: {
    fontSize: 16,
    fontWeight: '700',
    padding: 0,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  errorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBang: {
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  submitButton: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  tipCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  tipIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.nbIconChip,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  tipIconFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  tipBody: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  textLinkHit: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: 8,
  },
  textLink: {
    fontSize: 15,
    fontWeight: '900',
    borderBottomWidth: 3,
    paddingBottom: 1,
  },
  clockWrap: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  clockChip: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.nbIconChip,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  clockFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendCard: {
    padding: spacing.md,
  },
  resendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resendLabel: {
    fontSize: 15,
    fontWeight: '900',
  },
  resendTimer: {
    fontSize: 15,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 14,
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
  },
  resendHint: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
