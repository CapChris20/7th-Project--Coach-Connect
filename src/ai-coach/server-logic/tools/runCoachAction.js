/**
 * tool Executor
 *
 * Purpose: tool Executor — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/ai
 * Key exports: normalizeToolCall, runCoachAction, executeToolAction, TOOL_NAME_ALIASES, TOOL_DISPLAY_NAMES
 *
 * @file-header
 */
/**
 * AI Coach tool execution — server-first via /api/ai-coach/execute-tool, with client fallbacks.
 */
import { auth, db } from '../../../app-start/config';
import { collection, addDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getClientDateKey } from '../../../shared-utils/dateKeys';
import {
  mergeClientDailyMetrics,
  saveDashboardMetricField,
  saveDashboardSleepHours,
  saveDashboardWaterOz,
  saveDashboardWorkoutLog,
  clearClientDailyMetric,
} from '../../../metrics/daily-metrics/saveDailyMetricsToFirestore';
import { getAICoachApiBases } from '../../../shared/api/baseUrl';
import { addFoodLog, deleteFoodLogsForDate } from '../../../nutrition/daily-log/logFoodToFirestore';
import { sanitizeDeleteFoodQuery } from './detectDeleteFoodRequest';

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

export function normalizeToolCall(raw) {
  if (!raw) return null;
  const nameRaw = raw.name || raw.tool || raw.action;
  let name = TOOL_NAME_ALIASES[nameRaw] || nameRaw;
  if (!name) return null;
  const params = raw.params && typeof raw.params === 'object' ? { ...raw.params } : { ...raw };
  if (name === 'logNutrition' && params.name && !params.food && !params.foodName) {
    params.food = params.name;
    params.foodName = params.name;
  }
  delete params.name;
  delete params.tool;

  if (name === 'deleteLog' && !params.logType) {
    params.logType = 'nutrition';
  }

  if (
    name === 'updateWorkout' &&
    (params.type === 'rest' ||
      params.status === 'rest' ||
      params.rest === true ||
      params.restDay === true)
  ) {
    return {
      name: 'logRestDay',
      params: { date: params.date, planId: params.planId },
      reasoning: raw.reasoning || params.reasoning || params.reason || 'Log a rest day on your dashboard.',
    };
  }

  if (name === 'rateWorkout') {
    const notes = String(params.notes || params.note || '').toLowerCase();
    const rating = Number(params.rating);
    if (
      /\brest\s*day\b/.test(notes) ||
      /\bno\s+workout\b/.test(notes) ||
      rating === 0 ||
      !Number.isFinite(rating) ||
      rating < 1
    ) {
      return {
        name: 'logRestDay',
        params: { date: params.date },
        reasoning:
          raw.reasoning || params.reasoning || params.reason || 'Log a rest day on your dashboard workout card.',
      };
    }
  }

  return {
    name,
    params,
    reasoning: raw.reasoning || params.reasoning || params.reason || '',
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
    const url = `${String(base).replace(/\/$/, '')}/api/ai-coach/execute-tool`;
    try {
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
        lastErr = new Error(data?.error || data?.message || `Request failed (${res.status})`);
        continue;
      }
      await logAiCoachAction(userId, toolCall.name, toolCall.params);
      return {
        success: data.success !== false,
        message: data.message || 'Done.',
        data: data.data,
      };
    } catch (e) {
      lastErr = e;
    }
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

  const mealRaw = String(params.mealType || params.meal || 'snacks').toLowerCase();
  const mealType =
    mealRaw === 'snack' || mealRaw === 'snacks'
      ? 'snacks'
      : ['breakfast', 'lunch', 'dinner', 'snacks'].includes(mealRaw)
        ? mealRaw
        : 'snacks';

  await addFoodLog(userId, {
    mealType,
    date: params.date || getClientDateKey(),
    food: {
      name: foodName,
      calories: cals,
      protein,
      carbs,
      fat,
      source: 'manual',
      dataBasis: 'logged_totals',
      servingGrams: Number(params.servingGrams) > 0 ? Number(params.servingGrams) : 100,
      servingSize: 1,
    },
  });

  await logAiCoachAction(userId, 'logNutrition', params);
  return {
    success: true,
    message: `Logged ${foodName}: ${Math.round(cals)} cal, ${Math.round(protein)}g protein`,
  };
}

