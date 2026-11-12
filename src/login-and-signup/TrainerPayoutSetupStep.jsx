// Trainer signup step that offers Stripe Connect so coaches can receive client payments.
// Flow: idle/error show Connect + Skip → connecting/pending show a spinner → active shows Continue.
// Used in Design Law trainer onboarding (step 8) and legacy flows. Bank payout only — not Face ID.

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
import NbCard from '../look-and-feel/NbCard';
import HardShadow from '../look-and-feel/HardShadow';
import { nb, gradients, lightColors, darkColors, borderRadius, spacing } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const IDENTITY_ICON_COLOR = '#E25588';
const PAYMENT_ICON_COLOR = lightColors.primary;
const SPINNER_CONNECTING_COLOR = lightColors.primary;
const SPINNER_PENDING_COLOR = '#E25588';
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
      textPrimary: lightColors.nbBackground,
      textSecondary: darkColors.nbMuted,
      compareBorder: lightColors.nbBackground,
      cardBg: darkColors.nbSurface,
    };
  }
  return {
    textPrimary: lightColors.nbInk,
    textSecondary: lightColors.nbMuted,
    compareBorder: lightColors.nbInk,
    cardBg: lightColors.white,
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
  designLaw,
}) {
  const primaryLabel = error ? 'Retry' : designLaw ? 'Finish setup' : 'CONNECT WITH STRIPE';
  const primaryPress = error ? retry : startConnect;
  const skipLabel = designLaw ? 'Skip for now' : 'SKIP FOR NOW';
  return (
    <>
      {showButtons ? (
        <View style={styles.actions}>
          <NbButton variant={designLaw ? 'fill' : 'brand'} onPress={primaryPress}>
            {primaryLabel}
          </NbButton>
          <NbButton variant="plain" onPress={onSkip} style={styles.skipButton}>
            {skipLabel}
          </NbButton>
        </View>
      ) : null}

      {isActive ? (
        <NbButton variant={designLaw ? 'fill' : 'brand'} onPress={onComplete}>
          Continue
        </NbButton>
      ) : null}
    </>
  );
}

/** Design Law checklist rows (trainer-setup-part-2 PNG 13–19). */
function DesignLawPayoutBody({ palette, phase, error, identityDone }) {
  const rows = [
    {
      title: 'Identity verification',
      sub: identityDone ? 'Submitted, in review' : 'Upload face photo first',
      done: identityDone,
    },
    {
      title: 'Payment method',
      sub: phase === 'active' ? 'Bank account verified' : error ? 'Stripe could not finish' : 'Connect a bank account with Stripe',
      done: phase === 'active',
      failed: !!error,
    },
    {
      title: 'Start taking clients',
      sub: phase === 'active' ? 'You are ready' : 'Unlock after payouts are active',
      done: phase === 'active',
    },
  ];

  return (
    <View style={{ width: '100%', gap: spacing.md }}>
      <Text style={{ fontSize: 22, fontWeight: '900', color: palette.textPrimary }}>Get paid for sessions</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: palette.textSecondary, lineHeight: 20 }}>
        Connect a bank account with Stripe. It takes about five minutes.
      </Text>
      {error ? (
        <HardShadow>
          <NbCard>
            <Text style={{ fontSize: 16, fontWeight: '900', color: palette.textPrimary }}>That did not finish</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: palette.textSecondary, marginTop: 6 }}>
              Stripe still needs a detail. Try Finish setup again. Your progress is saved.
            </Text>
          </NbCard>
        </HardShadow>
      ) : null}
      {phase === 'active' ? (
        <View
          style={{
            borderWidth: nb.borderWidth,
            borderColor: palette.compareBorder,
            borderRadius: borderRadius.nbHero,
            backgroundColor: palette.textPrimary,
            padding: 16,
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '900', color: palette.textSecondary, letterSpacing: 1.1 }}>
            PAYOUTS
          </Text>
          <Text style={{ fontSize: 26, fontWeight: '900', color: palette.cardBg }}>Bank account verified!</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.cardBg, opacity: 0.9 }}>
            Clients can pay you and payouts go to your account on Tuesdays.
          </Text>
        </View>
      ) : null}
      <HardShadow>
        <NbCard style={{ paddingVertical: 0 }}>
          {rows.map((row, idx) => (
            <View
              key={row.title}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 12,
                paddingVertical: 14,
                borderTopWidth: idx > 0 ? nb.borderWidth : 0,
                borderTopColor: palette.compareBorder,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: nb.borderWidth,
                  borderColor: palette.compareBorder,
                  borderStyle: row.failed ? 'dashed' : 'solid',
                  backgroundColor: row.done ? palette.textPrimary : palette.cardBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {row.done ? (
                  <Text style={{ color: palette.cardBg, fontWeight: '900', fontSize: 12 }}>✓</Text>
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: palette.textPrimary }}>{row.title}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: palette.textSecondary, marginTop: 2 }}>
                  {row.sub}
                </Text>
              </View>
            </View>
          ))}
        </NbCard>
      </HardShadow>
    </View>
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
      borderColor: lightColors.nbInk,
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
 * @param {{ email?: string, isDark?: boolean, onSkip?: function, onComplete?: function, designLaw?: boolean, identitySubmitted?: boolean }} props
 */
export function TrainerPayoutSetupStep({
  email,
  isDark = true,
  onSkip,
  onComplete,
  designLaw = false,
  identitySubmitted = false,
}) {
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
    <View style={[styles.container, designLaw ? { alignItems: 'stretch', paddingTop: 0 } : null]}>
      {designLaw ? (
        <DesignLawPayoutBody
          palette={palette}
          phase={phase}
          error={error}
          identityDone={identitySubmitted}
        />
      ) : (
        <>
          <View style={styles.iconWrap}>
            <Ionicons name="card-outline" size={36} color={lightColors.white} />
          </View>

          <Text style={[styles.title, { color: palette.textPrimary }]}>Payment Method</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            This is for receiving client payments — not Face ID / identity verification.
          </Text>
          <Text style={[styles.message, { color: palette.textSecondary }]}>
            Stripe Connect lets you add a bank account, debit card, or other payout options so clients can pay you securely.
          </Text>

          <IdentityVsPaymentCards styles={styles} palette={palette} />
        </>
      )}

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
        designLaw={designLaw}
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
