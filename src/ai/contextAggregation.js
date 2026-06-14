/**
 * 7-day coach context for AI Coach UI chips + server payload.
 * Prefer GET /api/weekly-context (same logic as server getWeeklyContext).
 * Falls back to client Firestore reads when offline or API unavailable.
 */
import { auth, db } from '../app/config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getAICoachApiBases, getResilientApiBases } from '../shared/services/baseUrl';
import { formatOnboardingDisplay } from '../shared/utils/formatOnboardingDisplay';
import { aggregateCoachWeeklyDataClient } from './coachWeeklyDataClient';

const MS_7D = 7 * 24 * 60 * 60 * 1000;

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const mean = (arr) => {
  const nums = (arr || []).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
};

function docInLast7Days(docSnap, startMs) {
  const data = docSnap.data() || {};
  const candidates = [data.timestamp, data.date, data.createdAt, data.updatedAt];
  for (const c of candidates) {
    if (c?.toMillis) return c.toMillis() >= startMs;
    if (typeof c === 'string') {
      const ms = Date.parse(c);
      if (!Number.isNaN(ms) && ms >= startMs) return true;
    }
    if (c instanceof Date && c.getTime() >= startMs) return true;
    if (typeof c === 'number' && c >= startMs) return true;
  }
  const idMs = Date.parse(docSnap.id);
  if (!Number.isNaN(idMs) && idMs >= startMs) return true;
  return false;
}

async function queryLast7Docs(colRef, startMs) {
  const startTs = Timestamp.fromMillis(startMs);
  try {
    const snap = await getDocs(
      query(colRef, where('timestamp', '>=', startTs), orderBy('timestamp', 'desc'))
    );
    return snap.docs;
  } catch (_) {
    try {
      const snap = await getDocs(colRef);
      return (snap.docs || []).filter((d) => docInLast7Days(d, startMs));
    } catch (__) {
      return [];
    }
  }
}

/**
 * Normalize server weekly-context or client aggregate into chip + prompt shape.
 */
