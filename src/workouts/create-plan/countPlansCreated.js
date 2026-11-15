// Counts how many AI workout plans a user has generated this calendar month.
// Flow: read usage/workout_generations → max with saved plans this month → clamp to the monthly cap.
// Used by CreateWorkoutPlanScreen and the generate-plan API. Keep in sync with server/lib/workoutGenerationLimit.js.

import { auth, db } from '../../app-start/cloudConnection';
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

// ===== NAMED CONSTANTS =====

// Manipulate here: monthly AI plan cap — server limit must match
export const WORKOUT_GENERATION_LIMIT = 3;
export const PLAN_LIMIT_TOTAL = WORKOUT_GENERATION_LIMIT;

// Firestore path letters are frozen — do not rename these string values
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
 * Pull generations_used from the usage snapshot when its month matches this calendar month.
 * Stale months and missing docs count as 0 so we never under-report via a leftover counter.
 */
function usedCountFromThisMonthUsageDoc(usageSnapshot) {
  if (!usageSnapshot.exists()) {
    return 0;
  }

  const usageData = usageSnapshot.data() || {};
  const currentMonthKey = planLimitMonthKey();
  const usageIsForThisMonth = usageData.month === currentMonthKey;
  if (!usageIsForThisMonth) {
    return 0;
  }

  return Number(usageData.count) || 0;
}

/**
 * "2026-10" — the month bucket stored on the usage doc.
 */
function planLimitMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const monthNumber = date.getMonth() + 1;
  const monthTwoDigits = String(monthNumber).padStart(2, '0');
  return `${year}-${monthTwoDigits}`;
}

/**
 * Turn Firestore Timestamp / number / Date-like into milliseconds, or null.
 */
function toGeneratedAtMs(generatedAt) {
  if (generatedAt == null) {
    return null;
  }

  // vocab: toMillis = Firestore Timestamp → epoch ms
  if (typeof generatedAt?.toMillis === 'function') {
    return generatedAt.toMillis();
  }

  // vocab: toDate = Firestore Timestamp → JS Date
  if (typeof generatedAt?.toDate === 'function') {
    return generatedAt.toDate().getTime();
  }

  const timestampMs = Number(generatedAt);
  const looksValid = Number.isFinite(timestampMs) && timestampMs > 0;
  if (looksValid) {
    return timestampMs;
  }
  return null;
}

/**
 * True when generatedAt falls in the current calendar month (local).
 */
function planGeneratedThisMonth(generatedAt) {
  const timestampMs = toGeneratedAtMs(generatedAt);
  if (timestampMs == null) {
    return false;
  }
  const planMonthKey = planLimitMonthKey(new Date(timestampMs));
  const thisMonthKey = planLimitMonthKey();
  return planMonthKey === thisMonthKey;
}

/**
 * True when a plan doc has text or structured content worth counting.
 */
function hasActivePlanContent(plan) {
  if (!plan || typeof plan !== 'object') {
    return false;
  }

  const hasRawPlan = plan.rawPlan && String(plan.rawPlan).trim();
  if (hasRawPlan) {
    return true;
  }

  const hasPlanText = plan.planText && String(plan.planText).trim();
  if (hasPlanText) {
    return true;
  }

  if (plan.structuredPlan) {
    return true;
  }

  return false;
}

/**
 * When usage says 0 but a saved plan exists this month, bump the local used count to 1.
 */
function shouldCountSavedPlanAsUsed(used, generatedPlan) {
  if (used > 0) {
    return false;
  }
  if (!generatedPlan) {
    return false;
  }
  if (!hasActivePlanContent(generatedPlan)) {
    return false;
  }
  if (generatedPlan.generatedAt && !planGeneratedThisMonth(generatedPlan.generatedAt)) {
    return false;
  }
  return true;
}

/**
 * Local-only bumps: justGenerated → at least 1; or one active saved plan when used was 0.
 */
function usedCountFromLocalSignals(used, justGenerated, generatedPlan) {
  if (justGenerated) {
    return Math.max(used + 1, 1);
  }
  if (shouldCountSavedPlanAsUsed(used, generatedPlan)) {
    return 1;
  }
  return used;
}

