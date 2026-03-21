/**
 * Daily log date key — resets every 24 hours at midnight America/New_York.
 * Use for: dailyLogs, daily_tracking, trainer hub "today" view.
 * Data is stored per date and kept for weekly stats collection (no delete).
 */
const DEFAULT_TZ = 'America/New_York';

/**
 * Returns YYYY-MM-DD for "today" in the given timezone.
 * Trainer hub and client check-in forms use this so the "today" form
 * resets at midnight ET; yesterday's data stays under yesterday's key
 * and is used by the weekly summary job.
 * @param {string} [timeZone] IANA timezone (default America/New_York)
 * @returns {string} e.g. "2026-03-03"
 */
export function getDateKey(timeZone = DEFAULT_TZ) {
  return new Date().toLocaleDateString('en-CA', { timeZone });
}

export default getDateKey;
