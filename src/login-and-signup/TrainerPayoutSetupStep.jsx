// Trainer signup step that offers Stripe Connect so coaches can receive client payments.
// Flow: idle/error show Connect + Skip → connecting/pending show a spinner → active shows Continue.
// Used as onboarding step 4. This is bank payout setup, not Face ID / identity verification.

import React, { useMemo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { trainerPayoutSetupFlow } from '../for-both/payments/trainerPayoutSetupFlow';
import { TrainerPayoutSetupPopup } from '../for-both/payments/TrainerPayoutSetupPopup';
import NbButton from '../look-and-feel/NbButton';
import { nb, gradients } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

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
      textPrimary: '#F3EEFF',
      textSecondary: '#A7A1BE',
      compareBorder: '#F3EEFF',
      cardBg: '#17171F',
    };
  }
  return {
    textPrimary: '#0A0A0F',
    textSecondary: '#55506B',
    compareBorder: '#0A0A0F',
    cardBg: '#FFFFFF',
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
      <View style={[
        styles.compareCard,
        {
          borderColor: palette.compareBorder,
          backgroundColor: palette.cardBg,
          borderWidth: nb.borderWidth,
        }
      ]}>
        <Ionicons name="scan-outline" size={22} color={IDENTITY_ICON_COLOR} />
        <Text style={[styles.compareTitle, { color: palette.textPrimary }]}>Identity Verification</Text>
        <Text style={[styles.compareBody, { color: palette.textSecondary }]}>
          Face ID selfie on your profile step — manual review for the Verified badge. Separate from payments.
        </Text>
      </View>
      <View style={[
        styles.compareCard,
        {
          borderColor: palette.compareBorder,
          backgroundColor: palette.cardBg,
          borderWidth: nb.borderWidth,
        }
      ]}>
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
  palette,
}) {
  const primaryLabel = error ? 'RETRY' : 'CONNECT WITH STRIPE';
  const primaryPress = error ? retry : startConnect;
  return (
    <>
      {showButtons ? (
        <View style={styles.actions}>
          <NbButton variant="brand" onPress={primaryPress}>
            {primaryLabel}
          </NbButton>
          <NbButton variant="plain" onPress={onSkip} style={styles.skipButton}>
            SKIP FOR NOW
          </NbButton>
        </View>
      ) : null}

      {isActive ? (
        <NbButton variant="brand" onPress={onComplete}>
          Continue
        </NbButton>
      ) : null}
    </>
  );
}

function makeStyles() {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingTop: 8,
    },
    iconWrap: {
      marginBottom: 20,
      width: 72,
      height: 72,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: gradients.brand.colors[0],
      borderWidth: nb.borderWidth,
      borderColor: '#0A0A0F',
    },
    compareRow: {
      width: '100%',
      flexDirection: 'row',
      gap: 10,
      marginBottom: 20,
    },
    compareCard: {
      flex: 1,
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
      gap: 12,
    },
    skipButton: {
      marginTop: 0,
    },
  });
}

// ===== MAIN FUNCTION =====

/**
 * Optional Stripe Connect step during trainer signup.
 * vocab: trainerPayoutSetupFlow = hook that opens Stripe's hosted form and reports phase.
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

  const styles = useMemo(() => makeStyles(), []);
  const palette = payoutStepPalette(isDark);
  const { showButtons, isConnecting, isPending, isActive } = payoutPhaseFlags(phase);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="card-outline" size={36} color="#FFFFFF" />
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
