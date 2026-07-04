/**
 * sessions
 *
 * Purpose: sessions — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/lib
 * Key exports: pad2, formatDateLong, formatTime12
 *
 * @file-header
 */
export const pad2 = (n) => String(n).padStart(2, '0');

export const formatDateLong = (dateKey) => {
  if (!dateKey) return '';
  const d = dateKey instanceof Date ? dateKey : new Date(String(dateKey).slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return String(dateKey);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatTime12 = (hhmm) => {
  if (!hhmm) return '';
  const [hStr, mStr] = String(hhmm).split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return String(hhmm);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${pad2(m)} ${ampm}`;
};

