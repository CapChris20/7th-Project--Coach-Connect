// Day-14 macro recalibration: compare logged meals to current calorie/macro targets.
// Flow: count logged days → compare average calories → rewrite targets when drift is big.
// Used after onboarding on nutrition home. Needs 8+ logged days in the last 14.
// Key exports: recalibrateMacros, shouldRecalibrateMacros, recalibrateIfEligible.
//
// vocab: nutrition_logs = Firestore meal rows keyed by user_id + date
// vocab: macroTargets/current = the live calorie/macro doc under users/{uid}

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
const USERS_COLLECTION = 'users';
const MACRO_TARGETS_SUBCOLLECTION = 'macroTargets';
const MACRO_TARGETS_DOC_ID = 'current';
const MACRO_HISTORY_SUBCOLLECTION = 'macroHistory';

// Manipulate here: how many logged days and how far off before we rewrite targets
const MIN_LOGGED_DAYS = 8;
const ERROR_THRESHOLD_PERCENT = 15;
const RECALIBRATION_DAYS = 14;

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MS_PER_DAY =
  HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;

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

// Manipulate here: goal text → calorie nudge after we trust the logged average
const CUT_CALORIE_MULTIPLIER = 0.95;
const BULK_CALORIE_MULTIPLIER = 1.05;
const MAINTAIN_CALORIE_MULTIPLIER = 1;

const DEFAULT_MACRO_SPLIT = { protein: 0.3, carbs: 0.4, fat: 0.3 };
const CONFIDENCE_HIGH = 'high';
const UPDATED_BY_RECALIBRATION = 'macroRecalibration';
const PERMISSION_DENIED = 'permission-denied';
const HISTORY_EVENT_RECALIBRATION = 'recalibration';
const RESULT_REASON_NOT_ENOUGH_DATA = 'not_enough_data';
const RESULT_REASON_ACCURATE = 'accurate';

// ===== HELPER FUNCTIONS =====

/**
 * Turn a Date (or date-like) into the app's day key: "2026-10-09".
 * @param {Date|string|number} [date]
 * @returns {string}
 */
