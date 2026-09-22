/**
 * logger
 *
 * Purpose: Data/service layer: logger. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: logger
 *
 * @file-header
 */
/**
 * Centralized logging for CoachConnect.
 * - debug/info: development only
 * - warn: development only (keeps production logs quiet)
 * - error: always emitted; forwarded to Sentry when configured (see monitoring.js)
 */
import { captureException } from './monitorAppHealth';

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
    const errObj = error instanceof Error ? error : new Error(String(error ?? message));
    captureException(errObj, { logMessage: message, ...context });
  },

  warn: (message, data) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console -- dev-only sink
      console.warn(`[WARN] ${message}`, data !== undefined ? data : '');
    }
  },
};

export default logger;
