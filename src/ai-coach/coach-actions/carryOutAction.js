// Runs a confirmed AI coach action: log food, water, sleep, or book a session.
// Flow: read the action name → refuse trainer writes → log food / water / book on the phone or server.
// Used by the confirm popup after the user taps Confirm.

import { auth, db } from '../../app-start/cloudConnection';
import { collection, addDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getClientDateKey } from '../../helpers/dateStrings';
import {
  mergeClientDailyMetrics,
  saveDashboardMetricField,
  saveDashboardSleepHours,
  saveDashboardWaterOz,
  saveDashboardWorkoutLog,
  clearClientDailyMetric,
} from '../../daily-stats/saveDailyStats';
import { getAICoachApiBases } from '../../for-both/online-connection/whereToConnect';
import { addFoodLog, deleteFoodLogsForDate } from '../../nutrition/daily-log/saveLoggedFood';
import { sanitizeDeleteFoodQuery } from './spotDeleteRequests';

// ===== NAMED CONSTANTS =====

const DEFAULT_SESSION_MINUTES = 60;
const MAX_SLEEP_HOURS = 24;
const DEFAULT_PROTEIN_G = 150;
const DEFAULT_CARBS_G = 200;
const DEFAULT_FAT_G = 65;
const KCAL_PER_PROTEIN_OR_CARB = 4;
const KCAL_PER_FAT = 9;
const ENERGY_RATING_MIN = 1;
const ENERGY_RATING_MAX = 10;
const WORKOUT_RATING_MIN = 1;
const WORKOUT_RATING_MAX = 10;

const VALID_MOODS = ['happy', 'okay', 'stressed', 'tired', 'anxious'];

const DELETE_ALL_ALIASES = ['allnutrition', 'allfood', 'allmeals', 'all'];
const NUTRITION_DELETE_ALIASES = ['food', 'nutrition', 'foodlog', 'meal', 'meals'];

/** Map prompt / legacy names → server tool names */
export const TOOL_NAME_ALIASES = {
  updateWorkout: 'updateWorkout',
  openWorkoutPlan: 'openWorkoutPlan',
  adjustMacros: 'adjustMacroTargets',
  adjustMacroTargets: 'adjustMacroTargets',
  logNutrition: 'logNutrition',
  logSleep: 'logSleep',
  logRestDay: 'logRestDay',
  bookSession: 'bookSession',
  updateGoal: 'updateGoal',
  notifyTrainer: 'notifyTrainer',
  deleteLog: 'deleteLog',
  deleteNutritionLog: 'deleteLog',
  deleteFoodLog: 'deleteLog',
  deleteNutrition: 'deleteLog',
};

export const TOOL_DISPLAY_NAMES = {
  updateWorkout: 'Update workout',
  openWorkoutPlan: 'Workout plan',
  adjustMacroTargets: 'Adjust macros',
  logNutrition: 'Log nutrition',
  logSleep: 'Log sleep',
  logRestDay: 'Log rest day',
  logWater: 'Log water',
  logSteps: 'Log steps',
  rateEnergy: 'Log energy',
  logMood: 'Log mood',
  rateWorkout: 'Rate workout',
  bookSession: 'Book session',
  updateGoal: 'Update goal',
  notifyTrainer: 'Notify trainer',
  deleteLog: 'Delete log',
};

const TRAINER_READ_ONLY_TOOLS = new Set([
  'logSleep',
  'logWater',
  'logNutrition',
  'logWorkout',
  'logRestDay',
  'deleteLog',
  'adjustMacroTargets',
  'rateWorkout',
]);

const DELETE_LABELS = {
  sleep: 'sleep log',
  water: 'water log',
  steps: 'step count',
  energy: 'energy rating',
  mood: 'mood log',
  workout: 'workout entry',
  restDay: 'rest day entry',
};

// ===== MAIN FUNCTION =====

/**
 * Map a raw coach tool call onto a canonical name and params.
 * @param {object} raw
 * @returns {object|null}
 */
