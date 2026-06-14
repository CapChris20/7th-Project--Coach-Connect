/**
 * Date keys for Firestore daily docs.
 *
 * - **getClientDateKey** — device local midnight (client home, dashboard, AI tools).
 * - **getDateKey** — America/New_York (trainer weekly jobs / legacy server defaults).
 */
import { getLocalDateKey } from '../shared/utils/localDay';

const DEFAULT_TZ = 'America/New_York';

/** Client-facing "today" (device timezone). Prefer this for dailyLogs / daily_tracking. */
export function getClientDateKey(d = new Date()) {
  return getLocalDateKey(d);
}

/**
 * Trainer / weekly-summary boundary (Eastern Time).
 * @param {string} [timeZone] IANA timezone
 */
export function getDateKey(timeZone = DEFAULT_TZ) {
  return new Date().toLocaleDateString('en-CA', { timeZone });
}

export default getDateKey;
