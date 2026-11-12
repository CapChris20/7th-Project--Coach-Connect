// Design Law payout reminder — bottom sheet over trainer home (PNG 07/08).
// Flow: checklist + Refresh status / Finish setup → Stripe WebView via trainerPayoutSetupFlow.
// Used by TrainerHomeContent (props: visible, onClose, userEmail, stripeAccountId).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import NbSheet from '../../look-and-feel/NbSheet';
import NbButton from '../../look-and-feel/NbButton';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { borderRadius, gradients, nb, spacing } from '../../look-and-feel/colorPalette';
import { trainerPayoutSetupFlow } from './trainerPayoutSetupFlow';
import { TrainerPayoutSetupPopup } from './TrainerPayoutSetupPopup';
import { dismissPayoutSetupReminderPopup } from './whenToAskForPayoutSetup';
import { resolveStripeStatus, verifyStripeConnectStatus } from './trainerPayoutSetup';
import { auth, db } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

// Manipulate here: how long we wait on "verifying" before we stop the connecting spinner.
const PENDING_DONE_MS = 30000;

const SHEET_COPY = {
  title: 'Finish payout setup',
  body: 'You need this to accept clients and get paid for sessions.',
  pillPending: 'Payout verification in progress',
};

// ===== HELPER FUNCTIONS =====

function applyStripePhaseToPopup(phase, stripeError, setters) {
  if (phase === 'connecting') {
    setters.setStatus('connecting');
    setters.setLoading(true);
    setters.setErrorMessage(null);
    return;
  }
  if (phase === 'pending') {
    setters.setStatus('verifying');
    setters.setLoading(true);
    setters.setErrorMessage(null);
    return;
  }
  if (phase === 'active') {
    setters.setStatus('success');
    setters.setLoading(false);
    return;
  }
  if (phase === 'error') {
    setters.setStatus('error');
    setters.setLoading(false);
    setters.setErrorMessage(stripeError || 'Connection failed, try again');
  }
}

/**
 * Checklist rows for PNG 07/08 — subtitles change with resolved Stripe status.
 * @param {'not_connected'|'pending'|'active'} resolved
 */
function payoutStepSpecs(resolved) {
  const pendingOrActive = resolved === 'pending' || resolved === 'active';
  const active = resolved === 'active';
  return [
    {
      key: 'identity',
      title: 'Identity',
      subtitle: pendingOrActive ? 'Verified' : 'Complete in Stripe',
      done: pendingOrActive,
      current: !pendingOrActive,
    },
    {
      key: 'bank',
      title: 'Bank account',
      subtitle: pendingOrActive ? 'Added' : 'Add payout details',
      done: pendingOrActive,
      current: false,
    },
    {
      key: 'verification',
      title: 'Verification',
      subtitle: active
        ? 'Complete'
        : pendingOrActive
          ? 'Under review. Try Refresh status in a minute.'
          : 'Starts after bank details',
      done: active,
      current: pendingOrActive && !active,
    },
  ];
}

// ===== SUBCOMPONENTS =====

function StatusPill({ label }) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={gradients.brand.colors}
      start={gradients.brand.start}
      end={gradients.brand.end}
      style={[styles.statusPill, { borderColor: colors.nbBorder }]}
    >
      <Text style={[styles.statusPillText, { color: colors.nbInk }]}>{label}</Text>
    </LinearGradient>
  );
}

