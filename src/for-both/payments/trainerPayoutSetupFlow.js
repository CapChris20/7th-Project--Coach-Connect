// Shared Stripe Connect onboarding flow (create account → WebView → poll status).
// Flow: startConnect opens the Stripe form → closeWebView starts polling → active calls onActive.
// Used by the payment popup, settings/payments, and legacy step 4 so bank setup is one implementation.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createStripeConnectAccount, verifyStripeConnectStatus } from '../payments/trainerPayoutSetup';

// ===== NAMED CONSTANTS =====

// Manipulate here: how often we ask the server “is Stripe active yet?”
const POLL_MS = 5000;
// Manipulate here: 48 × 5s ≈ 4 minutes of pending polls before we stop the interval.
const MAX_POLLS = 48;
const PHASE_IDLE = 'idle';
const PHASE_CONNECTING = 'connecting';
const PHASE_PENDING = 'pending';
const PHASE_ACTIVE = 'active';
const PHASE_ERROR = 'error';
const STRIPE_STATUS_ACTIVE = 'active';
const NETWORK_ERROR_CODE = 'network_error';
const EMAIL_REQUIRED_MESSAGE = 'Email is required to connect your bank account.';
const STRIPE_FAILED_MESSAGE = 'Stripe connection failed, try again';
const CONNECTION_FAILED_MESSAGE = 'Connection failed, try again';
const FORM_CLOSED_MESSAGE = 'You closed the form. Tap to try again.';

// ===== HELPER FUNCTIONS =====

/**
 * True when the failure looks like offline / timeout (show the soft “try again” copy).
 * @param {Error|object|null|undefined} caughtError
 * @returns {boolean}
 */
function isNetworkConnectError(caughtError) {
  let errorMessage = '';
  if (caughtError && caughtError.message) {
    errorMessage = caughtError.message;
  }
  let hasNetworkCode = false;
  if (caughtError && caughtError.code === NETWORK_ERROR_CODE) {
    hasNetworkCode = true;
  }
  const looksLikeNetworkText = /network request failed|timeout|aborted/i.test(errorMessage);
  if (hasNetworkCode) {
    return true;
  }
  if (looksLikeNetworkText) {
    return true;
  }
  return false;
}

/**
 * Human message for a failed connect attempt.
 * @param {Error|object|null|undefined} caughtError
 * @returns {string}
 */
function connectErrorMessage(caughtError) {
  if (isNetworkConnectError(caughtError)) {
    return CONNECTION_FAILED_MESSAGE;
  }
  if (caughtError && caughtError.message) {
    return caughtError.message;
  }
  return STRIPE_FAILED_MESSAGE;
}

/**
 * Stop the interval and reset the poll counter.
 * @param {{ current: ReturnType<typeof setInterval>|null }} pollTimerRef
 * @param {{ current: number }} pollCountRef
 */
function stopPollTimer(pollTimerRef, pollCountRef) {
  if (pollTimerRef.current) {
    clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
  }
  pollCountRef.current = 0;
}

function verifyResultSaysActive(verifyResult) {
  if (!verifyResult) {
    return false;
  }
  return verifyResult.status === STRIPE_STATUS_ACTIVE;
}

function markPollActiveAndNotify(verifyResult, pollContext) {
  pollContext.clearPoll();
  pollContext.setPhase(PHASE_ACTIVE);
  pollContext.setError(null);
  if (pollContext.onActive) {
    pollContext.onActive(verifyResult);
  }
}

function markPollFailed(caughtError, pollContext) {
  pollContext.clearPoll();
  pollContext.setPhase(PHASE_ERROR);
  let errorText = STRIPE_FAILED_MESSAGE;
  if (caughtError && caughtError.message) {
    errorText = caughtError.message;
  }
  pollContext.setError(errorText);
}

/**
 * One poll tick: active → stop and notify; otherwise stay pending.
 * @param {{ clearPoll: Function, onActive?: Function, setPhase: Function, setError: Function }} pollContext
 * @returns {Promise<boolean>} true when Stripe reports active
 */
async function runSingleStatusPoll(pollContext) {
  try {
    const verifyResult = await verifyStripeConnectStatus();
    if (verifyResultSaysActive(verifyResult)) {
      markPollActiveAndNotify(verifyResult, pollContext);
      return true;
    }
    pollContext.setPhase(PHASE_PENDING);
    return false;
  } catch (caughtError) {
    markPollFailed(caughtError, pollContext);
    return false;
  }
}

// ===== MAIN FUNCTION =====

