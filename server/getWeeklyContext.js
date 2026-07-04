const admin = require('firebase-admin');
const { aggregateCoachWeeklyData, resolveCoachContextStartMs } = require('./lib/coachWeeklyData');
const { fetchCoachExtendedContext } = require('./lib/coachExtendedContext');

/**
 * @typedef {Object} WeeklyContext
 * @property {Object|null} user
 * @property {number|null} user.age
 * @property {number|null} user.weight
 * @property {number|null} user.height
 * @property {string|null} user.goal
 * @property {string|null} user.trainingLevel
 * @property {Object|null} macroTargets
 * @property {number|null} macroTargets.calories
 * @property {number|null} macroTargets.protein
 * @property {number|null} macroTargets.carbs
 * @property {number|null} macroTargets.fat
 * @property {Object|null} nutritionAnalysis
 * @property {number|null} nutritionAnalysis.avgDailyCalories
 * @property {number|null} nutritionAnalysis.avgProtein
 * @property {number|null} nutritionAnalysis.avgCarbs
 * @property {number|null} nutritionAnalysis.avgFat
 * @property {number} nutritionAnalysis.daysLogged
 * @property {number|null} nutritionAnalysis.consistencyScore
 * @property {Object|null} workoutAnalysis
 * @property {number} workoutAnalysis.sessionsLogged
 * @property {number|null} workoutAnalysis.totalVolume
 * @property {number|null} workoutAnalysis.avgRPE
 * @property {string|null} workoutAnalysis.volumeTrend
 * @property {Object|null} sleepAnalysis
 * @property {number|null} sleepAnalysis.avgHours
 * @property {string|null} sleepAnalysis.quality
 * @property {boolean|null} sleepAnalysis.isDepleted
 */

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.code = 'not_found';
  }
}

const toNumberOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const meanOrNull = (nums) => {
  const arr = (nums || []).filter((n) => Number.isFinite(n));
  if (!arr.length) return null;
  const sum = arr.reduce((a, b) => a + b, 0);
  return sum / arr.length;
};

/**
 * Attempt to query a log subcollection by timestamp field.
 * Falls back to fetching all docs and filtering by known date fields if query fails.
 *
 * @param {FirebaseFirestore.CollectionReference} colRef
 * @param {FirebaseFirestore.Timestamp} startTs
 * @returns {Promise<FirebaseFirestore.QueryDocumentSnapshot[]>}
 */
async function queryLast7ByTimestamp(colRef, startTs) {
  try {
    // Preferred: "timestamp" field (Firestore Timestamp)
    const snap = await colRef
      .where('timestamp', '>=', startTs)
      .orderBy('timestamp', 'desc')
      .get();
    return snap.docs;
  } catch (e) {
    // Fallback: fetch all and filter by any supported date field.
    try {
      const snap = await colRef.get();
      const docs = snap.docs || [];
      const startMs = startTs.toMillis();
      return docs.filter((d) => {
        const data = d.data() || {};
        const candidates = [
          data.timestamp,
          data.date,
          data.createdAt,
          data.updatedAt,
        ];
        for (const c of candidates) {
          // Firestore Timestamp
          if (c && typeof c.toMillis === 'function') {
            if (c.toMillis() >= startMs) return true;
          }
          // ISO/date string
          if (typeof c === 'string') {
            const ms = Date.parse(c);
            if (!Number.isNaN(ms) && ms >= startMs) return true;
          }
          // Date
          if (c instanceof Date && c.getTime() >= startMs) return true;
          // number millis
          if (typeof c === 'number' && c >= startMs) return true;
        }
        // Last fallback: doc id as YYYY-MM-DD
        const idMs = Date.parse(d.id);
        if (!Number.isNaN(idMs) && idMs >= startMs) return true;
        return false;
      });
    } catch (_) {
      return [];
    }
  }
}

/**
 * Compute a simple volume trend from ordered daily totals.
 *
 * Calculation:
 * - Split the week into early half and late half (by timestamp order)
 * - Compare mean(early) vs mean(late)
 * - Return 'up' | 'down' | 'flat' | null
 *
 * @param {number[]} dailyVolumes
 * @returns {string|null}
 */
