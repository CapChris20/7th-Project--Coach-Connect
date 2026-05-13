/**
 * Centralized logging for CoachConnect.
 * - debug/info: development only
 * - warn: development only (keeps production logs quiet)
 * - error: always emitted (Crashlytics/Sentry can hook in later)
 */

export const logger = {
  debug: (message, data) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console -- dev-only sink
      console.log(`[DEBUG] ${message}`, data !== undefined ? data : '');
    }
  },

  info: (message, data) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console -- dev-only sink
      console.log(`[INFO] ${message}`, data !== undefined ? data : '');
    }
  },

  error: (message, error, context = {}) => {
    // eslint-disable-next-line no-console -- errors must surface in prod
    console.error(`[ERROR] ${message}`, {
      message: error?.message,
      stack: error?.stack,
      ...context,
    });
  },

  warn: (message, data) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console -- dev-only sink
      console.warn(`[WARN] ${message}`, data !== undefined ? data : '');
    }
  },
};

export default logger;
