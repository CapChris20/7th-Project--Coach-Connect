import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../app-start/config';

function emptyDayTotals() {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

function addLogToDay(byDay, day, data) {
  if (!day) return;
  if (!byDay[day]) byDay[day] = emptyDayTotals();
  byDay[day].calories += Number(data.calories) || 0;
  byDay[day].protein += Number(data.protein) || 0;
  byDay[day].carbs += Number(data.carbs) || 0;
  byDay[day].fat += Number(data.fat) || 0;
}

function inRange(day, startKey, endKey) {
  if (!day) return false;
  if (startKey && day < startKey) return false;
  if (endKey && day > endKey) return false;
  return true;
}

/**
 * Fetch nutrition totals keyed by YYYY-MM-DD for a client across a date range.
 * @returns {Promise<Record<string, { calories: number, protein: number, carbs: number, fat: number }>>}
 */
export async function fetchNutritionByDayForRange(userId, weekStart, weekEnd) {
  if (!userId || !db || !weekStart) return {};

  const byDay = {};
  const endKey = weekEnd || weekStart;

  const ingest = (docs) => {
    docs.forEach((d) => {
      const data = d.data() || {};
      const day = data.date;
      if (inRange(day, weekStart, endKey)) addLogToDay(byDay, day, data);
    });
  };

  for (const field of ['user_id', 'userId']) {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'nutrition_logs'),
          where(field, '==', userId),
          where('date', '>=', weekStart),
          where('date', '<=', endKey),
        ),
      );
      ingest(snap.docs);
    } catch {
      try {
        const snap = await getDocs(
          query(collection(db, 'nutrition_logs'), where(field, '==', userId)),
        );
        snap.docs.forEach((d) => {
          const data = d.data() || {};
          if (inRange(data.date, weekStart, endKey)) addLogToDay(byDay, data.date, data);
        });
      } catch {
        /* collection may be unavailable */
      }
    }
  }

  try {
    const legacySnap = await getDocs(collection(db, 'users', userId, 'nutritionLogs'));
    legacySnap.docs.forEach((d) => {
      const data = d.data() || {};
      const day = data.date || d.id;
      if (!inRange(day, weekStart, endKey)) return;
      const totals = data.dayTotals || data.totals || data;
      addLogToDay(byDay, day, totals);
    });
  } catch {
    /* legacy path optional */
  }

  return byDay;
}

/** Merge maps from multiple week fetches. */
export function mergeNutritionMaps(...maps) {
  const out = {};
  maps.forEach((m) => {
    Object.entries(m || {}).forEach(([day, totals]) => {
      if (!out[day]) out[day] = emptyDayTotals();
      out[day].calories += totals.calories || 0;
      out[day].protein += totals.protein || 0;
      out[day].carbs += totals.carbs || 0;
      out[day].fat += totals.fat || 0;
    });
  });
  return out;
}
