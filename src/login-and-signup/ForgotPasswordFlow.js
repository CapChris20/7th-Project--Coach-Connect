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
import { LinearGradient } from 'expo-linear-gradient';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../app-start/cloudConnection';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// ===== NAMED CONSTANTS =====

const ACCENT = ['#FF6B9D', '#C084FC'];
const CTA_RING = ['#C1265A', '#D84315'];
const AUTH_ERROR_INVALID_EMAIL = 'auth/invalid-email';
const AUTH_ERROR_MISSING_EMAIL = 'auth/missing-email';

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
  return error?.message || 'Failed to send reset email';
}

// ===== MAIN FUNCTION =====

/**
 * Email form that asks Firebase to send a password reset link.
 * @param {{ navigation?: { goBack?: Function, navigate?: Function } }} props
 */
export default function ResetPasswordScreen({ navigation }) {
  const { isDark, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const onBack = navigation?.goBack ?? navigation?.navigate;
  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);

  const backgroundColor = isDark ? '#0A0A0F' : '#F5F5F7';
  const textMain = isDark ? '#FFFFFF' : '#0A0A0F';
  const textSub = isDark ? 'rgba(255,255,255,0.62)' : 'rgba(15,23,42,0.58)';
  const glassInner = isDark ? 'rgba(10,10,15,0.78)' : 'rgba(255,255,255,0.92)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.14)';
  const labelColor = isDark ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.72)';

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
    <View style={[styles.root, { backgroundColor }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 22,
            paddingTop: spacing.sm,
            paddingBottom: Math.max(insets.bottom, 16) + 24,
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
                  borderColor: inputBorder,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)',
                },
              ]}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color={textMain} />
            </TouchableOpacity>
          </View>

          <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.heroRing}>
            <View style={[styles.heroInner, { backgroundColor: glassInner }]}>
              <Text style={[styles.kicker, { color: textSub }]}>PASSWORD</Text>
              <Text style={[styles.title, { color: textMain }]}>Reset your password</Text>
              <Text style={[styles.subtitle, { color: textSub }]}>
                Enter your email and we'll send you a secure link to choose a new password.
              </Text>
            </View>
          </LinearGradient>

          <Text style={[styles.fieldLabel, { color: labelColor }]}>EMAIL</Text>
          <View
            style={[
              styles.inputShell,
              {
                borderColor: errorMessage ? '#F87171' : inputBorder,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)',
              },
            ]}
          >
            <TextInput
              style={[styles.input, { color: textMain }]}
              placeholder="you@example.com"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.38)'}
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

          <LinearGradient
            colors={CTA_RING}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.ctaRing, { opacity: isSubmitting ? 0.75 : 1 }]}
          >
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleReset}
              disabled={isSubmitting}
              style={[
                styles.ctaInner,
                { backgroundColor: isDark ? 'rgba(10,10,15,0.94)' : 'rgba(255,255,255,0.98)' },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={isDark ? '#FFFFFF' : '#0A0A0F'} />
              ) : (
                <Text style={[styles.ctaText, { color: isDark ? '#FFFFFF' : '#0A0A0F' }]}>Send reset link</Text>
              )}
            </TouchableOpacity>
          </LinearGradient>

          <TouchableOpacity activeOpacity={0.85} onPress={() => onBack?.()} style={styles.textLinkHit}>
            <Text style={[styles.textLink, { color: isDark ? '#C084FC' : '#7C3AED' }]}>Back to sign in</Text>
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRing: {
    borderRadius: 22,
    padding: 3,
    marginBottom: 28,
  },
  heroInner: {
    borderRadius: 19,
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    borderWidth: 1.5,
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
  ctaRing: {
    marginTop: 22,
    borderRadius: 16,
    padding: 2,
  },
  ctaInner: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
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