export function normalizeToolCall(raw) {
  if (!raw) return null;
  const nameRaw = rawToolName(raw);
  const name = TOOL_NAME_ALIASES[nameRaw] || nameRaw;
  if (!name) return null;
  const params = copyToolParams(raw);
  if (name === 'logNutrition' && params.name && !params.food && !params.foodName) {
    params.food = params.name;
    params.foodName = params.name;
  }
  delete params.name;
  delete params.tool;

  if (name === 'deleteLog' && !params.logType) {
    params.logType = 'nutrition';
  }

  if (name === 'updateWorkout' && isRestDayWorkoutUpdate(params)) {
    return restDayCall(raw, params, 'Log a rest day on your dashboard.');
  }

  if (name === 'rateWorkout' && isRestDayWorkoutRating(params)) {
    return {
      name: 'logRestDay',
      params: { date: params.date },
      reasoning:
        raw.reasoning || params.reasoning || params.reason || 'Log a rest day on your dashboard workout card.',
    };
  }

  return {
    name,
    params,
    reasoning: raw.reasoning || params.reasoning || params.reason || '',
  };
}

/**
 * Execute a confirmed AI Coach tool.
 * Flow: 1. name the action  2. refuse trainer writes  3. need a trainer  4. log food on the phone  5. other client logs  6. server
 * @param {object} options
 * @returns {Promise<{ success: boolean, message: string, data?: * }>}
 */
export async function carryOutAction({
  userId,
  trainerId,
  planId,
  toolCall,
  navigationHandlers = {},
  coachMode,
  targetClientId,
}) {
  const normalized = normalizeToolCall(toolCall);
  if (!normalized?.name) return { success: false, message: 'Unknown action' };

  // 1. Trainer coach mode cannot write client food, water, or sleep.
  const trainerRefuse = refuseTrainerWrite(coachMode, normalized.name);
  if (trainerRefuse) return trainerRefuse;

  const params = buildServerParams(normalized.name, normalized.params, { trainerId, planId });
  const serverCall = { name: normalized.name, params };

  // 2. Booking and trainer alerts need a linked trainer.
  const missingTrainer = refuseIfNeedsTrainer(normalized.name, params);
  if (missingTrainer) return missingTrainer;

  // 3. Food stays on the phone. Sleep, water, and deletes write locally first.
  const clientFirst = await runClientFirstTools(userId, normalized.name, params, serverCall);
  if (clientFirst) return clientFirst;

  // 4. Everything else goes to the server first.
  const serverResult = await executeToolViaServer(userId, serverCall);

  // 5. Open the plan on the phone when the handler is there.
  if (normalized.name === 'openWorkoutPlan') {
    return handleOpenWorkoutPlan(params, serverResult, navigationHandlers);
  }

  // 6. Leftover client fallbacks only when the server could not run the action.
  return runServerFallback(userId, normalized.name, params, serverResult);
}

/** @deprecated use carryOutAction */
export async function executeToolAction(toolName, userId, trainerId, planId, params) {
  return carryOutAction({
    userId,
    trainerId,
    planId,
    toolCall: { name: toolName, params },
  });
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function rawToolName(raw) {
  return raw.name || raw.tool || raw.action;
}

function copyToolParams(raw) {
  if (raw.params && typeof raw.params === 'object') return { ...raw.params };
  return { ...raw };
}

function isRestDayWorkoutUpdate(params) {
  return (
    params.type === 'rest' ||
    params.status === 'rest' ||
    params.rest === true ||
    params.restDay === true
  );
}

function isRestDayWorkoutRating(params) {
  const notes = String(params.notes || params.note || '').toLowerCase();
  const rating = Number(params.rating);
  return (
    /\brest\s*day\b/.test(notes) ||
    /\bno\s+workout\b/.test(notes) ||
    rating === 0 ||
    !Number.isFinite(rating) ||
    rating < 1
  );
}

function restDayCall(raw, params, reasoning) {
  return {
    name: 'logRestDay',
    params: { date: params.date, planId: params.planId },
    reasoning: raw.reasoning || params.reasoning || params.reason || reasoning,
  };
}

async function logAiCoachAction(userId, action, details) {
  if (!userId || !db) return;
  try {
    await addDoc(collection(db, 'users', userId, 'aiCoachActions'), {
      action,
      timestamp: serverTimestamp(),
      details,
    });
  } catch (_) {
    /* non-fatal */
  }
}

async function tryOneExecuteToolBase(url, idToken, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: new Error(data?.error || data?.message || `Request failed (${res.status})`) };
  }
  return {
    ok: true,
    result: {
      success: data.success !== false,
      message: data.message || 'Done.',
      data: data.data,
    },
  };
}

