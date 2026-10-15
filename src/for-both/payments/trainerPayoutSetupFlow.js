// Shared Stripe Connect onboarding flow (create account → WebView → poll status).
// Flow: startConnect opens the Stripe form → closeWebView starts polling → active calls onActive.
// Used by the payment popup, settings/payments, and legacy step 4 so bank setup is one implementation.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createStripeConnectAccount, verifyStripeConnectStatus } from '../payments/trainerPayoutSetup';

// ===== NAMED CONSTANTS =====

const POLL_MS = 5000;
const MAX_POLLS = 48; // ~4 minutes while pending
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

function isNetworkConnectError(caughtError) {
  const errorMessage = caughtError?.message || '';
  return caughtError?.code === NETWORK_ERROR_CODE || /network request failed|timeout|aborted/i.test(errorMessage);
}

function connectErrorMessage(caughtError) {
  if (isNetworkConnectError(caughtError)) return CONNECTION_FAILED_MESSAGE;
  return caughtError?.message || STRIPE_FAILED_MESSAGE;
}

// ===== MAIN FUNCTION =====

/**
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
  const pollRef = useRef(null);
  const pollCountRef = useRef(0);
  const userClosedRef = useRef(false);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollCountRef.current = 0;
  }, []);

  useEffect(() => () => clearPoll(), [clearPoll]);

  const pollStatus = useCallback(async () => {
    try {
      // 1. Ask the server whether Stripe finished verifying.
      const result = await verifyStripeConnectStatus();

      // 2. Active → stop polling and tell the screen. Anything else stays pending.
      if (result?.status === STRIPE_STATUS_ACTIVE) {
        clearPoll();
        setPhase(PHASE_ACTIVE);
        setError(null);
        onActive?.(result);
        return true;
      }
      setPhase(PHASE_PENDING);
      return false;
    } catch (caughtError) {
      clearPoll();
      setPhase(PHASE_ERROR);
      setError(caughtError?.message || STRIPE_FAILED_MESSAGE);
      return false;
    }
  }, [clearPoll, onActive]);

  const startPolling = useCallback(() => {
    clearPoll();
    pollCountRef.current = 0;
    setPhase(PHASE_PENDING);
    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      const didBecomeActive = await pollStatus();
      if (didBecomeActive || pollCountRef.current >= MAX_POLLS) {
        clearPoll();
        if (!didBecomeActive && pollCountRef.current >= MAX_POLLS) {
          setPhase(PHASE_PENDING);
        }
      }
    }, POLL_MS);
    pollStatus();
  }, [clearPoll, pollStatus]);

  const startConnect = useCallback(async () => {
    // 1. Reset the last error and remember this tap was not a user-close.
    setError(null);
    userClosedRef.current = false;
    setPhase(PHASE_CONNECTING);
    try {
      // 2. Stripe needs an email. Blank is a hard stop, not a retry on another base.
      const trimmedEmail = String(email || '').trim();
      if (!trimmedEmail) {
        throw new Error(EMAIL_REQUIRED_MESSAGE);
      }

      // 3. Create the Connect account and open the hosted form URL.
      const { url } = await createStripeConnectAccount(trimmedEmail);
      if (!url) throw new Error(STRIPE_FAILED_MESSAGE);
      setWebViewUrl(url);
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
        userClosedRef.current = true;
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
    phase,
    error,
    webViewUrl,
    startConnect,
    closeWebView,
    handleWebViewComplete,
    retry,
    pollStatus,
  };
}
