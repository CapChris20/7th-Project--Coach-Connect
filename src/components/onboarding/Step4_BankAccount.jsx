/**
 * Trainer onboarding Step 4 — Connect bank account (Stripe Connect).
 *
 * Purpose: Optional bank setup during trainer signup so coaches can receive client payments.
 * Why it matters: Reduces Day-1 friction while still offering secure Stripe onboarding in-app.
 * Area: src/components
 * Key exports: Step4_BankAccount
 *
 * @file-header
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useStripeConnectFlow } from '../../shared/payments/useStripeConnectFlow';
import { StripeConnectWebViewModal } from '../../shared/payments/StripeConnectWebViewModal';

export function Step4_BankAccount({ email, isDark = true, onSkip, onComplete }) {
  const {
    phase,
    error,
    webViewUrl,
    startConnect,
    closeWebView,
    handleWebViewComplete,
    retry,
  } = useStripeConnectFlow({
    email,
    onActive: () => onComplete?.(),
  });

  const styles = useMemo(() => makeStyles(isDark), [isDark]);
  const textPrimary = isDark ? '#FFFFFF' : '#0A0A0F';
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';

  const showButtons = phase === 'idle' || phase === 'error';
  const isConnecting = phase === 'connecting';
  const isPending = phase === 'pending';
  const isActive = phase === 'active';

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <LinearGradient colors={['#FF6B9D', '#22D3EE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconGradient}>
          <Ionicons name="card-outline" size={36} color="#FFFFFF" />
        </LinearGradient>
      </View>

      <Text style={[styles.title, { color: textPrimary }]}>Payment Method</Text>
      <Text style={[styles.subtitle, { color: textSecondary }]}>
        This is for receiving client payments — not Face ID / identity verification.
      </Text>
      <Text style={[styles.message, { color: textSecondary }]}>
        Stripe Connect lets you add a bank account, debit card, or other payout options so clients can pay you securely.
      </Text>

      <View style={styles.compareRow}>
        <View style={[styles.compareCard, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}>
          <Ionicons name="scan-outline" size={22} color="#C084FC" />
          <Text style={[styles.compareTitle, { color: textPrimary }]}>Identity Verification</Text>
          <Text style={[styles.compareBody, { color: textSecondary }]}>
            Face ID selfie on your profile step — manual review for the Verified badge. Separate from payments.
          </Text>
        </View>
        <View style={[styles.compareCard, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}>
          <Ionicons name="card-outline" size={22} color="#FF6B9D" />
          <Text style={[styles.compareTitle, { color: textPrimary }]}>Payment Method</Text>
          <Text style={[styles.compareBody, { color: textSecondary }]}>
            Bank transfer, debit card, and other Stripe payout options for coaching fees.
          </Text>
        </View>
      </View>

      {isConnecting ? (
        <View style={styles.statusBlock}>
          <ActivityIndicator size="large" color="#FF6B9D" />
          <Text style={[styles.statusText, { color: textSecondary }]}>Opening Stripe form…</Text>
        </View>
      ) : null}

      {isPending ? (
        <View style={styles.statusBlock}>
          <ActivityIndicator size="large" color="#C084FC" />
          <Text style={[styles.statusText, { color: textSecondary }]}>
            Verifying your account (up to 24 hours)…
          </Text>
        </View>
      ) : null}

      {isActive ? (
        <View style={styles.statusBlock}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={[styles.successText, { color: textPrimary }]}>Bank account verified!</Text>
        </View>
      ) : null}

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      {showButtons ? (
        <View style={styles.actions}>
          <TouchableOpacity activeOpacity={0.9} onPress={error ? retry : startConnect} style={styles.primaryWrap}>
            <LinearGradient
              colors={['#FF6B9D', '#C084FC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryText}>{error ? 'RETRY' : 'CONNECT WITH STRIPE'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.85} onPress={onSkip} style={styles.secondaryBtn}>
            <Text style={[styles.secondaryText, { color: textSecondary }]}>SKIP FOR NOW</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isActive ? (
        <TouchableOpacity activeOpacity={0.9} onPress={onComplete} style={styles.primaryWrap}>
          <LinearGradient
            colors={['#FF6B9D', '#C084FC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryText}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : null}

      <StripeConnectWebViewModal
        visible={!!webViewUrl}
        url={webViewUrl}
        title="Connect with Stripe"
        isDark={isDark}
        onClose={() => closeWebView({ userClosed: true })}
        onComplete={handleWebViewComplete}
      />
    </View>
  );
}

function makeStyles(isDark) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingTop: 8,
    },
    iconWrap: {
      marginBottom: 20,
    },
    iconGradient: {
      width: 72,
      height: 72,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    compareRow: {
      width: '100%',
      flexDirection: 'row',
      gap: 10,
      marginBottom: 20,
    },
    compareCard: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 14,
      padding: 12,
      gap: 6,
    },
    compareTitle: {
      fontSize: 13,
      fontWeight: '800',
      marginTop: 4,
    },
    compareBody: {
      fontSize: 11,
      lineHeight: 15,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 8,
    },
    message: {
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 20,
    },
    statusBlock: {
      alignItems: 'center',
      marginVertical: 20,
      gap: 12,
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      paddingHorizontal: 16,
    },
    successIcon: {
      fontSize: 40,
    },
    successText: {
      fontSize: 18,
      fontWeight: '800',
      textAlign: 'center',
    },
    errorText: {
      color: '#FF453A',
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 16,
      paddingHorizontal: 8,
    },
    actions: {
      width: '100%',
      marginTop: 8,
    },
    primaryWrap: {
      width: '100%',
      marginBottom: 12,
    },
    primaryBtn: {
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    secondaryBtn: {
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryText: {
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
  });
}
