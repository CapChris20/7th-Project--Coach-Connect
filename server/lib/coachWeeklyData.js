/**
 * Reads real Coach Connect data paths for AI weekly context.
 * Primary sources: nutrition_logs, completedWorkouts, users/{uid}/dailyLogs, daily_tracking.
 */

const logger = require('./logger');

/** Cap completedWorkouts reads per aggregation (scalability guard). */
const COMPLETED_WORKOUTS_QUERY_LIMIT = 500;

/** Max account history loaded into coach context (performance cap). */
const COACH_MAX_LOOKBACK_DAYS = 730;

/** Recent days with per-meal detail in the AI prompt (token cap). */
const COACH_PROMPT_MEAL_DETAIL_DAYS = 45;

/** Recent days of step/mood daily breakdown shown in the prompt. */
const COACH_PROMPT_WELLNESS_DETAIL_DAYS = 14;

const toNumberOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const meanOrNull = (nums) => {
  const arr = (nums || []).filter((n) => Number.isFinite(n));
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};

function isoDateKey(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

function last7DateKeys() {
  const keys = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(isoDateKey(d));
  }
  return keys.sort();
}

function tsFromProfileValue(v) {
  if (v == null) return null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v._seconds != null) return v._seconds * 1000 + (v._nanoseconds || 0) / 1e6;
  if (v instanceof Date) return v.getTime();
  const n = Date.parse(String(v));
  return Number.isFinite(n) ? n : null;
}

/**
 * Start of coach personal-data window: account creation → now (capped at COACH_MAX_LOOKBACK_DAYS).
 * @param {object} [profile]
 * @returns {number} epoch ms
 */
function resolveCoachContextStartMs(profile) {
  const now = Date.now();
  const maxBack = now - COACH_MAX_LOOKBACK_DAYS * 86400000;
  const created =
    tsFromProfileValue(profile?.createdAt) ??
    tsFromProfileValue(profile?.onboardingCompletedAt);
  if (created != null) return Math.max(created, maxBack);
  return now - 7 * 86400000;
}

async function fetchDateKeyedSubDocs(db, userId, subcollection, startKey, mapDoc) {
  const out = [];
  try {
    const snap = await db.collection('users').doc(userId).collection(subcollection).get();
    snap.docs.forEach((d) => {
      const data = d.data() || {};
      const dateKey = String(data.date || d.id || '').slice(0, 10);
      if (!dateKey || dateKey.length < 10 || dateKey < startKey) return;
      const mapped = mapDoc(data, dateKey);
      if (mapped != null) out.push(mapped);
    });
  } catch (err) {
    logger.warn(
      `coachWeeklyData: failed to fetch users/${userId}/${subcollection}, continuing with empty`,
      err?.message || err
    );
  }
  return out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

async function fetchDailyLogsSince(db, userId, startKey) {
  const docs = [];
  try {
    const snap = await db.collection('users').doc(userId).collection('dailyLogs').get();
    snap.docs.forEach((d) => {
      if (String(d.id).slice(0, 10) >= startKey) docs.push({ id: d.id, data: d.data() || {} });
    });
  } catch (err) {
    logger.warn(
      'coachWeeklyData: failed to fetch dailyLogs collection, continuing with empty',
      err?.message || err
    );
  }
  return docs.sort((a, b) => a.id.localeCompare(b.id));
}

function computeVolumeTrend(dailyVolumes) {
  const vols = (dailyVolumes || []).filter((n) => Number.isFinite(n));
  if (vols.length < 3) return null;
  const mid = Math.floor(vols.length / 2);
  const a = meanOrNull(vols.slice(0, mid));
  const b = meanOrNull(vols.slice(mid));
  if (a == null || b == null) return null;
  const pct = a === 0 ? 0 : (b - a) / a;
  if (pct > 0.07) return 'up';
  if (pct < -0.07) return 'down';
  return 'flat';
}

function tsToMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.toDate) return ts.toDate().getTime();
  const p = Date.parse(ts);
  return Number.isNaN(p) ? null : p;
}

