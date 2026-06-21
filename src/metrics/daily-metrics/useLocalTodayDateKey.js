/**
 * use Local Today Date Key
 *
 * Purpose: React hook: use Local Today Date Key. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: useLocalTodayDateKey
 *
 * @file-header
 */
import { useEffect, useState } from 'react';
import { getLocalDateKey, msUntilLocalMidnight } from '../../shared-utils/getLocalDay';

/**
 * YYYY-MM-DD for "today" in the device timezone. Updates at local midnight
 * (and every 30s) so Firestore listeners re-bind to the new daily doc.
 */
export function useLocalTodayDateKey() {
  const [dateKey, setDateKey] = useState(() => getLocalDateKey());

  useEffect(() => {
    const refresh = () => {
      const next = getLocalDateKey();
      setDateKey((prev) => (prev !== next ? next : prev));
    };

    refresh();
    const interval = setInterval(refresh, 30_000);

    let midnightTimer;
    const scheduleMidnight = () => {
      midnightTimer = setTimeout(() => {
        refresh();
        scheduleMidnight();
      }, msUntilLocalMidnight() + 1000);
    };
    scheduleMidnight();

    return () => {
      clearInterval(interval);
      clearTimeout(midnightTimer);
    };
  }, []);

  return dateKey;
}

export default useLocalTodayDateKey;
