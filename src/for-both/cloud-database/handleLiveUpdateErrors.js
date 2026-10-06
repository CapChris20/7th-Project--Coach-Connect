// Decides which Firestore listener errors are a normal sign-out and which ones to print.
// Flow: check the error code → skip permission-denied → otherwise log it.
// Used by: live listeners. A signed-out user is expected to be rejected, so that must not look like a crash.

// ===== NAMED CONSTANTS =====

const PERMISSION_DENIED_CODE = 'permission-denied';
const INSUFFICIENT_PERMISSIONS_TEXT = 'insufficient permissions';

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * True when Firestore rejected the request. That happens during and after sign-out.
 * @param {Error|{ code?: string, message?: string }} firestoreError
 * @returns {boolean}
 */
export function isFirestorePermissionDenied(firestoreError) {
  const errorCode = String(firestoreError?.code || '');
  const errorMessage = String(firestoreError?.message || '').toLowerCase();
  const isPermissionDenied = errorCode === PERMISSION_DENIED_CODE;
  const messageSaysInsufficient = errorMessage.includes(INSUFFICIENT_PERMISSIONS_TEXT);
  return isPermissionDenied || messageSaysInsufficient;
}

/**
 * Log a snapshot error, except the permission denial we expect at sign-out.
 * @param {Error} firestoreError
 * @param {string} [label]
 * @returns {void}
 */
export function logSnapshotError(firestoreError, label) {
  if (isFirestorePermissionDenied(firestoreError)) return;
  if (label) console.error(label, firestoreError);
  else console.error(firestoreError);
}