/**
 * Merge API usage + Firestore usage + local just-generated hints into the public shape.
 * Keys generations_used / generations_limit / resets_at stay frozen.
 */
function mergeWorkoutGenerationUsage({
  apiUsage = null,
  firestoreUsage = null,
  justGenerated = false,
  generatedPlan = null,
} = {}) {
  const base = firestoreUsage || buildDefaultWorkoutUsage(0);
  const limitFromApi = Number(apiUsage?.generations_limit) || 0;
  const limitFromBase = Number(base.generations_limit) || 0;
  const limit = limitFromApi || limitFromBase || PLAN_LIMIT_TOTAL;
  const resets_at = apiUsage?.resets_at || base.resets_at || nextMonthResetsAtIso();

  const usedFromApi = Number(apiUsage?.generations_used) || 0;
  const usedFromBase = Number(base.generations_used) || 0;
  let used = Math.max(usedFromApi, usedFromBase);

  const apiGaveAnExplicitUsedCount = apiUsage?.generations_used != null;
  if (apiGaveAnExplicitUsedCount) {
    used = Math.max(used, Number(apiUsage.generations_used) || 0);
  } else {
    used = usedCountFromLocalSignals(used, justGenerated, generatedPlan);
  }

  const clampedUsed = Math.min(Math.max(used, 0), limit);
  return {
    generations_used: clampedUsed,
    generations_limit: limit,
    resets_at,
  };
}

/**
 * Local start/end of the current calendar month for Timestamp range queries.
 */
function monthDateRange(date = new Date()) {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { startOfMonth, endOfMonth };
}

/**
 * Count 1 if users/{uid}/workoutPlan/current is active and from this month (or missing generatedAt).
 */
async function countCurrentWorkoutPlanThisMonth(uid) {
  if (!uid || !db) {
    return 0;
  }

  try {
    const currentPlanRef = doc(
      db,
      USERS_COLLECTION,
      uid,
      CURRENT_PLAN_SUBCOLLECTION,
      CURRENT_PLAN_DOC,
    );
    const snapshot = await getDoc(currentPlanRef);
    if (!snapshot.exists()) {
      return 0;
    }

    const data = snapshot.data() || {};
    if (!hasActivePlanContent(data)) {
      return 0;
    }
    if (!data.generatedAt) {
      return 1;
    }
    if (planGeneratedThisMonth(data.generatedAt)) {
      return 1;
    }
    return 0;
  } catch (_) {
    return 0;
  }
}

/**
 * Saved-plan docs count when they have content and (no date or this month).
 */
function doesSavedPlanCountThisMonth(planData) {
  if (!hasActivePlanContent(planData)) {
    return false;
  }
  if (!planData.generatedAt) {
    return true;
  }
  if (planGeneratedThisMonth(planData.generatedAt)) {
    return true;
  }
  return false;
}

/**
 * Walk a getDocs snapshot and count plans that should count this month.
 */
function countMatchingPlans(snapshot) {
  let planCount = 0;
  snapshot.forEach((planDoc) => {
    const planData = planDoc.data() || {};
    if (doesSavedPlanCountThisMonth(planData)) {
      planCount += 1;
    }
  });
  return planCount;
}

/**
 * Fallback when the generatedAt range query fails (index missing, etc.): scan all saved plans.
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

/**
 * Count users/{uid}/workoutPlans docs with generatedAt in this calendar month.
 * On query failure, fall back to a full collection scan.
 */
