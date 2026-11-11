// Reset-password screen. The user types an email and Firebase sends the reset link.
// Flow: check the email → sendPasswordResetEmail → show inbox copy, or the Firebase error.
// Used from the sign-in screen. The screen export name is ResetPasswordScreen.

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../app-start/cloudConnection';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import NbButton from '../look-and-feel/NbButton';
import NbCard from '../look-and-feel/NbCard';
import { nb } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const AUTH_ERROR_INVALID_EMAIL = 'auth/invalid-email';
const AUTH_ERROR_MISSING_EMAIL = 'auth/missing-email';
const KEYBOARD_OFFSET_IOS = 10;
const KEYBOARD_OFFSET_ANDROID = 0;
const SCROLL_BOTTOM_PAD_MIN = 16;
const SCROLL_BOTTOM_PAD_EXTRA = 24;

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

// ===== MAIN FUNCTION =====

/**
 * Email form that asks Firebase to send a password reset link.
 * @param {{ navigation?: { goBack?: Function, navigate?: Function } }} props
 */
export default function ResetPasswordScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const onBack = navigation?.goBack ?? navigation?.navigate;
  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);

  const handleReset = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    const validation = validateResetEmail(email, emailRegex);
    if (validation.errorMessage) {
      setErrorMessage(validation.errorMessage);
      return;
    }

    try {
      setIsSubmitting(true);
      // vocab: sendPasswordResetEmail = Firebase Auth emails a link. It does not change the password here.
      await sendPasswordResetEmail(auth, validation.trimmedEmail);
      setSuccessMessage('Check your inbox for a reset link.');
    } catch (error) {
      setErrorMessage(messageForPasswordResetError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.nbBackground }]}>
      <StatusBar barStyle={colors.nbInk === '#F3EEFF' ? 'light-content' : 'dark-content'} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={keyboardAvoidBehavior()}
          style={{ flex: 1 }}
          keyboardVerticalOffset={keyboardVerticalOffset()}
        >
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              paddingHorizontal: 22,
              paddingTop: 16,
              paddingBottom: scrollBottomPadding(insets.bottom),
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formColumn}>
              <View style={styles.backCenterWrap}>
                <TouchableOpacity
                  onPress={() => onBack?.()}
                  activeOpacity={0.8}
                  style={[
                    styles.backBtn,
                    {
                      borderColor: colors.nbBorder,
                      backgroundColor: colors.nbSurface,
                      borderWidth: nb.borderWidth,
                    },
                  ]}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <Ionicons name="chevron-back" size={22} color={colors.nbInk} />
                </TouchableOpacity>
              </View>

              <NbCard style={styles.heroCard}>
                <Text style={[styles.kicker, { color: colors.nbMuted }]}>PASSWORD</Text>
                <Text style={[styles.title, { color: colors.nbInk }]}>Reset your password</Text>
                <Text style={[styles.subtitle, { color: colors.nbMuted }]}>
                  Enter your email and we'll send you a secure link to choose a new password.
                </Text>
              </NbCard>

              <Text style={[styles.fieldLabel, { color: colors.nbInk }]}>EMAIL</Text>
              <View
                style={[
                  styles.inputShell,
                  {
                    borderColor: errorMessage ? '#F87171' : colors.nbBorder,
                    backgroundColor: colors.nbSurface,
                    borderWidth: nb.borderWidth,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.nbInk }]}
                  placeholder="you@example.com"
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

              {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
              {!!successMessage && <Text style={styles.successText}>{successMessage}</Text>}

              <NbButton
                variant="brand"
                onPress={handleReset}
                disabled={isSubmitting}
                style={styles.submitButton}
              >
                {isSubmitting ? 'SENDING...' : 'SEND RESET LINK'}
              </NbButton>

              <TouchableOpacity activeOpacity={0.85} onPress={() => onBack?.()} style={styles.textLinkHit}>
                <Text style={[styles.textLink, { color: '#FF6B9D' }]}>Back to sign in</Text>
              </TouchableOpacity>
            </View>
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
  formColumn: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  backCenterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    marginBottom: 28,
    padding: 20,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  inputShell: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    fontSize: 16,
    fontWeight: '600',
    padding: 0,
  },
  errorText: {
    marginTop: 10,
    marginBottom: 4,
    color: '#FF453A',
    fontSize: 13,
    fontWeight: '700',
  },
  successText: {
    marginTop: 10,
    marginBottom: 4,
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
  },
  submitButton: {
    marginTop: 22,
  },
  textLinkHit: {
    marginTop: 22,
    alignItems: 'center',
    paddingVertical: 8,
  },
  textLink: {
    fontSize: 15,
    fontWeight: '800',
  },
});