async function tryExecuteOnBase(base, idToken, payload) {
  const url = `${String(base).replace(/\/$/, '')}/api/ai-coach/execute-tool`;
  try {
    return await tryOneExecuteToolBase(url, idToken, payload);
  } catch (caught) {
    return { ok: false, error: caught };
  }
}

async function executeToolViaServer(userId, toolCall) {
  const idToken = await auth?.currentUser?.getIdToken?.();
  if (!idToken) return { success: false, message: 'Please sign in again.' };

  const payload = {
    userId,
    toolCall: { name: toolCall.name, params: toolCall.params },
    confirmed: true,
  };

  let lastErr = null;
  for (const base of getAICoachApiBases()) {
    const attempt = await tryExecuteOnBase(base, idToken, payload);
    if (attempt.ok) {
      await logAiCoachAction(userId, toolCall.name, toolCall.params);
      return attempt.result;
    }
    lastErr = attempt.error;
  }
  return {
    success: false,
    message: lastErr?.message || 'Could not reach the server to run this action.',
  };
}

async function executeLogNutritionClient(userId, params) {
  const foodName = String(params.food || params.foodName || '').trim();
  if (!foodName) return { success: false, message: 'Missing food name' };

  const cals = Number(params.cals ?? params.calories ?? 0);
  const protein = Number(params.protein ?? 0);
  const carbs = Number(params.carbs ?? 0);
  const fat = Number(params.fat ?? params.fats ?? 0);

  if (!Number.isFinite(cals) || cals <= 0) {
    return {
      success: false,
      message: `I couldn't look up nutrition for "${foodName}". Add calories/macros or log it in the Nutrition tab.`,
    };
  }

  await addFoodLog(userId, {
    mealType: String(params.mealType || 'snack').toLowerCase(),
    date: params.date || getClientDateKey(),
    food: {
      name: foodName,
      calories: cals,
      protein,
      carbs,
      fat,
      source: 'manual',
    },
  });

  await logAiCoachAction(userId, 'logNutrition', params);
  return {
    success: true,
    message: `Logged ${foodName}: ${Math.round(cals)} cal, ${Math.round(protein)}g protein`,
  };
}

