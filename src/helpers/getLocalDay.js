// Device-timezone "today" helpers. Every daily reset in the app starts here.
// Flow: stamp today as YYYY-MM-DD → say how long until the next local midnight.
// Used by: nutrition logs and the midnight archive. Weekly trainer jobs use dateStrings.js instead.
// Read order: constants → helpers → numbered mains.

// ===== NAMED CONSTANTS =====

// vocab: en-CA prints dates as YYYY-MM-DD, which is the Firestore document id shape.
const LOCAL_DATE_LOCALE = 'en-CA';
// Manipulate here: hour 24 rolls to midnight of the next day, including month and DST edges.
const NEXT_MIDNIGHT_HOUR = 24;
const NEXT_MIDNIGHT_MINUTE = 0;
const NEXT_MIDNIGHT_SECOND = 0;
const NEXT_MIDNIGHT_MS = 0;

// ===== HELPER FUNCTIONS =====

/**
 * Copy the date so setHours does not change the caller's object, then pin to next local midnight.
 * @param {Date} now
 * @returns {Date}
 */
function copyDatePinnedToNextLocalMidnight(now) {
  const nextMidnight = new Date(now);
  // vocab: setHours(24, 0, 0, 0) = jump to midnight of the following local calendar day
  nextMidnight.setHours(
    NEXT_MIDNIGHT_HOUR,
    NEXT_MIDNIGHT_MINUTE,
    NEXT_MIDNIGHT_SECOND,
    NEXT_MIDNIGHT_MS,
  );
  return nextMidnight;
}

/**
 * Milliseconds from now until a target Date. Never negative.
 * @param {Date} targetDate
 * @param {Date} now
 * @returns {number}
 */
function nonNegativeMillisecondsUntil(targetDate, now) {
  // Never negative, so a clock shift cannot spin a timer backward.
  const rawGap = targetDate.getTime() - now.getTime();
  return Math.max(0, rawGap);
}

// ===== MAIN FUNCTION =====

/**
 * @param {Date} [date]
 * @returns {string} YYYY-MM-DD in the device timezone
 */
export function getLocalDateKey(date = new Date()) {
  // 1. Ask the device locale for today's calendar date in YYYY-MM-DD form.
  return date.toLocaleDateString(LOCAL_DATE_LOCALE);
}

/**
 * Milliseconds until the next local midnight.
 * @param {Date} [now]
 * @returns {number}
 */
export function msUntilLocalMidnight(now = new Date()) {
  // 1. Build the instant of the next local midnight (without mutating `now`).
  const nextMidnight = copyDatePinnedToNextLocalMidnight(now);
  // 2. Return nonnegative ms so a clock jump cannot spin a timer backward.
  return nonNegativeMillisecondsUntil(nextMidnight, now);
}

/**
 * @param {Date} [now]
 * @returns {Date}
 */
export function nextLocalMidnight(now = new Date()) {
  // 1. Return a fresh Date object pinned to the next local midnight.
  return copyDatePinnedToNextLocalMidnight(now);
}