/**
 * Hook: create Stripe Connect account, open hosted form, poll until active.
 * Hook order (frozen): phase/error/url state → poll refs → clearPoll → cleanup effect →
 * pollStatus → startPolling → startConnect → closeWebView → handleWebViewComplete → retry.
 *
 * @param {{ email: string, onActive?: Function }} [options]
 * @returns {{
 *   phase: string,
 *   error: string|null,
 *   webViewUrl: string|null,
 *   startConnect: Function,
 *   closeWebView: Function,
 *   handleWebViewComplete: Function,
 *   retry: Function,
 *   pollStatus: Function,
 * }}
 */
export function trainerPayoutSetupFlow({ email, onActive } = {}) {
  const [phase, setPhase] = useState(PHASE_IDLE);
  const [error, setError] = useState(null);
  const [webViewUrl, setWebViewUrl] = useState(null);
  const pollTimerRef = useRef(null);
  const pollCountRef = useRef(0);
  const userClosedFormRef = useRef(false);

  const clearPoll = useCallback(() => {
    stopPollTimer(pollTimerRef, pollCountRef);
  }, []);

  // vocab: useEffect cleanup on unmount = clear the poll interval if the screen leaves mid-poll.
  useEffect(() => {
    return () => {
      clearPoll();
    };
  }, [clearPoll]);

  const pollStatus = useCallback(async () => {
    // 1. Ask the server whether Stripe finished verifying.
    return runSingleStatusPoll({
      clearPoll: clearPoll,
      onActive: onActive,
      setPhase: setPhase,
      setError: setError,
    });
  }, [clearPoll, onActive]);

  const startPolling = useCallback(() => {
    // 1. Reset any old interval, mark pending, poll immediately, then every POLL_MS.
    clearPoll();
    pollCountRef.current = 0;
    setPhase(PHASE_PENDING);

    pollTimerRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      const didBecomeActive = await pollStatus();
      const hitPollLimit = pollCountRef.current >= MAX_POLLS;
      if (didBecomeActive || hitPollLimit) {
        clearPoll();
        if (!didBecomeActive && hitPollLimit) {
          // Stay on pending so the UI can offer Refresh — do not flip to error just for timeout.
          setPhase(PHASE_PENDING);
        }
      }
    }, POLL_MS);

    pollStatus();
  }, [clearPoll, pollStatus]);

  const startConnect = useCallback(async () => {
    // 1. Reset the last error and remember this tap was not a user-close.
    setError(null);
    userClosedFormRef.current = false;
    setPhase(PHASE_CONNECTING);

    try {
      // 2. Stripe needs an email. Blank is a hard stop, not a retry on another base.
      const trimmedEmail = String(email || '').trim();
      if (!trimmedEmail) {
        throw new Error(EMAIL_REQUIRED_MESSAGE);
      }

      // 3. Create the Connect account and open the hosted form URL.
      // vocab: createStripeConnectAccount = server creates Stripe Express account + returns onboarding url.
      const createResult = await createStripeConnectAccount(trimmedEmail);
      let hostedFormUrl = null;
      if (createResult) {
        hostedFormUrl = createResult.url;
      }
      if (!hostedFormUrl) {
        throw new Error(STRIPE_FAILED_MESSAGE);
      }
      setWebViewUrl(hostedFormUrl);
    } catch (caughtError) {
      setPhase(PHASE_ERROR);
      setError(connectErrorMessage(caughtError));
    }
  }, [email]);

  const closeWebView = useCallback(
    ({ userClosed = false } = {}) => {
      // 1. Hide the Stripe form.
      setWebViewUrl(null);

      // 2. They tapped Close → error + stop. Return/refresh URL → start polling.
      if (userClosed) {
        userClosedFormRef.current = true;
        setPhase(PHASE_ERROR);
        setError(FORM_CLOSED_MESSAGE);
        clearPoll();
        return;
      }
      startPolling();
    },
    [clearPoll, startPolling],
  );

  const handleWebViewComplete = useCallback(() => {
    closeWebView({ userClosed: false });
  }, [closeWebView]);

  const retry = useCallback(() => {
    setError(null);
    setPhase(PHASE_IDLE);
    startConnect();
  }, [startConnect]);

  return {
    phase: phase,
    error: error,
    webViewUrl: webViewUrl,
    startConnect: startConnect,
    closeWebView: closeWebView,
    handleWebViewComplete: handleWebViewComplete,
    retry: retry,
    pollStatus: pollStatus,
  };
}
