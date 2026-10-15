// Builds the YYYY-MM-DD strings used as Firestore document ids for a day.
// Flow: pick whose clock matters → format that day → that string is the document id.
// Used by: the client dashboard (device clock), trainer weekly jobs (Eastern), and reminders (the profile timezone).

import { getLocalDateKey } from './getLocalDay';

// ===== NAMED CONSTANTS =====

// Manipulate here: trainer and server jobs share this boundary. Changing it moves cross-midnight writes.
const DEFAULT_TIME_ZONE = 'America/New_York';
// vocab: en-CA prints dates as YYYY-MM-DD.
const DATE_KEY_LOCALE = 'en-CA';

// ===== HELPER FUNCTIONS =====

/**
 * @param {object|undefined} profile
 * @returns {string}
 */
function readProfileTimeZone(profile) {
  const fromTimezone = profile?.timezone;
  const fromTimeZone = profile?.timeZone;
  const fromReminder = profile?.workoutReminder?.timeZone;
  return String(fromTimezone || fromTimeZone || fromReminder || '').trim();
}

function formatDateKeyInTimeZone(date, timeZone) {
  return new Date(date).toLocaleDateString(DATE_KEY_LOCALE, { timeZone });
}

function tryProfileDateKey(date, profileTimeZone) {
  try {
    return formatDateKeyInTimeZone(date, profileTimeZone);
  } catch {
    // An unrecognized timezone throws. Fall back so a bad profile cannot break the caller.
    return getLocalDateKey(date);
  }
}

// ===== MAIN FUNCTION =====

/**
 * Client-facing today, in the device timezone.
 * @param {Date} [date]
 * @returns {string}
 */
export function getClientDateKey(date = new Date()) {
  return getLocalDateKey(date);
}

/**
 * Trainer and weekly-summary day, in Eastern time unless a timezone is passed.
 * @param {string} [timeZone]
 * @returns {string}
 */
export function getDateKey(timeZone = DEFAULT_TIME_ZONE) {
  return formatDateKeyInTimeZone(new Date(), timeZone);
}

/**
 * Today for a profile. Uses the stored timezone, then the device clock if that string is invalid.
 * @param {object} [profile]
 * @param {Date} [date]
 * @returns {string}
 */
export function getProfileDateKey(profile, date = new Date()) {
  const profileTimeZone = readProfileTimeZone(profile);
  if (!profileTimeZone) return getLocalDateKey(date);
  return tryProfileDateKey(date, profileTimeZone);
}

export default getDateKey;
