// Keeps "today" as a local YYYY-MM-DD string that flips itself after midnight.
// Flow: read the device clock → poll while the app stays open → also wake just after local midnight → update React state only when the day string actually changes.
// Used by screens that put this key in a Firestore path so live listeners hop to the new day's document.
// Read order: constants → main hook → PLUMBING watchers at the bottom.

import { useEffect, useState } from 'react';
import { getLocalDateKey, msUntilLocalMidnight } from '../helpers/getLocalDay';

// ===== NAMED CONSTANTS =====

// Manipulate here: how often we notice a manual clock or timezone change while the app is open.
const DAY_CHECK_INTERVAL_MS = 30000;
// Manipulate here: wait this long after local midnight so the OS clock has flipped the calendar day.
const MIDNIGHT_BUFFER_MS = 1000;

// ===== MAIN FUNCTION =====

/**
 * Today's local date key. Re-renders when the calendar day changes.
 * @returns {string}
 */
export function todaysDate() {
  const [dateKey, setDateKey] = useState(() => getLocalDateKey());

  useEffect(() => {
    const stopWatching = beginWatchingForDayChange(setDateKey);
    return stopWatching;
  }, []);

  return dateKey;
}

export default todaysDate;

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless midnight fires too early/late or the day key sticks on the old date.

function pushDateKeyWhenItChanged(setDateKey) {
  const nextDateKey = getLocalDateKey();
  setDateKey((previousDateKey) => {
    if (previousDateKey === nextDateKey) return previousDateKey;
    return nextDateKey;
  });
}

function millisecondsUntilJustAfterMidnight() {
  return msUntilLocalMidnight() + MIDNIGHT_BUFFER_MS;
}

function armNextMidnightRefresh(refreshDateKey, midnightTimerBox) {
  const waitMs = millisecondsUntilJustAfterMidnight();
  midnightTimerBox.current = setTimeout(() => {
    refreshDateKey();
    armNextMidnightRefresh(refreshDateKey, midnightTimerBox);
  }, waitMs);
}

function beginWatchingForDayChange(setDateKey) {
  const refreshDateKey = () => pushDateKeyWhenItChanged(setDateKey);

  // 1. Sync once so a stale first paint cannot linger.
  refreshDateKey();

  // 2. Poll on an interval — catches clock edits / timezone flips while the app stays open.
  const intervalId = setInterval(refreshDateKey, DAY_CHECK_INTERVAL_MS);

  // 3. Chain a timeout for just-after-midnight, then re-arm for the next night.
  const midnightTimerBox = { current: undefined };
  armNextMidnightRefresh(refreshDateKey, midnightTimerBox);

  return () => {
    clearInterval(intervalId);
    clearTimeout(midnightTimerBox.current);
  };
}
