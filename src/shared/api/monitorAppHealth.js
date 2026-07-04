/**
 * monitoring
 *
 * Purpose: Data/service layer: monitoring. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: initMonitoring, captureException
 *
 * @file-header
 */
/**
 * Optional crash reporting — no-op until EXPO_PUBLIC_SENTRY_DSN is set and @sentry/react-native is installed.
 * See docs/MONITORING.md for setup.
 */
let sentryCapture = null;
let initialized = false;

function getClientDsn() {
  try {
    return (
      (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SENTRY_DSN) ||
      (typeof process !== 'undefined' && process.env?.SENTRY_DSN) ||
      ''
    ).trim();
  } catch (_) {
    return '';
  }
}

/**
 * Call once at app startup (App.js). Safe if Sentry is not installed.
 */
export function initMonitoring() {
  if (initialized) return;
  initialized = true;

  const dsn = getClientDsn();
  const isProd = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';

  if (!dsn && isProd && !__DEV__) {
    // eslint-disable-next-line no-console
    console.error('[ERROR] EXPO_PUBLIC_SENTRY_DSN is required in production builds');
  } else if (!dsn) {
    return;
  }

  try {
    // eslint-disable-next-line global-require
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn,
      enableInExpoDevelopment: false,
      debug: __DEV__,
    });
    sentryCapture = (error, context) => {
      Sentry.withScope((scope) => {
        if (context && typeof context === 'object') {
          Object.entries(context).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
        }
        Sentry.captureException(error);
      });
    };
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[INFO] Monitoring: Sentry initialized');
    }
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(
        '[WARN] Monitoring: DSN set but @sentry/react-native not installed',
        err?.message || err,
      );
    }
  }
}

/**
 * Report an error to Sentry when configured; always logs via logger in production paths.
 */
export function captureException(error, context = {}) {
  if (sentryCapture) {
    try {
      sentryCapture(error, context);
      return;
    } catch (_) {
      // fall through to logger
    }
  }
  // eslint-disable-next-line no-console
  console.error('[ERROR] captureException', {
    message: error?.message,
    stack: error?.stack,
    ...context,
  });
}

export default { initMonitoring, captureException };