export function normalizeCoachContext(raw, userProfile = {}) {
  if (!raw) return null;

  const na = raw.nutritionAnalysis || {};
  const wa = raw.workoutAnalysis || {};
  const sa = raw.sleepAnalysis || {};
  const mt = raw.macroTargets || userProfile?.macroTargets || {};
  const u = raw.user || userProfile || {};

  const avgCals = Math.round(toNum(na.avgDailyCalories) ?? toNum(raw.avgCals) ?? 0);
  const avgProtein = Math.round(toNum(na.avgProtein) ?? toNum(raw.avgProtein) ?? 0);
  const avgCarbs = Math.round(toNum(na.avgCarbs) ?? toNum(raw.avgCarbs) ?? 0);
  const avgFat = Math.round(toNum(na.avgFat) ?? toNum(raw.avgFat) ?? 0);
  const daysLogged =
    toNum(na.totalLoggedDaysAllTime) ?? toNum(na.daysLogged) ?? toNum(raw.nutritionDaysLogged) ?? 0;
  const nutritionConsistency = toNum(na.consistencyScore) ?? 0;

  const workoutsLogged = toNum(wa.sessionsLogged) ?? toNum(raw.workoutsLogged) ?? 0;
  const avgRPE = toNum(wa.avgRPE) ?? toNum(raw.avgRPE);
  const volumeTrend = wa.volumeTrend || raw.volumeTrend || (workoutsLogged > 0 ? 'logged' : 'none');

  const avgSleep = sa.avgHours != null ? Number(sa.avgHours).toFixed(1) : raw.avgSleep ?? '—';
  const wellness = raw.wellnessAnalysis || raw.wellness || {};
  const stepsAvg = toNum(wellness?.steps?.avgDaily) ?? 0;
  const hasWorkoutPlan = Boolean(raw.workoutPlan?.activePlan?.summary);

  const targetCals = Math.round(
    toNum(mt.calories) ??
      toNum(mt.cals) ??
      toNum(mt.calorie_target) ??
      toNum(userProfile?.calories) ??
      toNum(raw.targetCals) ??
      0
  );
  const targetProtein = Math.round(
    toNum(mt.protein) ??
      toNum(mt.protein_target) ??
      toNum(userProfile?.proteinTarget) ??
      toNum(raw.targetProtein) ??
      0
  );

  const goalRaw = u.goal || userProfile?.primaryGoal || userProfile?.goal || raw.goal || '';
  const goal = formatOnboardingDisplay(goalRaw, '') || String(goalRaw || 'Not set');

  return {
    userName:
      userProfile?.firstName ||
      userProfile?.name ||
      u.firstName ||
      'Coach',
    goal,
    trainingLevel:
      formatOnboardingDisplay(u.trainingLevel || userProfile?.fitnessLevel, '') ||
      u.trainingLevel ||
      userProfile?.fitnessLevel ||
      '—',
    currentPlan: raw.currentPlan || raw.currentPlanName || 'Your plan',
    avgCals,
    avgProtein,
    avgCarbs,
    avgFat,
    targetCals,
    targetProtein,
    targetCarbs: Math.round(toNum(mt.carbs) ?? toNum(raw.targetCarbs) ?? 0),
    targetFat: Math.round(toNum(mt.fat) ?? toNum(raw.targetFat) ?? 0),
    nutritionDaysLogged: daysLogged,
    nutritionConsistency,
    workoutsLogged,
    volumeTrend,
    avgRPE: avgRPE != null ? Number(avgRPE).toFixed(1) : '—',
    avgSleep,
    stepsAvg,
    hasWorkoutPlan,
    streakDays:
      toNum(raw.streakData?.currentStreak) ?? toNum(raw.streakDays) ?? toNum(raw.currentStreak) ?? 0,
    photoCount: toNum(raw.photoCount) ?? 0,
    trainerNotes: raw.trainerNotes || 'No recent notes',
    source: raw.source || 'unknown',
    dailyFoodLog: na.dailyBreakdown || raw.dailyBreakdown || [],
  };
}

/**
 * Fetch authoritative weekly context from Express API.
 */
export async function fetchWeeklyContextFromServer(userId) {
  if (!userId) return null;
  const idToken = await auth?.currentUser?.getIdToken?.();
  if (!idToken) return null;

  const headers = { Authorization: `Bearer ${idToken}` };
  for (const base of getResilientApiBases()) {
    const url = `${String(base).replace(/\/$/, '')}/api/weekly-context/${encodeURIComponent(userId)}`;
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const weekly = await res.json();
      return normalizeCoachContext({ ...weekly, source: 'server' }, null);
    } catch (_) {
      continue;
    }
  }
  return null;
}

/**
 * Client-side 7-day Firestore aggregation (fallback).
 */
