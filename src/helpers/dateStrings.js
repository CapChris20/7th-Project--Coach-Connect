// Builds the YYYY-MM-DD strings used as Firestore document ids for a day.
// Flow: pick whose clock matters → format that day → that string is the document id.
// Used by: the client dashboard (device clock), trainer weekly jobs (Eastern), and reminders (the profile timezone).
// Read order: constants → helpers → numbered mains. Letters of timezone / locale stay frozen.

import { getLocalDateKey } from './getLocalDay';

// ===== NAMED CONSTANTS =====

// Manipulate here: trainer and server jobs share this boundary. Changing it moves cross-midnight writes.
const DEFAULT_TIME_ZONE = 'America/New_York';
// vocab: en-CA prints dates as YYYY-MM-DD — that shape is the Firestore day document id.
const DATE_KEY_LOCALE = 'en-CA';

// ===== HELPER FUNCTIONS =====

/**
 * Pull the first non-empty timezone string off a profile (three spellings exist in the wild).
 * @param {object|undefined} profile
 * @returns {string}
 */
function readTimeZoneFromProfile(profile) {
  // vocab/symbol: ?. = stop and yield undefined if the left side is null/undefined
  const fromTimezone = profile?.timezone;
  const fromTimeZone = profile?.timeZone;
  const fromReminder = profile?.workoutReminder?.timeZone;
  // vocab/symbol: || = first truthy value (empty string falls through on purpose)
  return String(fromTimezone || fromTimeZone || fromReminder || '').trim();
}

/**
 * Print a Date as YYYY-MM-DD in a named IANA timezone.
 * @param {Date|string|number} date
 * @param {string} timeZone
 * @returns {string}
 */
function printDateKeyInTimeZone(date, timeZone) {
  return new Date(date).toLocaleDateString(DATE_KEY_LOCALE, { timeZone });
}

/**
 * Honor the profile timezone; if Intl rejects the string, fall back to the device day key.
 * @param {Date} date
 * @param {string} profileTimeZone
 * @returns {string}
 */
function printDateKeyOrFallBackToDevice(date, profileTimeZone) {
  try {
    return printDateKeyInTimeZone(date, profileTimeZone);
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
  // 1. Hand off to the device-local helper — clients always use the phone clock.
  return getLocalDateKey(date);
}

/**
 * Trainer and weekly-summary day, in Eastern time unless a timezone is passed.
 * @param {string} [timeZone]
 * @returns {string}
 */
export function getDateKey(timeZone = DEFAULT_TIME_ZONE) {
  // 1. Stamp "right now" in the chosen zone (default Eastern for trainer/server jobs).
  const rightNow = new Date();
  return printDateKeyInTimeZone(rightNow, timeZone);
}

/**
 * Today for a profile. Uses the stored timezone, then the device clock if that string is invalid.
 * @param {object} [profile]
 * @param {Date} [date]
 * @returns {string}
 */
export function getProfileDateKey(profile, date = new Date()) {
  // 1. Pull the first non-empty timezone string we find on the profile.
  const profileTimeZone = readTimeZoneFromProfile(profile);

  // 2. No timezone on file → same as the client device day key.
  if (!profileTimeZone) return getLocalDateKey(date);

  // 3. Honor profile timezone, but fall back on device if the string is unknown to Intl.
  return printDateKeyOrFallBackToDevice(date, profileTimeZone);
}

export default getDateKey;