async function countWorkoutPlansThisMonth(uid) {
  if (!uid || !db) {
    return 0;
  }

  try {
    const { startOfMonth, endOfMonth } = monthDateRange();
    // vocab: Timestamp.fromDate = JS Date → Firestore Timestamp for range filters
    const startTimestamp = Timestamp.fromDate(startOfMonth);
    const endTimestamp = Timestamp.fromDate(endOfMonth);
    const plansRef = collection(db, USERS_COLLECTION, uid, SAVED_PLANS_SUBCOLLECTION);
    const monthQuery = query(
      plansRef,
      where('generatedAt', '>=', startTimestamp),
      where('generatedAt', '<=', endTimestamp),
    );
    const snapshot = await getDocs(monthQuery);
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
  const year = firstOfNextMonth.getFullYear();
  const monthNumber = firstOfNextMonth.getMonth() + 1;
  const monthTwoDigits = String(monthNumber).padStart(2, '0');
  return `${year}-${monthTwoDigits}-01`;
};

/**
 * "October 1, 2026" for the "resets on" label. Noon local avoids a timezone date-shift.
 * Flow: 1. normalize iso  2. parse at noon  3. bad date → raw  4. locale string
 * @param {string} resetsAt
 * @returns {string}
 */
export function formatWorkoutLimitResetLabel(resetsAt) {
  // 1. Prefer the caller's resets_at; else compute next month from now
  const resetIsoText = String(resetsAt || nextMonthResetsAtIso()).trim();

  // 2. Parse YYYY-MM-DD at local noon so the label does not slip a day across timezones
  const resetDate = new Date(`${resetIsoText.slice(0, 10)}${RESET_LABEL_NOON}`);

  // 3. Unparseable → show the iso text rather than "Invalid Date"
  if (Number.isNaN(resetDate.getTime())) {
    return resetIsoText;
  }

  // 4. Long month name the usage banner reads
  return resetDate.toLocaleDateString(RESET_LABEL_LOCALE, RESET_LABEL_FORMAT);
}

/**
 * Default usage object when Firestore has nothing yet.
 * Object keys (generations_used / generations_limit / resets_at) are frozen for callers.
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
 * Flow: 1. need uid+db  2. read usage doc  3. count saved + current  4. max → default shape
 * @param {string} uid
 * @returns {Promise<{ generations_used: number, generations_limit: number, resets_at: string }>}
 */
export async function loadWorkoutGenerationUsage(uid) {
  // 1. No user or no Firestore → empty usage with the monthly cap
  if (!uid || !db) {
    return buildDefaultWorkoutUsage(0);
  }

  try {
    // 2. Usage counter for this calendar month (ignore stale months)
    // vocab: getDoc = one-shot Firestore read (not a live listener)
    const usageDocRef = doc(
      db,
      USERS_COLLECTION,
      uid,
      USAGE_SUBCOLLECTION,
      WORKOUT_GENERATIONS_DOC,
    );
    const usageSnapshot = await getDoc(usageDocRef);
    const usedFromUsageDoc = usedCountFromThisMonthUsageDoc(usageSnapshot);

    // 3. Also count real plan docs so a missing usage write cannot under-count
    const savedPlansCount = await countWorkoutPlansThisMonth(uid);
    const currentPlanCount = await countCurrentWorkoutPlanThisMonth(uid);

    // 4. Highest signal wins, then clamp into the public usage shape
    const used = Math.max(usedFromUsageDoc, savedPlansCount, currentPlanCount);
    return buildDefaultWorkoutUsage(used);
  } catch {
    return buildDefaultWorkoutUsage(0);
  }
}

/**
 * Merge live Firestore usage with optional API / just-generated hints from the caller.
 * Object keys here are the public usage shape callers read — do not rename them.
 * Flow: 1. resolve uid  2. load Firestore  3. merge with opts
 * @param {string} uid
 * @param {object} [opts]
 * @returns {Promise<{ generations_used: number, generations_limit: number, resets_at: string }>}
 */
export async function resolveWorkoutGenerationUsage(uid, opts = {}) {
  // 1. Prefer the passed uid; else the signed-in Firebase user
  // vocab: auth.currentUser = Firebase Auth session (null when signed out)
  const fallbackUid = uid || auth.currentUser?.uid || null;

  // 2. Live Firestore usage (or empty default)
  let firestoreUsage = buildDefaultWorkoutUsage(0);
  if (fallbackUid) {
    firestoreUsage = await loadWorkoutGenerationUsage(fallbackUid);
  }

  // 3. Fold in API / justGenerated / generatedPlan hints
  return mergeWorkoutGenerationUsage({ firestoreUsage, ...opts });
}
