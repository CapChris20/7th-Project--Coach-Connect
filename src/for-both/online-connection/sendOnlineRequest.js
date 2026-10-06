// Shared fetch helpers for Coach Connect API calls that must not hang forever.
// Flow: start a timer → fetch → if the timer wins, throw a timeout error → always clear the timer.
// Used by workout-plan generation and the other JSON posts that share this timeout.

import logger from '../online-connection/sendCrashReport';

// ===== NAMED CONSTANTS =====

// Manipulate here: callers can pass a shorter timeout. This is the fallback when they do not.
const DEFAULT_TIMEOUT_MS = 60000;
const ABORT_ERROR_NAME = 'AbortError';
const TIMEOUT_ERROR_CODE = 'timeout';
const HTTP_METHOD_POST = 'POST';
const MILLISECONDS_PER_SECOND = 1000;

// ===== HELPER FUNCTIONS =====

/**
 * A timer abort becomes an error with code "timeout". Every other failure is returned unchanged.
 * @param {Error} caughtError
 * @param {number} timeoutMs
 * @returns {Error}
 */
function errorForFailedFetch(caughtError, timeoutMs) {
  if (caughtError?.name !== ABORT_ERROR_NAME) {
    return caughtError;
  }
  const secondsWaited = Math.round(timeoutMs / MILLISECONDS_PER_SECOND);
  const timeoutError = new Error(`Request timed out after ${secondsWaited}s`);
  timeoutError.code = TIMEOUT_ERROR_CODE;
  return timeoutError;
}

// ===== MAIN FUNCTION =====

/**
 * Fetch a URL, then give up after timeoutMs so a stuck request cannot hang the screen.
 * @param {string} url
 * @param {RequestInit} [requestOptions]
 * @param {number} [timeoutMs]
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, requestOptions = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  // vocab: AbortController = a handle that can cancel this fetch through its signal.
  const abortController = new AbortController();
  const timeoutTimer = setTimeout(() => abortController.abort(), timeoutMs);
  try {
    // Our signal is last so the timer can cancel the request even if requestOptions brought its own.
    return await fetch(url, { ...requestOptions, signal: abortController.signal });
  } catch (caughtError) {
    throw errorForFailedFetch(caughtError, timeoutMs);
  } finally {
    // The timer has to die on success too. Otherwise it still fires and aborts a request that already finished.
    clearTimeout(timeoutTimer);
  }
}

/**
 * POST JSON and give up after timeoutMs. The timeout is optional; fetchWithTimeout fills in the default.
 * @param {string} url
 * @param {object} body
 * @param {object} headers
 * @param {number} [timeoutMs]
 * @returns {Promise<Response>}
 */
export async function postJsonWithTimeout(url, body, headers, timeoutMs) {
  return fetchWithTimeout(
    url,
    {
      method: HTTP_METHOD_POST,
      headers,
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
}

/**
 * Dev-only note when an API call fails. Production stays quiet.
 * @param {string} label
 * @param {string} url
 * @param {Error|string} error
 * @returns {void}
 */
export function logApiAttempt(label, url, error) {
  if (!__DEV__) return;
  logger.warn(`[api] ${label} failed`, {
    url,
    message: error?.message || String(error),
    code: error?.code,
  });
}
