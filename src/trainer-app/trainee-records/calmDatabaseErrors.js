// Noise filter for trainer-side Firestore listeners.
// Flow: listener onError hands us an error → we decide “flicker” vs real bug.
// Used by: trainer roster + client-detail listeners, so a dropped connection
// does not flash an error screen while auth or rules are still settling.
// Read order: constants → isBenignTrainerClientFirestoreError → PLUMBING.

// ===== NAMED CONSTANTS =====

// Firestore error.code values we treat as “try again quietly.”
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

/**
 * True when this Firestore error is a flicker, not a bug.
 * Auth settling, offline, and a rules re-check all throw these.
 * @param {Error|string|null|undefined} firestoreError
 * @returns {boolean}
 */
export function isBenignTrainerClientFirestoreError(firestoreError) {
  // vocab: ?. = read .code only when the error object exists (no throw on null).
  const errorCode = firestoreError?.code || '';
  const errorMessage = String(firestoreError?.message || firestoreError || '');

  // 1. Known benign codes (permission settling, offline / unavailable).
  if (codeIsOnBenignList(errorCode)) {
    return true;
  }

  // 2. Message text that matches a known flicker string.
  if (messageLooksBenign(errorMessage)) {
    return true;
  }

  return false;
}

// PLUMBING — skip unless debugging

function codeIsOnBenignList(errorCode) {
  for (let index = 0; index < BENIGN_FIRESTORE_CODES.length; index += 1) {
    const benignCode = BENIGN_FIRESTORE_CODES[index];
    if (benignCode === errorCode) {
      return true;
    }
  }
  return false;
}

function messageLooksBenign(errorMessage) {
  for (let index = 0; index < BENIGN_MESSAGE_SNIPPETS.length; index += 1) {
    const snippet = BENIGN_MESSAGE_SNIPPETS[index];
    if (errorMessage.includes(snippet)) {
      return true;
    }
  }
  return false;
}
