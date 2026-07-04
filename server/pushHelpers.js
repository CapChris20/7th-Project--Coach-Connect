/**
 * Push copy + small helpers for server-side notifications (CoachConnect).
 */
const fs = require('fs');
const path = require('path');
const { stripNotificationEmoji } = require('./stripNotificationEmoji');

const COPY = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'config', 'pushNotificationCopy.json'), 'utf8')
);

function pickRandom(arr) {
  if (!Array.isArray(arr) || !arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

function sub(str, map) {
  return String(str || '').replace(/\{\{(\w+)\}\}/g, (_, k) =>
    map[k] != null && map[k] !== '' ? String(map[k]) : ''
  );
}

/** Local calendar date YYYY-MM-DD and clock in IANA time zone. */
function localDateTimeInIANA(timeZone, date = new Date()) {
  const tz = timeZone && String(timeZone).trim() ? String(timeZone).trim() : 'UTC';
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = f.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  const y = get('year');
  const mo = get('month');
  const da = get('day');
  const h = parseInt(get('hour'), 10);
  const mi = parseInt(get('minute'), 10);
  return { dateKey: `${y}-${mo}-${da}`, hour: Number.isFinite(h) ? h : 0, minute: Number.isFinite(mi) ? mi : 0 };
}

/** True if today's dashboard already has workout log data (dailyLogs doc). */
function hasDashboardWorkoutLog(docData) {
  if (!docData || typeof docData !== 'object') return false;
  if (String(docData.dashboard_workout_name || '').trim()) return true;
  if (String(docData.dashboard_workouts || '').trim()) return true;
  const wl = docData.workoutLog;
  if (!Array.isArray(wl) || !wl.length) return false;
  for (const ex of wl) {
    const n = String(ex.exerciseName || ex.name || '').trim();
    if (n) return true;
    const sets = ex.sets;
    if (!Array.isArray(sets)) continue;
    for (const s of sets) {
      const r = s?.reps;
      const w = s?.weight;
      if (r != null && r !== '' && Number(r) !== 0) return true;
      if (w != null && w !== '' && Number(w) !== 0) return true;
    }
  }
  return false;
}

function minutesDiffClock(h1, m1, h2, m2) {
  const a = h1 * 60 + m1;
  const b = h2 * 60 + m2;
  let d = Math.abs(a - b);
  if (d > 12 * 60) d = 24 * 60 - d;
  return d;
}

module.exports = {
  COPY,
  pickRandom,
  sub,
  localDateTimeInIANA,
  hasDashboardWorkoutLog,
  minutesDiffClock,
  stripNotificationEmoji,
};