function buildServerParams(name, params, { trainerId, planId } = {}) {
  const p = { ...params };
  if (name === 'adjustMacroTargets') {
    const protein = Number(p.newProtein ?? p.protein);
    const carbs = Number(p.newCarbs ?? p.carbs);
    const fat = Number(p.newFats ?? p.fats ?? p.fat);
    const calories =
      Number(p.newCals ?? p.calories) ||
      (Number.isFinite(protein) && Number.isFinite(carbs) && Number.isFinite(fat)
        ? Math.round(protein * 4 + carbs * 4 + fat * 9)
        : null);
    return {
      protein: Number.isFinite(protein) ? protein : null,
      carbs: Number.isFinite(carbs) ? carbs : null,
      fat: Number.isFinite(fat) ? fat : null,
      calories: Number.isFinite(calories) ? calories : null,
      reason: p.reason,
    };
  }
  if (name === 'bookSession') {
    const date = p.sessionDate || p.date;
    const time = p.sessionTime || p.time;
    return {
      trainerId: p.trainerId || trainerId,
      sessionDate: date,
      sessionTime: time,
      dateTime: p.dateTime,
      durationMin: Number(p.durationMin ?? p.durationMinutes ?? p.duration ?? 60) || 60,
      notes: p.notes,
    };
  }
  if (name === 'notifyTrainer') {
    return {
      trainerId: p.trainerId || trainerId,
      message: p.message,
      issueType: p.issueType,
      severity: p.severity,
    };
  }
  if (name === 'updateWorkout') {
    return {
      planId: p.planId || planId || 'current',
      dayIndex: p.dayIndex ?? 0,
      exerciseIndex: p.exerciseIndex ?? 0,
      newExercise: p.newExercise,
      exerciseName: p.exerciseName || p.exerciseId,
      reason: p.reason,
    };
  }
  if (name === 'openWorkoutPlan') {
    return {
      planId: p.planId || planId || 'current',
    };
  }
  if (name === 'logNutrition') {
    const out = {
      foodName: p.food || p.foodName,
      mealType: p.mealType,
      date: p.date || getClientDateKey(),
    };
    const cals = Number(p.cals ?? p.calories);
    if (Number.isFinite(cals) && cals > 0) {
      out.calories = cals;
      out.protein = Number(p.protein ?? 0);
      out.carbs = Number(p.carbs ?? 0);
      out.fat = Number(p.fat ?? p.fats ?? 0);
    } else {
      out.quantity = p.quantity ?? 1;
    }
    return out;
  }
  if (name === 'logSleep') {
    return {
      hours: Number(p.hours ?? p.sleepHours),
      date: p.date || getClientDateKey(),
    };
  }
  if (name === 'logWater') {
    return {
      amount_oz: Number(p.amount_oz ?? p.amountOz ?? p.amount),
      date: p.date || getClientDateKey(),
    };
  }
  if (name === 'logSteps') {
    return {
      step_count: Number(p.step_count ?? p.steps),
      date: p.date || getClientDateKey(),
    };
  }
  if (name === 'rateEnergy') {
    return {
      rating: Number(p.rating ?? p.energy),
      notes: p.notes || p.note,
      date: p.date || getClientDateKey(),
    };
  }
  if (name === 'logMood') {
    return {
      mood: p.mood,
      notes: p.notes || p.note,
      date: p.date || getClientDateKey(),
    };
  }
  if (name === 'rateWorkout') {
    return {
      rating: Number(p.rating),
      notes: p.notes || p.note,
      date: p.date || getClientDateKey(),
    };
  }
  if (name === 'logRestDay') {
    return {
      date: p.date || getClientDateKey(),
      planId: p.planId,
    };
  }
  if (name === 'deleteLog') {
    const logType = normalizeDeleteLogType(p.logType);
    const deleteAll = !!(p.deleteAll || p.all || ['allnutrition', 'allfood', 'allmeals', 'all'].includes(String(p.logType || '').toLowerCase()));
    const rawFood = p.foodName || p.food;
    const foodName = rawFood ? sanitizeDeleteFoodQuery(rawFood) || rawFood : undefined;
    return {
      logType,
      date: p.date || getClientDateKey(),
      foodName,
      logId: p.logId,
      deleteAll,
    };
  }
  return p;
}

