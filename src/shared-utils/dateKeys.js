/**
 * dateKeys
 *
 * Purpose: Date key utilities for Firestore daily documents.
 * Why it matters: Single source of truth for date-keyed collection paths across the app.
 * Area: src/shared/utils
 * Key exports: getClientDateKey, getDateKey
 *
 * - **getClientDateKey** — device local midnight (client home, dashboard, AI tools).
 * - **getDateKey** — America/New_York (trainer weekly jobs / legacy server defaults).
 *
 * @file-header
 */
import { getLocalDateKey } from './getLocalDay';

const DEFAULT_TZ = 'America/New_York';

/** Client-facing "today" (device timezone). Prefer this for dailyLogs / daily_tracking. */
export function getClientDateKey(d = new Date()) {
  return getLocalDateKey(d);
}

/**
 * Trainer / weekly-summary boundary (Eastern Time).
 * @param {string} [timeZone] IANA timezone
 */
export function getDateKey(timeZone = DEFAULT_TZ) {
  return new Date().toLocaleDateString('en-CA', { timeZone });
}

/**
 * "Today" for a user profile — prefers stored IANA timezone, else device local.
 * @param {object} [profile]
 * @param {Date} [d]
 */
export function getProfileDateKey(profile, d = new Date()) {
  const tz = String(
    profile?.timezone || profile?.timeZone || profile?.workoutReminder?.timeZone || '',
  ).trim();
  if (tz) {
    try {
      return new Date(d).toLocaleDateString('en-CA', { timeZone: tz });
    } catch (_) {
      /* invalid tz — fall through */
    }
  }
  return getLocalDateKey(d);
}

export default getDateKey;
