// Noise filter for trainer-side Firestore listeners.
// Flow: a listener's onError hands us the error → we decide flicker versus a real bug.
// Used by: the trainer roster listeners, so a dropped connection does not show an error screen.

// ===== NAMED CONSTANTS =====

const PERMISSION_DENIED_CODE = 'permission-denied';
const UNAVAILABLE_CODE = 'unavailable';

// Manipulate here: add a code to silence another flicker without hiding real bugs.
const BENIGN_FIRESTORE_CODES = [PERMISSION_DENIED_CODE, UNAVAILABLE_CODE];

const MISSING_PERMISSIONS_TEXT = 'Missing or insufficient permissions';
const FAILED_TO_GET_DOCUMENT_TEXT = 'Failed to get document';

// Manipulate here: add a message snippet when a new benign flicker shows up in logs.
const BENIGN_MESSAGE_SNIPPETS = [
  MISSING_PERMISSIONS_TEXT,
  FAILED_TO_GET_DOCUMENT_TEXT,
];

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} errorMessage
 * @returns {boolean}
 */
function messageLooksBenign(errorMessage) {
  for (let i = 0; i < BENIGN_MESSAGE_SNIPPETS.length; i += 1) {
    if (errorMessage.includes(BENIGN_MESSAGE_SNIPPETS[i])) return true;
  }
  return false;
}

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

  const codeIsBenign = BENIGN_FIRESTORE_CODES.includes(errorCode);
  if (codeIsBenign) return true;
  return messageLooksBenign(errorMessage);
}
