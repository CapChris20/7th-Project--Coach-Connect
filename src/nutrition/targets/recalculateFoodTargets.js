// Day-14 macro recalibration from actual nutrition_logs vs the current calorie/macro targets.
// Flow: count logged days → compare average calories to the estimate → rewrite targets if they drifted.
// Used by the nutrition home/check after onboarding. Needs 8+ logged days in the last 14.

import { db } from '../../app-start/cloudConnection';
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
import { getDailyGoals, upsertDailyGoals } from '../daily-log/saveLoggedFood';

// ===== NAMED CONSTANTS =====

const LOGS_COLLECTION = 'nutrition_logs';
const GOALS_COLLECTION = 'nutrition_goals';
const USERS_COLLECTION = 'users';
const MACRO_TARGETS_SUBCOLLECTION = 'macroTargets';
const MACRO_TARGETS_DOC_ID = 'current';
const MACRO_HISTORY_SUBCOLLECTION = 'macroHistory';
const MIN_LOGGED_DAYS = 8;
const ERROR_THRESHOLD_PERCENT = 15;
const RECALIBRATION_DAYS = 14;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MS_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;
const DEFAULT_CALORIES = 2000;
const DEFAULT_PROTEIN_GRAMS = 160;
const DEFAULT_CARBS_GRAMS = 200;
const DEFAULT_FAT_GRAMS = 70;
const MIN_PROTEIN_GRAMS = 50;
const MIN_CARBS_GRAMS = 50;
const MIN_FAT_GRAMS = 30;
const KCAL_PER_GRAM_PROTEIN = 4;
const KCAL_PER_GRAM_CARBS = 4;
const KCAL_PER_GRAM_FAT = 9;
const CUT_CALORIE_MULTIPLIER = 0.95;
const BULK_CALORIE_MULTIPLIER = 1.05;
const MAINTAIN_CALORIE_MULTIPLIER = 1;
const DEFAULT_MACRO_SPLIT = { protein: 0.3, carbs: 0.4, fat: 0.3 };
const CONFIDENCE_HIGH = 'high';
const UPDATED_BY_RECALIBRATION = 'macroRecalibration';
const PERMISSION_DENIED = 'permission-denied';

// ===== HELPER FUNCTIONS =====

function formatDateKey(date = new Date()) {
  const dateObject = date instanceof Date ? date : new Date(date);
  return [
    dateObject.getFullYear(),
    String(dateObject.getMonth() + 1).padStart(2, '0'),
    String(dateObject.getDate()).padStart(2, '0'),
  ].join('-');
}

function tsToDate(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp.seconds) return new Date(timestamp.seconds * MS_PER_SECOND);
  if (timestamp instanceof Date) return timestamp;
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed);
}

function daysBetween(startDate, endDate) {
  const ms = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.floor(ms / MS_PER_DAY);
}

function goalAdjustMultiplier(goalRaw) {
  const goalText = String(goalRaw || '').toLowerCase();
  if (goalText.includes('lose') || goalText.includes('cut') || goalText.includes('fat')) {
    return CUT_CALORIE_MULTIPLIER;
  }
  if (goalText.includes('muscle') || goalText.includes('bulk') || goalText.includes('build')) {
    return BULK_CALORIE_MULTIPLIER;
  }
  return MAINTAIN_CALORIE_MULTIPLIER;
}

function lookbackStartKey(lookbackDays) {
  const start = new Date();
  start.setDate(start.getDate() - lookbackDays);
  return formatDateKey(start);
}

function caloriesByDayFromLogs(logDocs) {
  const byDay = {};
  logDocs.forEach((logDoc) => {
    const data = logDoc.data() || {};
    const day = data.date;
    if (!day) return;
    byDay[day] = (byDay[day] || 0) + (Number(data.calories) || 0);
  });
  return byDay;
}

function averageCaloriesFromDayMap(byDay) {
  const days = Object.entries(byDay).filter(([, calories]) => calories > 0);
  const total = days.reduce((sum, [, calories]) => sum + calories, 0);
  const actualAvgCals = days.length ? Math.round(total / days.length) : 0;
  return { loggedDays: days.length, actualAvgCals };
}

async function fetchDailyCalorieStats(userId, lookbackDays = RECALIBRATION_DAYS) {
  const startKey = lookbackStartKey(lookbackDays);
  const snapshot = await getDocs(
    query(
      collection(db, LOGS_COLLECTION),
      where('user_id', '==', userId),
      where('date', '>=', startKey),
    ),
  );
  const byDay = caloriesByDayFromLogs(snapshot.docs);
  return averageCaloriesFromDayMap(byDay);
}

async function readMacroTargetsDoc(userId) {
  try {
    const macroSnap = await getDoc(
      doc(db, USERS_COLLECTION, userId, MACRO_TARGETS_SUBCOLLECTION, MACRO_TARGETS_DOC_ID),
    );
    if (!macroSnap.exists()) return null;
    return macroSnap.data();
  } catch (ignoredError) {
    return null;
  }
}

