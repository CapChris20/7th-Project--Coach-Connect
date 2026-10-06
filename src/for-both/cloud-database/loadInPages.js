// Firestore reads that still work while a composite index is building.
// Flow: try the indexed query → if Firestore asks for an index, run a smaller fallback → sort in memory.
// Used by: lists that cannot wait for the index to finish.

import { getDocs, limit as firestoreLimit } from 'firebase/firestore';
import logger from '../online-connection/sendCrashReport';

// ===== NAMED CONSTANTS =====

const INDEX_MISSING_CODE = 'failed-precondition';
const INDEX_MISSING_PATTERN = /requires an index/i;
// Manipulate here: how many documents the fallback reads when the index is not ready.
const FALLBACK_READ_LIMIT = 500;
const DESCENDING = 'desc';

// ===== HELPER FUNCTIONS =====

/**
 * @param {object|undefined} timestampValue
 * @returns {number}
 */
function timestampToMillis(timestampValue) {
  if (timestampValue?.toMillis) return timestampValue.toMillis();
  if (typeof timestampValue === 'number') return timestampValue;
  return 0;
}

// ===== MAIN FUNCTION =====

/**
 * @param {Error|string} firestoreError
 * @returns {boolean}
 */
export function isFirestoreIndexError(firestoreError) {
  const errorCode = String(firestoreError?.code || '');
  const errorMessage = String(firestoreError?.message || firestoreError || '');
  return errorCode === INDEX_MISSING_CODE || INDEX_MISSING_PATTERN.test(errorMessage);
}

/**
 * @param {import('firebase/firestore').Query} primaryQuery
 * @param {Function} buildFallback
 * @param {string} [label]
 * @returns {Promise<import('firebase/firestore').QuerySnapshot>}
 */
export async function getDocsWithIndexFallback(primaryQuery, buildFallback, label = 'query') {
  try {
    return await getDocs(primaryQuery);
  } catch (firestoreError) {
    const canFallBack = isFirestoreIndexError(firestoreError) && buildFallback;
    if (!canFallBack) throw firestoreError;
    logger.warn(`Firestore index missing for ${label}; using capped fallback`, firestoreError?.message || firestoreError);
    return getDocs(buildFallback());
  }
}

/**
 * @param {import('firebase/firestore').Query} baseQuery
 * @param {number} [max]
 * @returns {import('firebase/firestore').Query}
 */
export function capQuery(baseQuery, max = FALLBACK_READ_LIMIT) {
  try {
    return firestoreLimit(baseQuery, max);
  } catch (_) {
    return baseQuery;
  }
}

/**
 * @param {Array} docs
 * @param {string} [field]
 * @param {string} [direction]
 * @returns {Array}
 */
export function sortDocsByMillis(docs, field = 'updatedAt', direction = DESCENDING) {
  const sortedDocs = [...docs];
  sortedDocs.sort((leftDoc, rightDoc) => {
    const leftMillis = timestampToMillis(leftDoc.data()?.[field]);
    const rightMillis = timestampToMillis(rightDoc.data()?.[field]);
    if (direction === DESCENDING) return rightMillis - leftMillis;
    return leftMillis - rightMillis;
  });
  return sortedDocs;
}
