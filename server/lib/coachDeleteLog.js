/**
 * AI Coach deleteLog — remove nutrition entries and dashboard metrics.
 */
const admin = require('firebase-admin');
const { mergeUserDailyMetrics } = require('./dailyMetricsServer');
const { sanitizeDeleteFoodQuery } = require('../../src/ai-coach/server-logic/tools/detectDeleteFoodRequest');

const FieldValue = admin.firestore.FieldValue;

const DAILY_METRIC_CLEAR = {
  sleep: { logs: ['dashboard_sleep'], tracking: ['sleepHours'], sub: 'sleep_logs' },
  water: { logs: ['dashboard_water'], tracking: ['waterIntake'], sub: 'water_logs' },
  steps: { logs: ['dashboard_steps'], tracking: ['steps'], sub: 'step_logs' },
  energy: { logs: ['dashboard_energy'], tracking: ['energyLevel'], sub: 'energy_logs' },
  mood: { logs: ['dashboard_mood'], tracking: ['mood'], sub: 'mood_logs' },
  workout: {
    logs: ['dashboard_workout_name', 'dashboard_workouts', 'workoutLog'],
    tracking: ['workoutName', 'workoutSummary', 'workoutExercises'],
    sub: 'workout_ratings',
  },
  restDay: {
    logs: ['dashboard_workout_name', 'dashboard_workouts', 'workoutLog'],
    tracking: ['workoutName', 'workoutSummary', 'workoutExercises'],
    sub: 'workout_ratings',
  },
};

function normalizeDeleteLogType(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (['food', 'nutrition', 'foodlog', 'meal', 'meals'].includes(s)) return 'nutrition';
  if (['allnutrition', 'allfood', 'allmeals', 'all'].includes(s)) return 'nutrition';
  if (['sleep'].includes(s)) return 'sleep';
  if (['water', 'hydration'].includes(s)) return 'water';
  if (['steps', 'step'].includes(s)) return 'steps';
  if (['energy', 'fatigue'].includes(s)) return 'energy';
  if (['mood', 'feeling'].includes(s)) return 'mood';
  if (['workout', 'workoutrating', 'workout_rating'].includes(s)) return 'workout';
  if (['rest', 'restday', 'rest_day'].includes(s)) return 'restDay';
  return s || 'nutrition';
}

function foodNameMatchesServer(logName, query) {
  const a = String(logName || '').toLowerCase().trim();
  const b = sanitizeDeleteFoodQuery(query) || String(query || '').toLowerCase().trim();
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  if (/pizza|domino/.test(b) && /pizza|domino/.test(a)) return true;
  const tokens = b.split(/[\s,]+/).filter((w) => w.length >= 4);
  return tokens.some((t) => a.includes(t));
}

function foodNameMatches(logName, query) {
  return foodNameMatchesServer(logName, query);
}

async function clearDailyMetricServer(db, userId, dateKey, logType, serverTs) {
  const cfg = DAILY_METRIC_CLEAR[logType];
  if (!cfg) return { success: false, message: `Unknown log type: ${logType}` };

  const logsPatch = {};
  for (const field of cfg.logs) logsPatch[field] = FieldValue.delete();
  const trackingPatch = {};
  for (const field of cfg.tracking) trackingPatch[field] = FieldValue.delete();

  await mergeUserDailyMetrics(db, userId, dateKey, { logs: logsPatch, tracking: trackingPatch }, serverTs);

  if (cfg.sub) {
    try {
      await db.collection('users').doc(userId).collection(cfg.sub).doc(dateKey).delete();
    } catch (_) {
      /* non-fatal */
    }
  }

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

async function deleteNutritionLogsServer(db, userId, { dateKey, foodName, logId, deleteAll }, serverTs) {
  if (logId) {
    const ref = db.collection('nutrition_logs').doc(String(logId));
    const snap = await ref.get();
    if (!snap.exists) {
      return { success: false, message: 'Could not find that food log.' };
    }
    const data = snap.data() || {};
    if (data.user_id && data.user_id !== userId) {
      return { success: false, message: 'That log does not belong to your account.' };
    }
    await ref.delete();
    return {
      success: true,
      message: `Removed ${data.food_name || 'food entry'} from your nutrition log.`,
      data: { deletedCount: 1, deletedNames: [data.food_name || 'entry'] },
    };
  }

  const snap = await db
    .collection('nutrition_logs')
    .where('user_id', '==', userId)
    .where('date', '==', dateKey)
    .get();

  let docs = snap.docs;
  if (!deleteAll && foodName) {
    docs = docs.filter((d) => foodNameMatches(d.data()?.food_name, foodName));
  } else if (!deleteAll && docs.length) {
    docs = [...docs]
      .sort((a, b) => {
        const ta = a.data()?.created_at?.toMillis?.() || 0;
        const tb = b.data()?.created_at?.toMillis?.() || 0;
        return tb - ta;
      })
      .slice(0, 1);
  }

  if (!docs.length) {
    const hint = foodName ? ` matching "${foodName}"` : '';
    return { success: false, message: `No food logs found for ${dateKey}${hint}.` };
  }

  const batch = db.batch();
  const names = [];
  for (const d of docs) {
    batch.delete(d.ref);
    names.push(d.data()?.food_name || 'Food item');
  }
  await batch.commit();

  const label =
    docs.length === 1
      ? names[0]
      : `${docs.length} entries (${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''})`;

  return {
    success: true,
    message: `Removed ${label} from your nutrition log.`,
    data: { deletedCount: docs.length, deletedNames: names, date: dateKey },
  };
}

async function executeDeleteLogServer(db, userId, params, serverTs, isoDateKey) {
  const logType = normalizeDeleteLogType(params?.logType);
  const dateKey = String(params?.date || isoDateKey()).trim();
  const deleteAll = !!(params?.deleteAll || params?.all || ['allnutrition', 'allfood', 'allmeals', 'all'].includes(String(params?.logType || '').toLowerCase()));

  if (logType === 'nutrition') {
    const rawFood = params?.foodName || params?.food;
    const foodName = rawFood ? sanitizeDeleteFoodQuery(rawFood) || rawFood : undefined;
    return deleteNutritionLogsServer(
      db,
      userId,
      {
        dateKey,
        foodName,
        logId: params?.logId,
        deleteAll,
      },
      serverTs,
    );
  }

  return clearDailyMetricServer(db, userId, dateKey, logType, serverTs);
}

module.exports = {
  normalizeDeleteLogType,
  executeDeleteLogServer,
};
