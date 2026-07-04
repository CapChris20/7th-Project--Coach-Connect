/**
 * Shared Stripe Connect onboarding flow (create account → WebView → poll status).
 *
 * Purpose: Reuse connect + verify polling in payment popup, settings/payments, and legacy step 4.
 * Why it matters: One implementation for bank setup everywhere in the app.
 * Area: src/shared
 * Key exports: useStripeConnectFlow
 *
 * @file-header
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createStripeConnectAccount, verifyStripeConnectStatus } from '../api/stripeConnectApi';

const POLL_MS = 5000;
const MAX_POLLS = 48; // ~4 minutes while pending

/**
 * @param {{ email: string, onActive?: () => void }} options
 */
export function useStripeConnectFlow({ email, onActive } = {}) {
  const [phase, setPhase] = useState('idle'); // idle | connecting | pending | active | error
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
      const result = await verifyStripeConnectStatus();
      if (result?.status === 'active') {
        clearPoll();
        setPhase('active');
        setError(null);
        onActive?.(result);
        return true;
      }
      setPhase('pending');
      return false;
    } catch (e) {
      clearPoll();
      setPhase('error');
      setError(e?.message || 'Stripe connection failed, try again');
      return false;
    }
  }, [clearPoll, onActive]);

  const startPolling = useCallback(() => {
    clearPoll();
    pollCountRef.current = 0;
    setPhase('pending');
    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      const done = await pollStatus();
      if (done || pollCountRef.current >= MAX_POLLS) {
        clearPoll();
        if (!done && pollCountRef.current >= MAX_POLLS) {
          setPhase('pending');
        }
      }
    }, POLL_MS);
    pollStatus();
  }, [clearPoll, pollStatus]);

  const startConnect = useCallback(async () => {
    setError(null);
    userClosedRef.current = false;
    setPhase('connecting');
    try {
      const trimmedEmail = String(email || '').trim();
      if (!trimmedEmail) {
        throw new Error('Email is required to connect your bank account.');
      }
      const { url } = await createStripeConnectAccount(trimmedEmail);
      if (!url) throw new Error('Stripe connection failed, try again');
      setWebViewUrl(url);
    } catch (e) {
      setPhase('error');
      const msg = e?.message || '';
      if (e?.code === 'network_error' || /network request failed|timeout|aborted/i.test(msg)) {
        setError('Connection failed, try again');
      } else {
        setError(msg || 'Stripe connection failed, try again');
      }
    }
  }, [email]);

  const closeWebView = useCallback(
    ({ userClosed = false } = {}) => {
      setWebViewUrl(null);
      if (userClosed) {
        userClosedRef.current = true;
        setPhase('error');
        setError('You closed the form. Tap to try again.');
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
    setPhase('idle');
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
