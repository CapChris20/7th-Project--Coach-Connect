// Decides which Firestore listener errors are a normal sign-out and which ones to print.
// Flow: read code + message → treat permission-denied as quiet → otherwise console.error.
// Used by live onSnapshot listeners. A signed-out user is expected to be rejected.

// ===== NAMED CONSTANTS =====

// Freeze: Firestore error code letters must stay permission-denied.
const PERMISSION_DENIED_CODE = 'permission-denied';
// Freeze: some wrappers drop the code and only keep this sentence fragment.
const INSUFFICIENT_PERMISSIONS_TEXT = 'insufficient permissions';

// ===== MAIN FUNCTION =====

/**
 * True when Firestore rejected the request. That happens during and after sign-out.
 * @param {Error|{ code?: string, message?: string }} firestoreError
 * @returns {boolean}
 */
export function isFirestorePermissionDenied(firestoreError) {
  // 1. Turn code and message into plain strings (empty when missing).
  const errorCode = codeFromError(firestoreError);
  const errorMessageLower = messageFromErrorLower(firestoreError);

  // 2. Official code wins; otherwise look for the wrapper sentence.
  if (errorCode === PERMISSION_DENIED_CODE) {
    return true;
  }
  if (errorMessageLower.includes(INSUFFICIENT_PERMISSIONS_TEXT)) {
    return true;
  }
  return false;
}

/**
 * Log a snapshot error, except the permission denial we expect at sign-out.
 * @param {Error} firestoreError
 * @param {string} [label]
 * @returns {void}
 */
export function logSnapshotError(firestoreError, label) {
  // 1. Sign-out permission denial is expected — stay quiet.
  if (isFirestorePermissionDenied(firestoreError)) {
    return;
  }

  // 2. Everything else is a real listener failure — print it.
  if (label) {
    console.error(label, firestoreError);
    return;
  }
  console.error(firestoreError);
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless a new wrapper shape sneaks past the matcher.

function codeFromError(firestoreError) {
  if (!firestoreError) {
    return '';
  }
  if (firestoreError.code == null) {
    return '';
  }
  return String(firestoreError.code);
}

function messageFromErrorLower(firestoreError) {
  if (!firestoreError) {
    return '';
  }
  if (firestoreError.message == null) {
    return '';
  }
  return String(firestoreError.message).toLowerCase();
}
