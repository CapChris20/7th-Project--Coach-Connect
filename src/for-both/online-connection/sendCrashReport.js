// Dev-quiet logger. Errors always print and are forwarded to the crash sink.
// Flow: debug, info, and warn print only in development → error always prints and calls captureException.
// Used by API calls, food search, the coach screen, and the crash boundary.

import { captureException } from './checkConnectionHealth';

// ===== NAMED CONSTANTS =====

const DEBUG_PREFIX = '[DEBUG]';
const INFO_PREFIX = '[INFO]';
const ERROR_PREFIX = '[ERROR]';
const WARN_PREFIX = '[WARN]';
const EMPTY_LOG_DATA = '';

// ===== HELPER FUNCTIONS =====

/**
 * A missing second argument prints as a blank string so the console line does not say "undefined".
 * null and 0 are real values and are kept.
 * @param {*} logData
 * @returns {*}
 */
function logPayloadOrBlank(logData) {
  if (logData !== undefined) return logData;
  return EMPTY_LOG_DATA;
}

/**
 * captureException wants an Error. A string or a missing value becomes an Error whose text is the log line.
 * @param {*} error
 * @param {*} message
 * @returns {Error}
 */
function errorObjectForCapture(error, message) {
  if (error instanceof Error) return error;
  return new Error(String(error ?? message));
}

/**
 * Development-only debug line.
 * @param {*} message
 * @param {*} [logData]
 * @returns {void}
 */
function logDebug(message, logData) {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console -- dev-only sink
  console.log(`${DEBUG_PREFIX} ${message}`, logPayloadOrBlank(logData));
}

/**
 * Development-only info line.
 * @param {*} message
 * @param {*} [logData]
 * @returns {void}
 */
function logInfo(message, logData) {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console -- dev-only sink
  console.log(`${INFO_PREFIX} ${message}`, logPayloadOrBlank(logData));
}

/**
 * Always prints, then forwards an Error to the crash sink. The argument order matches existing callers:
 * some pass (message, error), and the crash boundary passes (error, context).
 * @param {*} message
 * @param {*} [error]
 * @param {object} [context]
 * @returns {void}
 */
function logError(message, error, context = {}) {
  // eslint-disable-next-line no-console -- errors must surface in prod
  console.error(`${ERROR_PREFIX} ${message}`, {
    message: error?.message,
    stack: error?.stack,
    ...context,
  });
  const errorObject = errorObjectForCapture(error, message);
  // vocab: captureException = send this Error to Sentry when that sink is configured.
  captureException(errorObject, { logMessage: message, ...context });
}

/**
 * Development-only warning. Production stays quiet.
 * @param {*} message
 * @param {*} [logData]
 * @returns {void}
 */
function logWarn(message, logData) {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console -- dev-only sink
  console.warn(`${WARN_PREFIX} ${message}`, logPayloadOrBlank(logData));
}

// ===== MAIN FUNCTION =====

export const logger = {
  debug: logDebug,
  info: logInfo,
  error: logError,
  warn: logWarn,
};

export default logger;