function formatDateKey(date = new Date()) {
  let dateObject = new Date(date);
  if (date instanceof Date) {
    dateObject = date;
  }
  const year = dateObject.getFullYear();
  const month = String(dateObject.getMonth() + 1).padStart(2, '0');
  const day = String(dateObject.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Firestore Timestamp / seconds / Date / ISO string → Date, or null.
 * @param {*} timestamp
 * @returns {Date|null}
 */
function firestoreTimestampToDate(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp.seconds) return new Date(timestamp.seconds * MS_PER_SECOND);
  if (timestamp instanceof Date) return timestamp;
  const parsedMilliseconds = Date.parse(timestamp);
  if (Number.isNaN(parsedMilliseconds)) return null;
  return new Date(parsedMilliseconds);
}

/**
 * Whole calendar days between two Dates (absolute, floored).
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {number}
 */
function daysBetweenCalendarDates(startDate, endDate) {
  const elapsedMilliseconds = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.floor(elapsedMilliseconds / MS_PER_DAY);
}

/**
 * Cut / bulk / maintain multiplier from free-text goal fields.
 * @param {*} goalRaw
 * @returns {number}
 */
function calorieMultiplierForGoal(goalRaw) {
  const goalText = String(goalRaw || '').toLowerCase();
  const looksLikeCut =
    goalText.includes('lose') || goalText.includes('cut') || goalText.includes('fat');
  if (looksLikeCut) return CUT_CALORIE_MULTIPLIER;

  const looksLikeBulk =
    goalText.includes('muscle') || goalText.includes('bulk') || goalText.includes('build');
  if (looksLikeBulk) return BULK_CALORIE_MULTIPLIER;

  return MAINTAIN_CALORIE_MULTIPLIER;
}

/**
 * YYYY-MM-DD for "today minus lookbackDays".
 * @param {number} lookbackDays
 * @returns {string}
 */
function lookbackStartDateKey(lookbackDays) {
  const start = new Date();
  start.setDate(start.getDate() - lookbackDays);
  return formatDateKey(start);
}

/**
 * Sum calories on each log date from nutrition_logs docs.
 * @param {Array} logDocs
 * @returns {Object.<string, number>}
 */
function sumCaloriesPerDayFromLogDocs(logDocs) {
  const caloriesPerDay = {};
  for (const logDoc of logDocs) {
    const data = logDoc.data() || {};
    const dayKey = data.date;
    if (!dayKey) continue;
    const previous = caloriesPerDay[dayKey] || 0;
    caloriesPerDay[dayKey] = previous + (Number(data.calories) || 0);
  }
  return caloriesPerDay;
}

/**
 * Average calories across days that have food logged (calories > 0).
 * @param {Object.<string, number>} caloriesPerDay
 * @returns {{ loggedDays: number, averageDailyCalories: number }}
 */
function averageCaloriesFromDayMap(caloriesPerDay) {
  // Only days with calories > 0 count as "logged" for the average.
  const dayKeys = Object.keys(caloriesPerDay);
  let totalCalories = 0;
  let loggedDays = 0;
  for (let index = 0; index < dayKeys.length; index += 1) {
    const calories = caloriesPerDay[dayKeys[index]];
    if (calories <= 0) continue;
    totalCalories += calories;
    loggedDays += 1;
  }
  let averageDailyCalories = 0;
  if (loggedDays) {
    averageDailyCalories = Math.round(totalCalories / loggedDays);
  }
  return { loggedDays, averageDailyCalories };
}

function readMacroSplitOrDefault(macroBaseline) {
  if (!macroBaseline.goals) return DEFAULT_MACRO_SPLIT;
  if (!macroBaseline.goals.macroSplit) return DEFAULT_MACRO_SPLIT;
  return macroBaseline.goals.macroSplit;
}

/**
 * First truthy Number() from a candidate list, else fallback.
 * @param {Array} candidates
 * @param {number} fallback
 * @returns {number}
 */
function firstPositiveNumber(candidates, fallback) {
  for (const value of candidates) {
    const asNumber = Number(value);
    if (asNumber) return asNumber;
  }
  return fallback;
}

/**
 * Scale one macro gram target with the calorie change, floor at minGrams.
 * @returns {number}
 */
function scaleMacroGramsFromBaseline(
  adjustedCalories,
  baselineGrams,
  initialEstimate,
  kcalPerGram,
  minGrams,
) {
  const safeEstimate = Math.max(initialEstimate, 1);
  const gramsPerCalorie = baselineGrams / safeEstimate;
  const scaledGrams = Math.round((adjustedCalories * gramsPerCalorie) / kcalPerGram);
  return Math.max(minGrams, scaledGrams);
}

/**
 * Primary goal string from user / macro docs (letters stay as stored).
 * @param {object} macroBaseline
 * @returns {string}
 */
function readPrimaryGoalText(macroBaseline) {
  // Prefer user primaryGoal, then user goal, then macro doc goal.
  if (macroBaseline.userData) {
    if (macroBaseline.userData.primaryGoal) return macroBaseline.userData.primaryGoal;
    if (macroBaseline.userData.goal) return macroBaseline.userData.goal;
  }
  if (macroBaseline.macroDoc && macroBaseline.macroDoc.goal) {
    return macroBaseline.macroDoc.goal;
  }
  return 'maintain';
}

/**
 * True when Firestore rejected the read for rules (not a logic failure).
 * @param {*} error
 * @returns {boolean}
 */
function isFirestorePermissionError(error) {
  let code = '';
  if (error && error.code) code = error.code;
  if (code === PERMISSION_DENIED) return true;
  let message = '';
  if (error && error.message) message = String(error.message);
  return message.includes('permission');
}

/**
 * Onboarding / account created / macro doc created — first date we can find.
 * @param {object} userData
 * @param {*} macroSnap
 * @returns {Date|null}
 */
function pickOnboardingAnchorDate(userData, macroSnap) {
  const fromOnboarding = firestoreTimestampToDate(userData.onboardingCompletedAt);
  if (fromOnboarding) return fromOnboarding;

  const fromCreated = firestoreTimestampToDate(userData.createdAt);
  if (fromCreated) return fromCreated;

  let macroCreatedAt = null;
  if (macroSnap.exists()) {
    const macroData = macroSnap.data();
    if (macroData) macroCreatedAt = macroData.createdAt;
  }
  return firestoreTimestampToDate(macroCreatedAt);
}

/**
 * Already ran a high-confidence recalibration — do not run again.
 * @param {*} macroSnap
 * @returns {boolean}
 */
function userAlreadyRecalibratedWithHighConfidence(macroSnap) {
  if (!macroSnap.exists()) return false;
  const data = macroSnap.data();
  if (!data) return false;
  const isHighConfidence = data.confidence === CONFIDENCE_HIGH;
  const hasRecalibratedAt = Boolean(data.recalibratedAt);
  return isHighConfidence && hasRecalibratedAt;
}

/**
 * How far average logged calories sit from the initial estimate (percent).
 * @param {number} averageDailyCalories
 * @param {number} initialEstimate
 * @returns {number}
 */
function computeEstimateErrorPercent(averageDailyCalories, initialEstimate) {
  const error = Math.abs(averageDailyCalories - initialEstimate);
  if (initialEstimate > 0) return (error / initialEstimate) * 100;
  return 0;
}

function buildNotEnoughLoggedDaysResult(loggedDays) {
  return {
    success: false,
    reason: RESULT_REASON_NOT_ENOUGH_DATA,
    message: `Log at least ${MIN_LOGGED_DAYS} days of meals to recalibrate (you have ${loggedDays}).`,
  };
}

function buildRecalibrationFailureResult(error) {
  console.error('[macroRecalibration] failed:', error);
  let errorText = String(error);
  if (error && error.message) errorText = error.message;
  return {
    success: false,
    error: errorText,
    message: 'Could not recalibrate macros right now.',
  };
}

function computeAdjustedMacroGrams(adjustedCalories, macroBaseline, initialEstimate) {
  return {
    protein: scaleMacroGramsFromBaseline(
      adjustedCalories,
      macroBaseline.protein,
      initialEstimate,
      KCAL_PER_GRAM_PROTEIN,
      MIN_PROTEIN_GRAMS,
    ),
    carbs: scaleMacroGramsFromBaseline(
      adjustedCalories,
      macroBaseline.carbs,
      initialEstimate,
      KCAL_PER_GRAM_CARBS,
      MIN_CARBS_GRAMS,
    ),
    fat: scaleMacroGramsFromBaseline(
      adjustedCalories,
      macroBaseline.fat,
      initialEstimate,
      KCAL_PER_GRAM_FAT,
      MIN_FAT_GRAMS,
    ),
  };
}

// ===== MAIN FUNCTION =====

/**
 * Reverse-engineer maintenance calories from logged nutrition (14-day window).
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function recalibrateMacros(userId) {
  // 1. Need a signed-in user and a live Firestore handle.
  if (!userId || !db) {
    return { success: false, reason: 'Missing user' };
  }

  // 2. Run the pipeline; never throw to callers — return a friendly failure object.
  try {
    return await runMacroRecalibrationForUser(userId);
  } catch (error) {
    return buildRecalibrationFailureResult(error);
  }
}

/**
 * True when the user is 14+ days past onboarding and not yet high-confidence recalibrated.
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function shouldRecalibrateMacros(userId) {
  if (!userId || !db) return false;

  try {
    return await checkIfUserIsDueForRecalibration(userId);
  } catch (error) {
    warnAboutRecalibrationEligibilityError(error);
    return false;
  }
}

/**
 * Run recalibration only when shouldRecalibrateMacros says the user is due.
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function recalibrateIfEligible(userId) {
  // 1. Ask eligibility first so we do not rewrite accurate targets early.
  const eligible = await shouldRecalibrateMacros(userId);
  if (!eligible) return { success: true, skipped: true };

  // 2. Same path as a manual recalibrate call.
  return recalibrateMacros(userId);
}

// PLUMBING — skip unless debugging

async function checkIfUserIsDueForRecalibration(userId) {
  const macroSnap = await getDoc(
    doc(db, USERS_COLLECTION, userId, MACRO_TARGETS_SUBCOLLECTION, MACRO_TARGETS_DOC_ID),
  );
  if (userAlreadyRecalibratedWithHighConfidence(macroSnap)) return false;

  const userSnap = await getDoc(doc(db, USERS_COLLECTION, userId));
  if (!userSnap.exists()) return false;

  const userData = userSnap.data();
  const anchorDate = pickOnboardingAnchorDate(userData, macroSnap);
  if (!anchorDate) return false;

  const daysSinceAnchor = daysBetweenCalendarDates(anchorDate, new Date());
  return daysSinceAnchor >= RECALIBRATION_DAYS;
}

function warnAboutRecalibrationEligibilityError(error) {
  if (isFirestorePermissionError(error)) {
    console.warn(
      '[shouldRecalibrateMacros] Firestore rules missing for macroTargets — deploy firestore.rules',
    );
    return;
  }
  let warnText = error;
  if (error && error.message) warnText = error.message;
  console.warn('[shouldRecalibrateMacros]', warnText);
}

async function runMacroRecalibrationForUser(userId) {
  const { loggedDays, averageDailyCalories } = await loadAverageDailyCaloriesFromLogs(userId);
  if (loggedDays < MIN_LOGGED_DAYS) {
    return buildNotEnoughLoggedDaysResult(loggedDays);
  }

  const macroBaseline = await loadMacroBaselineForUser(userId);
  const initialEstimate = macroBaseline.initialEstimate;
  const errorPercent = computeEstimateErrorPercent(averageDailyCalories, initialEstimate);
  if (errorPercent <= ERROR_THRESHOLD_PERCENT) {
    return markTargetsAccurateAndReturn(userId, errorPercent);
  }

  return saveAdjustedMacrosAndReturn({
    userId,
    macroBaseline,
    initialEstimate,
    averageDailyCalories,
    errorPercent,
    loggedDays,
    goalRaw: readPrimaryGoalText(macroBaseline),
  });
}

async function loadAverageDailyCaloriesFromLogs(userId, lookbackDays = RECALIBRATION_DAYS) {
  const startKey = lookbackStartDateKey(lookbackDays);
  // vocab: where('user_id'…) / where('date'…) = field letters frozen on nutrition_logs
  const snapshot = await getDocs(
    query(
      collection(db, LOGS_COLLECTION),
      where('user_id', '==', userId),
      where('date', '>=', startKey),
    ),
  );
  const caloriesPerDay = sumCaloriesPerDayFromLogDocs(snapshot.docs);
  return averageCaloriesFromDayMap(caloriesPerDay);
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

function readNestedMacroField(userData, fieldName) {
  if (!userData) return undefined;
  if (!userData.macroTargets) return undefined;
  return userData.macroTargets[fieldName];
}

function calorieCandidatesFromBaseline(macroDoc, goals, userData) {
  const candidates = [];
  if (macroDoc) candidates.push(macroDoc.calories);
  if (goals) candidates.push(goals.calories);
  candidates.push(readNestedMacroField(userData, 'calories'));
  candidates.push(readNestedMacroField(userData, 'cals'));
  return candidates;
}

function proteinCandidatesFromBaseline(macroDoc, goals, userData) {
  const candidates = [];
  if (macroDoc) candidates.push(macroDoc.protein);
  if (goals) candidates.push(goals.proteinTarget);
  candidates.push(readNestedMacroField(userData, 'protein'));
  return candidates;
}

function carbsCandidatesFromBaseline(macroDoc, goals, userData) {
  const candidates = [];
  if (macroDoc) candidates.push(macroDoc.carbs);
  if (goals) candidates.push(goals.carbsTarget);
  candidates.push(readNestedMacroField(userData, 'carbs'));
  return candidates;
}

function fatCandidatesFromBaseline(macroDoc, goals, userData) {
  const candidates = [];
  if (macroDoc) candidates.push(macroDoc.fat);
  if (goals) candidates.push(goals.fatTarget);
  candidates.push(readNestedMacroField(userData, 'fats'));
  candidates.push(readNestedMacroField(userData, 'fat'));
  return candidates;
}

async function loadMacroBaselineForUser(userId) {
  const goals = await getDailyGoals(userId);
  const macroDoc = await readMacroTargetsDoc(userId);
  const userSnap = await getDoc(doc(db, USERS_COLLECTION, userId));
  let userData = {};
  if (userSnap.exists()) {
    userData = userSnap.data();
  }

  const initialEstimate = Math.round(
    firstPositiveNumber(
      calorieCandidatesFromBaseline(macroDoc, goals, userData),
      DEFAULT_CALORIES,
    ),
  );

  const protein = firstPositiveNumber(
    proteinCandidatesFromBaseline(macroDoc, goals, userData),
    DEFAULT_PROTEIN_GRAMS,
  );
  const carbs = firstPositiveNumber(
    carbsCandidatesFromBaseline(macroDoc, goals, userData),
    DEFAULT_CARBS_GRAMS,
  );
  const fat = firstPositiveNumber(
    fatCandidatesFromBaseline(macroDoc, goals, userData),
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

async function persistMacroTargets(userId, historyPayload, goalsPayload) {
  await upsertDailyGoals(userId, goalsPayload);

  await setDoc(
    doc(db, USERS_COLLECTION, userId, MACRO_TARGETS_SUBCOLLECTION, MACRO_TARGETS_DOC_ID),
    {
      calories: goalsPayload.calories,
      protein: goalsPayload.proteinTarget,
      carbs: goalsPayload.carbsTarget,
      fat: goalsPayload.fatTarget,
      confidence: historyPayload.confidence || CONFIDENCE_HIGH,
      recalibratedAt: serverTimestamp(),
      initialEstimate: historyPayload.initialEstimate,
      actualAverage: historyPayload.actualAverage,
      errorPercent: historyPayload.errorPercent,
      updatedBy: UPDATED_BY_RECALIBRATION,
    },
    { merge: true },
  );

  try {
    await addDoc(collection(db, USERS_COLLECTION, userId, MACRO_HISTORY_SUBCOLLECTION), {
      event: HISTORY_EVENT_RECALIBRATION,
      timestamp: serverTimestamp(),
      ...historyPayload,
    });
  } catch (ignoredError) {
    /* history is nice-to-have — do not fail the live targets write */
  }
}

