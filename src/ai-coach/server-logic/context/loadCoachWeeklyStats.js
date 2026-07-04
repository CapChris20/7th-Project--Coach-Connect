/**
 * coach Weekly Data Client
 *
 * Purpose: coach Weekly Data Client — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/ai
 * Key exports: aggregateCoachWeeklyDataClient
 *
 * @file-header
 */
/**
 * Client Firestore reads for 7-day AI context (matches server/lib/coachWeeklyData.js).
 */
import { db } from '../../../app-start/config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

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

function isoDateKey(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-');
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

function addToDayMap(byDay, day, data) {
  if (!day) return;
  if (!byDay[day]) byDay[day] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  byDay[day].calories += Number(data.calories) || 0;
  byDay[day].protein += Number(data.protein) || 0;
  byDay[day].carbs += Number(data.carbs) || 0;
  byDay[day].fat += Number(data.fat) || 0;
}

async function fetchNutritionDays(userId, startKey) {
  const byDay = {};

  const ingest = (docs) => {
    docs.forEach((d) => {
      const data = d.data() || {};
      const day = data.date;
      if (day && day >= startKey) addToDayMap(byDay, day, data);
    });
  };

  for (const field of ['user_id', 'userId']) {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'nutrition_logs'),
          where(field, '==', userId),
          where('date', '>=', startKey)
        )
      );
      ingest(snap.docs);
    } catch (_) {
      try {
        const snap = await getDocs(
          query(collection(db, 'nutrition_logs'), where(field, '==', userId))
        );
        ingest(snap.docs);
      } catch (__) {
        /* ignore */
      }
    }
  }

  try {
    const legacySnap = await getDocs(collection(db, 'users', userId, 'nutritionLogs'));
    legacySnap.docs.forEach((d) => {
      const data = d.data() || {};
      const day = data.date || d.id;
      if (day < startKey) return;
      addToDayMap(byDay, day, data.dayTotals || data.totals || data);
    });
  } catch (_) {
    /* ignore */
  }

  return Object.entries(byDay)
    .filter(([, t]) => t.calories > 0 || t.protein > 0)
    .map(([, t]) => t);
}

async function fetchWorkoutAnalysis(userId, startMs) {
  const sessionDays = new Set();
  const volumes = [];

  try {
    const snap = await getDocs(
      query(collection(db, 'completedWorkouts'), where('userId', '==', userId))
    );
    snap.docs.forEach((d) => {
      const data = d.data() || {};
      const c = data.completedAt;
      let ms = null;
      if (c?.toMillis) ms = c.toMillis();
      else if (c?.seconds) ms = c.seconds * 1000;
      if (ms == null || ms < startMs) return;
      sessionDays.add(isoDateKey(new Date(ms)));
      const v = toNum(data.totalVolume);
      if (v != null) volumes.push(v);
    });
  } catch (_) {
    /* ignore */
  }

  for (const key of last7DateKeys()) {
    try {
      const snap = await getDoc(doc(db, 'users', userId, 'dailyLogs', key));
      if (!snap.exists()) continue;
      const data = snap.data() || {};
      const hasWorkout =
        (Array.isArray(data.workoutLog) && data.workoutLog.length > 0) ||
        Boolean(data.dashboard_workouts) ||
        Boolean(data.dashboard_workout_name);
      if (hasWorkout) sessionDays.add(key);
    } catch (_) {
      /* ignore */
    }
  }

  const sessionsLogged = sessionDays.size;
  if (!sessionsLogged) return null;

  return {
    sessionsLogged,
    totalVolume: volumes.length ? volumes.reduce((a, b) => a + b, 0) : null,
    avgRPE: null,
    volumeTrend: sessionsLogged > 0 ? 'logged' : 'none',
  };
}

async function fetchSleepAnalysis(userId) {
  const sleepHours = [];

  for (const key of last7DateKeys()) {
    let hours = null;
    try {
      const logSnap = await getDoc(doc(db, 'users', userId, 'dailyLogs', key));
      if (logSnap.exists()) {
        const data = logSnap.data() || {};
        hours =
          toNum(data.dashboard_sleep) ?? toNum(data.sleep_hours) ?? toNum(data.sleepHours);
      }
    } catch (_) {
      /* ignore */
    }
    if (hours == null) {
      try {
        // TODO(phase-5): remove legacy daily_tracking fallback after backfill
        const trackSnap = await getDoc(doc(db, 'users', userId, 'daily_tracking', key));
        if (trackSnap.exists()) hours = toNum(trackSnap.data()?.sleepHours);
      } catch (_) {
        /* ignore */
      }
    }
    if (hours != null) sleepHours.push(hours);
  }

  if (!sleepHours.length) return null;
  const avgHours = mean(sleepHours);
  return {
    avgHours,
    quality: null,
    isDepleted: avgHours != null && avgHours < 6.5,
  };
}

export async function aggregateCoachWeeklyDataClient(userId) {
  if (!userId || !db) {
    return {
      nutritionAnalysis: null,
      workoutAnalysis: null,
      sleepAnalysis: null,
    };
  }

  const startMs = Date.now() - MS_7D;
  const startKey = isoDateKey(new Date(startMs));
  const nutritionDays = await fetchNutritionDays(userId, startKey);
  const daysLogged = nutritionDays.length;

  const nutritionAnalysis = daysLogged
    ? {
        avgDailyCalories: mean(nutritionDays.map((x) => x.calories)),
        avgProtein: mean(nutritionDays.map((x) => x.protein)),
        avgCarbs: mean(nutritionDays.map((x) => x.carbs)),
        avgFat: mean(nutritionDays.map((x) => x.fat)),
        daysLogged,
        consistencyScore: Math.round((daysLogged / 7) * 100),
      }
    : null;

  const workoutAnalysis = await fetchWorkoutAnalysis(userId, startMs);
  const sleepAnalysis = await fetchSleepAnalysis(userId);

  return { nutritionAnalysis, workoutAnalysis, sleepAnalysis };
}
