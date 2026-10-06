// Sends a thrown value to the console and to monitoring, without ever throwing itself.
// Flow: turn the value into an Error → log it → capture it. The async function is the same work, so callers can await it.
// Used by: catch blocks across the app.

import { captureException } from '../for-both/online-connection/checkConnectionHealth';

// ===== NAMED CONSTANTS =====

const UNKNOWN_ERROR_MESSAGE = 'Unknown error';
const UNKNOWN_CONTEXT = 'unknown';

// ===== HELPER FUNCTIONS =====

/**
 * Callers throw strings, Firebase objects, and real Errors. This picks a message.
 * @param {unknown} error
 * @returns {string}
 */
function messageFromThrownValue(error) {
  if (error && error.message) return error.message;
  if (error && error.toString) return error.toString();
  return UNKNOWN_ERROR_MESSAGE;
}

// ===== MAIN FUNCTION =====

/**
 * The logger must not throw. A throw here would hide the original bug.
 * @param {unknown} error
 * @param {string} [context]
 * @returns {void}
 */
export function reportCrashAutomaticallySync(error, context) {
  try {
    const message = messageFromThrownValue(error);
    const contextLabel = context || UNKNOWN_CONTEXT;
    // eslint-disable-next-line no-console
    console.log(`🧾 reportCrashAutomaticallySync [${contextLabel}]:`, message);
    const errorObject = error instanceof Error ? error : new Error(message);
    captureException(errorObject, { context: contextLabel });
  } catch (_) {
    // Swallow on purpose. See the note above.
  }
}

/**
 * Same work as the sync reporter. The Promise lets a catch block await it.
 * @param {unknown} error
 * @param {string} [context]
 * @returns {Promise<void>}
 */
export async function reportCrashAutomatically(error, context) {
  reportCrashAutomaticallySync(error, context);
}