function normalizeDeleteLogType(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (['food', 'nutrition', 'foodlog', 'meal', 'meals'].includes(s)) return 'nutrition';
  if (['allnutrition', 'allfood', 'allmeals', 'all'].includes(s)) return 'nutrition';
  if (s === 'sleep') return 'sleep';
  if (['water', 'hydration'].includes(s)) return 'water';
  if (['steps', 'step'].includes(s)) return 'steps';
  if (['energy', 'fatigue'].includes(s)) return 'energy';
  if (['mood', 'feeling'].includes(s)) return 'mood';
  if (['workout', 'workoutrating'].includes(s)) return 'workout';
  if (['rest', 'restday', 'rest_day'].includes(s)) return 'restDay';
  return s || 'nutrition';
}

async function executeDeleteLogClient(userId, params) {
  const logType = normalizeDeleteLogType(params?.logType);
  const dateKey = String(params?.date || getClientDateKey()).trim();
  const deleteAll = !!(
    params?.deleteAll ||
    params?.all ||
    ['allnutrition', 'allfood', 'allmeals', 'all'].includes(String(params?.logType || '').toLowerCase())
  );

  if (logType === 'nutrition') {
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
    await logAiCoachAction(userId, 'deleteLog', { logType, date: dateKey, deletedCount, deletedNames });
    const label =
      deletedCount === 1
        ? deletedNames[0] || 'food entry'
        : `${deletedCount} entries (${deletedNames.slice(0, 3).join(', ')}${deletedNames.length > 3 ? '…' : ''})`;
    return {
      success: true,
      message: `Removed ${label} from your nutrition log.`,
      data: { deletedCount, deletedNames, date: dateKey },
    };
  }

  await clearClientDailyMetric(userId, logType, dateKey);
  await logAiCoachAction(userId, 'deleteLog', { logType, date: dateKey });

  const labels = {
    sleep: 'sleep log',
    water: 'water log',
    steps: 'step count',
    energy: 'energy rating',
    mood: 'mood log',
    workout: 'workout entry',
    restDay: 'rest day entry',
  };

  return {
    success: true,
    message: `Removed your ${labels[logType] || logType} for ${dateKey}.`,
    data: { logType, date: dateKey },
  };
}

