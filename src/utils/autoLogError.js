/**
 * auto Log Error
 *
 * Purpose: auto Log Error — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/utils
 * Key exports: autoLogErrorSync, autoLogError
 *
 * @file-header
 */
/**
 * Lightweight error logger used across the app.
 * Forwards to monitoring (Sentry when configured).
 */
import { captureException } from '../shared/api/monitorAppHealth';

export function autoLogErrorSync(error, context) {
  try {
    const message =
      (error && (error.message || (error.toString && error.toString()))) || 'Unknown error';
    // eslint-disable-next-line no-console
    console.log(`🧾 autoLogErrorSync [${context || 'unknown'}]:`, message);
    const errObj = error instanceof Error ? error : new Error(message);
    captureException(errObj, { context: context || 'unknown' });
  } catch (_) {
    // no-op
  }
}

export async function autoLogError(error, context) {
  autoLogErrorSync(error, context);
}




