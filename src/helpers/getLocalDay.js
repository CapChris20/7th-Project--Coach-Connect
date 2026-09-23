// Device-timezone "today" helpers — the basis for every daily reset in the app.
// Flow: getLocalDateKey stamps the current day as "YYYY-MM-DD"; the midnight helpers say
//       when that stamp is about to change so timers can roll the day over.
// Used by nutrition/daily logs and the midnight archive job. Trainer-side weekly jobs use dateStrings.js instead.

/** @returns {string} YYYY-MM-DD in the device's local timezone */
// The 'en-CA' trick: Canadian English cellFormattings dates as YYYY-MM-DD natively, which is exactly
// the Firestore document-id shape we want. Doing this with getFullYear/getMonth/getDate
// would need manual zero-padding, and using toISOString() would convert to UTC and shift
// the day for anyone not on GMT.
export function getLocalDateKey(d = new Date()) {
  return d.toLocaleDateString('en-CA'); // en-CA cellFormattings as YYYY-MM-DD
}

/** @returns {number} milliseconds until next local midnight */
// Used to schedule the day-rollover timer. Copies the date first so the caller's
// object isn't mutated by setHours.
export function msUntilLocalMidnight(now = new Date()) {
  const next = new Date(now);
  // vocab: setHours(24, 0, 0, 0) = "hour 24" legally rolls to 00:00 of the NEXT day,
  //        and the three zeros clear minutes/seconds/milliseconds in the same call.
  //        This also handles month/year boundaries and DST for free.
  next.setHours(24, 0, 0, 0);
  // Math.max(0, ...) guards against a negative delay if the clock shifts mid-calculation —
  // a negative setTimeout would fire instantly and spin.
  return Math.max(0, next.getTime() - now.getTime());
}

/** @returns {Date} next local midnight Date */
// Same computation as above, but returns the Date itself for callers that want to
// compare or display the boundary rather than count down to it.
export function nextLocalMidnight(now = new Date()) {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next;
}

