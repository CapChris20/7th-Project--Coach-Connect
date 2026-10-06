// A "today" date key that updates itself at midnight.
// Flow: start from the device clock → check every 30 seconds and again just after midnight → only update state when the day string changes.
// Used by: screens that put this key in a Firestore path. When it changes, their listeners move to the new day's document.

import { useEffect, useState } from 'react';
import { getLocalDateKey, msUntilLocalMidnight } from '../helpers/getLocalDay';

// ===== NAMED CONSTANTS =====

// Manipulate here: how often we notice a clock or timezone change while the app is open.
const DAY_CHECK_INTERVAL_MS = 30000;
// Fires just after midnight so the date key is not still yesterday.
const MIDNIGHT_BUFFER_MS = 1000;

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * Hooks stay in this order: state, then the one effect that owns both timers.
 * @returns {string}
 */
export function todaysDate() {
  const [dateKey, setDateKey] = useState(() => getLocalDateKey());

  useEffect(() => {
    const refreshDateKey = () => {
      const nextDateKey = getLocalDateKey();
      setDateKey((previousDateKey) => (previousDateKey !== nextDateKey ? nextDateKey : previousDateKey));
    };

    refreshDateKey();
    const intervalId = setInterval(refreshDateKey, DAY_CHECK_INTERVAL_MS);

    let midnightTimerId;
    const scheduleMidnightRefresh = () => {
      midnightTimerId = setTimeout(() => {
        refreshDateKey();
        scheduleMidnightRefresh();
      }, msUntilLocalMidnight() + MIDNIGHT_BUFFER_MS);
    };
    scheduleMidnightRefresh();

    return () => {
      clearInterval(intervalId);
      clearTimeout(midnightTimerId);
    };
  }, []);

  return dateKey;
}

export default todaysDate;
