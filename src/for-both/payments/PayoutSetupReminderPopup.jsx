// Design Law payout reminder — bottom sheet over trainer home (PNG 07/08).
// Flow: checklist → Refresh status / Finish setup → Stripe WebView via trainerPayoutSetupFlow.
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

const USERS_COLLECTION = 'users';
const STRIPE_WEBVIEW_TITLE = 'Connect with Stripe';
const CONNECT_FAILED_FALLBACK = 'Connection failed, try again';
const REFRESH_FAILED_FALLBACK = 'Could not refresh. Try Finish setup.';
const DISMISS_WARN_PREFIX = 'Failed to save payment popup dismissal:';
const RELOAD_WARN_PREFIX = 'Payout sheet: could not reload trainer Stripe fields:';

const STATUS_SUCCESS = 'success';
const STATUS_VERIFYING = 'verifying';
const STATUS_CONNECTING = 'connecting';
const STATUS_ERROR = 'error';
const RESOLVED_ACTIVE = 'active';
const RESOLVED_PENDING = 'pending';
const PHASE_CONNECTING = 'connecting';
const PHASE_PENDING = 'pending';
const PHASE_ACTIVE = 'active';
const PHASE_ERROR = 'error';

// ===== HELPER FUNCTIONS =====

/**
 * Clear the verifying timeout if one is armed.
 * @param {{ current: ReturnType<typeof setTimeout>|null }} pendingTimerRef
 */
function clearPendingTimer(pendingTimerRef) {
  if (pendingTimerRef.current) {
    clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = null;
  }
}

/**
 * Mirror shared-flow phase into this sheet's status / loading / error locals.
 * @param {string} phase
 * @param {string|null} stripeError
 * @param {{ setStatus: Function, setLoading: Function, setErrorMessage: Function }} setters
 */
function syncReminderUiToConnectPhase(phase, stripeError, setters) {
  if (phase === PHASE_CONNECTING) {
    setters.setStatus(STATUS_CONNECTING);
    setters.setLoading(true);
    setters.setErrorMessage(null);
    return;
  }
  if (phase === PHASE_PENDING) {
    setters.setStatus(STATUS_VERIFYING);
    setters.setLoading(true);
    setters.setErrorMessage(null);
    return;
  }
  if (phase === PHASE_ACTIVE) {
    setters.setStatus(STATUS_SUCCESS);
    setters.setLoading(false);
    return;
  }
  if (phase === PHASE_ERROR) {
    setters.setStatus(STATUS_ERROR);
    setters.setLoading(false);
    let message = CONNECT_FAILED_FALLBACK;
    if (stripeError) {
      message = stripeError;
    }
    setters.setErrorMessage(message);
  }
}

/**
 * Subtitle under the Verification checklist step.
 * @param {string} resolved
 * @returns {string}
 */
function verificationStepSubtitle(resolved) {
  if (resolved === RESOLVED_ACTIVE) {
    return 'Complete';
  }
  if (resolved === RESOLVED_PENDING) {
    return 'Under review. Try Refresh status in a minute.';
  }
  return 'Starts after bank details';
}

/**
 * Three checklist steps driven by resolved Stripe status (not started / pending / active).
 * @param {string} resolved
 * @returns {Array<{ key: string, title: string, subtitle: string, done: boolean, current: boolean }>}
 */
function buildPayoutChecklistSteps(resolved) {
  const pendingOrActive = resolved === RESOLVED_PENDING || resolved === RESOLVED_ACTIVE;
  const isFullyActive = resolved === RESOLVED_ACTIVE;

  let identitySubtitle = 'Complete in Stripe';
  if (pendingOrActive) {
    identitySubtitle = 'Verified';
  }

  let bankSubtitle = 'Add payout details';
  if (pendingOrActive) {
    bankSubtitle = 'Added';
  }

  return [
    {
      key: 'identity',
      title: 'Identity',
      subtitle: identitySubtitle,
      done: pendingOrActive,
      current: !pendingOrActive,
    },
    {
      key: 'bank',
      title: 'Bank account',
      subtitle: bankSubtitle,
      done: pendingOrActive,
      current: false,
    },
    {
      key: 'verification',
      title: 'Verification',
      subtitle: verificationStepSubtitle(resolved),
      done: isFullyActive,
      current: pendingOrActive && !isFullyActive,
    },
  ];
}

