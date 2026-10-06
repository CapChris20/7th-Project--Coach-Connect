// Noise filter for trainer-side Firestore listeners.
// Flow: a listener's onError hands us the error → we decide flicker versus a real bug.
// Used by: the trainer roster listeners, so a dropped connection does not show an error screen.

// ===== NAMED CONSTANTS =====

const PERMISSION_DENIED_CODE = 'permission-denied';
const UNAVAILABLE_CODE = 'unavailable';
const MISSING_PERMISSIONS_TEXT = 'Missing or insufficient permissions';
const FAILED_TO_GET_DOCUMENT_TEXT = 'Failed to get document';

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * True when this Firestore error is a flicker, not a bug.
 * Auth settling, offline, and a rules re-check all throw these.
 * @param {Error|string} firestoreError
 * @returns {boolean}
 */
export function isBenignTrainerClientFirestoreError(firestoreError) {
  // vocab: ?. reads .code only when the error object exists.
  const errorCode = firestoreError?.code || '';
  const errorMessage = String(firestoreError?.message || firestoreError || '');
  // Manipulate here: add a code or a snippet to silence another flicker.
  const isPermissionDenied = errorCode === PERMISSION_DENIED_CODE;
  const isUnavailable = errorCode === UNAVAILABLE_CODE;
  const messageIsBenign = errorMessage.includes(MISSING_PERMISSIONS_TEXT)
    || errorMessage.includes(FAILED_TO_GET_DOCUMENT_TEXT);
  return isPermissionDenied || isUnavailable || messageIsBenign;
}
