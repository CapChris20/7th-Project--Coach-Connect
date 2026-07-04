/**
 * workout Generation Usage
 *
 * Purpose: UI screen or component: workout Generation Usage. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/workouts
 * Key exports: formatWorkoutLimitResetLabel, buildDefaultWorkoutUsage, loadWorkoutGenerationUsage, resolveWorkoutGenerationUsage, PLAN_LIMIT_TOTAL, nextMonthResetDate, nextMonthResetsAtIso
 *
 * @file-header
 */
import { auth, db } from '../../app-start/config';
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

/** Keep in sync with server/lib/workoutGenerationLimit.js */
export const WORKOUT_GENERATION_LIMIT = 3;
export const PLAN_LIMIT_TOTAL = WORKOUT_GENERATION_LIMIT;
const planLimitMonthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const nextMonthResetDate = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
};
export const nextMonthResetsAtIso = (d = new Date()) => {
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
};

export function formatWorkoutLimitResetLabel(resetsAt) {
  const raw = String(resetsAt || nextMonthResetsAtIso()).trim();
  const d = new Date(`${raw.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function buildDefaultWorkoutUsage(used = 0) {
  return {
    generations_used: used,
    generations_limit: PLAN_LIMIT_TOTAL,
    resets_at: nextMonthResetsAtIso(),
  };
}

function toGeneratedAtMs(generatedAt) {
  if (generatedAt == null) return null;
  if (typeof generatedAt?.toMillis === 'function') return generatedAt.toMillis();
  if (typeof generatedAt?.toDate === 'function') return generatedAt.toDate().getTime();
  const ts = Number(generatedAt);
  return Number.isFinite(ts) && ts > 0 ? ts : null;
}

function planGeneratedThisMonth(generatedAt) {
  const ts = toGeneratedAtMs(generatedAt);
  if (ts == null) return false;
  return planLimitMonthKey(new Date(ts)) === planLimitMonthKey();
}

function hasActivePlanContent(plan) {
  if (!plan || typeof plan !== 'object') return false;
  return Boolean(
    (plan.rawPlan && String(plan.rawPlan).trim()) ||
      (plan.planText && String(plan.planText).trim()) ||
      plan.structuredPlan,
  );
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
  } else if (justGenerated) {
    used = Math.max(used + 1, 1);
  } else if (
    used <= 0 &&
    generatedPlan &&
    hasActivePlanContent(generatedPlan) &&
    (!generatedPlan.generatedAt || planGeneratedThisMonth(generatedPlan.generatedAt))
  ) {
    used = 1;
  }
  return {
    generations_used: Math.min(Math.max(used, 0), limit),
    generations_limit: limit,
    resets_at,
  };
}

function monthDateRange(d = new Date()) {
  const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return { startOfMonth, endOfMonth };
}

/** Active plan doc at users/{uid}/workoutPlan/current (primary generator path). */
async function countCurrentWorkoutPlanThisMonth(uid) {
  if (!uid || !db) return 0;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'workoutPlan', 'current'));
    if (!snap.exists()) return 0;
    const data = snap.data() || {};
    if (!hasActivePlanContent(data)) return 0;
    if (!data.generatedAt) return 1;
    return planGeneratedThisMonth(data.generatedAt) ? 1 : 0;
  } catch (_) {
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
    const plansRef = collection(db, 'users', uid, 'workoutPlans');
    const snap = await getDocs(
      query(plansRef, where('generatedAt', '>=', startTs), where('generatedAt', '<=', endTs)),
    );
    return snap.size;
  } catch (_) {
    try {
      const plansRef = collection(db, 'users', uid, 'workoutPlans');
      const snap = await getDocs(plansRef);
      let count = 0;
      snap.forEach((d) => {
        const data = d.data() || {};
        if (!hasActivePlanContent(data)) return;
        if (!data.generatedAt || planGeneratedThisMonth(data.generatedAt)) count += 1;
      });
      return count;
    } catch {
      return 0;
    }
  }
}

export async function loadWorkoutGenerationUsage(uid) {
  if (!uid || !db) return buildDefaultWorkoutUsage(0);
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'usage', 'workout_generations'));
    const month = planLimitMonthKey();
    let used = 0;
    if (snap.exists()) {
      const data = snap.data() || {};
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

export async function resolveWorkoutGenerationUsage(uid, opts = {}) {
  const fallbackUid = uid || auth.currentUser?.uid || null;
  const firestoreUsage = fallbackUid
    ? await loadWorkoutGenerationUsage(fallbackUid)
    : buildDefaultWorkoutUsage(0);
  return mergeWorkoutGenerationUsage({ firestoreUsage, ...opts });
}
