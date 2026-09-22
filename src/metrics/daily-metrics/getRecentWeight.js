// Finds the client's most recently LOGGED weight (not their profile weight).
// Flow: list dailyLogs newest-day-first → return the first doc with a usable
//       `dashboard_weight` → if the collection query is blocked, fall back to reading
//       individual day docs one at a time.
// Used by the trainer progress view's "Current" figure, where a stale profile number would mislead.

import { collection, doc, getDoc, getDocs, query, orderBy, limit, documentId } from 'firebase/firestore';
import { db } from '../../app-start/config';

// Manipulate here: how far back to look. Both are ~4 months; raising them costs more
// reads, lowering them means long-inactive clients show no current weight at all.
const QUERY_LIMIT = 120;  // docs pulled in the fast path
const SCAN_DAYS = 120;    // individual days probed in the fallback
// The fallback has to RECONSTRUCT date-key strings, so it must use the same timezone the
// keys were written under. Eastern matches the trainer-side dateKeys default.
const TZ = 'America/New_York';

// Pulls a valid number out of a day doc, or null. Weight has been stored as both a string
// and a number over time, hence the Number() coercion before the finite check.
function parseDashboardWeight(data) {
  const v = data?.dashboard_weight;
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Rebuilds the "YYYY-MM-DD" doc id for N days back.
// vocab: setDate(getDate() - n) = subtract days; JS rolls month/year back automatically
function dateKeyDaysAgo(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

// Fallback path: up to SCAN_DAYS single-doc reads, walking backwards from today.
// Slow and chatty, but it works when Firestore rules allow reading a specific day doc
// while denying a list/query of the whole collection — exactly the trainer-reading-a-client case.
async function fetchLatestLoggedWeightByScan(userId) {
  for (let i = 0; i < SCAN_DAYS; i++) {
    const snap = await getDoc(doc(db, 'users', userId, 'dailyLogs', dateKeyDaysAgo(i)));
    if (!snap.exists()) continue;
    const n = parseDashboardWeight(snap.data());
    // Return on the FIRST hit — the loop runs newest-first, so this is the latest weight.
    if (n != null) return n;
  }
  return null;
}

/** Latest finite `dashboard_weight` from dailyLogs, newest day first; null if never logged. */
export async function fetchLatestLoggedWeight(userId) {
  if (!userId || !db) return null;
  try {
    // Fast path: one query for the most recent days.
    // vocab: documentId() = order by the doc's own id. Works here because ids are
    //        "YYYY-MM-DD", so descending string order IS reverse chronological order —
    //        no timestamp field or extra index required.
    const colRef = collection(db, 'users', userId, 'dailyLogs');
    const q = query(colRef, orderBy(documentId(), 'desc'), limit(QUERY_LIMIT));
    const snap = await getDocs(q);
    // Docs come back newest-first, and many days have no weight entry, so scan until
    // the first parseable value.
    for (const docSnap of snap.docs) {
      const n = parseDashboardWeight(docSnap.data());
      if (n != null) return n;
    }
    return null;
  } catch (_) {
    // Query failed (almost always a rules restriction on listing) — retry the slow way.
    return fetchLatestLoggedWeightByScan(userId);
  }
}