function readSignedInTrainerEmail(userEmail) {
  let emailFromAuth = '';
  if (auth && auth.currentUser && auth.currentUser.email) {
    emailFromAuth = auth.currentUser.email;
  }
  return String(userEmail || emailFromAuth || '').trim();
}

function readSignedInTrainerUid() {
  if (auth && auth.currentUser && auth.currentUser.uid) {
    return auth.currentUser.uid;
  }
  return '';
}

function errorMessageOrFallback(caughtError, fallbackMessage) {
  if (caughtError && caughtError.message) {
    return caughtError.message;
  }
  return fallbackMessage;
}

function stripeStatusFromUserDoc(userDoc) {
  if (userDoc.stripeStatus) {
    return userDoc.stripeStatus;
  }
  if (userDoc.stripeConnectStatus) {
    return userDoc.stripeConnectStatus;
  }
  return '';
}

async function readTrainerStripeStatusFromFirestore(trainerUid) {
  // vocab: getDoc(doc(db, 'users', uid)) = one-shot read of the trainer's Firestore user doc.
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, trainerUid));
  if (!snapshot.exists()) {
    return '';
  }
  const userDoc = snapshot.data() || {};
  return stripeStatusFromUserDoc(userDoc);
}

/**
 * Brand gradient pill shown while Stripe verification is still pending.
 */
function PendingStatusPill({ label }) {
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

/**
 * One checklist row: numbered/check dot + optional connector rail + title/subtitle.
 */
function ChecklistStepRow({ step, stepNumber, showConnectorBelow, colors }) {
  const stepIsFilled = step.done || step.current;
  let dotFill = colors.nbSurface;
  if (stepIsFilled) {
    dotFill = colors.nbFill;
  }

  let numberColor = colors.nbInk;
  if (step.current) {
    numberColor = colors.nbOnFill;
  }

  let connectorColor = colors.nbBorder;
  if (step.done) {
    connectorColor = colors.nbInk;
  }

  let connectorOpacity = 0.35;
  if (step.done) {
    connectorOpacity = 1;
  }

  let dotInner = (
    <Text style={[styles.stepNumber, { color: numberColor }]}>{stepNumber}</Text>
  );
  if (step.done) {
    dotInner = <Ionicons name="checkmark" size={16} color={colors.nbOnFill} />;
  }

  let connectorBelow = null;
  if (showConnectorBelow) {
    connectorBelow = (
      <View
        style={[
          styles.stepConnector,
          { backgroundColor: connectorColor, opacity: connectorOpacity },
        ]}
      />
    );
  }

  return (
    <View style={styles.stepRow}>
      <View style={styles.stepRail}>
        <View style={[styles.stepDot, { borderColor: colors.nbBorder, backgroundColor: dotFill }]}>
          {dotInner}
        </View>
        {connectorBelow}
      </View>
      <View style={styles.stepText}>
        <Text style={[styles.stepTitle, { color: colors.nbInk }]}>{step.title}</Text>
        <Text style={[styles.stepSub, { color: colors.nbMuted }]}>{step.subtitle}</Text>
      </View>
    </View>
  );
}

/**
 * Vertical Identity → Bank → Verification timeline.
 */
function PayoutChecklistTimeline({ steps, colors }) {
  const lastStepIndex = steps.length - 1;
  const rows = [];
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const showConnectorBelow = index !== lastStepIndex;
    rows.push(
      <ChecklistStepRow
        key={step.key}
        step={step}
        stepNumber={index + 1}
        showConnectorBelow={showConnectorBelow}
        colors={colors}
      />,
    );
  }
  return <View style={styles.timeline}>{rows}</View>;
}

/**
 * Spinner + copy while the hosted Stripe form is opening.
 */
function PayoutReminderConnectingRow({ showConnecting, colors }) {
  if (!showConnecting) {
    return null;
  }
  return (
    <View style={styles.statusBlock}>
      <ActivityIndicator size="small" color={colors.nbInk} />
      <Text style={[styles.statusHint, { color: colors.nbMuted }]}>
        Opening secure Stripe form…
      </Text>
    </View>
  );
}

/**
 * Spinner + copy while we wait on Stripe verification (before PENDING_DONE_MS timeout).
 */
function PayoutReminderVerifyingRow({ showVerifying, colors }) {
  if (!showVerifying) {
    return null;
  }
  return (
    <View style={styles.statusBlock}>
      <ActivityIndicator size="small" color={colors.nbInk} />
      <Text style={[styles.statusHint, { color: colors.nbMuted }]}>
        Checking verification status…
      </Text>
    </View>
  );
}

