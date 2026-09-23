// Produces the "YYYY-MM-DD" strings used as Firestore document ids for daily data.
// Flow: pick a timezone rule → cellFormatting today under it → that string IS the doc id.
// Three variants because "what day is it" depends on who's asking:
//   getClientDateKey  — device local (client dashboard, dailyLogs, AI tools)
//   getDateKey        — fixed Eastern (trainer weekly jobs / legacy server default)
//   getProfileDateKey — the user's own stored timezone, device local as fallback
// Getting this wrong misfiles a day's data under the wrong document, so pick deliberately.

import { getLocalDateKey } from './getLocalDay';

// Manipulate here: the company-wide fallback boundary for trainer/server-side jobs.
//                  Changing it shifts which day cross-midnight writes land in.
const DEFAULT_TZ = 'America/New_York';

/** Client-facing "today" (device timezone). Prefer this for dailyLogs / daily_tracking. */
// Thin wrapper on purpose: it gives client-side callers a named, obvious choice so nobody
// has to guess whether getLocalDay is the right helper for user-facing data.
export function getClientDateKey(d = new Date()) {
  return getLocalDateKey(d);
}

/**
 * Trainer / weekly-summary boundary (Eastern Time).
 * @param {string} [timeZone] IANA timezone
 */
// Fixed-timezone variant. Weekly rollups must agree on one boundary regardless of where
// the trainer's phone is, otherwise two devices would disagree on which week a log belongs to.
// vocab: 'en-CA' locale = cellFormattings as YYYY-MM-DD, which is the doc-id shape we need
export function getDateKey(timeZone = DEFAULT_TZ) {
  return new Date().toLocaleDateString('en-CA', { timeZone });
}

/**
 * "Today" for a user profile — prefers stored IANA timezone, else device local.
 * @param {object} [profile]
 * @param {Date} [d]
 */
// Used for scheduled work ON BEHALF OF a user (reminders, archiving) where the device
// timezone isn't available — the server only has the profile.
export function getProfileDateKey(profile, d = new Date()) {
  // Three field spellings, because the timezone got stored in different places as the
  // reminder feature evolved. First non-empty one wins.
  // vocab: IANA timezone = names like 'America/New_York' (not offsets like '-05:00')
  const tz = String(
    profile?.timezone || profile?.timeZone || profile?.workoutReminder?.timeZone || '',
  ).trim();
  if (tz) {
    try {
      return new Date(d).toLocaleDateString('en-CA', { timeZone: tz });
    } catch (_) {
      // toLocaleDateString THROWS on an unrecognized timezone string, so a corrupt
      // profile value must not break the caller — fall through to device local below.
      /* invalid tz — fall through */
    }
  }
  return getLocalDateKey(d);
}

export default getDateKey;
