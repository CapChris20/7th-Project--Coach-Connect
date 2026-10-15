// Trainer signup step that offers Stripe Connect so coaches can receive client payments.
// Flow: idle/error show Connect + Skip → connecting/pending show a spinner → active shows Continue.
// Used as onboarding step 4. This is bank payout setup, not Face ID / identity verification.

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
import { trainerPayoutSetupFlow } from '../for-both/payments/trainerPayoutSetupFlow';
import { TrainerPayoutSetupPopup } from '../for-both/payments/TrainerPayoutSetupPopup';

// ===== NAMED CONSTANTS =====

const ICON_GRADIENT = ['#FF6B9D', '#22D3EE'];
const BUTTON_GRADIENT = ['#FF6B9D', '#C084FC'];
const IDENTITY_ICON_COLOR = '#C084FC';
const PAYMENT_ICON_COLOR = '#FF6B9D';
const SPINNER_CONNECTING_COLOR = '#FF6B9D';
const SPINNER_PENDING_COLOR = '#C084FC';
const PHASE_IDLE = 'idle';
const PHASE_ERROR = 'error';
const PHASE_CONNECTING = 'connecting';
const PHASE_PENDING = 'pending';
const PHASE_ACTIVE = 'active';

// ===== HELPER FUNCTIONS =====

/**
 * Title/body colors that follow the onboarding dark/light theme.
 * @param {boolean} isDark
 * @returns {{ textPrimary: string, textSecondary: string, compareBorder: string }}
 */
function payoutStepPalette(isDark) {
  if (isDark) {
    return {
      textPrimary: '#FFFFFF',
      textSecondary: 'rgba(255,255,255,0.55)',
      compareBorder: 'rgba(255,255,255,0.12)',
    };
  }
  return {
    textPrimary: '#0A0A0F',
    textSecondary: 'rgba(0,0,0,0.5)',
    compareBorder: 'rgba(0,0,0,0.08)',
  };
}

/**
 * Which blocks to show. One phase at a time — connecting and pending never share the button row.
 * @param {string} phase
 */
function payoutPhaseFlags(phase) {
  return {
    showButtons: phase === PHASE_IDLE || phase === PHASE_ERROR,
    isConnecting: phase === PHASE_CONNECTING,
    isPending: phase === PHASE_PENDING,
    isActive: phase === PHASE_ACTIVE,
  };
}

/**
 * Side-by-side explainer so trainers do not mix Face ID with Stripe payouts.
 * @param {object} props
 */
function IdentityVsPaymentCards({ styles, palette }) {
  return (
    <View style={styles.compareRow}>
      <View style={[styles.compareCard, { borderColor: palette.compareBorder }]}>
        <Ionicons name="scan-outline" size={22} color={IDENTITY_ICON_COLOR} />
        <Text style={[styles.compareTitle, { color: palette.textPrimary }]}>Identity Verification</Text>
        <Text style={[styles.compareBody, { color: palette.textSecondary }]}>
          Face ID selfie on your profile step — manual review for the Verified badge. Separate from payments.
        </Text>
      </View>
      <View style={[styles.compareCard, { borderColor: palette.compareBorder }]}>
        <Ionicons name="card-outline" size={22} color={PAYMENT_ICON_COLOR} />
        <Text style={[styles.compareTitle, { color: palette.textPrimary }]}>Payment Method</Text>
        <Text style={[styles.compareBody, { color: palette.textSecondary }]}>
          Bank transfer, debit card, and other Stripe payout options for coaching fees.
        </Text>
      </View>
    </View>
  );
}

/**
 * Spinner / success copy for the in-flight Stripe phases.
 * @param {object} props
 */
function PayoutStatusBlock({ isConnecting, isPending, isActive, error, styles, palette }) {
  return (
    <>
      {isConnecting ? (
        <View style={styles.statusBlock}>
          <ActivityIndicator size="large" color={SPINNER_CONNECTING_COLOR} />
          <Text style={[styles.statusText, { color: palette.textSecondary }]}>Opening Stripe form…</Text>
        </View>
      ) : null}

      {isPending ? (
        <View style={styles.statusBlock}>
          <ActivityIndicator size="large" color={SPINNER_PENDING_COLOR} />
          <Text style={[styles.statusText, { color: palette.textSecondary }]}>
            Verifying your account (up to 24 hours)…
          </Text>
        </View>
      ) : null}

      {isActive ? (
        <View style={styles.statusBlock}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={[styles.successText, { color: palette.textPrimary }]}>Bank account verified!</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </>
  );
}

/**
 * Connect/Retry + Skip, or Continue after Stripe says the account is active.
 * @param {object} props
 */
function PayoutActionButtons({
  showButtons,
  isActive,
  error,
  retry,
  startConnect,
  onSkip,
  onComplete,
  styles,
  palette,
}) {
  const primaryLabel = error ? 'RETRY' : 'CONNECT WITH STRIPE';
  const primaryPress = error ? retry : startConnect;
  return (
    <>
      {showButtons ? (
        <View style={styles.actions}>
          <TouchableOpacity activeOpacity={0.9} onPress={primaryPress} style={styles.primaryWrap}>
            <LinearGradient
              colors={BUTTON_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryText}>{primaryLabel}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.85} onPress={onSkip} style={styles.secondaryBtn}>
            <Text style={[styles.secondaryText, { color: palette.textSecondary }]}>SKIP FOR NOW</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isActive ? (
        <TouchableOpacity activeOpacity={0.9} onPress={onComplete} style={styles.primaryWrap}>
          <LinearGradient
            colors={BUTTON_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryText}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : null}
    </>
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

// ===== MAIN FUNCTION =====

/**
 * Optional Stripe Connect step during trainer signup.
 * vocab: trainerPayoutSetupFlow = hook that opens Stripe’s hosted form and reports phase.
 * @param {{ email?: string, isDark?: boolean, onSkip?: function, onComplete?: function }} props
 */
export function TrainerPayoutSetupStep({ email, isDark = true, onSkip, onComplete }) {
  // Hook order must stay: flow first (it owns Stripe state), then styles keyed to theme.
  const {
    phase,
    error,
    webViewUrl,
    startConnect,
    closeWebView,
    handleWebViewComplete,
    retry,
  } = trainerPayoutSetupFlow({
    email,
    onActive: () => onComplete?.(),
  });

  const styles = useMemo(() => makeStyles(isDark), [isDark]);
  const palette = payoutStepPalette(isDark);
  const { showButtons, isConnecting, isPending, isActive } = payoutPhaseFlags(phase);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <LinearGradient
          colors={ICON_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconGradient}
        >
          <Ionicons name="card-outline" size={36} color="#FFFFFF" />
        </LinearGradient>
      </View>

      <Text style={[styles.title, { color: palette.textPrimary }]}>Payment Method</Text>
      <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
        This is for receiving client payments — not Face ID / identity verification.
      </Text>
      <Text style={[styles.message, { color: palette.textSecondary }]}>
        Stripe Connect lets you add a bank account, debit card, or other payout options so clients can pay you securely.
      </Text>

      <IdentityVsPaymentCards styles={styles} palette={palette} />

      <PayoutStatusBlock
        isConnecting={isConnecting}
        isPending={isPending}
        isActive={isActive}
        error={error}
        styles={styles}
        palette={palette}
      />

      <PayoutActionButtons
        showButtons={showButtons}
        isActive={isActive}
        error={error}
        retry={retry}
        startConnect={startConnect}
        onSkip={onSkip}
        onComplete={onComplete}
        styles={styles}
        palette={palette}
      />

      <TrainerPayoutSetupPopup
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
