// Display formatters for booked trainer/client sessions.
// Flow: raw stored values ("2026-03-14", "14:30") → human strings ("Saturday, March 14, 2026", "2:30 PM").
// Used by session cards and meeting rows. These only print. They do not do date math.

// ===== NAMED CONSTANTS =====

const NOON_HOUR = 12;
const HOURS_ON_A_CLOCK = 12;
const DATE_KEY_LENGTH = 10;
// Parsing a bare "YYYY-MM-DD" is UTC midnight, which can shift the day backwards west of UTC.
const DATE_KEY_NOON_SUFFIX = 'T12:00:00';

// ===== HELPER FUNCTIONS =====

/**
 * Zero-pad a number to two digits so "2:5 PM" never happens.
 * vocab: padStart(2, '0') = make the string at least 2 characters by adding '0' in front.
 * @param {number} value
 * @returns {string}
 */
export const pad2 = (value) => String(value).padStart(2, '0');

function dateFromStoredKey(dateKey) {
  if (dateKey instanceof Date) return dateKey;
  const dateOnly = String(dateKey).slice(0, DATE_KEY_LENGTH);
  return new Date(dateOnly + DATE_KEY_NOON_SUFFIX);
}

function hourOn12HourClock(hour24) {
  // Midnight (0) and noon (12) must both print as 12, not 0.
  return ((hour24 + HOURS_ON_A_CLOCK - 1) % HOURS_ON_A_CLOCK) + 1;
}

// ===== MAIN FUNCTION =====

/**
 * Turn a stored date key into a long spelled-out date.
 * @param {string|Date} dateKey
 * @returns {string}
 */
export const formatDateLong = (dateKey) => {
  if (!dateKey) return '';
  const parsedDate = dateFromStoredKey(dateKey);
  // Garbage in → show the raw value rather than the literal string "Invalid Date".
  if (Number.isNaN(parsedDate.getTime())) return String(dateKey);
  // vocab: toLocaleDateString(undefined, ...) = format using the device's locale.
  // Manipulate here: drop weekday for a shorter label, or use month: 'short' for "Mar 14, 2026".
  return parsedDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Convert a stored 24-hour "HH:MM" into a 12-hour clock label.
 * @param {string} hoursAndMinutes
 * @returns {string}
 */
export const formatTime12 = (hoursAndMinutes) => {
  if (!hoursAndMinutes) return '';
  const [hourText, minuteText] = String(hoursAndMinutes).split(':');
  const hour24 = parseInt(hourText, 10);
  // A value stored as just "14" has no minutes.
  const minute = parseInt(minuteText || '0', 10);
  if (Number.isNaN(hour24) || Number.isNaN(minute)) return String(hoursAndMinutes);
  const dayHalf = hour24 >= NOON_HOUR ? 'PM' : 'AM';
  return `${hourOn12HourClock(hour24)}:${pad2(minute)} ${dayHalf}`;
};
