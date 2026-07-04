/**
 * Per-user daily cap for POST /api/nutrition/search (Firestore-backed, multi-instance safe).
 */
const admin = require('firebase-admin');
const logger = require('./logger');

const NUTRITION_SEARCH_DAILY_LIMIT = 500;

function utcDateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

async function enforceNutritionSearchDailyLimit(uid, limit = NUTRITION_SEARCH_DAILY_LIMIT) {
  if (!uid || !admin.apps.length) {
    return { allowed: true, remaining: null, limit: null, count: 0 };
  }

  const db = admin.firestore();
  const date = utcDateKey();
  const ref = db.collection('users').doc(uid).collection('usage').doc(`nutritionSearch_${date}`);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists ? snap.data() || {} : {};
    const count = Number(cur.count || 0);
    if (count >= limit) {
      return { allowed: false, remaining: 0, count };
    }
    const next = count + 1;
    tx.set(
      ref,
      {
        count: next,
        date,
        limit,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { allowed: true, remaining: Math.max(0, limit - next), count: next };
  });

  if (result.allowed) {
    logger.info(`[Nutrition Search] uid=${uid} search #${result.count}/${limit} today`);
  }

  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);

  return {
    ...result,
    limit,
    resetsAt: tomorrow.toISOString(),
  };
}

module.exports = {
  NUTRITION_SEARCH_DAILY_LIMIT,
  enforceNutritionSearchDailyLimit,
  utcDateKey,
};
