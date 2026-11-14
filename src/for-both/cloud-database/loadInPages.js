// Firestore reads that still work while a composite index is building.
// Flow: try the indexed query → if Firestore asks for an index, run a capped fallback → sort docs in memory.
// Used by lists that cannot wait for the index to finish building.

import { getDocs, limit as firestoreLimit } from 'firebase/firestore';
import logger from '../online-connection/sendCrashReport';

// ===== NAMED CONSTANTS =====

// Freeze: Firestore reports a missing composite index with this code.
const INDEX_MISSING_CODE = 'failed-precondition';
// Freeze: the message text Firestore uses when an index is required.
const INDEX_MISSING_PATTERN = /requires an index/i;
// Manipulate here: how many documents the fallback reads when the index is not ready.
const FALLBACK_READ_LIMIT = 500;
const SORT_DIRECTION_DESCENDING = 'desc';
const DEFAULT_SORT_FIELD = 'updatedAt';
const DEFAULT_FALLBACK_LABEL = 'query';

// ===== MAIN FUNCTION =====

/**
 * True when Firestore is complaining that a composite index is missing or still building.
 * @param {Error|string} firestoreError
 * @returns {boolean}
 */
export function isFirestoreIndexError(firestoreError) {
  // 1. Pull code + message into plain strings (a bare string error has no code).
  const errorCode = codeFromFirestoreError(firestoreError);
  const errorMessage = messageFromFirestoreError(firestoreError);

  // 2. Match the official code or the "requires an index" sentence.
  if (errorCode === INDEX_MISSING_CODE) {
    return true;
  }
  if (INDEX_MISSING_PATTERN.test(errorMessage)) {
    return true;
  }
  return false;
}

/**
 * Run the indexed query; if the index is missing, run the capped fallback builder instead.
 * @param {import('firebase/firestore').Query} primaryQuery
 * @param {Function} buildFallback
 * @param {string} [label]
 * @returns {Promise<import('firebase/firestore').QuerySnapshot>}
 */
export async function getDocsWithIndexFallback(
  primaryQuery,
  buildFallback,
  label = DEFAULT_FALLBACK_LABEL,
) {
  try {
    // 1. Happy path: the composite index is ready.
    return await getDocs(primaryQuery);
  } catch (firestoreError) {
    // 2. Only missing-index failures get the fallback. Anything else still throws.
    return readDocsWithCappedFallback(firestoreError, buildFallback, label);
  }
}

/**
 * Cap a query so the fallback cannot pull the whole collection.
 * @param {import('firebase/firestore').Query} baseQuery
 * @param {number} [maxDocuments]
 * @returns {import('firebase/firestore').Query}
 */
export function capQuery(baseQuery, maxDocuments = FALLBACK_READ_LIMIT) {
  try {
    return firestoreLimit(baseQuery, maxDocuments);
  } catch (limitError) {
    // Some query shapes refuse limit(); keep the uncapped query rather than crash.
    return baseQuery;
  }
}

/**
 * Sort document snapshots by a timestamp-ish field, newest first by default.
 * @param {Array} docs
 * @param {string} [field]
 * @param {string} [direction]
 * @returns {Array}
 */
export function sortDocsByMillis(
  docs,
  field = DEFAULT_SORT_FIELD,
  direction = SORT_DIRECTION_DESCENDING,
) {
  // 1. Copy so we never mutate the caller's array.
  const sortedDocs = [...docs];

  // 2. Compare each pair by the field's millisecond value.
  sortedDocs.sort(function compareByFieldMillis(leftDoc, rightDoc) {
    return compareDocsByFieldMillis(leftDoc, rightDoc, field, direction);
  });

  return sortedDocs;
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging timestamp shapes or the fallback path.

function codeFromFirestoreError(firestoreError) {
  if (!firestoreError) {
    return '';
  }
  if (typeof firestoreError === 'string') {
    return '';
  }
  if (firestoreError.code == null) {
    return '';
  }
  return String(firestoreError.code);
}

function messageFromFirestoreError(firestoreError) {
  if (!firestoreError) {
    return '';
  }
  if (typeof firestoreError === 'string') {
    return String(firestoreError);
  }
  if (firestoreError.message == null) {
    return '';
  }
  return String(firestoreError.message);
}

async function readDocsWithCappedFallback(firestoreError, buildFallback, label) {
  if (!isFirestoreIndexError(firestoreError)) {
    throw firestoreError;
  }
  if (!buildFallback) {
    throw firestoreError;
  }

  const warningDetail = messageFromFirestoreError(firestoreError) || firestoreError;
  logger.warn(
    `Firestore index missing for ${label}; using capped fallback`,
    warningDetail,
  );

  return getDocs(buildFallback());
}

function compareDocsByFieldMillis(leftDoc, rightDoc, field, direction) {
  const leftMillis = timestampToMillis(fieldValueFromDoc(leftDoc, field));
  const rightMillis = timestampToMillis(fieldValueFromDoc(rightDoc, field));

  if (direction === SORT_DIRECTION_DESCENDING) {
    return rightMillis - leftMillis;
  }
  return leftMillis - rightMillis;
}

function fieldValueFromDoc(docSnapshot, field) {
  if (!docSnapshot) {
    return undefined;
  }
  if (typeof docSnapshot.data !== 'function') {
    return undefined;
  }
  const data = docSnapshot.data();
  if (!data) {
    return undefined;
  }
  return data[field];
}

function timestampToMillis(timestampValue) {
  // vocab: Firestore Timestamp.toMillis() → wall-clock ms; plain numbers are already ms
  if (timestampValue && typeof timestampValue.toMillis === 'function') {
    return timestampValue.toMillis();
  }
  if (typeof timestampValue === 'number') {
    return timestampValue;
  }
  return 0;
}
