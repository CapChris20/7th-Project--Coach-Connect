/**
 * Firestore-backed distributed lock for cron jobs across Cloud Run replicas.
 */
const admin = require('firebase-admin');

async function acquireLock(lockId, ttlSeconds = 60) {
  if (!admin.apps.length) return true;
  const lockRef = admin.firestore().collection('_locks').doc(lockId);
  const nowMs = Date.now();
  const expiresAtMs = nowMs + ttlSeconds * 1000;

  try {
    const acquired = await admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(lockRef);
      if (snap.exists) {
        const data = snap.data() || {};
        const existingExpiry =
          typeof data.expiresAt?.toMillis === 'function'
            ? data.expiresAt.toMillis()
            : Number(data.expiresAtMs || 0);
        if (existingExpiry > nowMs) {
          return false;
        }
      }
      tx.set(lockRef, {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
        expiresAtMs,
        ttlSeconds,
      });
      return true;
    });
    if (acquired) {
      console.log(`[distributedLock] Acquired lock: ${lockId}`);
    }
    return acquired;
  } catch (e) {
    console.warn(`[distributedLock] acquire failed for ${lockId}:`, e?.message || e);
    return false;
  }
}

async function releaseLock(lockId) {
  if (!admin.apps.length) return;
  try {
    await admin.firestore().collection('_locks').doc(lockId).delete();
  } catch (e) {
    console.warn(`[distributedLock] release failed for ${lockId}:`, e?.message || e);
  }
}

async function runWithDistributedLock(lockId, fn, ttlSeconds = 120) {
  if (!(await acquireLock(lockId, ttlSeconds))) return false;
  try {
    await fn();
    return true;
  } finally {
    await releaseLock(lockId);
  }
}

module.exports = {
  acquireLock,
  releaseLock,
  runWithDistributedLock,
};