/** Extract workout intensity (1–10) from varied Firestore shapes. */
function collectRpeFromDoc(data) {
  if (!data || typeof data !== 'object') return [];
  const out = [];
  const topLevel = [data.avgRPE, data.avgRpe, data.rpe, data.RPE, data.rating];
  for (const v of topLevel) {
    const n = toNumberOrNull(v);
    if (n != null && n >= 1 && n <= 10) out.push(n);
  }
  if (Array.isArray(data.workoutLog)) {
    data.workoutLog.forEach((ex) => {
      const exRpe = [ex?.rpe, ex?.RPE, ex?.rating, ex?.avgRPE];
      for (const v of exRpe) {
        const n = toNumberOrNull(v);
        if (n != null && n >= 1 && n <= 10) out.push(n);
      }
      const sets = ex?.sets;
      if (Array.isArray(sets)) {
        sets.forEach((s) => {
          const n = toNumberOrNull(s?.rpe ?? s?.RPE ?? s?.rating);
          if (n != null && n >= 1 && n <= 10) out.push(n);
        });
      }
    });
  }
  if (Array.isArray(data.exercises)) {
    data.exercises.forEach((ex) => {
      const exRpe = [ex?.rpe, ex?.RPE, ex?.rating];
      for (const v of exRpe) {
        const n = toNumberOrNull(v);
        if (n != null && n >= 1 && n <= 10) out.push(n);
      }
      const sets = ex?.sets || ex?.completedSets;
      if (Array.isArray(sets)) {
        sets.forEach((s) => {
          const n = toNumberOrNull(s?.rpe ?? s?.RPE ?? s?.rating);
          if (n != null && n >= 1 && n <= 10) out.push(n);
        });
      }
    });
  }
  return out;
}

function foodLabelFromLog(data) {
  if (data.food_name) return String(data.food_name).trim();
  const food = data.food;
  if (food && typeof food === 'object' && food.name) return String(food.name).trim();
  if (data.foodName) return String(data.foodName).trim();
  if (data.name) return String(data.name).trim();
  return null;
}

function dayKeyFromLog(data, docId) {
  if (data.date && String(data.date).length >= 8) return String(data.date).slice(0, 10);
  const ts = data.created_at || data.createdAt || data.timestamp;
  if (ts && typeof ts.toDate === 'function') return isoDateKey(ts.toDate());
  if (ts?.seconds) return isoDateKey(new Date(ts.seconds * 1000));
  if (typeof docId === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(docId)) return docId;
  return null;
}

function addToDayMap(byDay, day, data) {
  if (!day) return;
  if (!byDay[day]) {
    byDay[day] = { calories: 0, protein: 0, carbs: 0, fat: 0, foods: [], meals: [] };
  }
  const cals = Number(data.calories) || 0;
  byDay[day].calories += cals;
  byDay[day].protein += Number(data.protein) || 0;
  byDay[day].carbs += Number(data.carbs) || 0;
  byDay[day].fat += Number(data.fat) || 0;
  const label = foodLabelFromLog(data);
  if (label) {
    byDay[day].foods.push(label);
    byDay[day].meals.push({
      meal: data.meal_type || data.mealType || 'meal',
      food: label,
      calories: Math.round(cals),
      protein: Math.round(Number(data.protein) || 0),
    });
  }
}

