// Counts how many AI workout plans a user has generated this calendar month.
// Flow: read usage/workout_generations → max with saved plans this month → clamp to the monthly cap.
// Used by CreateWorkoutPlanScreen and the generate-plan API. Keep in sync with server/lib/workoutGenerationLimit.js.

import { auth, db } from '../../app-start/cloudConnection';
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

// ===== NAMED CONSTANTS =====

export const WORKOUT_GENERATION_LIMIT = 3;
export const PLAN_LIMIT_TOTAL = WORKOUT_GENERATION_LIMIT;

const USERS_COLLECTION = 'users';
const CURRENT_PLAN_SUBCOLLECTION = 'workoutPlan';
const CURRENT_PLAN_DOC = 'current';
const SAVED_PLANS_SUBCOLLECTION = 'workoutPlans';
const USAGE_SUBCOLLECTION = 'usage';
const WORKOUT_GENERATIONS_DOC = 'workout_generations';
const RESET_LABEL_NOON = 'T12:00:00';
const RESET_LABEL_LOCALE = 'en-US';
const RESET_LABEL_FORMAT = { month: 'long', day: 'numeric', year: 'numeric' };

// ===== HELPER FUNCTIONS =====

/**
 * "2026-10" — the month bucket stored on the usage doc.
 * @param {Date} [date]
 * @returns {string}
 */
const planLimitMonthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/**
 * Firestore Timestamp, Date, or millis → millis. Anything else is "missing".
 * @param {*} generatedAt
 * @returns {number|null}
 */
function toGeneratedAtMs(generatedAt) {
  if (generatedAt == null) return null;
  if (typeof generatedAt?.toMillis === 'function') return generatedAt.toMillis();
  if (typeof generatedAt?.toDate === 'function') return generatedAt.toDate().getTime();
  const timestampMs = Number(generatedAt);
  return Number.isFinite(timestampMs) && timestampMs > 0 ? timestampMs : null;
}

/**
 * @param {*} generatedAt
 * @returns {boolean}
 */
function planGeneratedThisMonth(generatedAt) {
  const timestampMs = toGeneratedAtMs(generatedAt);
  if (timestampMs == null) return false;
  return planLimitMonthKey(new Date(timestampMs)) === planLimitMonthKey();
}

/**
 * Empty leftover docs must not count as a generation.
 * @param {object} plan
 * @returns {boolean}
 */
function hasActivePlanContent(plan) {
  if (!plan || typeof plan !== 'object') return false;
  return Boolean(
    (plan.rawPlan && String(plan.rawPlan).trim()) ||
      (plan.planText && String(plan.planText).trim()) ||
      plan.structuredPlan,
  );
}

/**
 * Pick the highest used-count we can defend: API, Firestore, or a just-generated plan.
 * Object keys here are the public usage shape callers read — do not rename them.
 * @param {{ apiUsage?: object, firestoreUsage?: object, justGenerated?: boolean, generatedPlan?: object }} [options]
 * @returns {{ generations_used: number, generations_limit: number, resets_at: string }}
 */
/**
 * A leftover empty plan must not bump the used-count. Missing generatedAt still counts this month.
 * @param {number} used
 * @param {object|null} generatedPlan
 * @returns {boolean}
 */
function shouldCountSavedPlanAsUsed(used, generatedPlan) {
  if (used > 0) return false;
  if (!generatedPlan) return false;
  if (!hasActivePlanContent(generatedPlan)) return false;
  if (generatedPlan.generatedAt && !planGeneratedThisMonth(generatedPlan.generatedAt)) return false;
  return true;
}

/**
 * When the API did not send generations_used, infer from this session or a saved plan.
 * @param {number} used
 * @param {boolean} justGenerated
 * @param {object|null} generatedPlan
 * @returns {number}
 */
function usedCountFromLocalSignals(used, justGenerated, generatedPlan) {
  if (justGenerated) return Math.max(used + 1, 1);
  if (shouldCountSavedPlanAsUsed(used, generatedPlan)) return 1;
  return used;
}

function mergeWorkoutGenerationUsage({
  apiUsage = null,
  firestoreUsage = null,
  justGenerated = false,
  generatedPlan = null,
} = {}) {
  const base = firestoreUsage || buildDefaultWorkoutUsage(0);
  const limit =
    Number(apiUsage?.generations_limit) || Number(base.generations_limit) || PLAN_LIMIT_TOTAL;
  const resets_at = apiUsage?.resets_at || base.resets_at || nextMonthResetsAtIso();
  let used = Math.max(
    Number(apiUsage?.generations_used) || 0,
    Number(base.generations_used) || 0
  );
  if (apiUsage?.generations_used != null) {
    used = Math.max(used, Number(apiUsage.generations_used) || 0);
  } else {
    used = usedCountFromLocalSignals(used, justGenerated, generatedPlan);
  }
  return {
    generations_used: Math.min(Math.max(used, 0), limit),
    generations_limit: limit,
    resets_at,
  };
}

/**
 * Inclusive calendar-month window in local time (end is 23:59:59.999 of the last day).
 * @param {Date} [date]
 * @returns {{ startOfMonth: Date, endOfMonth: Date }}
 */
function monthDateRange(date = new Date()) {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { startOfMonth, endOfMonth };
}

