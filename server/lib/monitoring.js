/**
 * Optional server crash reporting — no-op until SENTRY_DSN is set and @sentry/node is installed.
 */
const logger = require('./logger');

let capture = null;
let initialized = false;

function initServerMonitoring() {
  if (initialized) return;
  initialized = true;

  const dsn = String(process.env.SENTRY_DSN || '').trim();
  const isProd = process.env.NODE_ENV === 'production' && !!process.env.K_SERVICE;

  if (!dsn && isProd) {
    logger.error('SENTRY_DSN is required in production Cloud Run — errors will not be tracked');
  } else if (!dsn) {
    logger.warn('Sentry not configured; set SENTRY_DSN for crash reporting');
    return;
  }

  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
    capture = (error, context) => {
      Sentry.withScope((scope) => {
        if (context && typeof context === 'object') {
          Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
        }
        Sentry.captureException(error);
      });
    };
    logger.info('Server monitoring: Sentry initialized');
  } catch (err) {
    logger.warn('SENTRY_DSN set but @sentry/node not installed', err?.message || err);
  }
}

function captureServerException(error, context = {}) {
  if (capture) {
    try {
      capture(error, context);
      return;
    } catch (_) {
      // fall through
    }
  }
  logger.error('captureServerException', error?.message || error, context);
}

module.exports = { initServerMonitoring, captureServerException };
