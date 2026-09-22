// React hook giving screens a "today" date key that updates itself at midnight.
// Flow: seed from the device clock → re-check every 30s AND on a timer aimed at local
//       midnight → only change state when the string actually differs.
// Screens use the returned key in Firestore paths, so when it changes their listeners
// automatically re-bind to the new day's doc without a manual refresh.

import { useEffect, useState } from 'react';
import { getLocalDateKey, msUntilLocalMidnight } from '../../helpers/getLocalDay';

export function useLocalTodayDateKey() {
  // vocab: useState(() => ...) = lazy initializer — runs the function once on mount
  //        instead of recomputing the date on every render
  const [dateKey, setDateKey] = useState(() => getLocalDateKey());

  // Empty dependency array → this effect sets up its timers once for the component's life.
  useEffect(() => {
    // The critical detail: return `prev` unchanged when the day hasn't rolled over.
    // React skips the re-render when state is identical, so this can fire every 30
    // seconds without causing a single wasted render or listener re-subscribe.
    const refresh = () => {
      const next = getLocalDateKey();
      setDateKey((prev) => (prev !== next ? next : prev));
    };

    // Run immediately: the app may have been backgrounded across midnight, in which case
    // the seeded value is already stale.
    refresh();
    // Belt-and-braces poll. Catches manual clock changes, timezone changes while
    // travelling, and timers that didn't fire while the app was suspended.
    // Manipulate here: 30_000 = 30s. (Underscores are just readable digit separators.)
    const interval = setInterval(refresh, 30_000);

    // Precise midnight timer. Self-rescheduling rather than a fixed 24h interval, so it
    // stays accurate across DST shifts and long sleeps.
    let midnightTimer;
    const scheduleMidnight = () => {
      midnightTimer = setTimeout(() => {
        refresh();
        scheduleMidnight();  // queue tomorrow's — this is the loop
      // The +1000 buffer fires just AFTER midnight. Landing exactly on the boundary
      // risks getLocalDateKey() still returning yesterday due to timer imprecision.
      }, msUntilLocalMidnight() + 1000);
    };
    scheduleMidnight();

    // Tear down both timers on unmount, or they'd keep calling setState on a dead component.
    return () => {
      clearInterval(interval);
      clearTimeout(midnightTimer);
    };
  }, []);

  return dateKey;
}

export default useLocalTodayDateKey;
