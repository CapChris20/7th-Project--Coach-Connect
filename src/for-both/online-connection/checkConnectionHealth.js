// Optional crash reporting. No-op until EXPO_PUBLIC_SENTRY_DSN is set and @sentry/react-native is installed.
// Flow: read the DSN → init Sentry once at startup → later errors go to Sentry, or console.error if Sentry is missing.
// Used by: App.js (init once) and sendCrashReport / reportCrashAutomatically (captureException).

// ===== NAMED CONSTANTS =====

const PRODUCTION_NODE_ENV = 'production';
const MISSING_DSN_PRODUCTION_MESSAGE =
  '[ERROR] EXPO_PUBLIC_SENTRY_DSN is required in production builds';
const SENTRY_INITIALIZED_MESSAGE = '[INFO] Monitoring: Sentry initialized';
const SENTRY_NOT_INSTALLED_MESSAGE =
  '[WARN] Monitoring: DSN set but @sentry/react-native not installed';
const CAPTURE_EXCEPTION_LOG_PREFIX = '[ERROR] captureException';

// Module state: the capture function is filled in after a successful Sentry.init.
let captureWithSentry = null;
let isMonitoringInitialized = false;

// ===== HELPER FUNCTIONS =====

/**
 * Read the Sentry DSN from Expo public env, then the generic SENTRY_DSN fallback.
 * A missing `process` (some test runners) must not crash startup.
 * @returns {string}
 */
function getClientDsn() {
  try {
    return (
      (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SENTRY_DSN) ||
      (typeof process !== 'undefined' && process.env?.SENTRY_DSN) ||
      ''
    ).trim();
  } catch (_readError) {
    return '';
  }
}

/**
 * @returns {boolean}
 */
function isProductionNodeEnv() {
  return typeof process !== 'undefined' && process.env?.NODE_ENV === PRODUCTION_NODE_ENV;
}

/**
 * Attach caller-supplied extras onto the Sentry scope so the event is searchable.
 * @param {object} scope
 * @param {object} extraContext
 */
function attachSentryExtras(scope, extraContext) {
  if (!extraContext || typeof extraContext !== 'object') return;
  Object.entries(extraContext).forEach(([key, value]) => {
    scope.setExtra(key, value);
  });
}

/**
 * Build the function that reports one error to Sentry after init succeeds.
 * @param {object} Sentry
 * @returns {Function}
 */
function makeSentryCapture(Sentry) {
  return (error, extraContext) => {
    Sentry.withScope((scope) => {
      attachSentryExtras(scope, extraContext);
      Sentry.captureException(error);
    });
  };
}

/**
 * Always-on console fallback when Sentry is missing or itself threw.
 * @param {*} error
 * @param {object} extraContext
 */
function logCapturedException(error, extraContext) {
  // eslint-disable-next-line no-console
  console.error(CAPTURE_EXCEPTION_LOG_PREFIX, {
    message: error?.message,
    stack: error?.stack,
    ...extraContext,
  });
}

// ===== MAIN FUNCTION =====

/**
 * Call once at app startup (App.js). Safe if Sentry is not installed.
 * Marked initialized immediately so a second call is a no-op even when the DSN is missing.
 * @returns {void}
 */
export function initMonitoring() {
  if (isMonitoringInitialized) return;
  isMonitoringInitialized = true;

  const sentryDsn = getClientDsn();
  const isProduction = isProductionNodeEnv();

  if (!sentryDsn && isProduction && !__DEV__) {
    // eslint-disable-next-line no-console
    console.error(MISSING_DSN_PRODUCTION_MESSAGE);
  } else if (!sentryDsn) {
    return;
  }

  try {
    // eslint-disable-next-line global-require
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn: sentryDsn,
      enableInExpoDevelopment: false,
      debug: __DEV__,
    });
    captureWithSentry = makeSentryCapture(Sentry);
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(SENTRY_INITIALIZED_MESSAGE);
    }
  } catch (setupError) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(SENTRY_NOT_INSTALLED_MESSAGE, setupError?.message || setupError);
    }
  }
}

/**
 * Report an error to Sentry when configured; always logs via console in production paths.
 * @param {*} error
 * @param {object} [context]
 * @returns {void}
 */
export function captureException(error, context = {}) {
  if (captureWithSentry) {
    try {
      captureWithSentry(error, context);
      return;
    } catch (_sentryError) {
      // fall through to logger
    }
  }
  logCapturedException(error, context);
}

export default { initMonitoring, captureException };
