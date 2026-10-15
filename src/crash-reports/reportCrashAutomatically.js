// Sends a thrown value to the console and to monitoring, without ever throwing itself.
// Flow: turn the value into an Error → log it → capture it. The async function is the same work.
// Used by catch blocks across the app.

import { captureException } from '../for-both/online-connection/checkConnectionHealth';

// ===== NAMED CONSTANTS =====

const UNKNOWN_ERROR_MESSAGE = 'Unknown error';
const UNKNOWN_CONTEXT = 'unknown';

// ===== HELPER FUNCTIONS =====

function messageFromThrownValue(error) {
  if (error && error.message) return error.message;
  if (error && error.toString) return error.toString();
  return UNKNOWN_ERROR_MESSAGE;
}

function errorObjectForMonitoring(error, message) {
  if (error instanceof Error) return error;
  return new Error(message);
}

// ===== MAIN FUNCTION =====

/**
 * Log a thrown value and send it to monitoring. Never throws.
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
    const errorObject = errorObjectForMonitoring(error, message);
    captureException(errorObject, { context: contextLabel });
  } catch (ignoredError) {
    // A throw here would hide the original bug.
  }
}

/**
 * Same work as the sync reporter, so a catch block can await it.
 * @param {unknown} error
 * @param {string} [context]
 * @returns {Promise<void>}
 */
export async function reportCrashAutomatically(error, context) {
  reportCrashAutomaticallySync(error, context);
}
