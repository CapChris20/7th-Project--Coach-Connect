// Device-timezone "today" helpers. Every daily reset in the app starts here.
// Flow: stamp today as YYYY-MM-DD → say how long until the next local midnight.
// Used by: nutrition logs and the midnight archive. Weekly trainer jobs use dateKeys.js instead.

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
 * Copies the date so setHours does not change the caller's object.
 * @param {Date} now
 * @returns {Date}
 */
function dateAtNextLocalMidnight(now) {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(
    NEXT_MIDNIGHT_HOUR,
    NEXT_MIDNIGHT_MINUTE,
    NEXT_MIDNIGHT_SECOND,
    NEXT_MIDNIGHT_MS,
  );
  return nextMidnight;
}

function millisecondsUntil(targetDate, now) {
  // Never negative, so a clock shift cannot spin a timer.
  return Math.max(0, targetDate.getTime() - now.getTime());
}

// ===== MAIN FUNCTION =====

/**
 * @param {Date} [date]
 * @returns {string} YYYY-MM-DD in the device timezone
 */
export function getLocalDateKey(date = new Date()) {
  return date.toLocaleDateString(LOCAL_DATE_LOCALE);
}

/**
 * Milliseconds until the next local midnight.
 * @param {Date} [now]
 * @returns {number}
 */
export function msUntilLocalMidnight(now = new Date()) {
  const nextMidnight = dateAtNextLocalMidnight(now);
  return millisecondsUntil(nextMidnight, now);
}

/**
 * @param {Date} [now]
 * @returns {Date}
 */
export function nextLocalMidnight(now = new Date()) {
  return dateAtNextLocalMidnight(now);
}
