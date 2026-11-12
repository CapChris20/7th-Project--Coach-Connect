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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../app-start/cloudConnection';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import NbButton from '../look-and-feel/NbButton';
import NbCard from '../look-and-feel/NbCard';
import NbPageHeader from '../look-and-feel/NbPageHeader';
import HardShadow from '../look-and-feel/HardShadow';
import { nb, lightColors, borderRadius, spacing, accentGradients } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const AUTH_ERROR_INVALID_EMAIL = 'auth/invalid-email';
const AUTH_ERROR_MISSING_EMAIL = 'auth/missing-email';
const KEYBOARD_OFFSET_IOS = 10;
const KEYBOARD_OFFSET_ANDROID = 0;
const SCROLL_BOTTOM_PAD_MIN = 16;
const SCROLL_BOTTOM_PAD_EXTRA = 24;
// Manipulate here: seconds before “Resend link” unlocks on the inbox step
const RESEND_COOLDOWN_SEC = 30;
const TIP_GRADIENT = accentGradients[4];
const CLOCK_GRADIENT = accentGradients[0];

// ===== HELPER FUNCTIONS =====

function validateResetEmail(email, emailRegex) {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) return { errorMessage: 'Email is required' };
  if (!emailRegex.test(trimmedEmail)) return { errorMessage: 'Please enter a valid email address' };
  if (!auth) return { errorMessage: 'Auth is not ready. Please try again in a moment.' };
  return { trimmedEmail };
}