export async function aggregateUserContext(userId, userProfile = {}) {
  if (!userId || !db) return null;

  try {
    const startMs = Date.now() - MS_7D;

    let profile = userProfile;
    try {
      const profileSnap = await getDoc(doc(db, 'users', userId, 'profile', 'current'));
      if (profileSnap.exists()) profile = { ...profile, ...profileSnap.data() };
    } catch (_) {
      /* ignore */
    }
    try {
      const rootSnap = await getDoc(doc(db, 'users', userId));
      if (rootSnap.exists()) profile = { ...profile, ...rootSnap.data() };
    } catch (_) {
      /* ignore */
    }

    let macroTargets = profile?.macroTargets || {};
    try {
      const mtSnap = await getDoc(doc(db, 'users', userId, 'macroTargets', 'current'));
      if (mtSnap.exists()) macroTargets = { ...macroTargets, ...mtSnap.data() };
    } catch (_) {
      /* ignore */
    }
    try {
      const goalsSnap = await getDoc(doc(db, 'nutrition_goals', userId));
      if (goalsSnap.exists()) {
        const g = goalsSnap.data() || {};
        macroTargets = {
          ...macroTargets,
          calories: g.calorie_target ?? macroTargets.calories,
          protein: g.protein_target ?? macroTargets.protein,
          carbs: g.carbs_target ?? macroTargets.carbs,
          fat: g.fat_target ?? macroTargets.fat,
        };
      }
    } catch (_) {
      /* ignore */
    }

    const { nutritionAnalysis, workoutAnalysis, sleepAnalysis } =
      await aggregateCoachWeeklyDataClient(userId);

    let currentPlan = 'Your plan';
    try {
      const curSnap = await getDoc(doc(db, 'users', userId, 'workoutPlans', 'current'));
      if (curSnap.exists()) {
        currentPlan = curSnap.data()?.name || curSnap.data()?.title || currentPlan;
      } else {
        const plansSnap = await getDocs(collection(db, 'users', userId, 'workoutPlans'));
        const active = plansSnap.docs.find((p) => p.data()?.status === 'active' || p.data()?.assigned);
        if (active) currentPlan = active.data()?.name || active.data()?.title || currentPlan;
      }
    } catch (_) {
      /* ignore */
    }

    let streakDays = 0;
    try {
      const streakSnap = await getDoc(doc(db, 'users', userId, 'streaks', 'current'));
      if (streakSnap.exists()) streakDays = toNum(streakSnap.data()?.streak) ?? toNum(streakSnap.data()?.currentStreak) ?? 0;
    } catch (_) {
      /* ignore */
    }

    let photoCount = 0;
    try {
      const photoSnap = await getDocs(
        query(collection(db, 'users', userId, 'progressPhotos'), limit(20))
      );
      photoCount = (photoSnap.docs || []).filter((d) => docInLast7Days(d, startMs)).length;
    } catch (_) {
      /* ignore */
    }

    let trainerNotes = '';
    try {
      const notesSnap = await getDocs(
        query(collection(db, 'users', userId, 'notes_and_files'), limit(8))
      );
      const lines = (notesSnap.docs || [])
        .filter((d) => docInLast7Days(d, startMs))
        .slice(0, 3)
        .map((d) => {
          const data = d.data() || {};
          const text = data.note || data.text || data.title || data.name;
          return text ? `- ${String(text).trim()}` : null;
        })
        .filter(Boolean);
      trainerNotes = lines.join('\n');
    } catch (_) {
      /* ignore */
    }

    return normalizeCoachContext(
      {
        user: {
          age: profile?.age,
          weight: profile?.weight,
          height: profile?.height,
          goal: profile?.primaryGoal || profile?.goal,
          trainingLevel: profile?.fitnessLevel || profile?.trainingLevel,
        },
        macroTargets,
        nutritionAnalysis,
        workoutAnalysis,
        sleepAnalysis,
        currentPlan,
        streakDays,
        photoCount,
        trainerNotes: trainerNotes || 'No recent notes',
        source: 'client',
      },
      profile
    );
  } catch (error) {
    console.error('[contextAggregation] aggregateUserContext failed:', error);
    return null;
  }
}

/**
 * Best available 7-day context: server first, Firestore fallback.
 */
export async function loadCoachContext(userId, userProfile = {}) {
  const fromServer = await fetchWeeklyContextFromServer(userId);
  if (fromServer) return { ...fromServer, source: 'server' };

  const fromClient = await aggregateUserContext(userId, userProfile);
  if (fromClient) return fromClient;

  return normalizeCoachContext(
    {
      user: userProfile,
      macroTargets: userProfile?.macroTargets,
      source: 'profile-only',
    },
    userProfile
  );
}

/**
 * Compact system-prompt block (server still builds the full prompt; this supplements userProfile).
 */
