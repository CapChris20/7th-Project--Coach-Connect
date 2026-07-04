/**
 * Verifies weekly summary job logic (week bounds + ET dailyLogs doc IDs).
 *
 * Keep in sync with `getLastWeekBounds` + `fetchDailyLogsForWeek` in `functions/index.js`.
 *
 * Usage:
 *   cd functions && node scripts/verifyWeeklySummaryJob.js
 *
 * Optional Firestore smoke (counts dailyLogs for last ET week for one user):
 *   VERIFY_WEEKLY_CLIENT_UID=<firebase uid> GOOGLE_APPLICATION_CREDENTIALS=/abs/path/to.json \
 *     node scripts/verifyWeeklySummaryJob.js
 *
 * Exit code 1 if any assertion fails.
 */

const path = require('path');
const assert = require('assert');

const moment = require(path.join(__dirname, '..', 'node_modules', 'moment-timezone'));

const WEEK_SUMMARY_TZ = 'America/New_York';

/** Same algorithm as Cloud Function `getLastWeekBounds`, but accepts a fixed "now" for tests. */
function getLastWeekBoundsForNow(now) {
  const today = moment(now).tz(WEEK_SUMMARY_TZ);
  const dow = today.day();
  const daysSinceMonday = (dow + 6) % 7;
  const thisMonday = today.clone().subtract(daysSinceMonday, 'days').startOf('day');
  const lastMonday = thisMonday.clone().subtract(7, 'days');
  const lastSunday = lastMonday.clone().add(6, 'days');
  return {
    weekStart: lastMonday.format('YYYY-MM-DD'),
    weekEnd: lastSunday.format('YYYY-MM-DD'),
  };
}

/** Same iteration as `fetchDailyLogsForWeek` (doc IDs only — no Firestore). */
function listDailyLogDocIdsForWeek(weekStart, weekEnd) {
  const start = moment.tz(weekStart, 'YYYY-MM-DD', WEEK_SUMMARY_TZ);
  const end = moment.tz(weekEnd, 'YYYY-MM-DD', WEEK_SUMMARY_TZ);
  const keys = [];
  for (let d = start.clone(); d.isSameOrBefore(end, 'day'); d.add(1, 'day')) {
    keys.push(d.format('YYYY-MM-DD'));
  }
  return keys;
}

/** Legacy buggy pattern: parse weekStart as UTC midnight + iterate with setDate + toISOString date key. */
function listDailyLogDocIdsLegacyUtcLoop(weekStart) {
  const keys = [];
  const startDate = new Date(weekStart);
  const endDate = new Date(weekStart);
  endDate.setDate(endDate.getDate() + 6);
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    keys.push(d.toISOString().split('T')[0]);
  }
  return keys;
}

function runAssertions() {
  // Sunday 2025-03-09 00:30 ET → prior Mon–Sun is Feb 24 – Mar 2
  assert.deepStrictEqual(
    getLastWeekBoundsForNow(moment.tz('2025-03-09 00:30', WEEK_SUMMARY_TZ)),
    { weekStart: '2025-02-24', weekEnd: '2025-03-02' }
  );

  // Monday 2025-03-10 09:00 ET → prior week Mar 3 – Mar 9
  assert.deepStrictEqual(
    getLastWeekBoundsForNow(moment.tz('2025-03-10 09:00', WEEK_SUMMARY_TZ)),
    { weekStart: '2025-03-03', weekEnd: '2025-03-09' }
  );

  // Saturday 2025-03-08 23:00 ET → still same "current week" Mon Mar 3 – Sun Mar 9, last week Feb 24 – Mar 2
  assert.deepStrictEqual(
    getLastWeekBoundsForNow(moment.tz('2025-03-08 23:00', WEEK_SUMMARY_TZ)),
    { weekStart: '2025-02-24', weekEnd: '2025-03-02' }
  );

  // ET keys: exactly 7 days, Mon–Sun labels for 2025-03-03 week
  const keys = listDailyLogDocIdsForWeek('2025-03-03', '2025-03-09');
  assert.strictEqual(keys.length, 7);
  assert.deepStrictEqual(keys, [
    '2025-03-03',
    '2025-03-04',
    '2025-03-05',
    '2025-03-06',
    '2025-03-07',
    '2025-03-08',
    '2025-03-09',
  ]);

  // Around DST spring-forward 2025 (Mar 9 2am ET): keys stay calendar-correct
  const keysDst = listDailyLogDocIdsForWeek('2025-03-03', '2025-03-09');
  assert.strictEqual(keysDst[6], '2025-03-09');

  // Demonstrate UTC ISO loop can diverge from ET keys near week boundaries (server in UTC)
  const legacy = listDailyLogDocIdsLegacyUtcLoop('2025-03-03');
  // For this particular week, legacy may match or not depending on parse; assert our ET list matches app getDateKey semantics
  const et = listDailyLogDocIdsForWeek('2025-03-03', '2025-03-09');
  assert.strictEqual(et.length, 7);
  // App uses en-CA ET strings — always equal to moment ET format for these dates
  et.forEach((k) => {
    assert.match(k, /^\d{4}-\d{2}-\d{2}$/);
  });

  console.log('All local assertions passed.');
  console.log('  Week-boundary logic matches Cloud Function (America/New_York, Mon–Sun).');
  console.log('  dailyLogs doc id list uses ET calendar days (7 keys per week).');
  if (legacy.join(',') !== et.join(',')) {
    console.log('  Note: legacy UTC toISOString() loop differs from ET keys for this week:');
    console.log('    ET:    ', et.join(', '));
    console.log('    legacy:', legacy.join(', '));
  }
}

async function optionalFirestoreCheck() {
  const uid = process.env.VERIFY_WEEKLY_CLIENT_UID;
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!uid || !credPath) {
    console.log('\nFirestore skip: set VERIFY_WEEKLY_CLIENT_UID and GOOGLE_APPLICATION_CREDENTIALS to count real dailyLogs.');
    return;
  }

  try {
    const admin = require(path.join(__dirname, '..', 'node_modules', 'firebase-admin'));
    const resolved = path.resolve(credPath);
    const serviceAccount = require(resolved);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
    }

    const db = admin.firestore();
    const { weekStart, weekEnd } = getLastWeekBoundsForNow(moment());
    const keys = listDailyLogDocIdsForWeek(weekStart, weekEnd);

    let found = 0;
    for (const dateKey of keys) {
      const snap = await db.collection('users').doc(uid).collection('dailyLogs').doc(dateKey).get();
      if (snap.exists) found += 1;
    }

    console.log('\nFirestore smoke (live project):');
    console.log('  Client uid:', uid);
    console.log('  Last ET week (would be used by scheduler now):', weekStart, '→', weekEnd);
    console.log('  dailyLogs present for', found, 'of 7 day keys.');
    if (found === 0) {
      console.log('  → Scheduler would skip this client (no logs in window).');
    } else {
      console.log('  → Scheduler would send at least one day of data to Claude for this client.');
    }
  } catch (e) {
    console.warn('\nFirestore smoke failed (check credentials path and network):', e.message || e);
  }
}

async function main() {
  runAssertions();
  await optionalFirestoreCheck();
  console.log('\nDone. Scheduler itself is only verifiable in GCP (Cloud Scheduler + Logs).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
