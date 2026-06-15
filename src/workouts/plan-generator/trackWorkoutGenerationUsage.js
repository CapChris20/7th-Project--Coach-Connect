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
import { auth, db } from '../../app/config';
import { doc, getDoc } from 'firebase/firestore';

export const PLAN_LIMIT_TOTAL = 3;
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

function planGeneratedThisMonth(generatedAt) {
  if (generatedAt == null) return false;
  const ts = Number(generatedAt);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  return planLimitMonthKey(new Date(ts)) === planLimitMonthKey();
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
  if (used <= 0 && (justGenerated || planGeneratedThisMonth(generatedPlan?.generatedAt))) {
    used = 1;
  }
  return {
    generations_used: Math.min(Math.max(used, 0), limit),
    generations_limit: limit,
    resets_at,
  };
}

export async function loadWorkoutGenerationUsage(uid) {
  if (!uid || !db) return buildDefaultWorkoutUsage(0);
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'usage', 'workout_generations'));
    const month = planLimitMonthKey();
    if (!snap.exists()) return buildDefaultWorkoutUsage(0);
    const data = snap.data() || {};
    const used = data.month === month ? Number(data.count) || 0 : 0;
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
