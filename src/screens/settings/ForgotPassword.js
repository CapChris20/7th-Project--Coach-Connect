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
import { auth } from '../../app/config';
import { useTheme } from '../../shared/ui/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ForgotPasswordScreen({ navigation }) {
  const { colors, isDark, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const onBack = navigation?.goBack ?? navigation?.navigate;

  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);

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
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : colors.white }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => onBack?.()}
          activeOpacity={0.8}
          style={[
            styles.backBtn,
            {
              borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)',
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.92)',
            },
          ]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={isDark ? colors.white : colors.black} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: isDark ? colors.text : colors.text }]}>Forgot Password</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: spacing.lg,
            paddingBottom: insets.bottom + 32,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.title, { color: isDark ? colors.text : colors.text }]}>Reset your password</Text>
          <Text style={[styles.subtitle, { color: isDark ? colors.textSecondary : colors.textSecondary }]}>
            Enter your email and we’ll send you a link to reset your password.
          </Text>

          <View style={styles.field}>
            <Text style={[styles.label, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)' }]}>
              Email
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
                  color: isDark ? colors.text : colors.text,
                },
              ]}
              placeholder="Enter your email"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)'}
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

          {!!error && <Text style={[styles.errorText]}>{error}</Text>}
          {!!successMessage && <Text style={[styles.successText]}>{successMessage}</Text>}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleReset}
            disabled={submitting}
            style={[
              styles.primaryBtn,
              {
                opacity: submitting ? 0.7 : 1,
                backgroundColor: isDark ? colors.primary : colors.primary,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Send Reset Link</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onBack?.()}
            style={styles.backLink}
          >
            <Text style={[styles.backLinkText, { color: isDark ? colors.primary : colors.primary }]}>
              Back to login
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingTop: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'left',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 18,
  },
  field: {
    marginTop: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    marginTop: 10,
    marginBottom: 6,
    color: '#FF453A',
    fontSize: 13,
    fontWeight: '700',
  },
  successText: {
    marginTop: 10,
    marginBottom: 6,
    color: '#30D158',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryBtn: {
    marginTop: 18,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  backLink: {
    marginTop: 14,
    alignItems: 'center',
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
});