function PayoutStepTimeline({ steps, colors }) {
  return (
    <View style={styles.timeline}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const showConnector = !isLast;
        const dotStyle = [
          styles.stepDot,
          {
            borderColor: colors.nbBorder,
            backgroundColor: step.done || step.current ? colors.nbFill : colors.nbSurface,
          },
        ];
        return (
          <View key={step.key} style={styles.stepRow}>
            <View style={styles.stepRail}>
              <View style={dotStyle}>
                {step.done ? (
                  <Ionicons name="checkmark" size={16} color={colors.nbOnFill} />
                ) : (
                  <Text style={[styles.stepNumber, { color: step.current ? colors.nbOnFill : colors.nbInk }]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              {showConnector ? (
                <View
                  style={[
                    styles.stepConnector,
                    {
                      backgroundColor: step.done ? colors.nbInk : colors.nbBorder,
                      opacity: step.done ? 1 : 0.35,
                    },
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.stepText}>
              <Text style={[styles.stepTitle, { color: colors.nbInk }]}>{step.title}</Text>
              <Text style={[styles.stepSub, { color: colors.nbMuted }]}>{step.subtitle}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Dashboard reminder to finish Stripe payout setup (Design Law sheet).
 * @param {{ visible: boolean, onClose: Function, userEmail?: string, stripeAccountId?: string }} props
 */
export function PayoutSetupReminderPopup({ visible, onClose, userEmail, stripeAccountId = '' }) {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [pendingTimedOut, setPendingTimedOut] = useState(false);
  const [refreshingStripe, setRefreshingStripe] = useState(false);
  const [firestoreStripeStatus, setFirestoreStripeStatus] = useState('');
  const pendingTimerRef = useRef(null);

  const email = String(userEmail || auth?.currentUser?.email || '').trim();
  const trainerUid = auth?.currentUser?.uid || '';

  const stripeConnect = trainerPayoutSetupFlow({
    email,
    onActive: () => {
      setStatus('success');
      setLoading(false);
      setErrorMessage(null);
      setFirestoreStripeStatus('active');
    },
  });

  const reloadTrainerStripeFields = useCallback(async () => {
    if (!trainerUid || !db) return;
    try {
      const snap = await getDoc(doc(db, 'users', trainerUid));
      if (!snap.exists()) return;
      const user = snap.data() || {};
      const raw = user.stripeStatus || user.stripeConnectStatus || '';
      setFirestoreStripeStatus(raw);
    } catch (caughtError) {
      console.warn('Payout sheet: could not reload trainer Stripe fields:', caughtError?.message || caughtError);
    }
  }, [trainerUid]);

  useEffect(() => {
    if (!visible) return undefined;
    reloadTrainerStripeFields();
    return undefined;
  }, [visible, reloadTrainerStripeFields]);

  useEffect(() => {
    applyStripePhaseToPopup(stripeConnect.phase, stripeConnect.error, {
      setStatus,
      setLoading,
      setErrorMessage,
    });
  }, [stripeConnect.phase, stripeConnect.error]);

  useEffect(() => {
    if (status !== 'verifying') {
      setPendingTimedOut(false);
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      return;
    }
    pendingTimerRef.current = setTimeout(() => {
      setPendingTimedOut(true);
      setLoading(false);
    }, PENDING_DONE_MS);
    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, [status]);

  const resolvedStripeStatus = useMemo(() => {
    if (status === 'success' || stripeConnect.phase === 'active') return 'active';
    if (status === 'verifying' || stripeConnect.phase === 'pending') return 'pending';
  // vocab: stripeAccountId alone does not mean payouts work — resolveStripeStatus reads status fields.
    return resolveStripeStatus({
      stripeStatus: firestoreStripeStatus,
      stripeConnectStatus: firestoreStripeStatus,
      stripeAccountId: stripeAccountId || undefined,
    });
  }, [status, stripeConnect.phase, firestoreStripeStatus, stripeAccountId]);

  const steps = useMemo(() => payoutStepSpecs(resolvedStripeStatus), [resolvedStripeStatus]);
  const showStatusPill = resolvedStripeStatus === 'pending';
  const showConnecting = status === 'connecting';
  const showVerifyingSpinner = status === 'verifying' && !pendingTimedOut && loading;

  const handleSetupNow = useCallback(async () => {
    setErrorMessage(null);
    setPendingTimedOut(false);
    setStatus('connecting');
    setLoading(true);
    try {
      await stripeConnect.startConnect();
    } catch (caughtError) {
      setStatus('error');
      setLoading(false);
      setErrorMessage(caughtError?.message || 'Connection failed, try again');
    }
  }, [stripeConnect]);

  const handleDismiss = useCallback(async () => {
    try {
      if (trainerUid) await dismissPayoutSetupReminderPopup(trainerUid);
    } catch (caughtError) {
      console.warn('Failed to save payment popup dismissal:', caughtError?.message || caughtError);
    }
    onClose?.();
  }, [onClose, trainerUid]);

  const handleDone = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleRefreshStatus = useCallback(async () => {
    setRefreshingStripe(true);
    setErrorMessage(null);
    try {
      await verifyStripeConnectStatus();
      await stripeConnect.pollStatus();
      await reloadTrainerStripeFields();
    } catch (caughtError) {
      setErrorMessage(caughtError?.message || 'Could not refresh. Try Finish setup.');
    } finally {
      setRefreshingStripe(false);
    }
  }, [stripeConnect, reloadTrainerStripeFields]);

  const handleFinishSetup = useCallback(() => {
    if (status === 'error') {
      setErrorMessage(null);
      setStatus(null);
      stripeConnect.retry();
      return;
    }
    handleSetupNow();
  }, [handleSetupNow, status, stripeConnect]);

  if (!visible) return null;

  const footerBusy = loading || refreshingStripe || showConnecting;
  const showSuccess = status === 'success' || resolvedStripeStatus === 'active';

  return (
    <>
      <NbSheet visible={visible} onClose={handleDismiss}>
        <View style={styles.sheetBody}>
          {showStatusPill ? <StatusPill label={SHEET_COPY.pillPending} /> : null}

          <Text style={[styles.sheetTitle, { color: colors.nbInk }]}>{SHEET_COPY.title}</Text>
          <Text style={[styles.sheetBodyText, { color: colors.nbMuted }]}>{SHEET_COPY.body}</Text>

          <PayoutStepTimeline steps={steps} colors={colors} />

          {showConnecting || showVerifyingSpinner ? (
            <View style={styles.statusBlock}>
              <ActivityIndicator size="small" color={colors.nbInk} />
              <Text style={[styles.statusHint, { color: colors.nbMuted }]}>
                {showConnecting ? 'Opening secure Stripe form…' : 'Checking verification status…'}
              </Text>
            </View>
          ) : null}

          {errorMessage ? (
            <Text style={[styles.errorText, { color: colors.error }]}>{errorMessage}</Text>
          ) : null}

          {showSuccess ? (
            <View style={styles.successBlock}>
              <Text style={[styles.successText, { color: colors.nbInk }]}>Payout setup complete.</Text>
              <NbButton variant="fill" onPress={handleDone} style={styles.successBtn}>
                Done
              </NbButton>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <NbButton
                variant="ghost"
                onPress={handleRefreshStatus}
                disabled={footerBusy}
                style={styles.actionGhost}
              >
                {refreshingStripe ? 'Loading…' : 'Refresh status'}
              </NbButton>
              <NbButton
                variant="fill"
                onPress={handleFinishSetup}
                disabled={footerBusy}
                style={styles.actionFill}
              >
                {loading ? 'Loading…' : 'Finish setup'}
              </NbButton>
            </View>
          )}
        </View>
      </NbSheet>

      <TrainerPayoutSetupPopup
        visible={!!stripeConnect.webViewUrl}
        url={stripeConnect.webViewUrl}
        title="Connect with Stripe"
        isDark={isDark}
        onClose={() => stripeConnect.closeWebView({ userClosed: true })}
        onComplete={stripeConnect.handleWebViewComplete}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheetBody: {
    paddingBottom: spacing.sm,
    gap: 12,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderWidth: nb.borderWidthPill,
    borderRadius: borderRadius.round,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: 'center',
  },
  statusPillText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    fontWeight: '800',
  },
  sheetTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  sheetBodyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  timeline: {
    marginTop: 4,
    marginBottom: 8,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepRail: {
    width: 32,
    alignItems: 'center',
    paddingBottom: 4,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    fontWeight: '800',
  },
  stepConnector: {
    width: 3,
    flex: 1,
    minHeight: 16,
    marginVertical: 4,
  },
  stepText: {
    flex: 1,
    paddingBottom: 10,
  },
  stepTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    fontWeight: '800',
  },
  stepSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  statusBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  statusHint: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    flex: 1,
  },
  errorText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  actionGhost: {
    flex: 1,
  },
  actionFill: {
    flex: 1.2,
  },
  successBlock: {
    gap: 12,
    marginTop: 8,
  },
  successText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  successBtn: {
    width: '100%',
  },
});