function firstPositiveNumber(candidates, fallback) {
  for (const value of candidates) {
    const asNumber = Number(value);
    if (asNumber) return asNumber;
  }
  return fallback;
}

async function readMacroBaseline(userId) {
  const goals = await getDailyGoals(userId);
  const macroDoc = await readMacroTargetsDoc(userId);
  const userSnap = await getDoc(doc(db, USERS_COLLECTION, userId));
  const userData = userSnap.exists() ? userSnap.data() : {};

  const initialEstimate = Math.round(
    firstPositiveNumber(
      [
        macroDoc?.calories,
        goals?.calories,
        userData?.macroTargets?.calories,
        userData?.macroTargets?.cals,
      ],
      DEFAULT_CALORIES,
    ),
  );

  const protein = firstPositiveNumber(
    [macroDoc?.protein, goals?.proteinTarget, userData?.macroTargets?.protein],
    DEFAULT_PROTEIN_GRAMS,
  );
  const carbs = firstPositiveNumber(
    [macroDoc?.carbs, goals?.carbsTarget, userData?.macroTargets?.carbs],
    DEFAULT_CARBS_GRAMS,
  );
  const fat = firstPositiveNumber(
    [macroDoc?.fat, goals?.fatTarget, userData?.macroTargets?.fats, userData?.macroTargets?.fat],
    DEFAULT_FAT_GRAMS,
  );

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
    doc(db, USERS_COLLECTION, userId, MACRO_TARGETS_SUBCOLLECTION, MACRO_TARGETS_DOC_ID),
    {
      calories: goalsPayload.calories,
      protein: goalsPayload.proteinTarget,
      carbs: goalsPayload.carbsTarget,
      fat: goalsPayload.fatTarget,
      confidence: payload.confidence || CONFIDENCE_HIGH,
      recalibratedAt: serverTimestamp(),
      initialEstimate: payload.initialEstimate,
      actualAverage: payload.actualAverage,
      errorPercent: payload.errorPercent,
      updatedBy: UPDATED_BY_RECALIBRATION,
    },
    { merge: true },
  );

  try {
    await addDoc(collection(db, USERS_COLLECTION, userId, MACRO_HISTORY_SUBCOLLECTION), {
      event: 'recalibration',
      timestamp: serverTimestamp(),
      ...payload,
    });
  } catch (ignoredError) {
    /* non-fatal */
  }
}

function scaledMacroGrams(adjustedCals, grams, initialEstimate, kcalPerGram, minGrams) {
  const ratio = grams / Math.max(initialEstimate, 1);
  return Math.max(minGrams, Math.round((adjustedCals * ratio) / kcalPerGram));
}

function goalTextFromBaseline(baseline) {
  return (
    baseline.userData?.primaryGoal ||
    baseline.userData?.goal ||
    baseline.macroDoc?.goal ||
    'maintain'
  );
}

async function markTargetsVerified(userId) {
  await setDoc(
    doc(db, USERS_COLLECTION, userId, MACRO_TARGETS_SUBCOLLECTION, MACRO_TARGETS_DOC_ID),
    { confidence: CONFIDENCE_HIGH, verifiedAt: serverTimestamp() },
    { merge: true },
  );
}

function isPermissionError(error) {
  const code = error?.code || '';
  return code === PERMISSION_DENIED || String(error?.message || '').includes('permission');
}

function onboardingAnchorDate(userData, macroSnap) {
  return (
    tsToDate(userData.onboardingCompletedAt) ||
    tsToDate(userData.createdAt) ||
    tsToDate(macroSnap.data()?.createdAt)
  );
}

function alreadyRecalibratedHighConfidence(macroSnap) {
  if (!macroSnap.exists()) return false;
  const data = macroSnap.data();
  return data?.confidence === CONFIDENCE_HIGH && Boolean(data?.recalibratedAt);
}

function notEnoughLoggedDaysResult(loggedDays) {
  return {
    success: false,
    reason: 'not_enough_data',
    message: `Log at least ${MIN_LOGGED_DAYS} days of meals to recalibrate (you have ${loggedDays}).`,
  };
}

function estimateErrorPercent(actualAvgCals, initialEstimate) {
  const error = Math.abs(actualAvgCals - initialEstimate);
  if (initialEstimate > 0) return (error / initialEstimate) * 100;
  return 0;
}

async function accurateTargetsResult(userId, errorPercent) {
  await markTargetsVerified(userId);
  return {
    success: true,
    adjusted: false,
    reason: 'accurate',
    message: 'Your macro targets already match what you have been logging.',
    errorPercent: Number(errorPercent.toFixed(1)),
  };
}

