/**
 * Parse natural-language session booking into date (YYYY-MM-DD) + time (HH:mm).
 */

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateKey(d) {
  return d.toLocaleDateString('en-CA');
}

function parseTimeFromText(text) {
  const lower = String(text || '').toLowerCase();
  const m = lower.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (!m) return '10:00';
  let h = Number(m[1]);
  const mins = m[2] != null ? m[2] : '00';
  const ap = m[3];
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (!ap && h >= 1 && h <= 7) h += 12;
  return `${pad2(h)}:${pad2(Number(mins) || 0)}`;
}

function parseDateFromText(text, now = new Date()) {
  const raw = String(text || '');
  const lower = raw.toLowerCase();

  const iso = raw.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  if (/\btoday\b/.test(lower)) return toDateKey(now);
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return toDateKey(d);
  }

  const wantsNext = /\bnext\b/.test(lower);
  for (let i = 0; i < WEEKDAYS.length; i += 1) {
    if (!lower.includes(WEEKDAYS[i])) continue;
    const d = new Date(now);
    const current = d.getDay();
    let delta = i - current;
    if (wantsNext) {
      if (delta <= 0) delta += 7;
    } else if (delta < 0) {
      delta += 7;
    }
    d.setDate(d.getDate() + delta);
    return toDateKey(d);
  }

  return null;
}

function parseBookSessionFields(params = {}) {
  const p = params && typeof params === 'object' ? params : {};
  let date = p.sessionDate || p.date || null;
  let time = p.sessionTime || p.time || null;
  const durationMin = Number(p.durationMin ?? p.durationMinutes ?? p.duration ?? 60) || 60;

  const dateTimeRaw = p.dateTime != null ? String(p.dateTime) : '';
  if ((!date || !time) && dateTimeRaw) {
    if (/^\d{4}-\d{2}-\d{2}T/.test(dateTimeRaw)) {
      date = dateTimeRaw.slice(0, 10);
      time = dateTimeRaw.slice(11, 16);
    } else {
      date = date || parseDateFromText(dateTimeRaw);
      time = time || parseTimeFromText(dateTimeRaw);
    }
  }

  if (!date) date = parseDateFromText(dateTimeRaw);
  if (!time) time = parseTimeFromText(dateTimeRaw);

  if (date && typeof date === 'string') date = date.slice(0, 10);
  if (time && typeof time === 'string') time = time.slice(0, 5);

  return { date, time, durationMin };
}

function formatSessionLabel({ date, time }) {
  if (!date) return 'your requested time';
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const dayLabel = dt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  if (!time) return dayLabel;
  const [hh, mm] = time.split(':').map(Number);
  const t = new Date(2000, 0, 1, hh || 0, mm || 0);
  const timeLabel = t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${dayLabel} at ${timeLabel}`;
}

module.exports = {
  parseBookSessionFields,
  formatSessionLabel,
};