async function fetchNutritionDays(db, userId, startKey) {
  const byDay = {};

  const ingestLogDocs = (docs) => {
    docs.forEach((d) => {
      const data = d.data() || {};
      const day = dayKeyFromLog(data, d.id);
      if (day && day >= startKey) addToDayMap(byDay, day, data);
    });
  };

  for (const field of ['user_id', 'userId']) {
    try {
      const snap = await db
        .collection('nutrition_logs')
        .where(field, '==', userId)
        .where('date', '>=', startKey)
        .get();
      ingestLogDocs(snap.docs);
    } catch (err) {
      try {
        const snap = await db
          .collection('nutrition_logs')
          .where(field, '==', userId)
          .limit(500)
          .get();
        ingestLogDocs(snap.docs);
      } catch (innerErr) {
        logger.warn(
          `coachWeeklyData: failed to fetch nutrition_logs (${field}), continuing with empty`,
          innerErr?.message || innerErr
        );
      }
    }
  }

  try {
    const legacySnap = await db.collection('users').doc(userId).collection('nutritionLogs').get();
    legacySnap.docs.forEach((d) => {
      const data = d.data() || {};
      const day = data.date || d.id;
      if (day < startKey) return;
      const totals = data.dayTotals || data.totals || data;
      addToDayMap(byDay, day, totals);
    });
  } catch (err) {
    logger.warn(
      'coachWeeklyData: failed to fetch legacy nutritionLogs, continuing with empty',
      err?.message || err
    );
  }

  return Object.entries(byDay)
    .filter(([, t]) => t.calories > 0 || t.protein > 0 || t.carbs > 0 || t.fat > 0)
    .map(([date, t]) => ({
      date,
      calories: t.calories,
      protein: t.protein,
      carbs: t.carbs,
      fat: t.fat,
      foods: [...new Set(t.foods || [])].slice(0, 20),
      meals: (t.meals || []).slice(0, 40),
    }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

async function fetchWorkoutRatingsRpe(db, userId, startKey) {
  const rows = await fetchDateKeyedSubDocs(db, userId, 'workout_ratings', startKey, (data, dateKey) => {
    const r = toNumberOrNull(data?.rating);
    if (r == null || r < 1 || r > 10) return null;
    return { date: dateKey, rating: r };
  });
  return rows.map((x) => x.rating);
}

async function fetchWorkoutLogsRpe(db, userId, startMs) {
  const rpes = [];
  try {
    const snap = await db.collection('users').doc(userId).collection('workoutLogs').get();
    snap.docs.forEach((d) => {
      const data = d.data() || {};
      const ts = data.timestamp;
      const ms = tsToMillis(ts);
      if (ms != null && ms < startMs) return;
      collectRpeFromDoc(data).forEach((n) => rpes.push(n));
    });
  } catch (err) {
    logger.warn(
      'coachWeeklyData: failed to fetch workoutLogs for RPE, continuing with empty',
      err?.message || err
    );
  }
  return rpes;
}

async function fetchWorkoutAnalysis(db, userId, startMs) {
  const startKey = isoDateKey(new Date(startMs));
  const sessionDays = new Set();
  const volumes = [];
  const rpeValues = [];

  try {
    const snap = await db
      .collection('completedWorkouts')
      .where('userId', '==', userId)
      .limit(COMPLETED_WORKOUTS_QUERY_LIMIT)
      .get();
    snap.docs.forEach((d) => {
      const data = d.data() || {};
      const ms = tsToMillis(data.completedAt);
      if (ms == null || ms < startMs) return;
      sessionDays.add(isoDateKey(new Date(ms)));
      const v = toNumberOrNull(data.totalVolume);
      if (v != null) volumes.push(v);
      collectRpeFromDoc(data).forEach((n) => rpeValues.push(n));
    });
  } catch (err) {
    logger.warn(
      'coachWeeklyData: failed to fetch completedWorkouts, continuing with empty',
      err?.message || err
    );
  }

  const dailyLogDocs = await fetchDailyLogsSince(db, userId, startKey);
  dailyLogDocs.forEach(({ id, data }) => {
    const hasWorkout =
      (Array.isArray(data.workoutLog) && data.workoutLog.length > 0) ||
      Boolean(data.dashboard_workouts) ||
      Boolean(data.dashboard_workout_name);
    if (hasWorkout) sessionDays.add(id.slice(0, 10));
    collectRpeFromDoc(data).forEach((n) => rpeValues.push(n));
  });

  const ratingRpes = await fetchWorkoutRatingsRpe(db, userId, startKey);
  ratingRpes.forEach((n) => rpeValues.push(n));
  const logRpes = await fetchWorkoutLogsRpe(db, userId, startMs);
  logRpes.forEach((n) => rpeValues.push(n));

  const sessionsLogged = sessionDays.size;
  if (!sessionsLogged && !rpeValues.length) return null;

  const avgRPE = meanOrNull(rpeValues);

  return {
    sessionsLogged,
    sessionDates: [...sessionDays].sort(),
    totalVolume: volumes.length ? volumes.reduce((a, b) => a + b, 0) : null,
    avgRPE,
    volumeTrend: computeVolumeTrend(volumes),
  };
}

async function fetchDashboardWellnessFromDailyLogs(db, userId, startKey) {
  const dailyLogDocs = await fetchDailyLogsSince(db, userId, startKey);
  const steps = [];
  const water = [];
  const energy = [];
  const mood = [];
  const soreness = [];
  const sleepDaily = [];

  dailyLogDocs.forEach(({ id, data }) => {
    const date = String(id).slice(0, 10);
    const stepVal = toNumberOrNull(data?.dashboard_steps);
    if (stepVal != null && stepVal > 0) steps.push({ date, steps: Math.round(stepVal) });

    const waterVal = toNumberOrNull(data?.dashboard_water);
    if (waterVal != null && waterVal > 0) water.push(waterVal);

    const energyVal = toNumberOrNull(data?.dashboard_energy);
    if (energyVal != null && energyVal >= 1 && energyVal <= 10) {
      energy.push({ date, rating: energyVal });
    }

    const moodVal = data?.dashboard_mood;
    if (moodVal != null && String(moodVal).trim()) {
      mood.push({ date, mood: String(moodVal).trim() });
    }

    const sorenessVal = toNumberOrNull(data?.dashboard_soreness);
    if (sorenessVal != null && sorenessVal >= 0) {
      soreness.push({ date, rating: sorenessVal });
    }

    const sleepH =
      toNumberOrNull(data?.dashboard_sleep) ??
      toNumberOrNull(data?.sleep_hours) ??
      toNumberOrNull(data?.sleepHours);
    if (sleepH != null && sleepH > 0) sleepDaily.push({ date, hours: sleepH });
  });

  return { steps, water, energy, mood, soreness, sleepDaily };
}

function mergeStepSeries(subcollectionSteps, dashboardSteps) {
  const byDate = new Map();
  (subcollectionSteps?.daily || []).forEach((d) => byDate.set(d.date, d));
  (dashboardSteps || []).forEach((d) => byDate.set(d.date, d));
  const daily = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (!daily.length) return null;
  const avgDaily = meanOrNull(daily.map((d) => d.steps));
  return {
    avgDaily: avgDaily != null ? Math.round(avgDaily) : null,
    daysLogged: daily.length,
    daily,
  };
}

function mergeWaterSeries(subOz, dashboardOz) {
  const vals = [...(subOz?.rows || []), ...(dashboardOz || [])].filter((n) => Number.isFinite(n));
  if (!vals.length) return subOz || null;
  const avgOzDaily = meanOrNull(vals);
  return {
    avgOzDaily: avgOzDaily != null ? Math.round(avgOzDaily) : null,
    daysLogged: vals.length,
  };
}

function mergeEnergySeries(subEnergy, dashboardEnergy) {
  const byDate = new Map();
  (dashboardEnergy || []).forEach((e) => byDate.set(e.date, e.rating));
  const avgRating = meanOrNull([...byDate.values()]);
  if (avgRating == null && subEnergy?.avgRating == null) return subEnergy || null;
  return {
    avgRating:
      avgRating != null
        ? Math.round(avgRating * 10) / 10
        : subEnergy?.avgRating ?? null,
    daysLogged: Math.max(byDate.size, subEnergy?.daysLogged || 0),
  };
}

function mergeMoodSeries(subMood, dashboardMood) {
  const byDate = new Map();
  (subMood?.entries || []).forEach((e) => byDate.set(e.date, e));
  (dashboardMood || []).forEach((e) => byDate.set(e.date, e));
  const entries = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (!entries.length) return null;
  return { entries, daysLogged: entries.length };
}

async function fetchStepLogs(db, userId, startKey) {
  const daily = await fetchDateKeyedSubDocs(db, userId, 'step_logs', startKey, (data, dateKey) => {
    const steps = toNumberOrNull(data?.step_count);
    if (steps == null || steps <= 0) return null;
    return { date: dateKey, steps: Math.round(steps) };
  });
  if (!daily.length) return null;
  const avgDaily = meanOrNull(daily.map((d) => d.steps));
  return {
    avgDaily: avgDaily != null ? Math.round(avgDaily) : null,
    daysLogged: daily.length,
    daily,
  };
}

async function fetchWaterLogs(db, userId, startKey) {
  const rows = await fetchDateKeyedSubDocs(db, userId, 'water_logs', startKey, (data, dateKey) => {
    const oz = toNumberOrNull(data?.amount_oz);
    if (oz == null || oz <= 0) return null;
    return { date: dateKey, oz };
  });
  if (!rows.length) return null;
  const avgOzDaily = meanOrNull(rows.map((r) => r.oz));
  return {
    avgOzDaily: avgOzDaily != null ? Math.round(avgOzDaily) : null,
    daysLogged: rows.length,
  };
}

async function fetchEnergyLogs(db, userId, startKey) {
  const rows = await fetchDateKeyedSubDocs(db, userId, 'energy_logs', startKey, (data, dateKey) => {
    const rating = toNumberOrNull(data?.rating);
    if (rating == null || rating < 1 || rating > 10) return null;
    return { date: dateKey, rating };
  });
  if (!rows.length) return null;
  const avgRating = meanOrNull(rows.map((r) => r.rating));
  return {
    avgRating: avgRating != null ? Math.round(avgRating * 10) / 10 : null,
    daysLogged: rows.length,
  };
}

async function fetchMoodLogs(db, userId, startKey) {
  const entries = await fetchDateKeyedSubDocs(db, userId, 'mood_logs', startKey, (data, dateKey) => {
    const mood = data?.mood;
    if (!mood || !String(mood).trim()) return null;
    return { date: dateKey, mood: String(mood).trim() };
  });
  if (!entries.length) return null;
  return { entries, daysLogged: entries.length };
}

async function fetchWellnessAnalysis(db, userId, startKey) {
  const dashboard = await fetchDashboardWellnessFromDailyLogs(db, userId, startKey);

  const [stepsSub, waterSub, energySub, moodSub] = await Promise.all([
    fetchDateKeyedSubDocs(db, userId, 'step_logs', startKey, (data, dateKey) => {
      const step_count = toNumberOrNull(data?.step_count);
      if (step_count == null || step_count <= 0) return null;
      return { date: dateKey, steps: Math.round(step_count) };
    }),
    fetchDateKeyedSubDocs(db, userId, 'water_logs', startKey, (data, dateKey) => {
      const oz = toNumberOrNull(data?.amount_oz);
      if (oz == null || oz <= 0) return null;
      return { date: dateKey, oz };
    }),
    fetchDateKeyedSubDocs(db, userId, 'energy_logs', startKey, (data, dateKey) => {
      const rating = toNumberOrNull(data?.rating);
      if (rating == null || rating < 1 || rating > 10) return null;
      return { date: dateKey, rating };
    }),
    fetchDateKeyedSubDocs(db, userId, 'mood_logs', startKey, (data, dateKey) => {
      const mood = data?.mood;
      if (!mood || !String(mood).trim()) return null;
      return { date: dateKey, mood: String(mood).trim() };
    }),
  ]);

  let stepsFromSub = null;
  if (stepsSub.length) {
    const avgDaily = meanOrNull(stepsSub.map((d) => d.steps));
    stepsFromSub = {
      avgDaily: avgDaily != null ? Math.round(avgDaily) : null,
      daysLogged: stepsSub.length,
      daily: stepsSub,
    };
  }

  let waterFromSub = null;
  if (waterSub.length) {
    const avgOzDaily = meanOrNull(waterSub.map((r) => r.oz));
    waterFromSub = {
      avgOzDaily: avgOzDaily != null ? Math.round(avgOzDaily) : null,
      daysLogged: waterSub.length,
    };
  }

  let energyFromSub = null;
  if (energySub.length) {
    const avgRating = meanOrNull(energySub.map((r) => r.rating));
    energyFromSub = {
      avgRating: avgRating != null ? Math.round(avgRating * 10) / 10 : null,
      daysLogged: energySub.length,
    };
  }

  let moodFromSub = null;
  if (moodSub.length) {
    moodFromSub = { entries: moodSub, daysLogged: moodSub.length };
  }

  const steps = mergeStepSeries(stepsFromSub, dashboard.steps);
  const water = mergeWaterSeries(
    waterFromSub ? { ...waterFromSub, rows: waterSub.map((r) => r.oz) } : null,
    dashboard.water
  );
  const energy = mergeEnergySeries(energyFromSub, dashboard.energy);
  const mood = mergeMoodSeries(moodFromSub, dashboard.mood);

  let soreness = null;
  if (dashboard.soreness.length) {
    const avg = meanOrNull(dashboard.soreness.map((s) => s.rating));
    soreness = {
      avgRating: avg != null ? Math.round(avg * 10) / 10 : null,
      daysLogged: dashboard.soreness.length,
      daily: dashboard.soreness.slice(-14),
    };
  }

  const sleepDaily = dashboard.sleepDaily.length ? dashboard.sleepDaily : null;

  if (!steps && !water && !energy && !mood && !soreness && !sleepDaily) return null;
  return { steps, water, energy, mood, soreness, sleepDaily };
}

async function fetchStreak(db, userId) {
  try {
    const snap = await db.doc(`users/${userId}/streaks/current`).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    const currentStreak =
      toNumberOrNull(data.streak) ??
      toNumberOrNull(data.currentStreak) ??
      toNumberOrNull(data.streakDays);
    if (currentStreak == null || currentStreak <= 0) return null;
    return { currentStreak: Math.round(currentStreak) };
  } catch (err) {
    logger.warn(
      'coachWeeklyData: failed to fetch streaks/current, continuing with empty',
      err?.message || err
    );
    return null;
  }
}

async function fetchWeightLog(db, userId, startKey) {
  const dailyLogDocs = await fetchDailyLogsSince(db, userId, startKey);
  const points = [];
  dailyLogDocs.forEach(({ id, data }) => {
    const weight =
      toNumberOrNull(data?.dashboard_weight) ??
      toNumberOrNull(data?.weight) ??
      toNumberOrNull(data?.bodyWeight);
    if (weight != null) points.push({ date: id.slice(0, 10), weightLbs: weight });
  });
  return points;
}

async function fetchSleepAnalysis(db, userId, startKey) {
  const sleepHours = [];

  const dailyLogDocs = await fetchDailyLogsSince(db, userId, startKey);
  dailyLogDocs.forEach(({ data }) => {
    const hours =
      toNumberOrNull(data?.dashboard_sleep) ??
      toNumberOrNull(data?.sleep_hours) ??
      toNumberOrNull(data?.sleepHours);
    if (hours != null) sleepHours.push(hours);
  });

  try {
    const trackSnap = await db.collection('users').doc(userId).collection('daily_tracking').get();
    trackSnap.docs.forEach((d) => {
      if (String(d.id).slice(0, 10) < startKey) return;
      const h = toNumberOrNull(d.data()?.sleepHours);
      if (h != null) sleepHours.push(h);
    });
  } catch (err) {
    logger.warn(
      'coachWeeklyData: failed to fetch daily_tracking for sleep, continuing with empty',
      err?.message || err
    );
  }

  try {
    const legacySnap = await db.collection('users').doc(userId).collection('sleepLogs').get();
    legacySnap.docs.forEach((d) => {
      const data = d.data() || {};
      const day = String(data.date || d.id || '').slice(0, 10);
      if (day && day.length >= 10 && day < startKey) return;
      const h = toNumberOrNull(data.hours);
      if (h != null) sleepHours.push(h);
    });
  } catch (err) {
    logger.warn(
      'coachWeeklyData: failed to fetch legacy sleepLogs, continuing with empty',
      err?.message || err
    );
  }

  if (!sleepHours.length) return null;
  const avgHours = meanOrNull(sleepHours);
  return {
    avgHours,
    daysLogged: sleepHours.length,
    quality: null,
    isDepleted: avgHours != null ? avgHours < 6.5 : null,
  };
}

async function fetchMacroTargets(db, userId) {
  let targets = null;
  try {
    const snap = await db.doc(`users/${userId}/macroTargets/current`).get();
    if (snap.exists) targets = snap.data() || {};
  } catch (err) {
    logger.warn(
      'coachWeeklyData: failed to fetch macroTargets/current, continuing',
      err?.message || err
    );
  }

  try {
    const goalsSnap = await db.collection('nutrition_goals').doc(userId).get();
    if (goalsSnap.exists) {
      const g = goalsSnap.data() || {};
      targets = {
        ...(targets || {}),
        calories: toNumberOrNull(g.calorie_target) ?? targets?.calories,
        protein: toNumberOrNull(g.protein_target) ?? targets?.protein,
        carbs: toNumberOrNull(g.carbs_target) ?? targets?.carbs,
        fat: toNumberOrNull(g.fat_target) ?? targets?.fat,
      };
    }
  } catch (err) {
    logger.warn(
      'coachWeeklyData: failed to fetch nutrition_goals, continuing',
      err?.message || err
    );
  }

  const calories =
    toNumberOrNull(targets?.calories) ??
    toNumberOrNull(targets?.calorie_target);
  const protein =
    toNumberOrNull(targets?.protein) ?? toNumberOrNull(targets?.protein_target);
  const carbs = toNumberOrNull(targets?.carbs) ?? toNumberOrNull(targets?.carbs_target);
  const fat = toNumberOrNull(targets?.fat) ?? toNumberOrNull(targets?.fat_target);

  if (calories == null && protein == null && carbs == null && fat == null) return null;

  return { calories, protein, carbs, fat };
}

function buildNutritionAnalysis(nutritionDays, contextStartMs) {
  const daysLogged = nutritionDays.length;
  if (!daysLogged) return null;
  const now = Date.now();
  const spanDays = Math.max(1, Math.ceil((now - contextStartMs) / 86400000));
  const detailCutoff = isoDateKey(new Date(now - COACH_PROMPT_MEAL_DETAIL_DAYS * 86400000));
  const sorted = [...nutritionDays].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return {
    avgDailyCalories: meanOrNull(sorted.map((x) => x.calories)),
    avgProtein: meanOrNull(sorted.map((x) => x.protein)),
    avgCarbs: meanOrNull(sorted.map((x) => x.carbs)),
    avgFat: meanOrNull(sorted.map((x) => x.fat)),
    daysLogged,
    totalDaysSinceJoin: spanDays,
    consistencyScore: Math.min(100, Math.round((daysLogged / spanDays) * 100)),
    firstLogDate: sorted[0]?.date || null,
    lastLogDate: sorted[sorted.length - 1]?.date || null,
    dailyBreakdown: sorted
      .filter((d) => d.date >= detailCutoff)
      .map((d) => ({
        date: d.date,
        calories: Math.round(d.calories),
        protein: Math.round(d.protein),
        carbs: Math.round(d.carbs),
        fat: Math.round(d.fat),
        foods: d.foods || [],
        meals: d.meals || [],
      })),
    totalLoggedDaysAllTime: daysLogged,
  };
}

async function aggregateCoachWeeklyData(db, userId, startMs) {
  const startKey = isoDateKey(new Date(startMs));
  const nutritionDays = await fetchNutritionDays(db, userId, startKey);
  const nutritionAnalysis = buildNutritionAnalysis(nutritionDays, startMs);
  const workoutAnalysis = await fetchWorkoutAnalysis(db, userId, startMs);
  const sleepAnalysis = await fetchSleepAnalysis(db, userId, startKey);
  const macroTargets = await fetchMacroTargets(db, userId);
  const weightLog = await fetchWeightLog(db, userId, startKey);
  const wellnessAnalysis = await fetchWellnessAnalysis(db, userId, startKey);
  const streakData = await fetchStreak(db, userId);

  let weightTrend = 'unknown';
  if (weightLog.length >= 2) {
    const first = weightLog[0].weightLbs;
    const last = weightLog[weightLog.length - 1].weightLbs;
    const delta = last - first;
    if (Math.abs(delta) < 0.5) weightTrend = 'stable';
    else if (delta > 0) weightTrend = 'up';
    else weightTrend = 'down';
  } else if (weightLog.length === 1) {
    weightTrend = 'single_entry';
  }

  return {
    nutritionAnalysis,
    workoutAnalysis,
    sleepAnalysis,
    macroTargets,
    weightLog,
    weightTrend,
    wellnessAnalysis,
    streakData,
    contextMeta: {
      startKey,
      startMs,
      totalDaysSinceJoin: Math.max(1, Math.ceil((Date.now() - startMs) / 86400000)),
    },
  };
}

module.exports = {
  aggregateCoachWeeklyData,
  isoDateKey,
  last7DateKeys,
  resolveCoachContextStartMs,
  COACH_PROMPT_MEAL_DETAIL_DAYS,
  COACH_PROMPT_WELLNESS_DETAIL_DAYS,
};