async function markTargetsVerifiedHighConfidence(userId) {
  await setDoc(
    doc(db, USERS_COLLECTION, userId, MACRO_TARGETS_SUBCOLLECTION, MACRO_TARGETS_DOC_ID),
    { confidence: CONFIDENCE_HIGH, verifiedAt: serverTimestamp() },
    { merge: true },
  );
}

async function markTargetsAccurateAndReturn(userId, errorPercent) {
  await markTargetsVerifiedHighConfidence(userId);
  return {
    success: true,
    adjusted: false,
    reason: RESULT_REASON_ACCURATE,
    message: 'Your macro targets already match what you have been logging.',
    errorPercent: Number(errorPercent.toFixed(1)),
  };
}

async function saveAdjustedMacrosAndReturn({
  userId,
  macroBaseline,
  initialEstimate,
  averageDailyCalories,
  errorPercent,
  loggedDays,
  goalRaw,
}) {
  const adjustedCalories = Math.round(
    averageDailyCalories * calorieMultiplierForGoal(goalRaw),
  );
  const grams = computeAdjustedMacroGrams(adjustedCalories, macroBaseline, initialEstimate);
  const goalsPayload = {
    calories: adjustedCalories,
    proteinTarget: grams.protein,
    carbsTarget: grams.carbs,
    fatTarget: grams.fat,
    macroSplit: readMacroSplitOrDefault(macroBaseline),
  };
  const roundedErrorPercent = Number(errorPercent.toFixed(1));

  await persistMacroTargets(
    userId,
    {
      confidence: CONFIDENCE_HIGH,
      initialEstimate,
      actualAverage: averageDailyCalories,
      errorPercent: roundedErrorPercent,
      previousCals: initialEstimate,
      newCals: adjustedCalories,
      newProtein: grams.protein,
      newCarbs: grams.carbs,
      newFat: grams.fat,
    },
    goalsPayload,
  );

  return {
    success: true,
    adjusted: true,
    message: `Macros updated from ~${initialEstimate} to ${adjustedCalories} kcal/day based on your last ${loggedDays} logged days.`,
    details: {
      previousCals: initialEstimate,
      newCals: adjustedCalories,
      newProtein: grams.protein,
      newCarbs: grams.carbs,
      newFat: grams.fat,
      errorPercent: roundedErrorPercent,
    },
  };
}