function adjustedMacroGrams(adjustedCals, baseline, initialEstimate) {
  return {
    protein: scaledMacroGrams(
      adjustedCals,
      baseline.protein,
      initialEstimate,
      KCAL_PER_GRAM_PROTEIN,
      MIN_PROTEIN_GRAMS,
    ),
    carbs: scaledMacroGrams(
      adjustedCals,
      baseline.carbs,
      initialEstimate,
      KCAL_PER_GRAM_CARBS,
      MIN_CARBS_GRAMS,
    ),
    fat: scaledMacroGrams(
      adjustedCals,
      baseline.fat,
      initialEstimate,
      KCAL_PER_GRAM_FAT,
      MIN_FAT_GRAMS,
    ),
  };
}

async function persistAdjustedMacros({
  userId,
  baseline,
  initialEstimate,
  actualAvgCals,
  errorPercent,
  loggedDays,
  goalRaw,
}) {
  const adjustedCals = Math.round(actualAvgCals * goalAdjustMultiplier(goalRaw));
  const grams = adjustedMacroGrams(adjustedCals, baseline, initialEstimate);
  const goalsPayload = {
    calories: adjustedCals,
    proteinTarget: grams.protein,
    carbsTarget: grams.carbs,
    fatTarget: grams.fat,
    macroSplit: baseline.goals?.macroSplit || DEFAULT_MACRO_SPLIT,
  };

  await persistMacroTargets(
    userId,
    {
      confidence: CONFIDENCE_HIGH,
      initialEstimate,
      actualAverage: actualAvgCals,
      errorPercent: Number(errorPercent.toFixed(1)),
      previousCals: initialEstimate,
      newCals: adjustedCals,
      newProtein: grams.protein,
      newCarbs: grams.carbs,
      newFat: grams.fat,
    },
    goalsPayload,
  );

  return {
    success: true,
    adjusted: true,
    message: `Macros updated from ~${initialEstimate} to ${adjustedCals} kcal/day based on your last ${loggedDays} logged days.`,
    details: {
      previousCals: initialEstimate,
      newCals: adjustedCals,
      newProtein: grams.protein,
      newCarbs: grams.carbs,
      newFat: grams.fat,
      errorPercent: Number(errorPercent.toFixed(1)),
    },
  };
}

async function recalibrateMacrosBody(userId) {
  const { loggedDays, actualAvgCals } = await fetchDailyCalorieStats(userId);
  if (loggedDays < MIN_LOGGED_DAYS) return notEnoughLoggedDaysResult(loggedDays);

  const baseline = await readMacroBaseline(userId);
  const initialEstimate = baseline.initialEstimate;
  const errorPercent = estimateErrorPercent(actualAvgCals, initialEstimate);
  if (errorPercent <= ERROR_THRESHOLD_PERCENT) {
    return accurateTargetsResult(userId, errorPercent);
  }

  return persistAdjustedMacros({
    userId,
    baseline,
    initialEstimate,
    actualAvgCals,
    errorPercent,
    loggedDays,
    goalRaw: goalTextFromBaseline(baseline),
  });
}

function recalibrationFailure(error) {
  console.error('[macroRecalibration] failed:', error);
  return {
    success: false,
    error: error?.message || String(error),
    message: 'Could not recalibrate macros right now.',
  };
}

// ===== MAIN FUNCTION =====

/**
 * Reverse-engineer maintenance from logged nutrition (14-day window).
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function recalibrateMacros(userId) {
  if (!userId || !db) {
    return { success: false, reason: 'Missing user' };
  }
  try {
    return await recalibrateMacrosBody(userId);
  } catch (error) {
    return recalibrationFailure(error);
  }
}

/**
 * True when user is 14+ days from anchor and not yet high-confidence recalibrated.
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function shouldRecalibrateMacros(userId) {
  if (!userId || !db) return false;

  try {
    const macroSnap = await getDoc(
      doc(db, USERS_COLLECTION, userId, MACRO_TARGETS_SUBCOLLECTION, MACRO_TARGETS_DOC_ID),
    );
    if (alreadyRecalibratedHighConfidence(macroSnap)) return false;

    const userSnap = await getDoc(doc(db, USERS_COLLECTION, userId));
    if (!userSnap.exists()) return false;
    const userData = userSnap.data();
    const anchor = onboardingAnchorDate(userData, macroSnap);
    if (!anchor) return false;

    const days = daysBetween(anchor, new Date());
    return days >= RECALIBRATION_DAYS;
  } catch (error) {
    if (isPermissionError(error)) {
      console.warn('[shouldRecalibrateMacros] Firestore rules missing for macroTargets — deploy firestore.rules');
    }
    if (!isPermissionError(error)) {
      console.warn('[shouldRecalibrateMacros]', error?.message || error);
    }
    return false;
  }
}

/**
 * Run recalibration only when eligible.
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function recalibrateIfEligible(userId) {
  const eligible = await shouldRecalibrateMacros(userId);
  if (!eligible) return { success: true, skipped: true };
  return recalibrateMacros(userId);
}