/** Active plan doc at users/{uid}/workoutPlan/current (primary generator path). */
async function countCurrentWorkoutPlanThisMonth(uid) {
  if (!uid || !db) return 0;
  try {
    const snapshot = await getDoc(doc(db, USERS_COLLECTION, uid, CURRENT_PLAN_SUBCOLLECTION, CURRENT_PLAN_DOC));
    if (!snapshot.exists()) return 0;
    const data = snapshot.data() || {};
    if (!hasActivePlanContent(data)) return 0;
    if (!data.generatedAt) return 1;
    return planGeneratedThisMonth(data.generatedAt) ? 1 : 0;
  } catch (_) {
    return 0;
  }
}

/**
 * A saved plan counts if it has content and either has no timestamp or was generated this month.
 * @param {object} planData
 * @returns {boolean}
 */
function doesSavedPlanCountThisMonth(planData) {
  if (!hasActivePlanContent(planData)) return false;
  if (!planData.generatedAt || planGeneratedThisMonth(planData.generatedAt)) return true;
  return false;
}

/**
 * @param {object} snapshot
 * @returns {number}
 */
function countMatchingPlans(snapshot) {
  let planCount = 0;
  snapshot.forEach((planDoc) => {
    if (doesSavedPlanCountThisMonth(planDoc.data() || {})) planCount += 1;
  });
  return planCount;
}

/**
 * Fallback when the generatedAt range query needs an index we do not have.
 * @param {string} uid
 * @returns {Promise<number>}
 */
async function countPlansByScanningAll(uid) {
  try {
    const plansRef = collection(db, USERS_COLLECTION, uid, SAVED_PLANS_SUBCOLLECTION);
    const snapshot = await getDocs(plansRef);
    return countMatchingPlans(snapshot);
  } catch {
    return 0;
  }
}

/** Fallback: count saved plans in users/{uid}/workoutPlans for the current calendar month. */
async function countWorkoutPlansThisMonth(uid) {
  if (!uid || !db) return 0;
  try {
    const { startOfMonth, endOfMonth } = monthDateRange();
    const startTs = Timestamp.fromDate(startOfMonth);
    const endTs = Timestamp.fromDate(endOfMonth);
    const plansRef = collection(db, USERS_COLLECTION, uid, SAVED_PLANS_SUBCOLLECTION);
    const snapshot = await getDocs(
      query(plansRef, where('generatedAt', '>=', startTs), where('generatedAt', '<=', endTs)),
    );
    return snapshot.size;
  } catch (_) {
    return countPlansByScanningAll(uid);
  }
}

// ===== MAIN FUNCTION =====

/**
 * First day of next month as a Date (local timezone).
 * @returns {Date}
 */
export const nextMonthResetDate = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
};

/**
 * First day of next month as `YYYY-MM-01`.
 * @param {Date} [date]
 * @returns {string}
 */
export const nextMonthResetsAtIso = (date = new Date()) => {
  const firstOfNextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return `${firstOfNextMonth.getFullYear()}-${String(firstOfNextMonth.getMonth() + 1).padStart(2, '0')}-01`;
};

/**
 * "October 1, 2026" for the "resets on" label. Noon local avoids a timezone date-shift.
 * @param {string} [resetsAt]
 * @returns {string}
 */
export function formatWorkoutLimitResetLabel(resetsAt) {
  const raw = String(resetsAt || nextMonthResetsAtIso()).trim();
  const resetDate = new Date(`${raw.slice(0, 10)}${RESET_LABEL_NOON}`);
  if (Number.isNaN(resetDate.getTime())) return raw;
  return resetDate.toLocaleDateString(RESET_LABEL_LOCALE, RESET_LABEL_FORMAT);
}

/**
 * @param {number} [used]
 * @returns {{ generations_used: number, generations_limit: number, resets_at: string }}
 */
export function buildDefaultWorkoutUsage(used = 0) {
  return {
    generations_used: used,
    generations_limit: PLAN_LIMIT_TOTAL,
    resets_at: nextMonthResetsAtIso(),
  };
}

/**
 * Read the usage doc and take the max of that count vs plans actually saved this month.
 * @param {string} uid
 * @returns {Promise<{ generations_used: number, generations_limit: number, resets_at: string }>}
 */
export async function loadWorkoutGenerationUsage(uid) {
  if (!uid || !db) return buildDefaultWorkoutUsage(0);
  try {
    const snapshot = await getDoc(doc(db, USERS_COLLECTION, uid, USAGE_SUBCOLLECTION, WORKOUT_GENERATIONS_DOC));
    const month = planLimitMonthKey();
    let used = 0;
    if (snapshot.exists()) {
      const data = snapshot.data() || {};
      used = data.month === month ? Number(data.count) || 0 : 0;
    }
    const [plansCount, currentPlanCount] = await Promise.all([
      countWorkoutPlansThisMonth(uid),
      countCurrentWorkoutPlanThisMonth(uid),
    ]);
    used = Math.max(used, plansCount, currentPlanCount);
    return buildDefaultWorkoutUsage(used);
  } catch (_) {
    return buildDefaultWorkoutUsage(0);
  }
}

/**
 * Merge live Firestore usage with optional API / just-generated hints from the caller.
 * @param {string} uid
 * @param {object} [opts]
 * @returns {Promise<object>}
 */
export async function resolveWorkoutGenerationUsage(uid, opts = {}) {
  const fallbackUid = uid || auth.currentUser?.uid || null;
  const firestoreUsage = fallbackUid
    ? await loadWorkoutGenerationUsage(fallbackUid)
    : buildDefaultWorkoutUsage(0);
  return mergeWorkoutGenerationUsage({ firestoreUsage, ...opts });
}