function computeVolumeTrend(dailyVolumes) {
  const vols = (dailyVolumes || []).filter((n) => Number.isFinite(n));
  if (vols.length < 3) return null;
  const mid = Math.floor(vols.length / 2);
  const early = vols.slice(0, mid);
  const late = vols.slice(mid);
  const a = meanOrNull(early);
  const b = meanOrNull(late);
  if (a == null || b == null) return null;
  const delta = b - a;
  const pct = a === 0 ? 0 : delta / a;
  if (pct > 0.07) return 'up';
  if (pct < -0.07) return 'down';
  return 'flat';
}

/**
 * Aggregate a user's app history (since account creation) into coach context.
 *
 * Queries:
 * - users/{userId}/profile
 * - users/{userId}/macroTargets/current
 * - users/{userId}/nutritionLogs (docs with dayTotals)
 * - users/{userId}/workoutLogs (docs with totalVolume, avgRPE)
 * - users/{userId}/sleepLogs (docs with hours, quality)
 *
 * @param {string} userId
 * @returns {Promise<WeeklyContext>}
 */
async function getWeeklyContext(userId) {
  if (!admin.apps.length) {
    // server/index.js initializes admin with a service account; this is a safe fallback.
    admin.initializeApp();
  }

  if (!userId || typeof userId !== 'string') {
    throw new Error('userId is required');
  }

  const db = admin.firestore();

  // ── Profile (required for 404) ─────────────────────────────────────────────
  // Preferred (as requested): users/{userId}/profile/current
  // Fallback (matches existing CoachConnect app code): users/{userId}
  let profile = null;
  try {
    const profileRef = db.collection('users').doc(userId).collection('profile').doc('current');
    const profileSnap = await profileRef.get();
    if (profileSnap.exists) profile = profileSnap.data() || {};
  } catch (_) {
    // ignore and fall back
  }

  if (!profile) {
    try {
      const rootSnap = await db.collection('users').doc(userId).get();
      if (rootSnap.exists) profile = rootSnap.data() || {};
    } catch (_) {
      // ignore
    }
  }

  if (!profile) {
    throw new NotFoundError(`User profile not found for userId=${userId}`);
  }

  const startMs = resolveCoachContextStartMs(profile);
  const [{
    nutritionAnalysis,
    workoutAnalysis,
    sleepAnalysis,
    macroTargets,
    weightLog,
    weightTrend,
    wellnessAnalysis,
    streakData,
    contextMeta,
  }, extendedContext] = await Promise.all([
    aggregateCoachWeeklyData(db, userId, startMs),
    fetchCoachExtendedContext(db, userId, profile),
  ]);

  /** user object: coerce known profile fields. */
  const user = {
    age: toNumberOrNull(profile.age),
    weight: toNumberOrNull(profile.weight),
    height: toNumberOrNull(profile.height),
    goal:
      (typeof profile.primaryGoal === 'string' && profile.primaryGoal) ||
      (typeof profile.goal === 'string' && profile.goal) ||
      null,
    trainingLevel:
      (typeof profile.fitnessLevel === 'string' && profile.fitnessLevel) ||
      (typeof profile.trainingLevel === 'string' && profile.trainingLevel) ||
      null,
  };

  return {
    user,
    macroTargets,
    nutritionAnalysis,
    workoutAnalysis,
    sleepAnalysis,
    weightLog: weightLog || [],
    weightTrend: weightTrend || 'unknown',
    wellnessAnalysis: wellnessAnalysis || null,
    streakData: streakData || null,
    contextMeta: contextMeta || null,
    workoutPlan: extendedContext?.workoutPlan || null,
    notesAndFiles: extendedContext?.notesAndFiles || null,
    trainerDocuments: extendedContext?.trainerDocuments || null,
    linkedTrainerId: extendedContext?.linkedTrainerId || null,
  };
}

module.exports = { getWeeklyContext, NotFoundError };

