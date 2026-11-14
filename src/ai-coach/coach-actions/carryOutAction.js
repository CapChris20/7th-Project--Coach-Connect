// Runs a confirmed AI coach action: log food, water, sleep, or book a session.
// Flow: name the action → refuse trainer writes → log on the phone or hit the server.
// Used by the confirm popup after the user taps Confirm.
// Read order: constants → small helpers → normalizeToolCall / carryOutAction → PLUMBING.

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
// vocab: normalizeMoodValue = shared mood spelling ("Happy"/"great"/"😊" → canonical) from the guard file
import { normalizeMoodValue } from './shouldAskFirst';

// ===== NAMED CONSTANTS =====

const DEFAULT_SESSION_MINUTES = 60;
// Manipulate here: sleep hours above this are rejected as typos
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

const DEFAULT_REST_DAY_UPDATE_REASON = 'Log a rest day on your dashboard.';
const DEFAULT_REST_DAY_RATING_REASON = 'Log a rest day on your dashboard workout card.';

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

// ===== HELPER FUNCTIONS =====
// Small helpers the mains call by name. Heavy Firestore / fetch work is under PLUMBING.

function toolNameFromModelCall(modelCall) {
  if (modelCall.name) {
    return modelCall.name;
  }
  if (modelCall.tool) {
    return modelCall.tool;
  }
  return modelCall.action;
}

function nestedParamsFromModelCall(modelCall) {
  if (!modelCall.params) {
    return null;
  }
  if (typeof modelCall.params !== 'object') {
    return null;
  }
  return modelCall.params;
}

function copyToolParams(modelCall) {
  const nestedParams = nestedParamsFromModelCall(modelCall);
  if (nestedParams) {
    return { ...nestedParams };
  }
  return { ...modelCall };
}

function pickReasoningText(modelCall, params, fallbackText) {
  if (modelCall && modelCall.reasoning) {
    return modelCall.reasoning;
  }
  if (params && params.reasoning) {
    return params.reasoning;
  }
  if (params && params.reason) {
    return params.reason;
  }
  if (fallbackText) {
    return fallbackText;
  }
  return '';
}

function isRestDayWorkoutUpdate(params) {
  if (params.type === 'rest') {
    return true;
  }
  if (params.status === 'rest') {
    return true;
  }
  if (params.rest === true) {
    return true;
  }
  if (params.restDay === true) {
    return true;
  }
  return false;
}

function isRestDayWorkoutRating(params) {
  const notesText = String(params.notes || params.note || '').toLowerCase();
  const ratingNumber = Number(params.rating);
  if (/\brest\s*day\b/.test(notesText)) {
    return true;
  }
  if (/\bno\s+workout\b/.test(notesText)) {
    return true;
  }
  if (ratingNumber === 0) {
    return true;
  }
  if (!Number.isFinite(ratingNumber)) {
    return true;
  }
  if (ratingNumber < 1) {
    return true;
  }
  return false;
}

function restDayCallFromModel(modelCall, params, fallbackReason) {
  return {
    name: 'logRestDay',
    params: { date: params.date, planId: params.planId },
    reasoning: pickReasoningText(modelCall, params, fallbackReason),
  };
}

function fillFoodNameFromLegacyNameField(params) {
  // Some prompts send `name` instead of food / foodName — copy before we delete `name`.
  const hasLegacyName = Boolean(params.name);
  const missingFoodKeys = !params.food && !params.foodName;
  if (!hasLegacyName) {
    return;
  }
  if (!missingFoodKeys) {
    return;
  }
  params.food = params.name;
  params.foodName = params.name;
}

function applyDeleteLogTypeDefault(params) {
  if (params.logType) {
    return;
  }
  params.logType = 'nutrition';
}

// ===== MAIN FUNCTION =====

/**
 * Map a model coach tool call onto a canonical name and params.
 * @param {object} modelCall
 * @returns {object|null}
 */
