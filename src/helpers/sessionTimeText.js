// Display formatters for booked trainer/client sessions.
// Flow: raw stored values ("2026-03-14", "14:30") → human strings ("Saturday, March 14, 2026", "2:30 PM").
// Used by session cards and meeting rows. These only print. They do not do date math.
// Read order: constants → numbered mains → helper / PLUMBING at the bottom.

// ===== NAMED CONSTANTS =====

const NOON_HOUR = 12;
const HOURS_ON_A_CLOCK = 12;
const DATE_KEY_LENGTH = 10;
// Parsing a bare "YYYY-MM-DD" is UTC midnight, which can shift the day backwards west of UTC.
const DATE_KEY_NOON_SUFFIX = 'T12:00:00';
const AM_LABEL = 'AM';
const PM_LABEL = 'PM';
const ZERO_MINUTE_FALLBACK = '0';
const PAD_WIDTH = 2;
const PAD_CHAR = '0';

// ===== MAIN FUNCTION =====

/**
 * Zero-pad a number to two digits so "2:5 PM" never happens.
 * vocab: padStart(2, '0') = make the string at least 2 characters by adding '0' in front.
 * @param {number} value
 * @returns {string}
 */
export function pad2(value) {
  return String(value).padStart(PAD_WIDTH, PAD_CHAR);
}

/**
 * Turn a stored date key into a long spelled-out date.
 * @param {string|Date} dateKey
 * @returns {string}
 */
export function formatDateLong(dateKey) {
  // 1. Missing key → empty label (card can hide the row).
  if (!dateKey) return '';

  // 2. Parse the stored key into a Date at local noon so the day does not shift in western time zones.
  const parsedDate = dateFromStoredKey(dateKey);

  // 3. Garbage in → show the raw value rather than the literal string "Invalid Date".
  if (dateIsInvalid(parsedDate)) return String(dateKey);

  // 4. Spell it out in the device locale.
  // vocab: toLocaleDateString(undefined, ...) = format using the device's locale.
  // Manipulate here: drop weekday for a shorter label, or use month: 'short' for "Mar 14, 2026".
  return spelledOutLocalDate(parsedDate);
}

/**
 * Convert a stored 24-hour "HH:MM" into a 12-hour clock label.
 * @param {string} hoursAndMinutes
 * @returns {string}
 */
export function formatTime12(hoursAndMinutes) {
  // 1. Missing time → empty label.
  if (!hoursAndMinutes) return '';

  // 2. Split "14:30" into hour and minute text; a bare "14" means minute zero.
  const hourAndMinuteParts = String(hoursAndMinutes).split(':');
  const hourText = hourAndMinuteParts[0];
  const minuteText = hourAndMinuteParts[1] || ZERO_MINUTE_FALLBACK;
  const hour24 = parseInt(hourText, 10);
  const minute = parseInt(minuteText, 10);

  // 3. Unparseable → return what we got so support can see the bad write.
  const hourIsBad = Number.isNaN(hour24);
  const minuteIsBad = Number.isNaN(minute);
  if (hourIsBad || minuteIsBad) return String(hoursAndMinutes);

  // 4. Map onto a 12-hour clock and glue the label.
  const hour12 = hourOn12HourClock(hour24);
  const amOrPm = dayHalfLabel(hour24);
  const minuteTextPadded = pad2(minute);
  return `${hour12}:${minuteTextPadded} ${amOrPm}`;
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function dateFromStoredKey(dateKey) {
  if (dateKey instanceof Date) return dateKey;
  const dateOnly = String(dateKey).slice(0, DATE_KEY_LENGTH);
  return new Date(dateOnly + DATE_KEY_NOON_SUFFIX);
}

function hourOn12HourClock(hour24) {
  // Midnight (0) and noon (12) must both print as 12, not 0.
  return ((hour24 + HOURS_ON_A_CLOCK - 1) % HOURS_ON_A_CLOCK) + 1;
}

function dayHalfLabel(hour24) {
  if (hour24 >= NOON_HOUR) return PM_LABEL;
  return AM_LABEL;
}

function dateIsInvalid(parsedDate) {
  return Number.isNaN(parsedDate.getTime());
}

function spelledOutLocalDate(parsedDate) {
  return parsedDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
