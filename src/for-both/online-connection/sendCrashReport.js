// Dev-quiet logger. Errors always print and are forwarded to the crash sink.
// Flow: debug / info / warn print only in development → error always prints and calls captureException.
// Used by: API calls, food search, the coach screen, and the crash boundary.

import { captureException } from './checkConnectionHealth';

// ===== NAMED CONSTANTS =====

const DEBUG_PREFIX = '[DEBUG]';
const INFO_PREFIX = '[INFO]';
const ERROR_PREFIX = '[ERROR]';
const WARN_PREFIX = '[WARN]';
const EMPTY_LOG_DATA = '';

// ===== HELPER FUNCTIONS =====

// A missing second argument prints as a blank string so the console line does not say "undefined".
// null and 0 are real values and must stay visible.
function secondArgumentOrBlank(logData) {
  if (logData === undefined) return EMPTY_LOG_DATA;
  return logData;
}

// captureException wants an Error. A string or a missing value becomes an Error whose text is the log line.
function errorInstanceForCrashSink(firstArgument, secondArgument) {
  if (firstArgument instanceof Error) return firstArgument;
  // vocab/symbol: ?? = use right side only when left is null or undefined (0 / '' stay)
  return new Error(String(firstArgument ?? secondArgument));
}

function printDebugInDevelopmentOnly(message, logData) {
  // vocab: __DEV__ = Metro/Expo flag that is true in local builds, false in store builds
  if (!__DEV__) return;
  // eslint-disable-next-line no-console -- dev-only sink
  console.log(`${DEBUG_PREFIX} ${message}`, secondArgumentOrBlank(logData));
}

function printInfoInDevelopmentOnly(message, logData) {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console -- dev-only sink
  console.log(`${INFO_PREFIX} ${message}`, secondArgumentOrBlank(logData));
}

function printWarnInDevelopmentOnly(message, logData) {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console -- dev-only sink
  console.warn(`${WARN_PREFIX} ${message}`, secondArgumentOrBlank(logData));
}

function printErrorAndForwardToCrashSink(message, error, context = {}) {
  // Argument order matches existing callers:
  // some pass (message, error), and the crash boundary passes (error, context).
  // eslint-disable-next-line no-console -- errors must surface in prod
  console.error(`${ERROR_PREFIX} ${message}`, {
    message: error?.message,
    stack: error?.stack,
    ...context,
  });

  const errorForSink = errorInstanceForCrashSink(error, message);
  // vocab: captureException = send this Error to Sentry when checkConnectionHealth configured a DSN
  captureException(errorForSink, { logMessage: message, ...context });
}

// ===== MAIN FUNCTION =====

// 1. Non-error channels stay dev-only so production logs stay small.
// 2. error always prints, then forwards an Error to checkConnectionHealth.captureException.
/**
 * Shared app logger. Same method names as before (debug / info / error / warn).
 */
export const logger = {
  debug: printDebugInDevelopmentOnly,
  info: printInfoInDevelopmentOnly,
  error: printErrorAndForwardToCrashSink,
  warn: printWarnInDevelopmentOnly,
};

export default logger;