export function normalizeToolCall(modelCall) {
  // 1. Empty call → nothing to run.
  if (!modelCall) {
    return null;
  }

  // 2. Map aliases onto the one tool name we execute.
  const nameFromModel = toolNameFromModelCall(modelCall);
  const canonicalName = TOOL_NAME_ALIASES[nameFromModel] || nameFromModel;
  if (!canonicalName) {
    return null;
  }

  // 3. Copy params; food logs may send `name` instead of food/foodName.
  const params = copyToolParams(modelCall);
  if (canonicalName === 'logNutrition') {
    fillFoodNameFromLegacyNameField(params);
  }
  delete params.name;
  delete params.tool;

  // 4. Deletes default to nutrition when the model omitted logType.
  if (canonicalName === 'deleteLog') {
    applyDeleteLogTypeDefault(params);
  }

  // 5. Rest-day workout updates become logRestDay.
  if (canonicalName === 'updateWorkout' && isRestDayWorkoutUpdate(params)) {
    return restDayCallFromModel(modelCall, params, DEFAULT_REST_DAY_UPDATE_REASON);
  }

  // 6. Rest-day workout ratings become logRestDay too.
  if (canonicalName === 'rateWorkout' && isRestDayWorkoutRating(params)) {
    return {
      name: 'logRestDay',
      params: { date: params.date },
      reasoning: pickReasoningText(modelCall, params, DEFAULT_REST_DAY_RATING_REASON),
    };
  }

  // 7. Canonical call for everything else.
  return {
    name: canonicalName,
    params,
    reasoning: pickReasoningText(modelCall, params, ''),
  };
}

