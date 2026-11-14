// Timed fetch helpers so Coach Connect API calls cannot hang the UI forever.
// Flow: arm a cancel timer → run fetch → on timer win, throw a timeout-shaped error → always disarm the timer.
// Used by: workout-plan generation and other JSON POSTs that share this timeout wrapper.

import logger from '../online-connection/sendCrashReport';

// ===== NAMED CONSTANTS =====

// Manipulate here: callers can pass a shorter ceiling; this is the default when they omit one.
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
function rewriteAbortAsTimeoutError(caughtError, timeoutMs) {
  const wasAbortedByOurTimer = caughtError?.name === ABORT_ERROR_NAME;
  if (!wasAbortedByOurTimer) return caughtError;

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
  // 1. Arm a cancel handle the timer can trip when the deadline passes.
  // vocab: AbortController = browser/RN object whose .signal cancels an in-flight fetch
  const cancelController = new AbortController();
  const deadlineTimer = setTimeout(() => {
    cancelController.abort();
  }, timeoutMs);

  try {
    // 2. Our signal wins last so a caller-supplied signal does not block our timeout.
    const response = await fetch(url, {
      ...requestOptions,
      signal: cancelController.signal,
    });
    return response;
  } catch (caughtError) {
    // 3. Turn a timer abort into a readable timeout error; leave real network errors alone.
    throw rewriteAbortAsTimeoutError(caughtError, timeoutMs);
  } finally {
    // 4. Disarm the timer on success too — otherwise it still fires after a finished request.
    clearTimeout(deadlineTimer);
  }
}

/**
 * POST JSON and give up after timeoutMs. Omitting timeoutMs uses fetchWithTimeout's default.
 * @param {string} url
 * @param {object} body
 * @param {object} headers
 * @param {number} [timeoutMs]
 * @returns {Promise<Response>}
 */
export async function postJsonWithTimeout(url, body, headers, timeoutMs) {
  // 1. Build the POST options once, then reuse the timed fetch path.
  const postOptions = {
    method: HTTP_METHOD_POST,
    headers,
    body: JSON.stringify(body),
  };
  return fetchWithTimeout(url, postOptions, timeoutMs);
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

  const errorMessage = error?.message || String(error);
  logger.warn(`[api] ${label} failed`, {
    url,
    message: errorMessage,
    code: error?.code,
  });
}