async function executeLogSleepClient(userId, params) {
  if (!userId || !db) {
    return { success: false, message: 'Could not save sleep — please sign in and try again.' };
  }
  const hours = Number(params?.hours ?? params?.sleepHours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
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

async function executeAdjustMacrosClient(userId, params) {
  // Load current macros as fallbacks (same as server does)
  let currentMacros = {};
  try {
    const goalsSnap = await getDoc(doc(db, 'nutrition_goals', userId));
    if (goalsSnap.exists()) {
      const data = goalsSnap.data();
      currentMacros = {
        protein: Number(data.protein_target) || Number(data.protein),
        carbs: Number(data.carbs_target) || Number(data.carbs),
        fat: Number(data.fat_target) || Number(data.fat),
        calories: Number(data.calorie_target) || Number(data.calories),
      };
    }
  } catch (e) {
    console.warn('Failed to load current macros:', e.message);
  }

  // Apply fallbacks: use params first, then current values, then defaults
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const protein = num(params?.protein ?? params?.newProtein) ?? currentMacros.protein ?? 150;
  const carbs = num(params?.carbs ?? params?.newCarbs) ?? currentMacros.carbs ?? 200;
  const fat = num(params?.fat ?? params?.newFats ?? params?.fats) ?? currentMacros.fat ?? 65;
  const explicitCalories = num(params?.calories ?? params?.newCals ?? params?.calorieTarget);
  let calories = explicitCalories ?? currentMacros.calories;

  if (explicitCalories != null && explicitCalories <= 0) {
    throw new Error(`Invalid calorie target: ${explicitCalories}`);
  }

  // Calculate calories from macros if not provided
  if (calories == null || calories <= 0) {
    calories = Math.round(protein * 4 + carbs * 4 + fat * 9);
  }
  
  // Validate macros - don't write garbage (0) values
  if (!Number.isFinite(calories) || calories <= 0) {
    throw new Error(`Invalid calorie target: ${calories}`);
  }
  if (!Number.isFinite(protein) || !Number.isFinite(carbs) || !Number.isFinite(fat)) {
    throw new Error(`Invalid macro targets: P=${protein}, C=${carbs}, F=${fat}`);
  }
  
  const macroPayload = {
    protein,
    carbs,
    fat,
    calories,
    updatedAt: serverTimestamp(),
    updatedBy: 'aiCoach',
  };

  // Write to BOTH collections (matching server behavior)
  await Promise.all([
    // Write to macroTargets/current
    setDoc(
      doc(db, 'users', userId, 'macroTargets', 'current'),
      macroPayload,
      { merge: true }
    ),
    // Write to nutrition_goals
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
      { merge: true }
    ),
  ]);

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
  if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
    throw new Error('Energy rating must be between 1 and 10');
  }
  
  const dateKey = String(params?.date || getClientDateKey()).trim();
  await Promise.all([
    setDoc(
      doc(db, 'users', userId, 'energy_logs', dateKey),
      { rating, notes: String(params?.notes || '').trim(), date: dateKey, logged_at: serverTimestamp() },
      { merge: true }
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
  const validMoods = ['happy', 'okay', 'stressed', 'tired', 'anxious'];
  if (!validMoods.includes(mood)) {
    throw new Error(`Mood must be one of: ${validMoods.join(', ')}`);
  }
  
  const dateKey = String(params?.date || getClientDateKey()).trim();
  await Promise.all([
    setDoc(
      doc(db, 'users', userId, 'mood_logs', dateKey),
      { mood, notes: String(params?.notes || '').trim(), date: dateKey, logged_at: serverTimestamp() },
      { merge: true }
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
  if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
    throw new Error('Workout rating must be between 1 and 10');
  }
  
  const dateKey = getClientDateKey();
  await setDoc(
    doc(db, 'users', userId, 'workout_ratings', dateKey),
    { rating, notes: String(params?.notes || '').trim(), date: dateKey, logged_at: serverTimestamp() },
    { merge: true }
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

/**
 * Execute a confirmed AI Coach tool.
 */
export async function runCoachAction({
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

  if (coachMode === 'trainer' && TRAINER_READ_ONLY_TOOLS.has(normalized.name)) {
    return {
      success: false,
      message: 'Trainer coach mode is read-only — switch to the client profile to log data.',
    };
  }

  const params = buildServerParams(normalized.name, normalized.params, { trainerId, planId });
  const serverCall = { name: normalized.name, params };

  // All tools route through server first
  if (normalized.name === 'bookSession' && !params.trainerId) {
    return { 
      success: false, 
      message: 'You don\'t have a trainer linked. Connect with a trainer to book sessions.' 
    };
  }

  if (normalized.name === 'notifyTrainer' && !params.trainerId) {
    return { 
      success: false, 
      message: 'You don\'t have a trainer linked. Connect with a trainer to send alerts.' 
    };
  }

  // Nutrition + dashboard metrics write on-device (local date + same paths as Home / Nutrition).
  if (normalized.name === 'logNutrition') {
    try {
      return await executeLogNutritionClient(userId, params);
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to log nutrition' };
    }
  }

  if (normalized.name === 'logSleep') {
    try {
      return await executeLogSleepClient(userId, params);
    } catch (e) {
      const serverResult = await executeToolViaServer(userId, serverCall);
      if (serverResult.success) return serverResult;
      return { success: false, message: e?.message || serverResult.message || 'Failed to log sleep' };
    }
  }

  if (normalized.name === 'logWater') {
    try {
      return await executeLogWaterClient(userId, params);
    } catch (e) {
      const serverResult = await executeToolViaServer(userId, serverCall);
      if (serverResult.success) return serverResult;
      return { success: false, message: e?.message || serverResult.message || 'Failed to log water' };
    }
  }

  if (normalized.name === 'logSteps') {
    try {
      return await executeLogStepsClient(userId, params);
    } catch (e) {
      const serverResult = await executeToolViaServer(userId, serverCall);
      if (serverResult.success) return serverResult;
      return { success: false, message: e?.message || serverResult.message || 'Failed to log steps' };
    }
  }

  if (normalized.name === 'rateEnergy') {
    try {
      return await executeRateEnergyClient(userId, params);
    } catch (e) {
      const serverResult = await executeToolViaServer(userId, serverCall);
      if (serverResult.success) return serverResult;
      return { success: false, message: e?.message || serverResult.message || 'Failed to log energy' };
    }
  }

  if (normalized.name === 'logMood') {
    try {
      return await executeLogMoodClient(userId, params);
    } catch (e) {
      const serverResult = await executeToolViaServer(userId, serverCall);
      if (serverResult.success) return serverResult;
      return { success: false, message: e?.message || serverResult.message || 'Failed to log mood' };
    }
  }

  if (normalized.name === 'logRestDay') {
    try {
      return await executeLogRestDayClient(userId, params);
    } catch (e) {
      const serverResult = await executeToolViaServer(userId, serverCall);
      if (serverResult.success) return serverResult;
      return { success: false, message: e?.message || serverResult.message || 'Failed to log rest day' };
    }
  }

  // Deletes run client-first so Nutrition tab + dashboard update immediately.
  if (normalized.name === 'deleteLog') {
    try {
      return await executeDeleteLogClient(userId, params);
    } catch (e) {
      const serverResult = await executeToolViaServer(userId, serverCall);
      if (serverResult.success) return serverResult;
      return { success: false, message: e?.message || serverResult.message || 'Failed to delete log' };
    }
  }

  const serverResult = await executeToolViaServer(userId, serverCall);

  if (normalized.name === 'openWorkoutPlan') {
    if (typeof navigationHandlers.onOpenWorkoutPlan === 'function') {
      const navResult = await navigationHandlers.onOpenWorkoutPlan({
        planId: params.planId || 'current',
        title: serverResult.data?.title,
        todayPreview: serverResult.data?.todayPreview,
        summary: serverResult.data?.summary,
      });
      if (navResult?.success !== false) return navResult;
    }
    return serverResult.success
      ? serverResult
      : { success: false, message: serverResult.message || 'Could not open workout plan.' };
  }

  if (serverResult.success) return serverResult;

  // Client fallbacks for when server is unreachable (network issues only)
  if (normalized.name === 'adjustMacroTargets') {
    try {
      return await executeAdjustMacrosClient(userId, params);
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to update nutrition targets' };
    }
  }

  if (normalized.name === 'rateWorkout') {
    try {
      return await executeRateWorkoutClient(userId, params);
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to rate workout' };
    }
  }

  return serverResult;
}

/** @deprecated use runCoachAction */
export async function executeToolAction(toolName, userId, trainerId, planId, params) {
  return runCoachAction({
    userId,
    trainerId,
    planId,
    toolCall: { name: toolName, params },
  });
}