/**
 * Execute a confirmed AI Coach tool.
 * Flow: 1. refuse trainer writes  2. need a trainer  3. client-first logs  4. server  5. open plan  6. fallbacks
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
  const hasNamedTool = Boolean(normalized && normalized.name);
  if (!hasNamedTool) {
    return { success: false, message: 'Unknown action' };
  }

  const toolName = normalized.name;

  // 1. Trainer coach mode cannot write client food, water, or sleep.
  const trainerRefuse = refuseTrainerWrite(coachMode, toolName);
  if (trainerRefuse) {
    return trainerRefuse;
  }

  const params = buildServerParams(toolName, normalized.params, { trainerId, planId });
  const serverCall = { name: toolName, params };

  // 2. Booking and trainer alerts need a linked trainer.
  const missingTrainer = refuseIfNeedsTrainer(toolName, params);
  if (missingTrainer) {
    return missingTrainer;
  }

  // 3. Food stays on the phone. Sleep, water, and deletes write locally first.
  const clientFirst = await runClientFirstTools(userId, toolName, params, serverCall);
  if (clientFirst) {
    return clientFirst;
  }

  // 4. Everything else goes to the server first.
  const serverResult = await executeToolViaServer(userId, serverCall);

  // 5. Open the plan on the phone when the handler is there.
  if (toolName === 'openWorkoutPlan') {
    return handleOpenWorkoutPlan(params, serverResult, navigationHandlers);
  }

  // 6. Leftover client fallbacks only when the server could not run the action.
  return runServerFallback(userId, toolName, params, serverResult);
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

// ===== PLUMBING — skip unless debugging Firestore / server execute-tool =====

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

function errorMessageFromServerBody(data, statusCode) {
  if (data && data.error) {
    return data.error;
  }
  if (data && data.message) {
    return data.message;
  }
  return `Request failed (${statusCode})`;
}

async function tryOneExecuteToolBase(url, idToken, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });
  let data = {};
  try {
    data = await response.json();
  } catch (_parseError) {
    data = {};
  }
  if (!response.ok) {
    return {
      ok: false,
      error: new Error(errorMessageFromServerBody(data, response.status)),
    };
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
  const cleanBase = String(base).replace(/\/$/, '');
  const url = `${cleanBase}/api/ai-coach/execute-tool`;
  try {
    return await tryOneExecuteToolBase(url, idToken, payload);
  } catch (caught) {
    return { ok: false, error: caught };
  }
}

async function readSignedInIdToken() {
  if (!auth) {
    return null;
  }
  if (!auth.currentUser) {
    return null;
  }
  if (typeof auth.currentUser.getIdToken !== 'function') {
    return null;
  }
  return auth.currentUser.getIdToken();
}

async function executeToolViaServer(userId, toolCall) {
  const idToken = await readSignedInIdToken();
  if (!idToken) {
    return { success: false, message: 'Please sign in again.' };
  }

  const payload = {
    userId,
    toolCall: { name: toolCall.name, params: toolCall.params },
    confirmed: true,
  };

  let lastError = null;
  const apiBases = getAICoachApiBases();
  for (let baseIndex = 0; baseIndex < apiBases.length; baseIndex += 1) {
    const base = apiBases[baseIndex];
    const attempt = await tryExecuteOnBase(base, idToken, payload);
    if (attempt.ok) {
      await logAiCoachAction(userId, toolCall.name, toolCall.params);
      return attempt.result;
    }
    lastError = attempt.error;
  }

  let failMessage = 'Could not reach the server to run this action.';
  if (lastError && lastError.message) {
    failMessage = lastError.message;
  }
  return {
    success: false,
    message: failMessage,
  };
}

function firstDefinedNumber(...candidates) {
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (candidate !== null && candidate !== undefined) {
      return Number(candidate);
    }
  }
  return Number.NaN;
}

function firstDefinedValue(...candidates) {
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (candidate !== null && candidate !== undefined) {
      return candidate;
    }
  }
  return undefined;
}

async function executeLogNutritionClient(userId, params) {
  const foodName = String(params.food || params.foodName || '').trim();
  if (!foodName) {
    return { success: false, message: 'Missing food name' };
  }

  // Keep 0 calories if the model sent 0; only fall through when null/undefined.
  const calorieAmount = firstDefinedNumber(params.cals, params.calories, 0);
  const proteinGrams = firstDefinedNumber(params.protein, 0);
  const carbsGrams = firstDefinedNumber(params.carbs, 0);
  const fatGrams = firstDefinedNumber(params.fat, params.fats, 0);

  if (!Number.isFinite(calorieAmount) || calorieAmount <= 0) {
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
      calories: calorieAmount,
      protein: proteinGrams,
      carbs: carbsGrams,
      fat: fatGrams,
      source: 'manual',
    },
  });

  await logAiCoachAction(userId, 'logNutrition', params);
  return {
    success: true,
    message: `Logged ${foodName}: ${Math.round(calorieAmount)} cal, ${Math.round(proteinGrams)}g protein`,
  };
}

function finiteOrNull(value) {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return numericValue;
  }
  return null;
}

function caloriesFromMacros(protein, carbs, fat) {
  const allFinite =
    Number.isFinite(protein) && Number.isFinite(carbs) && Number.isFinite(fat);
  if (!allFinite) {
    return null;
  }
  return Math.round(
    protein * KCAL_PER_PROTEIN_OR_CARB +
      carbs * KCAL_PER_PROTEIN_OR_CARB +
      fat * KCAL_PER_FAT,
  );
}

function nullIfNotFinite(numericValue) {
  if (Number.isFinite(numericValue)) {
    return numericValue;
  }
  return null;
}

function paramsForAdjustMacros(params) {
  const protein = Number(firstDefinedValue(params.newProtein, params.protein));
  const carbs = Number(firstDefinedValue(params.newCarbs, params.carbs));
  const fat = Number(firstDefinedValue(params.newFats, params.fats, params.fat));
  const explicitCalories = Number(firstDefinedValue(params.newCals, params.calories));
  let calories = explicitCalories;
  if (!calories) {
    calories = caloriesFromMacros(protein, carbs, fat);
  }
  return {
    protein: nullIfNotFinite(protein),
    carbs: nullIfNotFinite(carbs),
    fat: nullIfNotFinite(fat),
    calories: nullIfNotFinite(calories),
    reason: params.reason,
  };
}

function sessionDurationMinutes(params) {
  const fromAnyKey = firstDefinedNumber(
    params.durationMin,
    params.durationMinutes,
    params.duration,
    DEFAULT_SESSION_MINUTES,
  );
  if (fromAnyKey) {
    return fromAnyKey;
  }
  return DEFAULT_SESSION_MINUTES;
}

function paramsForBookSession(params, trainerId) {
  const date = params.sessionDate || params.date;
  const time = params.sessionTime || params.time;
  return {
    trainerId: params.trainerId || trainerId,
    sessionDate: date,
    sessionTime: time,
    dateTime: params.dateTime,
    durationMin: sessionDurationMinutes(params),
    notes: params.notes,
  };
}

function paramsForLogNutrition(params) {
  const serverParams = {
    foodName: params.food || params.foodName,
    mealType: params.mealType,
    date: params.date || getClientDateKey(),
  };
  const calorieAmount = firstDefinedNumber(params.cals, params.calories);
  const hasUsableCalories = Number.isFinite(calorieAmount) && calorieAmount > 0;
  if (!hasUsableCalories) {
    const quantity = firstDefinedValue(params.quantity, 1);
    serverParams.quantity = quantity;
    return serverParams;
  }
  serverParams.calories = calorieAmount;
  serverParams.protein = firstDefinedNumber(params.protein, 0);
  serverParams.carbs = firstDefinedNumber(params.carbs, 0);
  serverParams.fat = firstDefinedNumber(params.fat, params.fats, 0);
  return serverParams;
}

function normalizeDeleteLogType(logTypeInput) {
  const typeText = String(logTypeInput || '').toLowerCase().trim();
  if (NUTRITION_DELETE_ALIASES.includes(typeText)) {
    return 'nutrition';
  }
  if (DELETE_ALL_ALIASES.includes(typeText)) {
    return 'nutrition';
  }
  if (typeText === 'sleep') {
    return 'sleep';
  }
  if (typeText === 'water' || typeText === 'hydration') {
    return 'water';
  }
  if (typeText === 'steps' || typeText === 'step') {
    return 'steps';
  }
  if (typeText === 'energy' || typeText === 'fatigue') {
    return 'energy';
  }
  if (typeText === 'mood' || typeText === 'feeling') {
    return 'mood';
  }
  if (typeText === 'workout' || typeText === 'workoutrating') {
    return 'workout';
  }
  if (typeText === 'rest' || typeText === 'restday' || typeText === 'rest_day') {
    return 'restDay';
  }
  if (typeText) {
    return typeText;
  }
  return 'nutrition';
}

function isDeleteAllRequest(params) {
  if (!params) {
    return false;
  }
  if (params.deleteAll) {
    return true;
  }
  if (params.all) {
    return true;
  }
  const logTypeText = String(params.logType || '').toLowerCase();
  if (DELETE_ALL_ALIASES.includes(logTypeText)) {
    return true;
  }
  return false;
}

function cleanedFoodNameForDelete(params) {
  const foodFromParams = params.foodName || params.food;
  if (!foodFromParams) {
    return undefined;
  }
  const sanitized = sanitizeDeleteFoodQuery(foodFromParams);
  if (sanitized) {
    return sanitized;
  }
  return foodFromParams;
}

function paramsForDeleteLog(params) {
  return {
    logType: normalizeDeleteLogType(params.logType),
    date: params.date || getClientDateKey(),
    foodName: cleanedFoodNameForDelete(params),
    logId: params.logId,
    deleteAll: isDeleteAllRequest(params),
  };
}

function dateOrToday(params) {
  if (params && params.date) {
    return params.date;
  }
  return getClientDateKey();
}

function notesOrNote(params) {
  if (params.notes) {
    return params.notes;
  }
  return params.note;
}

function buildServerParams(name, params, context = {}) {
  const trainerId = context.trainerId;
  const planId = context.planId;
  const copied = { ...params };

  if (name === 'adjustMacroTargets') {
    return paramsForAdjustMacros(copied);
  }
  if (name === 'bookSession') {
    return paramsForBookSession(copied, trainerId);
  }
  if (name === 'notifyTrainer') {
    return {
      trainerId: copied.trainerId || trainerId,
      message: copied.message,
      issueType: copied.issueType,
      severity: copied.severity,
    };
  }
  if (name === 'updateWorkout') {
    const dayIndex = firstDefinedValue(copied.dayIndex, 0);
    const exerciseIndex = firstDefinedValue(copied.exerciseIndex, 0);
    return {
      planId: copied.planId || planId || 'current',
      dayIndex,
      exerciseIndex,
      newExercise: copied.newExercise,
      exerciseName: copied.exerciseName || copied.exerciseId,
      reason: copied.reason,
    };
  }
  if (name === 'openWorkoutPlan') {
    return { planId: copied.planId || planId || 'current' };
  }
  if (name === 'logNutrition') {
    return paramsForLogNutrition(copied);
  }
  if (name === 'logSleep') {
    return {
      hours: firstDefinedNumber(copied.hours, copied.sleepHours),
      date: dateOrToday(copied),
    };
  }
  if (name === 'logWater') {
    return {
      amount_oz: firstDefinedNumber(copied.amount_oz, copied.amountOz, copied.amount),
      date: dateOrToday(copied),
    };
  }
  if (name === 'logSteps') {
    return {
      step_count: firstDefinedNumber(copied.step_count, copied.steps),
      date: dateOrToday(copied),
    };
  }
  if (name === 'rateEnergy') {
    return {
      rating: firstDefinedNumber(copied.rating, copied.energy),
      notes: notesOrNote(copied),
      date: dateOrToday(copied),
    };
  }
  if (name === 'logMood') {
    // Defense in depth: callers that skip the guard still send a canonical mood.
    const moodInput = firstDefinedValue(
      copied.mood,
      copied.feeling,
      copied.value,
      copied.emotion,
    );
    return {
      mood: normalizeMoodValue(moodInput),
      notes: notesOrNote(copied),
      date: dateOrToday(copied),
    };
  }
  if (name === 'rateWorkout') {
    return {
      rating: Number(copied.rating),
      notes: notesOrNote(copied),
      date: dateOrToday(copied),
    };
  }
  if (name === 'logRestDay') {
    return { date: dateOrToday(copied), planId: copied.planId };
  }
  if (name === 'deleteLog') {
    return paramsForDeleteLog(copied);
  }
  return copied;
}

function deletedFoodLabel(deletedCount, deletedNames) {
  if (deletedCount === 1) {
    return deletedNames[0] || 'food entry';
  }
  let nameList = deletedNames.slice(0, 3).join(', ');
  if (deletedNames.length > 3) {
    nameList = `${nameList}…`;
  }
  return `${deletedCount} entries (${nameList})`;
}

function looksLikePizzaDelete(foodText) {
  return /pizza|slice|domino/i.test(String(foodText || ''));
}

function wantsTwoPizzaDeletes(foodText) {
  return /\b(two|2|both)\b/i.test(String(foodText || ''));
}

async function deleteNutritionLogsClient(userId, params, dateKey, deleteAll) {
  const safeParams = params || {};
  const foodFromParams = safeParams.foodName || safeParams.food;
  let foodName = undefined;
  if (foodFromParams) {
    foodName = sanitizeDeleteFoodQuery(foodFromParams) || foodFromParams;
  }

  let deleteResult = await deleteFoodLogsForDate(userId, {
    date: dateKey,
    foodName,
    logId: safeParams.logId,
    deleteAll,
  });
  let deletedCount = deleteResult.deletedCount;
  let deletedNames = deleteResult.deletedNames;

  const shouldRetryPizza =
    !deletedCount && foodName && looksLikePizzaDelete(foodFromParams || foodName);
  if (shouldRetryPizza) {
    deleteResult = await deleteFoodLogsForDate(userId, {
      date: dateKey,
      foodName: 'pizza',
      deleteAll: wantsTwoPizzaDeletes(foodFromParams || ''),
    });
    deletedCount = deleteResult.deletedCount;
    deletedNames = deleteResult.deletedNames;
  }

  if (!deletedCount) {
    let hint = '';
    if (foodName) {
      hint = ` matching "${foodName}"`;
    }
    return { success: false, message: `No food logs found for ${dateKey}${hint}.` };
  }
  await logAiCoachAction(userId, 'deleteLog', {
    logType: 'nutrition',
    date: dateKey,
    deletedCount,
    deletedNames,
  });
  return {
    success: true,
    message: `Removed ${deletedFoodLabel(deletedCount, deletedNames)} from your nutrition log.`,
    data: { deletedCount, deletedNames, date: dateKey },
  };
}

async function executeDeleteLogClient(userId, params) {
  const safeParams = params || {};
  const logType = normalizeDeleteLogType(safeParams.logType);
  const dateKey = String(safeParams.date || getClientDateKey()).trim();
  const deleteAll = isDeleteAllRequest(safeParams);

  if (logType === 'nutrition') {
    return deleteNutritionLogsClient(userId, safeParams, dateKey, deleteAll);
  }

  await clearClientDailyMetric(userId, logType, dateKey);
  await logAiCoachAction(userId, 'deleteLog', { logType, date: dateKey });
  const label = DELETE_LABELS[logType] || logType;
  return {
    success: true,
    message: `Removed your ${label} for ${dateKey}.`,
    data: { logType, date: dateKey },
  };
}

function messageFromCaughtError(error, fallbackMessage) {
  if (error && error.message) {
    return error.message;
  }
  return fallbackMessage;
}

async function executeLogSleepClient(userId, params) {
  if (!userId || !db) {
    return { success: false, message: 'Could not save sleep — please sign in and try again.' };
  }
  const safeParams = params || {};
  const hours = firstDefinedNumber(safeParams.hours, safeParams.sleepHours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_SLEEP_HOURS) {
    return { success: false, message: 'Invalid sleep hours (use 0.5–24)' };
  }
  const dateKey = String(safeParams.date || getClientDateKey()).trim();
  if (__DEV__) {
    console.log('[coach-tool] Executing logSleep:', { userId, hours, dateKey });
  }
  try {
    await setDoc(
      doc(db, 'users', userId, 'sleep_logs', dateKey),
      { hours, date: dateKey, logged_at: serverTimestamp() },
      { merge: true },
    );
    await saveDashboardSleepHours(userId, hours, dateKey);
    await logAiCoachAction(userId, 'logSleep', { hours, date: dateKey });
    return { success: true, message: `Logged ${hours} hours of sleep on your dashboard.` };
  } catch (error) {
    console.error('[coach-tool] logSleep failed:', error);
    return {
      success: false,
      message: messageFromCaughtError(error, 'Failed to log sleep'),
    };
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
  await setDoc(
    doc(db, 'users', userId, 'macroTargets', 'current'),
    { protein, carbs, fat, calories, updatedAt: serverTimestamp(), updatedBy: 'aiCoach' },
    { merge: true },
  );
  await setDoc(
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
  );
}

function pickMacroOrDefault(fromParams, fromCurrent, defaultGrams) {
  if (fromParams != null) {
    return fromParams;
  }
  if (fromCurrent != null) {
    return fromCurrent;
  }
  return defaultGrams;
}

async function executeAdjustMacrosClient(userId, params) {
  const safeParams = params || {};
  const currentMacros = await loadCurrentMacros(userId);
  const protein = pickMacroOrDefault(
    finiteOrNull(firstDefinedValue(safeParams.protein, safeParams.newProtein)),
    currentMacros.protein,
    DEFAULT_PROTEIN_G,
  );
  const carbs = pickMacroOrDefault(
    finiteOrNull(firstDefinedValue(safeParams.carbs, safeParams.newCarbs)),
    currentMacros.carbs,
    DEFAULT_CARBS_G,
  );
  const fat = pickMacroOrDefault(
    finiteOrNull(firstDefinedValue(safeParams.fat, safeParams.newFats, safeParams.fats)),
    currentMacros.fat,
    DEFAULT_FAT_G,
  );
  const explicitCalories = finiteOrNull(
    firstDefinedValue(safeParams.calories, safeParams.newCals, safeParams.calorieTarget),
  );
  let calories = explicitCalories;
  if (calories == null) {
    calories = currentMacros.calories;
  }

  if (explicitCalories != null && explicitCalories <= 0) {
    throw new Error(`Invalid calorie target: ${explicitCalories}`);
  }
  if (calories == null || calories <= 0) {
    calories = Math.round(
      protein * KCAL_PER_PROTEIN_OR_CARB +
        carbs * KCAL_PER_PROTEIN_OR_CARB +
        fat * KCAL_PER_FAT,
    );
  }
  if (!Number.isFinite(calories) || calories <= 0) {
    throw new Error(`Invalid calorie target: ${calories}`);
  }
  if (!Number.isFinite(protein) || !Number.isFinite(carbs) || !Number.isFinite(fat)) {
    throw new Error(`Invalid macro targets: P=${protein}, C=${carbs}, F=${fat}`);
  }

  await writeMacroTargets(userId, protein, carbs, fat, calories);
  await logAiCoachAction(userId, 'adjustMacroTargets', safeParams);
  return {
    success: true,
    message: `Daily target updated to ${calories} kcal.`,
    data: { calories, protein, carbs, fat },
  };
}

async function executeLogWaterClient(userId, params) {
  const safeParams = params || {};
  const amount_oz = firstDefinedNumber(
    safeParams.amount_oz,
    safeParams.amountOz,
    safeParams.amount,
  );
  if (!Number.isFinite(amount_oz) || amount_oz <= 0) {
    throw new Error('Water amount must be greater than 0 ounces');
  }

  const dateKey = String(safeParams.date || getClientDateKey()).trim();
  await setDoc(
    doc(db, 'users', userId, 'water_logs', dateKey),
    { amount_oz, date: dateKey, logged_at: serverTimestamp() },
    { merge: true },
  );
  await saveDashboardWaterOz(userId, amount_oz, dateKey);

  await logAiCoachAction(userId, 'logWater', safeParams);
  return {
    success: true,
    message: `Logged ${amount_oz}oz of water.`,
    data: { amount_oz, date: dateKey },
  };
}

async function executeLogStepsClient(userId, params) {
  const safeParams = params || {};
  const step_count = firstDefinedNumber(safeParams.step_count, safeParams.steps);
  if (!Number.isFinite(step_count) || step_count < 0) {
    throw new Error('Step count must be 0 or greater');
  }

  const dateKey = String(safeParams.date || getClientDateKey()).trim();
  await setDoc(
    doc(db, 'users', userId, 'step_logs', dateKey),
    { step_count, date: dateKey, logged_at: serverTimestamp() },
    { merge: true },
  );
  await saveDashboardMetricField(userId, 'dashboard_steps', step_count, dateKey);

  await logAiCoachAction(userId, 'logSteps', safeParams);
  return {
    success: true,
    message: `Logged ${step_count} steps.`,
    data: { step_count, date: dateKey },
  };
}

async function executeRateEnergyClient(userId, params) {
  const safeParams = params || {};
  const rating = Number(safeParams.rating);
  if (!Number.isFinite(rating) || rating < ENERGY_RATING_MIN || rating > ENERGY_RATING_MAX) {
    throw new Error('Energy rating must be between 1 and 10');
  }

  const dateKey = String(safeParams.date || getClientDateKey()).trim();
  const notesText = String(safeParams.notes || '').trim();
  await setDoc(
    doc(db, 'users', userId, 'energy_logs', dateKey),
    { rating, notes: notesText, date: dateKey, logged_at: serverTimestamp() },
    { merge: true },
  );
  await mergeClientDailyMetrics(userId, dateKey, {
    logs: { dashboard_energy: rating },
    tracking: { energyLevel: String(rating) },
  });

  await logAiCoachAction(userId, 'rateEnergy', safeParams);
  return {
    success: true,
    message: `Logged energy level: ${rating}/10.`,
    data: { rating, date: dateKey },
  };
}

async function executeLogMoodClient(userId, params) {
  // Normalize (not just lowercase): "happy 😊" / "great" used to fail after Confirm.
  const safeParams = params || {};
  const moodInput = firstDefinedValue(
    safeParams.mood,
    safeParams.feeling,
    safeParams.value,
    safeParams.emotion,
  );
  const mood = normalizeMoodValue(moodInput) || '';
  if (!VALID_MOODS.includes(mood)) {
    throw new Error(`Mood must be one of: ${VALID_MOODS.join(', ')}`);
  }

  const dateKey = String(safeParams.date || getClientDateKey()).trim();
  const notesText = String(safeParams.notes || '').trim();
  await setDoc(
    doc(db, 'users', userId, 'mood_logs', dateKey),
    { mood, notes: notesText, date: dateKey, logged_at: serverTimestamp() },
    { merge: true },
  );
  await mergeClientDailyMetrics(userId, dateKey, {
    logs: { dashboard_mood: mood },
    tracking: { mood },
  });

  await logAiCoachAction(userId, 'logMood', safeParams);
  return {
    success: true,
    message: `Logged mood: ${mood}.`,
    data: { mood, date: dateKey },
  };
}

async function executeRateWorkoutClient(userId, params) {
  const safeParams = params || {};
  const rating = Number(safeParams.rating);
  if (!Number.isFinite(rating) || rating < WORKOUT_RATING_MIN || rating > WORKOUT_RATING_MAX) {
    throw new Error('Workout rating must be between 1 and 10');
  }

  const dateKey = getClientDateKey();
  const notesText = String(safeParams.notes || '').trim();
  await setDoc(
    doc(db, 'users', userId, 'workout_ratings', dateKey),
    { rating, notes: notesText, date: dateKey, logged_at: serverTimestamp() },
    { merge: true },
  );

  await logAiCoachAction(userId, 'rateWorkout', safeParams);
  return {
    success: true,
    message: `Logged workout rating: ${rating}/10.`,
    data: { rating, date: dateKey },
  };
}

async function executeLogRestDayClient(userId, params) {
  const safeParams = params || {};
  const dateKey = String(safeParams.date || getClientDateKey()).trim();
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
    if (serverResult.success) {
      return serverResult;
    }
    return {
      success: false,
      message: messageFromCaughtError(error, serverResult.message || failMessage),
    };
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
    return {
      success: false,
      message: messageFromCaughtError(error, 'Failed to log nutrition'),
    };
  }
}

async function runClientFirstTools(userId, toolName, params, serverCall) {
  if (toolName === 'logNutrition') {
    return runLogNutritionOnPhone(userId, params);
  }
  if (toolName === 'logSleep') {
    return runClientThenServer(
      userId,
      serverCall,
      () => executeLogSleepClient(userId, params),
      'Failed to log sleep',
    );
  }
  if (toolName === 'logWater') {
    return runClientThenServer(
      userId,
      serverCall,
      () => executeLogWaterClient(userId, params),
      'Failed to log water',
    );
  }
  if (toolName === 'logSteps') {
    return runClientThenServer(
      userId,
      serverCall,
      () => executeLogStepsClient(userId, params),
      'Failed to log steps',
    );
  }
  if (toolName === 'rateEnergy') {
    return runClientThenServer(
      userId,
      serverCall,
      () => executeRateEnergyClient(userId, params),
      'Failed to log energy',
    );
  }
  if (toolName === 'logMood') {
    return runClientThenServer(
      userId,
      serverCall,
      () => executeLogMoodClient(userId, params),
      'Failed to log mood',
    );
  }
  if (toolName === 'logRestDay') {
    return runClientThenServer(
      userId,
      serverCall,
      () => executeLogRestDayClient(userId, params),
      'Failed to log rest day',
    );
  }
  if (toolName === 'deleteLog') {
    return runClientThenServer(
      userId,
      serverCall,
      () => executeDeleteLogClient(userId, params),
      'Failed to delete log',
    );
  }
  return null;
}

async function runServerFallback(userId, toolName, params, serverResult) {
  if (serverResult.success) {
    return serverResult;
  }
  if (toolName === 'adjustMacroTargets') {
    try {
      return await executeAdjustMacrosClient(userId, params);
    } catch (error) {
      return {
        success: false,
        message: messageFromCaughtError(error, 'Failed to update nutrition targets'),
      };
    }
  }
  if (toolName === 'rateWorkout') {
    try {
      return await executeRateWorkoutClient(userId, params);
    } catch (error) {
      return {
        success: false,
        message: messageFromCaughtError(error, 'Failed to rate workout'),
      };
    }
  }
  return serverResult;
}

function planPreviewFieldsFromServer(serverResult) {
  const data = serverResult && serverResult.data ? serverResult.data : {};
  return {
    title: data.title,
    todayPreview: data.todayPreview,
    summary: data.summary,
  };
}

async function handleOpenWorkoutPlan(params, serverResult, navigationHandlers) {
  const openPlanHandler = navigationHandlers.onOpenWorkoutPlan;
  if (typeof openPlanHandler === 'function') {
    const preview = planPreviewFieldsFromServer(serverResult);
    const navResult = await openPlanHandler({
      planId: params.planId || 'current',
      title: preview.title,
      todayPreview: preview.todayPreview,
      summary: preview.summary,
    });
    const navFailed = navResult && navResult.success === false;
    if (!navFailed) {
      return navResult;
    }
  }
  if (serverResult.success) {
    return serverResult;
  }
  return {
    success: false,
    message: serverResult.message || 'Could not open workout plan.',
  };
}