/**
 * Footer: success Done, or Refresh status + Finish setup (with optional error line).
 */
function PayoutReminderFooter({
  showSuccess,
  footerBusy,
  refreshingStripe,
  loading,
  errorMessage,
  onDone,
  onRefresh,
  onFinishSetup,
  colors,
}) {
  if (showSuccess) {
    return (
      <View style={styles.successBlock}>
        <Text style={[styles.successText, { color: colors.nbInk }]}>Payout setup complete.</Text>
        <NbButton variant="fill" onPress={onDone} style={styles.successBtn}>
          Done
        </NbButton>
      </View>
    );
  }

  let refreshLabel = 'Refresh status';
  if (refreshingStripe) {
    refreshLabel = 'Loading…';
  }

  let finishLabel = 'Finish setup';
  if (loading) {
    finishLabel = 'Loading…';
  }

  let errorLine = null;
  if (errorMessage) {
    errorLine = (
      <Text style={[styles.errorText, { color: colors.error }]}>{errorMessage}</Text>
    );
  }

  return (
    <>
      {errorLine}
      <View style={styles.actionRow}>
        <NbButton
          variant="ghost"
          onPress={onRefresh}
          disabled={footerBusy}
          style={styles.actionGhost}
        >
          {refreshLabel}
        </NbButton>
        <NbButton
          variant="fill"
          onPress={onFinishSetup}
          disabled={footerBusy}
          style={styles.actionFill}
        >
          {finishLabel}
        </NbButton>
      </View>
    </>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Bottom-sheet reminder that Stripe Connect payout setup is incomplete.
 * Hook order is frozen — do not reorder useState / useEffect / useMemo / useCallback.
 *
 * @param {{ visible: boolean, onClose?: Function, userEmail?: string, stripeAccountId?: string }} props
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

  const email = readSignedInTrainerEmail(userEmail);
  const trainerUid = readSignedInTrainerUid();

  // vocab: trainerPayoutSetupFlow = shared hook (create account → WebView → poll → active).
  const stripeConnect = trainerPayoutSetupFlow({
    email: email,
    onActive: () => {
      setStatus(STATUS_SUCCESS);
      setLoading(false);
      setErrorMessage(null);
      setFirestoreStripeStatus(RESOLVED_ACTIVE);
    },
  });

  const reloadTrainerStripeFields = useCallback(async () => {
    if (!trainerUid || !db) {
      return;
    }
    try {
      const savedStatus = await readTrainerStripeStatusFromFirestore(trainerUid);
      setFirestoreStripeStatus(savedStatus);
    } catch (caughtError) {
      console.warn(RELOAD_WARN_PREFIX, errorMessageOrFallback(caughtError, caughtError));
    }
  }, [trainerUid]);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    reloadTrainerStripeFields();
    return undefined;
  }, [visible, reloadTrainerStripeFields]);

  useEffect(() => {
    syncReminderUiToConnectPhase(stripeConnect.phase, stripeConnect.error, {
      setStatus: setStatus,
      setLoading: setLoading,
      setErrorMessage: setErrorMessage,
    });
  }, [stripeConnect.phase, stripeConnect.error]);

  useEffect(() => {
    const isVerifying = status === STATUS_VERIFYING;
    if (!isVerifying) {
      setPendingTimedOut(false);
      clearPendingTimer(pendingTimerRef);
      return;
    }
    pendingTimerRef.current = setTimeout(() => {
      setPendingTimedOut(true);
      setLoading(false);
    }, PENDING_DONE_MS);
    return () => {
      clearPendingTimer(pendingTimerRef);
    };
  }, [status]);

  const resolvedStripeStatus = useMemo(() => {
    if (status === STATUS_SUCCESS || stripeConnect.phase === PHASE_ACTIVE) {
      return RESOLVED_ACTIVE;
    }
    if (status === STATUS_VERIFYING || stripeConnect.phase === PHASE_PENDING) {
      return RESOLVED_PENDING;
    }
    // vocab: stripeAccountId alone does not mean payouts work — resolveStripeStatus reads status fields.
    let accountIdForResolve = undefined;
    if (stripeAccountId) {
      accountIdForResolve = stripeAccountId;
    }
    return resolveStripeStatus({
      stripeStatus: firestoreStripeStatus,
      stripeConnectStatus: firestoreStripeStatus,
      stripeAccountId: accountIdForResolve,
    });
  }, [status, stripeConnect.phase, firestoreStripeStatus, stripeAccountId]);

  const steps = useMemo(
    () => buildPayoutChecklistSteps(resolvedStripeStatus),
    [resolvedStripeStatus],
  );
  const showStatusPill = resolvedStripeStatus === RESOLVED_PENDING;
  const showConnecting = status === STATUS_CONNECTING;
  const showVerifyingSpinner = status === STATUS_VERIFYING && !pendingTimedOut && loading;

  const handleSetupNow = useCallback(async () => {
    // 1. Clear errors and show the connecting spinner.
    setErrorMessage(null);
    setPendingTimedOut(false);
    setStatus(STATUS_CONNECTING);
    setLoading(true);
    try {
      // 2. Open Stripe Connect (creates account + WebView URL inside the shared flow).
      await stripeConnect.startConnect();
    } catch (caughtError) {
      setStatus(STATUS_ERROR);
      setLoading(false);
      setErrorMessage(errorMessageOrFallback(caughtError, CONNECT_FAILED_FALLBACK));
    }
  }, [stripeConnect]);

  const handleDismiss = useCallback(async () => {
    // 1. Remember dismissal on the trainer doc so we do not nag again this session/cycle.
    try {
      if (trainerUid) {
        await dismissPayoutSetupReminderPopup(trainerUid);
      }
    } catch (caughtError) {
      console.warn(DISMISS_WARN_PREFIX, errorMessageOrFallback(caughtError, caughtError));
    }
    // 2. Close the sheet.
    if (onClose) {
      onClose();
    }
  }, [onClose, trainerUid]);

  const handleDone = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const handleRefreshStatus = useCallback(async () => {
    // 1. Ask Stripe + shared flow + Firestore for the latest status.
    setRefreshingStripe(true);
    setErrorMessage(null);
    try {
      await verifyStripeConnectStatus();
      await stripeConnect.pollStatus();
      await reloadTrainerStripeFields();
    } catch (caughtError) {
      setErrorMessage(errorMessageOrFallback(caughtError, REFRESH_FAILED_FALLBACK));
    } finally {
      setRefreshingStripe(false);
    }
  }, [stripeConnect, reloadTrainerStripeFields]);

  const handleFinishSetup = useCallback(() => {
    // 1. After an error, clear it and retry the shared flow; otherwise start Connect fresh.
    if (status === STATUS_ERROR) {
      setErrorMessage(null);
      setStatus(null);
      stripeConnect.retry();
      return;
    }
    handleSetupNow();
  }, [handleSetupNow, status, stripeConnect]);

  if (!visible) {
    return null;
  }

  const footerBusy = loading || refreshingStripe || showConnecting;
  const showSuccess = status === STATUS_SUCCESS || resolvedStripeStatus === RESOLVED_ACTIVE;
  const stripeWebViewIsOpen = Boolean(stripeConnect.webViewUrl);

  function handleStripeWebViewClose() {
    stripeConnect.closeWebView({ userClosed: true });
  }

  return (
    <>
      <NbSheet visible={visible} onClose={handleDismiss}>
        <View style={styles.sheetBody}>
          {showStatusPill ? <PendingStatusPill label={SHEET_COPY.pillPending} /> : null}

          <Text style={[styles.sheetTitle, { color: colors.nbInk }]}>{SHEET_COPY.title}</Text>
          <Text style={[styles.sheetBodyText, { color: colors.nbMuted }]}>{SHEET_COPY.body}</Text>

          <PayoutChecklistTimeline steps={steps} colors={colors} />

          <PayoutReminderConnectingRow showConnecting={showConnecting} colors={colors} />
          <PayoutReminderVerifyingRow showVerifying={showVerifyingSpinner} colors={colors} />

          <PayoutReminderFooter
            showSuccess={showSuccess}
            footerBusy={footerBusy}
            refreshingStripe={refreshingStripe}
            loading={loading}
            errorMessage={errorMessage}
            onDone={handleDone}
            onRefresh={handleRefreshStatus}
            onFinishSetup={handleFinishSetup}
            colors={colors}
          />
        </View>
      </NbSheet>

      <TrainerPayoutSetupPopup
        visible={stripeWebViewIsOpen}
        url={stripeConnect.webViewUrl}
        title={STRIPE_WEBVIEW_TITLE}
        isDark={isDark}
        onClose={handleStripeWebViewClose}
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
