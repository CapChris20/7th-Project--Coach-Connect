/**
 * Forgot Password
 *
 * Purpose: UI screen or component: Forgot Password. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/screens
 * Key exports: ResetPasswordScreen
 *
 * @file-header
 */
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
import { auth } from '../../app-start/config';
import { useTheme } from '../../shared-ui/ThemeContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const ACCENT = ['#FF6B9D', '#C084FC'];
const CTA_RING = ['#C1265A', '#D84315'];

export default function ResetPasswordScreen({ navigation }) {
  const { isDark, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const onBack = navigation?.goBack ?? navigation?.navigate;

  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);

  const bg = isDark ? '#0A0A0F' : '#F5F5F7';
  const textMain = isDark ? '#FFFFFF' : '#0A0A0F';
  const textSub = isDark ? 'rgba(255,255,255,0.62)' : 'rgba(15,23,42,0.58)';
  const glassInner = isDark ? 'rgba(10,10,15,0.78)' : 'rgba(255,255,255,0.92)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.14)';
  const labelColor = isDark ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.72)';

  const handleReset = async () => {
    setError('');
    setSuccessMessage('');

    const trimmed = email.trim();
    if (!trimmed) {
      setError('Email is required');
      return;
    }
    if (!emailRegex.test(trimmed)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!auth) {
      setError('Auth is not ready. Please try again in a moment.');
      return;
    }

    try {
      setSubmitting(true);
      await sendPasswordResetEmail(auth, trimmed);
      setSuccessMessage('Check your inbox for a reset link.');
    } catch (e) {
      const code = e?.code || '';
      if (code === 'auth/invalid-email') setError('Invalid email address');
      else if (code === 'auth/missing-email') setError('Email is required');
      else setError(e?.message || 'Failed to send reset email');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
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
                borderColor: error ? '#F87171' : inputBorder,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)',
              },
            ]}
          >
            <TextInput
              style={[styles.input, { color: textMain }]}
              placeholder="you@example.com"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.38)'}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
            />
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}
          {!!successMessage && <Text style={styles.successText}>{successMessage}</Text>}

          <LinearGradient
            colors={CTA_RING}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.ctaRing, { opacity: submitting ? 0.75 : 1 }]}
          >
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleReset}
              disabled={submitting}
              style={[
                styles.ctaInner,
                { backgroundColor: isDark ? 'rgba(10,10,15,0.94)' : 'rgba(255,255,255,0.98)' },
              ]}
            >
              {submitting ? (
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
