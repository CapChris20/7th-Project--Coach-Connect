/**
 * Firestore query helpers — indexed query with safe fallback before indexes finish building.
 */
import { getDocs, limit as fsLimit } from 'firebase/firestore';
import logger from './logger';

export function isFirestoreIndexError(err) {
  const code = String(err?.code || '');
  const msg = String(err?.message || err || '');
  return code === 'failed-precondition' || /requires an index/i.test(msg);
}

/**
 * @param {import('firebase/firestore').Query} primaryQuery
 * @param {() => import('firebase/firestore').Query} buildFallback
 * @param {string} [label]
 */
export async function getDocsWithIndexFallback(primaryQuery, buildFallback, label = 'query') {
  try {
    return await getDocs(primaryQuery);
  } catch (err) {
    if (!isFirestoreIndexError(err) || !buildFallback) throw err;
    logger.warn(`Firestore index missing for ${label}; using capped fallback`, err?.message || err);
    return await getDocs(buildFallback());
  }
}

/** Cap unbounded collection reads when index is not ready. */
export function capQuery(baseQuery, max = 500) {
  try {
    return fsLimit(baseQuery, max);
  } catch (_) {
    return baseQuery;
  }
}

export function sortDocsByMillis(docs, field = 'updatedAt', direction = 'desc') {
  const list = [...docs];
  list.sort((a, b) => {
    const av = a.data()?.[field];
    const bv = b.data()?.[field];
    const am = av?.toMillis?.() ?? (typeof av === 'number' ? av : 0);
    const bm = bv?.toMillis?.() ?? (typeof bv === 'number' ? bv : 0);
    return direction === 'desc' ? bm - am : am - bm;
  });
  return list;
}
