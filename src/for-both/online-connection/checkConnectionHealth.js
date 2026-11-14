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

// Filled in after a successful Sentry.init. Null means “fall back to console only.”
let reportErrorThroughSentry = null;
let startupMonitoringFinished = false;

// ===== HELPER FUNCTIONS =====

function readSentryDsnFromEnvironment() {
  // vocab: process.env.EXPO_PUBLIC_* = values Expo inlines at build time for the client bundle.
  // A missing `process` (some test runners) must not crash startup.
  try {
    const processExists = typeof process !== 'undefined';
    const fromExpoPublic = processExists && process.env?.EXPO_PUBLIC_SENTRY_DSN;
    const fromGenericEnv = processExists && process.env?.SENTRY_DSN;
    return String(fromExpoPublic || fromGenericEnv || '').trim();
  } catch (_readError) {
    return '';
  }
}

function buildIsProductionNodeEnv() {
  if (typeof process === 'undefined') {
    return false;
  }
  return process.env?.NODE_ENV === PRODUCTION_NODE_ENV;
}

function decideWhetherToSkipSentryInstall(sentryDsn, runningProductionBuild) {
  if (!sentryDsn && runningProductionBuild && !__DEV__) {
    // eslint-disable-next-line no-console
    console.error(MISSING_DSN_PRODUCTION_MESSAGE);
    // Same as before: log, then still attempt install (do not return true here).
    return false;
  }
  if (!sentryDsn) {
    return true;
  }
  return false;
}

function copyExtraFieldsOntoSentryScope(scope, extraContext) {
  if (!extraContext) {
    return;
  }
  if (typeof extraContext !== 'object') {
    return;
  }
  const fieldEntries = Object.entries(extraContext);
  for (let entryIndex = 0; entryIndex < fieldEntries.length; entryIndex += 1) {
    const fieldName = fieldEntries[entryIndex][0];
    const fieldValue = fieldEntries[entryIndex][1];
    scope.setExtra(fieldName, fieldValue);
  }
}

function buildSentryReporter(Sentry) {
  // vocab: withScope = Sentry API that lets us attach extras for one event only
  return (error, extraContext) => {
    Sentry.withScope((scope) => {
      copyExtraFieldsOntoSentryScope(scope, extraContext);
      Sentry.captureException(error);
    });
  };
}

function tryToInstallSentryReporter(sentryDsn) {
  try {
    // eslint-disable-next-line global-require
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn: sentryDsn,
      enableInExpoDevelopment: false,
      debug: __DEV__,
    });
    reportErrorThroughSentry = buildSentryReporter(Sentry);
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

function tryReportErrorThroughSentry(error, context) {
  if (!reportErrorThroughSentry) {
    return false;
  }
  try {
    reportErrorThroughSentry(error, context);
    return true;
  } catch (_sentryFailure) {
    // Sentry itself failed — caller falls back to the console sink.
    return false;
  }
}

function printCapturedExceptionToConsole(error, extraContext) {
  // eslint-disable-next-line no-console
  console.error(CAPTURE_EXCEPTION_LOG_PREFIX, {
    message: error?.message,
    stack: error?.stack,
    ...extraContext,
  });
}

// ===== MAIN FUNCTION =====

/**
 * Run once at app launch (App.js). Safe when Sentry is not installed.
 * A second call is a no-op even when the DSN is missing.
 */
export function initMonitoring() {
  // 1. Only the first call does work — later calls bail immediately.
  if (startupMonitoringFinished) {
    return;
  }
  startupMonitoringFinished = true;

  // 2. Read DSN + whether this is a production Node env.
  const sentryDsn = readSentryDsnFromEnvironment();
  const runningProductionBuild = buildIsProductionNodeEnv();

  // 3. Production without a DSN logs an error but still continues into install
  //    (same branch shape as before). Any other missing DSN is a quiet no-op.
  const shouldSkipInstallForMissingDsn = decideWhetherToSkipSentryInstall(
    sentryDsn,
    runningProductionBuild,
  );
  if (shouldSkipInstallForMissingDsn) {
    return;
  }

  // 4. Require Sentry, init it, and store a reporter for captureException.
  tryToInstallSentryReporter(sentryDsn);
}

/**
 * Report one error to Sentry when configured; always can fall back to console logging.
 * @param {*} error
 * @param {object} [context]
 */
export function captureException(error, context = {}) {
  // 1. Prefer the live Sentry reporter when initMonitoring installed one.
  const sentThroughSentry = tryReportErrorThroughSentry(error, context);
  if (sentThroughSentry) {
    return;
  }

  // 2. Sentry missing or failed → print to console so the crash is not silent.
  printCapturedExceptionToConsole(error, context);
}

export default { initMonitoring, captureException };
