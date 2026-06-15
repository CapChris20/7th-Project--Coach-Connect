/**
 * local Day
 *
 * Purpose: local Day — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: getLocalDateKey, msUntilLocalMidnight, nextLocalMidnight
 *
 * @file-header
 */
/**
 * Local-day helpers (device timezone).
 * Used for dashboards that reset at the user's local midnight.
 */

/** @returns {string} YYYY-MM-DD in the device's local timezone */
export function getLocalDateKey(d = new Date()) {
  return d.toLocaleDateString('en-CA'); // en-CA formats as YYYY-MM-DD
}

/** @returns {number} milliseconds until next local midnight */
export function msUntilLocalMidnight(now = new Date()) {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, next.getTime() - now.getTime());
}

/** @returns {Date} next local midnight Date */
export function nextLocalMidnight(now = new Date()) {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next;
}