/** 0–100 score for how much logged data the coach can use. */
export function calculateDataQuality(context) {
  if (!context) return 0;
  let quality = 0;
  const days = Number(context.nutritionDaysLogged) || 0;
  const workouts = Number(context.workoutsLogged) || 0;
  const sleep = parseFloat(context.avgSleep);
  const streak = Number(context.streakDays) || 0;

  if (days >= 6) quality += 30;
  else if (days >= 3) quality += 15;
  if (workouts >= 3) quality += 30;
  else if (workouts >= 1) quality += 15;
  if (Number.isFinite(sleep) && sleep >= 7) quality += 20;
  else if (Number.isFinite(sleep) && sleep >= 6) quality += 10;
  if (streak > 0) quality += 20;

  return Math.min(100, quality);
}

/** Day-14 macro recalibration via server Admin SDK (avoids client Firestore permission gaps). */
async function runMacroRecalibrationViaServer(userId) {
  const idToken = await auth?.currentUser?.getIdToken?.();
  if (!idToken) return { success: true, skipped: true, reason: 'not_signed_in' };

  const { shouldRecalibrateMacros } = await import('./macroRecalibration');
  const eligible = await shouldRecalibrateMacros(userId);
  if (!eligible) return { success: true, skipped: true, reason: 'not_eligible' };

  for (const base of getAICoachApiBases()) {
    const url = `${String(base).replace(/\/$/, '')}/api/macro-recalibration`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) break;
        continue;
      }
      if (data.reason === 'not_enough_data') {
        return { success: true, skipped: true, reason: 'not_enough_data' };
      }
      return {
        success: data.success !== false,
        adjusted: data.adjusted === true,
        message: data.message,
        details: data.details,
        skipped: false,
      };
    } catch (_) {
      continue;
    }
  }

  return { success: true, skipped: true, reason: 'server_unreachable' };
}

/**
 * Loads coach context, optionally runs day-14 macro recalibration, adds quality metadata.
 */
export async function loadCoachContextEnhanced(userId, userProfile = {}, options = {}) {
  const { skipRecalibration = false } = options;
  let recalibrationResult = null;

  if (!skipRecalibration && userId) {
    try {
      recalibrationResult = await runMacroRecalibrationViaServer(userId);
    } catch (e) {
      console.warn('[loadCoachContextEnhanced] recalibration skipped:', e?.message || e);
    }
  }

  const context = await loadCoachContext(userId, userProfile);
  const enriched = {
    ...context,
    _lastUpdated: new Date().toISOString(),
    _dataQuality: calculateDataQuality(context),
    _recalibration: recalibrationResult,
  };

  if (recalibrationResult?.adjusted && recalibrationResult?.message) {
    enriched._recalibrationNote = recalibrationResult.message;
  }

  return enriched;
}

function formatDailyFoodLogForPrompt(dailyFoodLog) {
  if (!Array.isArray(dailyFoodLog) || !dailyFoodLog.length) return '';
  return dailyFoodLog
    .map((d) => {
      const meals = (d.meals || [])
        .map((m) => `${m.meal}: ${m.food} (${m.calories} cal)`)
        .join('; ');
      return `${d.date}: ${d.calories} cal — ${meals || (d.foods || []).join(', ')}`;
    })
    .join('\n');
}

export function buildContextSystemBlock(context) {
  if (!context) return '';
  const dailyLines = formatDailyFoodLogForPrompt(context.dailyFoodLog);
  return `CLIENT 7-DAY SNAPSHOT (from app):
User: ${context.userName}
Goal: ${context.goal}
Training level: ${context.trainingLevel}
Plan: ${context.currentPlan}
Nutrition: ${context.avgCals} kcal/day avg (target ${context.targetCals}), ${context.avgProtein}g protein, ${context.nutritionDaysLogged}/7 days logged (${context.nutritionConsistency}%)
${dailyLines ? `Daily food log:\n${dailyLines}\n` : ''}Workouts: ${context.workoutsLogged} sessions, volume trend ${context.volumeTrend}, avg RPE ${context.avgRPE}
Sleep: ${context.avgSleep} h/night avg
Streak: ${context.streakDays} days
Trainer notes:
${context.trainerNotes}`;
}
