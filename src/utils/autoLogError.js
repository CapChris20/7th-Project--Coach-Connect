/**
 * Lightweight error logger used across the app.
 *
 * This file exists because several services `require('../../utils/autoLogError')`
 * inside try/catch blocks. If the module is missing, Metro can compile the require
 * to `require(undefined)` which triggers:
 * "Error: Requiring unknown module \"undefined\""
 *
 * Keep this implementation intentionally minimal and dependency-free.
 */

export function autoLogErrorSync(error, context) {
  try {
    const message =
      (error && (error.message || error.toString && error.toString())) || 'Unknown error';
    // eslint-disable-next-line no-console
    console.log(`🧾 autoLogErrorSync [${context || 'unknown'}]:`, message);
  } catch (e) {
    // no-op
  }
}

export async function autoLogError(error, context) {
  autoLogErrorSync(error, context);
}




