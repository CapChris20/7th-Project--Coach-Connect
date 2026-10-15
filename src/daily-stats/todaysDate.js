// A today date key that updates itself at local midnight.
// Flow: start from the device clock → check on an interval and again just after midnight → update state only when the day string changes.
// Used by screens that put this key in a Firestore path so listeners move to the new day's document.

import { useEffect, useState } from 'react';
import { getLocalDateKey, msUntilLocalMidnight } from '../helpers/getLocalDay';

// ===== NAMED CONSTANTS =====

// Manipulate here: how often we notice a clock or timezone change while the app is open.
const DAY_CHECK_INTERVAL_MS = 30000;
const MIDNIGHT_BUFFER_MS = 1000;

// ===== HELPER FUNCTIONS =====

function refreshDateKey(setDateKey) {
  const nextDateKey = getLocalDateKey();
  setDateKey((previousDateKey) => {
    if (previousDateKey !== nextDateKey) return nextDateKey;
    return previousDateKey;
  });
}

function watchForLocalMidnight(setDateKey) {
  const refresh = () => refreshDateKey(setDateKey);
  refresh();
  const intervalId = setInterval(refresh, DAY_CHECK_INTERVAL_MS);

  let midnightTimerId;
  const scheduleMidnightRefresh = () => {
    const waitMs = msUntilLocalMidnight() + MIDNIGHT_BUFFER_MS;
    midnightTimerId = setTimeout(() => {
      refresh();
      scheduleMidnightRefresh();
    }, waitMs);
  };
  scheduleMidnightRefresh();

  return () => {
    clearInterval(intervalId);
    clearTimeout(midnightTimerId);
  };
}

// ===== MAIN FUNCTION =====

/**
 * Today's local date key. Re-renders when the calendar day changes.
 * @returns {string}
 */
export function todaysDate() {
  const [dateKey, setDateKey] = useState(() => getLocalDateKey());

  useEffect(() => {
    return watchForLocalMidnight(setDateKey);
  }, []);

  return dateKey;
}

export default todaysDate;
