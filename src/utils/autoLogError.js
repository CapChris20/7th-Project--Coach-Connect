// One-liner error reporter called from catch blocks all over the app.
// Flow: anything thrown → normalize to a real Error → console.log for local dev → forward to monitoring (Sentry).
// Two shapes on purpose: a sync one for fire-and-forget, and an async wrapper so `await autoLogError(...)` reads naturally.

import { captureException } from '../for-both/api/monitorAppHealth';

// `context` is a short free-text tag (e.g. 'logFoodToFirestore') so you can tell
// where a crash came from in the monitoring dashboard.
export function autoLogErrorSync(error, context) {
  // The whole body is wrapped in try/catch because the *logger itself* must never
  // throw — if it did, it would replace the real bug with a confusing second one.
  try {
    // Callers throw all sorts of things (Errors, strings, Firebase objects, undefined),
    // so dig out the best available message before giving up on 'Unknown error'.
    // vocab/symbol: || = use the next option whenever the previous one is empty/falsy
    const message =
      (error && (error.message || (error.toString && error.toString()))) || 'Unknown error';
    // Local visibility while developing. Manipulate here: change the 🧾 prefix to grep logs differently
    // eslint-disable-next-line no-console
    console.log(`🧾 autoLogErrorSync [${context || 'unknown'}]:`, message);
    // Monitoring needs a real Error to capture a usable stack trace, so wrap plain values.
    // vocab: instanceof Error = "is this already a real Error object?"
    const errObj = error instanceof Error ? error : new Error(message);
    captureException(errObj, { context: context || 'unknown' });
  } catch (_) {
    // Swallow on purpose — see the note above about the logger never throwing.
  }
}

// Async-shaped alias. Does the same work synchronously; the Promise just lets call
// sites `await` it without special-casing, which keeps error paths uniform.
export async function autoLogError(error, context) {
  autoLogErrorSync(error, context);
}