function messageForPasswordResetError(error) {
  const code = error?.code || '';
  if (code === AUTH_ERROR_INVALID_EMAIL) return 'Invalid email address';
  if (code === AUTH_ERROR_MISSING_EMAIL) return 'Email is required';
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

function formatCooldown(secondsLeft) {
  const safe = Math.max(0, secondsLeft);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// ===== MAIN FUNCTION =====

/**
 * Email form that asks Firebase to send a password reset link.
 * @param {{ navigation?: { goBack?: Function, navigate?: Function }, initialEmail?: string }} props
 */
export default function ResetPasswordScreen({ navigation, initialEmail = '' }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState(String(initialEmail || '').trim());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  // vocab: step = which Design Law screen we show — request (09/10) or inbox (11/12)
  const [step, setStep] = useState('request');
  const [sentToEmail, setSentToEmail] = useState('');
  const [cooldownLeft, setCooldownLeft] = useState(0);

  const onBack = navigation?.goBack ?? navigation?.navigate;
  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);

  // Tick the resend cooldown once per second while > 0
  useEffect(() => {
    if (cooldownLeft <= 0) return undefined;
    const id = setTimeout(() => setCooldownLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldownLeft]);

  const sendReset = async ({ fromResend = false } = {}) => {
    setErrorMessage('');

    const validation = validateResetEmail(email, emailRegex);
    if (validation.errorMessage) {
      setErrorMessage(validation.errorMessage);
      return;
    }

    try {
      setIsSubmitting(true);
      // vocab: sendPasswordResetEmail = Firebase Auth emails a link. It does not change the password here.
      await sendPasswordResetEmail(auth, validation.trimmedEmail);
      setSentToEmail(validation.trimmedEmail);
      setStep('inbox');
      setCooldownLeft(RESEND_COOLDOWN_SEC);
      if (fromResend) {
        // Stay on inbox — only refresh the timer after a successful resend
      }
    } catch (error) {
      setErrorMessage(messageForPasswordResetError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => sendReset({ fromResend: false });

  const handleResend = async () => {
    if (cooldownLeft > 0 || isSubmitting) return;
    await sendReset({ fromResend: true });
  };

  const openMailApp = () => {
    // Best-effort — device may have no default mail handler
    Linking.openURL('message://').catch(() => {
      Linking.openURL('mailto:').catch(() => {});
    });
  };

  const cooldownProgressPct =
    RESEND_COOLDOWN_SEC <= 0
      ? 0
      : Math.max(0, Math.min(100, ((RESEND_COOLDOWN_SEC - cooldownLeft) / RESEND_COOLDOWN_SEC) * 100));

  return (
    <View style={[styles.root, { backgroundColor: colors.nbBackground }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        <KeyboardAvoidingView
          behavior={keyboardAvoidBehavior()}
          style={{ flex: 1 }}
          keyboardVerticalOffset={keyboardVerticalOffset()}
        >
          <NbPageHeader title="Reset password" onBack={() => onBack?.()} />

          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: nb.screenGutter,
              paddingBottom: scrollBottomPadding(insets.bottom),
              maxWidth: 440,
              width: '100%',
              alignSelf: 'center',
            }}
            keyboardShouldPersistTaps="handled"
          >
            {step === 'request' ? (
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
                      borderColor: errorMessage ? colors.nbBorder : colors.nbBorder,
                      backgroundColor: colors.nbSurface,
                      borderWidth: nb.borderWidth,
                      shadowColor: colors.nbShadow,
                      borderStyle: errorMessage ? 'dashed' : 'solid',
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.input, { color: colors.nbInk }]}
                    placeholder="alex@example.com"
                    placeholderTextColor={colors.nbMuted}
                    value={email}
                    onChangeText={(nextEmail) => {
                      setEmail(nextEmail);
                      if (errorMessage) setErrorMessage('');
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isSubmitting}
                  />
                </View>

                {!!errorMessage && (
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
                )}

                <NbButton
                  variant="fill"
                  onPress={handleReset}
                  disabled={isSubmitting}
                  style={styles.submitButton}
                >
                  {isSubmitting ? 'Sending…' : 'Send reset link'}
                </NbButton>

                {/* Tip card — Design Law “No account found?” helper under the CTA */}
                <NbCard style={styles.tipCard}>
                  <View style={styles.tipRow}>
                    <View
                      style={[
                        styles.tipIcon,
                        { borderColor: colors.nbBorder },
                      ]}
                    >
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
                  onPress={() => onBack?.()}
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
            ) : (
              <>
                <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbIconChip} style={styles.clockWrap}>
                  <View style={[styles.clockChip, { borderColor: colors.nbBorder }]}>
                    <LinearGradient
                      colors={CLOCK_GRADIENT}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.clockFill}
                    >
                      <Ionicons name="time-outline" size={36} color={lightColors.nbInk} />
                    </LinearGradient>
                  </View>
                </HardShadow>

                <Text style={[styles.heroTitle, { color: colors.nbInk }]}>Check your inbox.</Text>
                <Text style={[styles.heroSub, { color: colors.nbMuted }]}>
                  We sent a reset link to{' '}
                  <Text style={{ fontWeight: '900', color: colors.nbInk }}>{sentToEmail || email}</Text>
                  . Open it on this phone.
                </Text>

                <NbButton variant="fill" onPress={openMailApp} style={styles.submitButton}>
                  Open mail app
                </NbButton>

                <NbCard style={styles.resendCard}>
                  <View style={styles.resendHeader}>
                    <TouchableOpacity
                      onPress={handleResend}
                      disabled={cooldownLeft > 0 || isSubmitting}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.resendLabel,
                          {
                            color: cooldownLeft > 0 ? colors.nbMuted : colors.nbInk,
                          },
                        ]}
                      >
                        Resend link
                      </Text>
                    </TouchableOpacity>
                    <Text style={[styles.resendTimer, { color: colors.nbInk }]}>
                      {formatCooldown(cooldownLeft)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.progressTrack,
                      { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
                    ]}
                  >
                    <LinearGradient
                      colors={CLOCK_GRADIENT}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={[styles.progressFill, { width: `${Math.max(cooldownProgressPct, 3)}%` }]}
                    />
                  </View>
                  <Text style={[styles.resendHint, { color: colors.nbMuted }]}>
                    Nothing yet? Look in spam, then resend.
                  </Text>
                </NbCard>

                {!!errorMessage && (
                  <Text style={[styles.errorText, { color: colors.nbInk, marginTop: spacing.sm }]}>
                    {errorMessage}
                  </Text>
                )}

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => onBack?.()}
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
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

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