function finiteOrNull(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function caloriesFromMacros(protein, carbs, fat) {
  if (Number.isFinite(protein) && Number.isFinite(carbs) && Number.isFinite(fat)) {
    return Math.round(protein * KCAL_PER_PROTEIN_OR_CARB + carbs * KCAL_PER_PROTEIN_OR_CARB + fat * KCAL_PER_FAT);
  }
  return null;
}

function paramsForAdjustMacros(params) {
  const protein = Number(params.newProtein ?? params.protein);
  const carbs = Number(params.newCarbs ?? params.carbs);
  const fat = Number(params.newFats ?? params.fats ?? params.fat);
  const calories =
    Number(params.newCals ?? params.calories) || caloriesFromMacros(protein, carbs, fat);
  return {
    protein: Number.isFinite(protein) ? protein : null,
    carbs: Number.isFinite(carbs) ? carbs : null,
    fat: Number.isFinite(fat) ? fat : null,
    calories: Number.isFinite(calories) ? calories : null,
    reason: params.reason,
  };
}

function paramsForBookSession(params, trainerId) {
  const date = params.sessionDate || params.date;
  const time = params.sessionTime || params.time;
  return {
    trainerId: params.trainerId || trainerId,
    sessionDate: date,
    sessionTime: time,
    dateTime: params.dateTime,
    durationMin: Number(params.durationMin ?? params.durationMinutes ?? params.duration ?? DEFAULT_SESSION_MINUTES) || DEFAULT_SESSION_MINUTES,
    notes: params.notes,
  };
}

function paramsForLogNutrition(params) {
  const out = {
    foodName: params.food || params.foodName,
    mealType: params.mealType,
    date: params.date || getClientDateKey(),
  };
  const cals = Number(params.cals ?? params.calories);
  if (Number.isFinite(cals) && cals > 0) {
    out.calories = cals;
    out.protein = Number(params.protein ?? 0);
    out.carbs = Number(params.carbs ?? 0);
    out.fat = Number(params.fat ?? params.fats ?? 0);
  } else {
    out.quantity = params.quantity ?? 1;
  }
  return out;
}

function normalizeDeleteLogType(raw) {
  const typeText = String(raw || '').toLowerCase().trim();
  if (NUTRITION_DELETE_ALIASES.includes(typeText)) return 'nutrition';
  if (DELETE_ALL_ALIASES.includes(typeText)) return 'nutrition';
  if (typeText === 'sleep') return 'sleep';
  if (['water', 'hydration'].includes(typeText)) return 'water';
  if (['steps', 'step'].includes(typeText)) return 'steps';
  if (['energy', 'fatigue'].includes(typeText)) return 'energy';
  if (['mood', 'feeling'].includes(typeText)) return 'mood';
  if (['workout', 'workoutrating'].includes(typeText)) return 'workout';
  if (['rest', 'restday', 'rest_day'].includes(typeText)) return 'restDay';
  return typeText || 'nutrition';
}

function isDeleteAllRequest(params) {
  return !!(
    params?.deleteAll ||
    params?.all ||
    DELETE_ALL_ALIASES.includes(String(params?.logType || '').toLowerCase())
  );
}

function paramsForDeleteLog(params) {
  const logType = normalizeDeleteLogType(params.logType);
  const deleteAll = isDeleteAllRequest(params);
  const rawFood = params.foodName || params.food;
  const foodName = rawFood ? sanitizeDeleteFoodQuery(rawFood) || rawFood : undefined;
  return {
    logType,
    date: params.date || getClientDateKey(),
    foodName,
    logId: params.logId,
    deleteAll,
  };
}

function buildServerParams(name, params, { trainerId, planId } = {}) {
  const copied = { ...params };
  if (name === 'adjustMacroTargets') return paramsForAdjustMacros(copied);
  if (name === 'bookSession') return paramsForBookSession(copied, trainerId);
  if (name === 'notifyTrainer') {
    return {
      trainerId: copied.trainerId || trainerId,
      message: copied.message,
      issueType: copied.issueType,
      severity: copied.severity,
    };
  }
  if (name === 'updateWorkout') {
    return {
      planId: copied.planId || planId || 'current',
      dayIndex: copied.dayIndex ?? 0,
      exerciseIndex: copied.exerciseIndex ?? 0,
      newExercise: copied.newExercise,
      exerciseName: copied.exerciseName || copied.exerciseId,
      reason: copied.reason,
    };
  }
  if (name === 'openWorkoutPlan') {
    return { planId: copied.planId || planId || 'current' };
  }
  if (name === 'logNutrition') return paramsForLogNutrition(copied);
  if (name === 'logSleep') {
    return { hours: Number(copied.hours ?? copied.sleepHours), date: copied.date || getClientDateKey() };
  }
  if (name === 'logWater') {
    return { amount_oz: Number(copied.amount_oz ?? copied.amountOz ?? copied.amount), date: copied.date || getClientDateKey() };
  }
  if (name === 'logSteps') {
    return { step_count: Number(copied.step_count ?? copied.steps), date: copied.date || getClientDateKey() };
  }
  if (name === 'rateEnergy') {
    return { rating: Number(copied.rating ?? copied.energy), notes: copied.notes || copied.note, date: copied.date || getClientDateKey() };
  }
  if (name === 'logMood') {
    return { mood: copied.mood, notes: copied.notes || copied.note, date: copied.date || getClientDateKey() };
  }
  if (name === 'rateWorkout') {
    return { rating: Number(copied.rating), notes: copied.notes || copied.note, date: copied.date || getClientDateKey() };
  }
  if (name === 'logRestDay') {
    return { date: copied.date || getClientDateKey(), planId: copied.planId };
  }
  if (name === 'deleteLog') return paramsForDeleteLog(copied);
  return copied;
}

function deletedFoodLabel(deletedCount, deletedNames) {
  if (deletedCount === 1) return deletedNames[0] || 'food entry';
  const extra = deletedNames.length > 3 ? '…' : '';
  return `${deletedCount} entries (${deletedNames.slice(0, 3).join(', ')}${extra})`;
}

async function deleteNutritionLogsClient(userId, params, dateKey, deleteAll) {
  const rawFood = params?.foodName || params?.food;
  let foodName = rawFood ? sanitizeDeleteFoodQuery(rawFood) || rawFood : undefined;

  let { deletedCount, deletedNames } = await deleteFoodLogsForDate(userId, {
    date: dateKey,
    foodName,
    logId: params?.logId,
    deleteAll,
  });

  if (!deletedCount && foodName && /pizza|slice|domino/i.test(String(rawFood || foodName))) {
    ({ deletedCount, deletedNames } = await deleteFoodLogsForDate(userId, {
      date: dateKey,
      foodName: 'pizza',
      deleteAll: /\b(two|2|both)\b/i.test(String(rawFood || '')),
    }));
  }

  if (!deletedCount) {
    const hint = foodName ? ` matching "${foodName}"` : '';
    return { success: false, message: `No food logs found for ${dateKey}${hint}.` };
  }
  await logAiCoachAction(userId, 'deleteLog', { logType: 'nutrition', date: dateKey, deletedCount, deletedNames });
  return {
    success: true,
    message: `Removed ${deletedFoodLabel(deletedCount, deletedNames)} from your nutrition log.`,
    data: { deletedCount, deletedNames, date: dateKey },
  };
}

async function executeDeleteLogClient(userId, params) {
  const logType = normalizeDeleteLogType(params?.logType);
  const dateKey = String(params?.date || getClientDateKey()).trim();
  const deleteAll = isDeleteAllRequest(params);

  if (logType === 'nutrition') {
    return deleteNutritionLogsClient(userId, params, dateKey, deleteAll);
  }

  await clearClientDailyMetric(userId, logType, dateKey);
  await logAiCoachAction(userId, 'deleteLog', { logType, date: dateKey });
  return {
    success: true,
    message: `Removed your ${DELETE_LABELS[logType] || logType} for ${dateKey}.`,
    data: { logType, date: dateKey },
  };
}

async function executeLogSleepClient(userId, params) {
  if (!userId || !db) {
    return { success: false, message: 'Could not save sleep — please sign in and try again.' };
  }
  const hours = Number(params?.hours ?? params?.sleepHours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_SLEEP_HOURS) {
    return { success: false, message: 'Invalid sleep hours (use 0.5–24)' };
  }
  const dateKey = String(params?.date || getClientDateKey()).trim();
  if (__DEV__) {
    console.log('[coach-tool] Executing logSleep:', { userId, hours, dateKey });
  }
  try {
    await Promise.all([
      setDoc(
        doc(db, 'users', userId, 'sleep_logs', dateKey),
        { hours, date: dateKey, logged_at: serverTimestamp() },
        { merge: true },
      ),
      saveDashboardSleepHours(userId, hours, dateKey),
    ]);
    await logAiCoachAction(userId, 'logSleep', { hours, date: dateKey });
    return { success: true, message: `Logged ${hours} hours of sleep on your dashboard.` };
  } catch (error) {
    console.error('[coach-tool] logSleep failed:', error);
    return { success: false, message: error?.message || 'Failed to log sleep' };
  }
}

async function loadCurrentMacros(userId) {
  try {
    const goalsSnap = await getDoc(doc(db, 'nutrition_goals', userId));
    if (!goalsSnap.exists()) return {};
    const data = goalsSnap.data();
    return {
      protein: Number(data.protein_target) || Number(data.protein),
      carbs: Number(data.carbs_target) || Number(data.carbs),
      fat: Number(data.fat_target) || Number(data.fat),
      calories: Number(data.calorie_target) || Number(data.calories),
    };
  } catch (error) {
    console.warn('Failed to load current macros:', error.message);
    return {};
  }
}

async function writeMacroTargets(userId, protein, carbs, fat, calories) {
  await Promise.all([
    setDoc(
      doc(db, 'users', userId, 'macroTargets', 'current'),
      { protein, carbs, fat, calories, updatedAt: serverTimestamp(), updatedBy: 'aiCoach' },
      { merge: true },
    ),
    setDoc(
      doc(db, 'nutrition_goals', userId),
      {
        user_id: userId,
        protein_target: protein,
        carbs_target: carbs,
        fat_target: fat,
        calorie_target: calories,
        calories,
        updated_at: serverTimestamp(),
      },
      { merge: true },
    ),
  ]);
}

async function executeAdjustMacrosClient(userId, params) {
  const currentMacros = await loadCurrentMacros(userId);
  const protein = finiteOrNull(params?.protein ?? params?.newProtein) ?? currentMacros.protein ?? DEFAULT_PROTEIN_G;
  const carbs = finiteOrNull(params?.carbs ?? params?.newCarbs) ?? currentMacros.carbs ?? DEFAULT_CARBS_G;
  const fat = finiteOrNull(params?.fat ?? params?.newFats ?? params?.fats) ?? currentMacros.fat ?? DEFAULT_FAT_G;
  const explicitCalories = finiteOrNull(params?.calories ?? params?.newCals ?? params?.calorieTarget);
  let calories = explicitCalories ?? currentMacros.calories;

  if (explicitCalories != null && explicitCalories <= 0) {
    throw new Error(`Invalid calorie target: ${explicitCalories}`);
  }
  if (calories == null || calories <= 0) {
    calories = Math.round(protein * KCAL_PER_PROTEIN_OR_CARB + carbs * KCAL_PER_PROTEIN_OR_CARB + fat * KCAL_PER_FAT);
  }
  if (!Number.isFinite(calories) || calories <= 0) {
    throw new Error(`Invalid calorie target: ${calories}`);
  }
  if (!Number.isFinite(protein) || !Number.isFinite(carbs) || !Number.isFinite(fat)) {
    throw new Error(`Invalid macro targets: P=${protein}, C=${carbs}, F=${fat}`);
  }

  await writeMacroTargets(userId, protein, carbs, fat, calories);
  await logAiCoachAction(userId, 'adjustMacroTargets', params);
  return {
    success: true,
    message: `Daily target updated to ${calories} kcal.`,
    data: { calories, protein, carbs, fat },
  };
}

async function executeLogWaterClient(userId, params) {
  const amount_oz = Number(params?.amount_oz ?? params?.amountOz ?? params?.amount);
  if (!Number.isFinite(amount_oz) || amount_oz <= 0) {
    throw new Error('Water amount must be greater than 0 ounces');
  }

  const dateKey = String(params?.date || getClientDateKey()).trim();
  await Promise.all([
    setDoc(
      doc(db, 'users', userId, 'water_logs', dateKey),
      { amount_oz, date: dateKey, logged_at: serverTimestamp() },
      { merge: true },
    ),
    saveDashboardWaterOz(userId, amount_oz, dateKey),
  ]);

  await logAiCoachAction(userId, 'logWater', params);
  return {
    success: true,
    message: `Logged ${amount_oz}oz of water.`,
    data: { amount_oz, date: dateKey },
  };
}

async function executeLogStepsClient(userId, params) {
  const step_count = Number(params?.step_count ?? params?.steps);
  if (!Number.isFinite(step_count) || step_count < 0) {
    throw new Error('Step count must be 0 or greater');
  }

  const dateKey = String(params?.date || getClientDateKey()).trim();
  await Promise.all([
    setDoc(
      doc(db, 'users', userId, 'step_logs', dateKey),
      { step_count, date: dateKey, logged_at: serverTimestamp() },
      { merge: true },
    ),
    saveDashboardMetricField(userId, 'dashboard_steps', step_count, dateKey),
  ]);

  await logAiCoachAction(userId, 'logSteps', params);
  return {
    success: true,
    message: `Logged ${step_count} steps.`,
    data: { step_count, date: dateKey },
  };
}

async function executeRateEnergyClient(userId, params) {
  const rating = Number(params?.rating);
  if (!Number.isFinite(rating) || rating < ENERGY_RATING_MIN || rating > ENERGY_RATING_MAX) {
    throw new Error('Energy rating must be between 1 and 10');
  }

  const dateKey = String(params?.date || getClientDateKey()).trim();
  await Promise.all([
    setDoc(
      doc(db, 'users', userId, 'energy_logs', dateKey),
      { rating, notes: String(params?.notes || '').trim(), date: dateKey, logged_at: serverTimestamp() },
      { merge: true },
    ),
    mergeClientDailyMetrics(userId, dateKey, {
      logs: { dashboard_energy: rating },
      tracking: { energyLevel: String(rating) },
    }),
  ]);

  await logAiCoachAction(userId, 'rateEnergy', params);
  return {
    success: true,
    message: `Logged energy level: ${rating}/10.`,
    data: { rating, date: dateKey },
  };
}

async function executeLogMoodClient(userId, params) {
  const mood = String(params?.mood || '').toLowerCase().trim();
  if (!VALID_MOODS.includes(mood)) {
    throw new Error(`Mood must be one of: ${VALID_MOODS.join(', ')}`);
  }

  const dateKey = String(params?.date || getClientDateKey()).trim();
  await Promise.all([
    setDoc(
      doc(db, 'users', userId, 'mood_logs', dateKey),
      { mood, notes: String(params?.notes || '').trim(), date: dateKey, logged_at: serverTimestamp() },
      { merge: true },
    ),
    mergeClientDailyMetrics(userId, dateKey, {
      logs: { dashboard_mood: mood },
      tracking: { mood },
    }),
  ]);

  await logAiCoachAction(userId, 'logMood', params);
  return {
    success: true,
    message: `Logged mood: ${mood}.`,
    data: { mood, date: dateKey },
  };
}

async function executeRateWorkoutClient(userId, params) {
  const rating = Number(params?.rating);
  if (!Number.isFinite(rating) || rating < WORKOUT_RATING_MIN || rating > WORKOUT_RATING_MAX) {
    throw new Error('Workout rating must be between 1 and 10');
  }

  const dateKey = getClientDateKey();
  await setDoc(
    doc(db, 'users', userId, 'workout_ratings', dateKey),
    { rating, notes: String(params?.notes || '').trim(), date: dateKey, logged_at: serverTimestamp() },
    { merge: true },
  );

  await logAiCoachAction(userId, 'rateWorkout', params);
  return {
    success: true,
    message: `Logged workout rating: ${rating}/10.`,
    data: { rating, date: dateKey },
  };
}

async function executeLogRestDayClient(userId, params) {
  const dateKey = String(params?.date || getClientDateKey()).trim();
  await saveDashboardWorkoutLog(
    userId,
    {
      workoutName: 'Rest day',
      workoutLog: [],
      dashboard_workouts: 'Rest day',
    },
    dateKey,
  );
  await logAiCoachAction(userId, 'logRestDay', { date: dateKey });
  return {
    success: true,
    message: `Rest day logged for ${dateKey}. Check your dashboard workout card.`,
    data: { date: dateKey },
  };
}

async function runClientThenServer(userId, serverCall, clientFn, failMessage) {
  try {
    return await clientFn();
  } catch (error) {
    const serverResult = await executeToolViaServer(userId, serverCall);
    if (serverResult.success) return serverResult;
    return { success: false, message: error?.message || serverResult.message || failMessage };
  }
}

function refuseTrainerWrite(coachMode, toolName) {
  if (coachMode !== 'trainer') return null;
  if (!TRAINER_READ_ONLY_TOOLS.has(toolName)) return null;
  return {
    success: false,
    message: 'Trainer coach mode is read-only — switch to the client profile to log data.',
  };
}

function refuseIfNeedsTrainer(toolName, params) {
  if (toolName === 'bookSession' && !params.trainerId) {
    return {
      success: false,
      message: 'You don\'t have a trainer linked. Connect with a trainer to book sessions.',
    };
  }
  if (toolName === 'notifyTrainer' && !params.trainerId) {
    return {
      success: false,
      message: 'You don\'t have a trainer linked. Connect with a trainer to send alerts.',
    };
  }
  return null;
}

async function runLogNutritionOnPhone(userId, params) {
  try {
    return await executeLogNutritionClient(userId, params);
  } catch (error) {
    return { success: false, message: error?.message || 'Failed to log nutrition' };
  }
}

async function runClientFirstTools(userId, toolName, params, serverCall) {
  if (toolName === 'logNutrition') return runLogNutritionOnPhone(userId, params);
  if (toolName === 'logSleep') {
    return runClientThenServer(userId, serverCall, () => executeLogSleepClient(userId, params), 'Failed to log sleep');
  }
  if (toolName === 'logWater') {
    return runClientThenServer(userId, serverCall, () => executeLogWaterClient(userId, params), 'Failed to log water');
  }
  if (toolName === 'logSteps') {
    return runClientThenServer(userId, serverCall, () => executeLogStepsClient(userId, params), 'Failed to log steps');
  }
  if (toolName === 'rateEnergy') {
    return runClientThenServer(userId, serverCall, () => executeRateEnergyClient(userId, params), 'Failed to log energy');
  }
  if (toolName === 'logMood') {
    return runClientThenServer(userId, serverCall, () => executeLogMoodClient(userId, params), 'Failed to log mood');
  }
  if (toolName === 'logRestDay') {
    return runClientThenServer(userId, serverCall, () => executeLogRestDayClient(userId, params), 'Failed to log rest day');
  }
  if (toolName === 'deleteLog') {
    return runClientThenServer(userId, serverCall, () => executeDeleteLogClient(userId, params), 'Failed to delete log');
  }
  return null;
}

async function runServerFallback(userId, toolName, params, serverResult) {
  if (serverResult.success) return serverResult;
  if (toolName === 'adjustMacroTargets') {
    try {
      return await executeAdjustMacrosClient(userId, params);
    } catch (error) {
      return { success: false, message: error?.message || 'Failed to update nutrition targets' };
    }
  }
  if (toolName === 'rateWorkout') {
    try {
      return await executeRateWorkoutClient(userId, params);
    } catch (error) {
      return { success: false, message: error?.message || 'Failed to rate workout' };
    }
  }
  return serverResult;
}

async function handleOpenWorkoutPlan(params, serverResult, navigationHandlers) {
  if (typeof navigationHandlers.onOpenWorkoutPlan === 'function') {
    const navResult = await navigationHandlers.onOpenWorkoutPlan({
      planId: params.planId || 'current',
      title: serverResult.data?.title,
      todayPreview: serverResult.data?.todayPreview,
      summary: serverResult.data?.summary,
    });
    if (navResult?.success !== false) return navResult;
  }
  if (serverResult.success) return serverResult;
  return { success: false, message: serverResult.message || 'Could not open workout plan.' };
}

