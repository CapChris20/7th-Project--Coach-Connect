// Soft crash reporter — never throws, so a catch block can call it safely.
// Flow: turn whatever was thrown into a message → print it → hand a real Error to monitoring.
// Used by catch blocks across the app. Sync and async exports do the same work.

import { captureException } from '../for-both/online-connection/checkConnectionHealth';

// ===== NAMED CONSTANTS =====

const UNKNOWN_ERROR_MESSAGE = 'Unknown error';
const UNKNOWN_CONTEXT = 'unknown';

// ===== HELPER FUNCTIONS =====

function messageFromThrownValue(thrownValue) {
  if (thrownValue && thrownValue.message) return thrownValue.message;
  if (thrownValue && thrownValue.toString) return thrownValue.toString();
  return UNKNOWN_ERROR_MESSAGE;
}

function errorObjectForMonitoring(thrownValue, message) {
  if (thrownValue instanceof Error) return thrownValue;
  return new Error(message);
}

function printCrashLineToConsole(contextLabel, message) {
  // eslint-disable-next-line no-console
  console.log(`🧾 reportCrashAutomaticallySync [${contextLabel}]:`, message);
}

function sendCrashToMonitoring(errorObject, contextLabel) {
  captureException(errorObject, { context: contextLabel });
}

function contextLabelOrDefault(context) {
  if (context) return context;
  return UNKNOWN_CONTEXT;
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
    // 1. Normalize message and context so every crash line looks the same in Metro.
    const message = messageFromThrownValue(error);
    const contextLabel = contextLabelOrDefault(context);
    printCrashLineToConsole(contextLabel, message);

    // 2. Monitoring tools expect a real Error instance, not a plain string throw.
    const errorObject = errorObjectForMonitoring(error, message);
    sendCrashToMonitoring(errorObject, contextLabel);
  } catch (ignoredReporterFailure) {
    // A throw here would hide the original bug we are trying to report.
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
