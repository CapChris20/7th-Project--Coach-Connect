const admin = require('firebase-admin');

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
 * Aggregate a user's last 7 days into a WeeklyContext.
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
  const now = admin.firestore.Timestamp.now();
  const startTs = admin.firestore.Timestamp.fromMillis(now.toMillis() - 7 * 24 * 60 * 60 * 1000);

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

  // ── Macro targets (optional) ───────────────────────────────────────────────
  const targetsRef = db.collection('users').doc(userId).collection('macroTargets').doc('current');
  const targetsSnap = await targetsRef.get().catch(() => null);
  const targets = targetsSnap && targetsSnap.exists ? (targetsSnap.data() || {}) : null;

  // ── Nutrition logs (optional) ──────────────────────────────────────────────
  const nutritionDocs = await queryLast7ByTimestamp(
    db.collection('users').doc(userId).collection('nutritionLogs'),
    startTs
  );
  const nutritionDays = [];
  for (const d of nutritionDocs) {
    const data = d.data() || {};
    const totals = data.dayTotals || data.totals || {};
    const calories = toNumberOrNull(totals.calories);
    const protein = toNumberOrNull(totals.protein);
    const carbs = toNumberOrNull(totals.carbs);
    const fat = toNumberOrNull(totals.fat);
    if (calories != null || protein != null || carbs != null || fat != null) {
      nutritionDays.push({ calories, protein, carbs, fat });
    }
  }

  /**
   * nutritionAnalysis calculations:
   * - avgDailyCalories/macros: mean across days with any totals present
   * - daysLogged: count of days with totals present
   * - consistencyScore: daysLogged / 7 * 100
   */
  const daysLogged = nutritionDays.length;
  const nutritionAnalysis = daysLogged
    ? {
        avgDailyCalories: meanOrNull(nutritionDays.map((x) => x.calories).filter((n) => n != null)),
        avgProtein: meanOrNull(nutritionDays.map((x) => x.protein).filter((n) => n != null)),
        avgCarbs: meanOrNull(nutritionDays.map((x) => x.carbs).filter((n) => n != null)),
        avgFat: meanOrNull(nutritionDays.map((x) => x.fat).filter((n) => n != null)),
        daysLogged,
        consistencyScore: Math.round((daysLogged / 7) * 100),
      }
    : null;

  // ── Workout logs (optional) ────────────────────────────────────────────────
  const workoutDocs = await queryLast7ByTimestamp(
    db.collection('users').doc(userId).collection('workoutLogs'),
    startTs
  );
  const workoutVolumes = [];
  const workoutRpes = [];
  for (const d of workoutDocs) {
    const data = d.data() || {};
    const v = toNumberOrNull(data.totalVolume);
    const r = toNumberOrNull(data.avgRPE);
    if (v != null) workoutVolumes.push(v);
    if (r != null) workoutRpes.push(r);
  }

  /**
   * workoutAnalysis calculations:
   * - sessionsLogged: number of docs returned in last 7 days (even if some fields missing)
   * - totalVolume: sum(totalVolume) across docs where present
   * - avgRPE: mean(avgRPE) across docs where present
   * - volumeTrend: compare early-week vs late-week mean volumes ('up'|'down'|'flat')
   */
  const sessionsLogged = workoutDocs.length;
  const totalVolume = workoutVolumes.length ? workoutVolumes.reduce((a, b) => a + b, 0) : null;
  const workoutAnalysis = sessionsLogged
    ? {
        sessionsLogged,
        totalVolume,
        avgRPE: meanOrNull(workoutRpes),
        volumeTrend: computeVolumeTrend(workoutVolumes),
      }
    : null;

  // ── Sleep logs (optional) ──────────────────────────────────────────────────
  const sleepDocs = await queryLast7ByTimestamp(
    db.collection('users').doc(userId).collection('sleepLogs'),
    startTs
  );
  const sleepHours = [];
  const sleepQualities = [];
  for (const d of sleepDocs) {
    const data = d.data() || {};
    const h = toNumberOrNull(data.hours);
    if (h != null) sleepHours.push(h);
    if (typeof data.quality === 'string' && data.quality.trim()) sleepQualities.push(data.quality.trim());
  }

  /**
   * sleepAnalysis calculations:
   * - avgHours: mean(hours) across docs where present
   * - quality: most recent non-empty quality string if present
   * - isDepleted: avgHours < 6.5
   */
  const avgHours = meanOrNull(sleepHours);
  const sleepAnalysis = sleepDocs.length
    ? {
        avgHours,
        quality: sleepQualities.length ? sleepQualities[0] : null,
        isDepleted: avgHours == null ? null : avgHours < 6.5,
      }
    : null;

  /** user object: coerce known profile fields. */
  const user = {
    age: toNumberOrNull(profile.age),
    weight: toNumberOrNull(profile.weight),
    height: toNumberOrNull(profile.height),
    goal: typeof profile.goal === 'string' ? profile.goal : null,
    trainingLevel: typeof profile.trainingLevel === 'string' ? profile.trainingLevel : null,
  };

  /** macroTargets: coerce target fields if present. */
  const macroTargets = targets
    ? {
        calories: toNumberOrNull(targets.calories),
        protein: toNumberOrNull(targets.protein),
        carbs: toNumberOrNull(targets.carbs),
        fat: toNumberOrNull(targets.fat),
      }
    : null;

  return {
    user,
    macroTargets,
    nutritionAnalysis,
    workoutAnalysis,
    sleepAnalysis,
  };
}

module.exports = { getWeeklyContext, NotFoundError };

