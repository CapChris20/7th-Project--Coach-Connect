/** Firestore-backed shared rate limiting across Cloud Run replicas. */
const admin = require('firebase-admin');
const logger = require('../lib/logger');

const LIMITS = {
  '/api/ai-coach': { perHour: 100, perMinute: 10 },
  '/api/nutrition/search': { perDay: 500 },
  '/api/food/search': { perHour: 100, perMinute: 30 },
};

function bucketKey(limitKey, uid, window) {
  return `${limitKey}_${uid}_${window}`;
}

async function checkAndIncrement(limitKey, uid, { perMinute, perHour, perDay } = {}) {
  if (!uid || !admin.apps.length) return { allowed: true };
  const db = admin.firestore();
  const now = new Date();
  const checks = [];

  if (perMinute) {
    checks.push({
      ref: db.collection('_rateLimits').doc(bucketKey(limitKey, uid, `m_${now.getUTCMinutes()}`)),
      limit: perMinute,
      ttlMs: 60_000,
    });
  }
  if (perHour) {
    checks.push({
      ref: db.collection('_rateLimits').doc(bucketKey(limitKey, uid, `h_${now.getUTCHours()}`)),
      limit: perHour,
      ttlMs: 3_600_000,
    });
  }
  if (perDay) {
    checks.push({
      ref: db.collection('_rateLimits').doc(bucketKey(limitKey, uid, `d_${now.toISOString().slice(0, 10)}`)),
      limit: perDay,
      ttlMs: 86_400_000,
    });
  }

  for (const { ref, limit, ttlMs } of checks) {
    const allowed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const count = snap.exists ? Number(snap.data()?.count || 0) : 0;
      if (count >= limit) return false;
      tx.set(
        ref,
        {
          count: count + 1,
          limit,
          ttl: Date.now() + ttlMs,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return true;
    });
    if (!allowed) {
      return { allowed: false, limit, retryAfter: perMinute ? 60 : perHour ? 3600 : 86400 };
    }
  }

  return { allowed: true };
}

function createSharedRateLimiter(limitKey) {
  const config = LIMITS[limitKey];
  return async function sharedRateLimit(req, res, next) {
    if (!config) return next();
    const uid = String(req.firebaseAuth?.uid || req.ip || 'anon').trim();
    try {
      const result = await checkAndIncrement(limitKey, uid, config);
      if (!result.allowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter || 60,
        });
      }
      return next();
    } catch (e) {
      logger.warn('[rateLimitShared] check failed — allowing request', e?.message || e);
      return next();
    }
  };
}

module.exports = {
  LIMITS,
  createSharedRateLimiter,
  checkAndIncrement,
};
