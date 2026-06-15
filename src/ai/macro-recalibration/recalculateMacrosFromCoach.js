/**
 * macro Recalibration
 *
 * Purpose: macro Recalibration — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/ai
 * Key exports: recalibrateMacros, shouldRecalibrateMacros, recalibrateIfEligible
 *
 * @file-header
 */
/**
 * Day-14 macro recalibration from actual nutrition_logs + nutrition_goals.
 */
import { db } from '../../app/config';
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { getDailyGoals, upsertDailyGoals } from '../../nutrition/daily-log/logFoodToFirestore';

const LOGS_COLLECTION = 'nutrition_logs';
const GOALS_COLLECTION = 'nutrition_goals';
const MIN_LOGGED_DAYS = 8;
const ERROR_THRESHOLD_PERCENT = 15;
const RECALIBRATION_DAYS = 14;

function formatDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function tsToDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  if (ts instanceof Date) return ts;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

function daysBetween(a, b) {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function goalAdjustMultiplier(goalRaw) {
  const g = String(goalRaw || '').toLowerCase();
  if (g.includes('lose') || g.includes('cut') || g.includes('fat')) return 0.95;
  if (g.includes('muscle') || g.includes('bulk') || g.includes('build')) return 1.05;
  return 1;
}

async function fetchDailyCalorieStats(userId, lookbackDays = RECALIBRATION_DAYS) {
  const start = new Date();
  start.setDate(start.getDate() - lookbackDays);
  const startKey = formatDateKey(start);

  const snap = await getDocs(
    query(
      collection(db, LOGS_COLLECTION),
      where('user_id', '==', userId),
      where('date', '>=', startKey)
    )
  );

  const byDay = {};
  snap.docs.forEach((d) => {
    const data = d.data() || {};
    const day = data.date;
    if (!day) return;
    byDay[day] = (byDay[day] || 0) + (Number(data.calories) || 0);
  });

  const days = Object.entries(byDay).filter(([, cals]) => cals > 0);
  const total = days.reduce((sum, [, cals]) => sum + cals, 0);
  const actualAvgCals = days.length ? Math.round(total / days.length) : 0;

  return { loggedDays: days.length, actualAvgCals };
}

async function readMacroBaseline(userId) {
  const goals = await getDailyGoals(userId);
  let macroDoc = null;
  try {
    const mtSnap = await getDoc(doc(db, 'users', userId, 'macroTargets', 'current'));
    if (mtSnap.exists()) macroDoc = mtSnap.data();
  } catch (_) {
    /* ignore */
  }

  const userSnap = await getDoc(doc(db, 'users', userId));
  const userData = userSnap.exists() ? userSnap.data() : {};

  const initialEstimate = Math.round(
    Number(macroDoc?.calories) ||
      Number(goals?.calories) ||
      Number(userData?.macroTargets?.calories) ||
      Number(userData?.macroTargets?.cals) ||
      2000
  );

  const protein =
    Number(macroDoc?.protein) ||
    Number(goals?.proteinTarget) ||
    Number(userData?.macroTargets?.protein) ||
    160;
  const carbs =
    Number(macroDoc?.carbs) ||
    Number(goals?.carbsTarget) ||
    Number(userData?.macroTargets?.carbs) ||
    200;
  const fat =
    Number(macroDoc?.fat) ||
    Number(goals?.fatTarget) ||
    Number(userData?.macroTargets?.fats) ||
    Number(userData?.macroTargets?.fat) ||
    70;

  return {
    goals,
    macroDoc,
    userData,
    initialEstimate,
    protein,
    carbs,
    fat,
  };
}

async function persistMacroTargets(userId, payload, goalsPayload) {
  await upsertDailyGoals(userId, goalsPayload);

  await setDoc(
    doc(db, 'users', userId, 'macroTargets', 'current'),
    {
      calories: goalsPayload.calories,
      protein: goalsPayload.proteinTarget,
      carbs: goalsPayload.carbsTarget,
      fat: goalsPayload.fatTarget,
      confidence: payload.confidence || 'high',
      recalibratedAt: serverTimestamp(),
      initialEstimate: payload.initialEstimate,
      actualAverage: payload.actualAverage,
      errorPercent: payload.errorPercent,
      updatedBy: 'macroRecalibration',
    },
    { merge: true }
  );

  try {
    await addDoc(collection(db, 'users', userId, 'macroHistory'), {
      event: 'recalibration',
      timestamp: serverTimestamp(),
      ...payload,
    });
  } catch (_) {
    /* non-fatal */
  }
}

/**
 * Reverse-engineer maintenance from logged nutrition (14-day window).
 */
export async function recalibrateMacros(userId) {
  if (!userId || !db) {
    return { success: false, reason: 'Missing user' };
  }

  try {
    const { loggedDays, actualAvgCals } = await fetchDailyCalorieStats(userId);
    if (loggedDays < MIN_LOGGED_DAYS) {
      return {
        success: false,
        reason: 'not_enough_data',
        message: `Log at least ${MIN_LOGGED_DAYS} days of meals to recalibrate (you have ${loggedDays}).`,
      };
    }

    const baseline = await readMacroBaseline(userId);
    const initialEstimate = baseline.initialEstimate;
    const error = Math.abs(actualAvgCals - initialEstimate);
    const errorPercent = initialEstimate > 0 ? (error / initialEstimate) * 100 : 0;

    const goalRaw =
      baseline.userData?.primaryGoal ||
      baseline.userData?.goal ||
      baseline.macroDoc?.goal ||
      'maintain';

    if (errorPercent <= ERROR_THRESHOLD_PERCENT) {
      await setDoc(
        doc(db, 'users', userId, 'macroTargets', 'current'),
        { confidence: 'high', verifiedAt: serverTimestamp() },
        { merge: true }
      );
      return {
        success: true,
        adjusted: false,
        reason: 'accurate',
        message: 'Your macro targets already match what you have been logging.',
        errorPercent: Number(errorPercent.toFixed(1)),
      };
    }

    const adjustedCals = Math.round(actualAvgCals * goalAdjustMultiplier(goalRaw));
    const proteinRatio = baseline.protein / Math.max(initialEstimate, 1);
    const carbRatio = baseline.carbs / Math.max(initialEstimate, 1);
    const fatRatio = baseline.fat / Math.max(initialEstimate, 1);

    const newProtein = Math.max(50, Math.round((adjustedCals * proteinRatio) / 4));
    const newCarbs = Math.max(50, Math.round((adjustedCals * carbRatio) / 4));
    const newFat = Math.max(30, Math.round((adjustedCals * fatRatio) / 9));

    const goalsPayload = {
      calories: adjustedCals,
      proteinTarget: newProtein,
      carbsTarget: newCarbs,
      fatTarget: newFat,
      macroSplit: baseline.goals?.macroSplit || { protein: 0.3, carbs: 0.4, fat: 0.3 },
    };

    await persistMacroTargets(userId, {
      confidence: 'high',
      initialEstimate,
      actualAverage: actualAvgCals,
      errorPercent: Number(errorPercent.toFixed(1)),
      previousCals: initialEstimate,
      newCals: adjustedCals,
      newProtein,
      newCarbs,
      newFat,
    }, goalsPayload);

    return {
      success: true,
      adjusted: true,
      message: `Macros updated from ~${initialEstimate} to ${adjustedCals} kcal/day based on your last ${loggedDays} logged days.`,
      details: {
        previousCals: initialEstimate,
        newCals: adjustedCals,
        newProtein,
        newCarbs,
        newFat,
        errorPercent: Number(errorPercent.toFixed(1)),
      },
    };
  } catch (error) {
    console.error('[macroRecalibration] failed:', error);
    return {
      success: false,
      error: error?.message || String(error),
      message: 'Could not recalibrate macros right now.',
    };
  }
}

/**
 * True when user is 14+ days from anchor and not yet high-confidence recalibrated.
 */
export async function shouldRecalibrateMacros(userId) {
  if (!userId || !db) return false;

  try {
    const mtSnap = await getDoc(doc(db, 'users', userId, 'macroTargets', 'current'));
    if (mtSnap.exists() && mtSnap.data()?.confidence === 'high' && mtSnap.data()?.recalibratedAt) {
      return false;
    }

    const userSnap = await getDoc(doc(db, 'users', userId));
    if (!userSnap.exists()) return false;
    const userData = userSnap.data();

    const anchor =
      tsToDate(userData.onboardingCompletedAt) ||
      tsToDate(userData.createdAt) ||
      tsToDate(mtSnap.data()?.createdAt);

    if (!anchor) return false;

    const days = daysBetween(anchor, new Date());
    return days >= RECALIBRATION_DAYS;
  } catch (error) {
    const code = error?.code || '';
    if (code === 'permission-denied' || String(error?.message || '').includes('permission')) {
      console.warn('[shouldRecalibrateMacros] Firestore rules missing for macroTargets — deploy firestore.rules');
    } else {
      console.warn('[shouldRecalibrateMacros]', error?.message || error);
    }
    return false;
  }
}

/** Run recalibration only when eligible. */
export async function recalibrateIfEligible(userId) {
  const eligible = await shouldRecalibrateMacros(userId);
  if (!eligible) return { success: true, skipped: true };
  return recalibrateMacros(userId);
}
