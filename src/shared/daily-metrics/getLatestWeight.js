/**
 * latest Logged Weight
 *
 * Purpose: Data/service layer: latest Logged Weight. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: fetchLatestLoggedWeight
 *
 * @file-header
 */
/**
 * Resolves the client's most recent logged weight from dailyLogs (dashboard_weight).
 * Used for trainer progress "Current" when today has no weight entry — not profile weight.
 */

import { collection, doc, getDoc, getDocs, query, orderBy, limit, documentId } from 'firebase/firestore';
import { db } from '../../app/config';

const QUERY_LIMIT = 120;
const SCAN_DAYS = 120;
const TZ = 'America/New_York';

function parseDashboardWeight(data) {
  const v = data?.dashboard_weight;
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function dateKeyDaysAgo(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

async function fetchLatestLoggedWeightByScan(userId) {
  for (let i = 0; i < SCAN_DAYS; i++) {
    const snap = await getDoc(doc(db, 'users', userId, 'dailyLogs', dateKeyDaysAgo(i)));
    if (!snap.exists()) continue;
    const n = parseDashboardWeight(snap.data());
    if (n != null) return n;
  }
  return null;
}

/** Latest finite `dashboard_weight` from dailyLogs, newest day first; null if never logged. */
export async function fetchLatestLoggedWeight(userId) {
  if (!userId || !db) return null;
  try {
    const colRef = collection(db, 'users', userId, 'dailyLogs');
    const q = query(colRef, orderBy(documentId(), 'desc'), limit(QUERY_LIMIT));
    const snap = await getDocs(q);
    for (const docSnap of snap.docs) {
      const n = parseDashboardWeight(docSnap.data());
      if (n != null) return n;
    }
    return null;
  } catch (_) {
    return fetchLatestLoggedWeightByScan(userId);
  }
}
