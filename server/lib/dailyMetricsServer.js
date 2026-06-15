/**
 * Server-side daily metrics — canonical `dailyLogs`, mirror `daily_tracking`.
 */
const { trackingMirrorFromLogs } = require('../../src/shared/daily-metrics/dailyMetricsParse.cjs');

async function mergeUserDailyMetrics(db, userId, dateKey, { logs = {}, tracking = {} }, serverTs) {
  const ts = serverTs();
  const logsRef = db.collection('users').doc(userId).collection('dailyLogs').doc(dateKey);
  await logsRef.set({ ...logs, updatedAt: ts }, { merge: true });

  const mirror = { ...trackingMirrorFromLogs(logs), ...tracking };
  if (Object.keys(mirror).length > 0) {
    await db
      .collection('users')
      .doc(userId)
      .collection('daily_tracking')
      .doc(dateKey)
      .set({ ...mirror, updatedAt: ts }, { merge: true });
  }
}

module.exports = {
  mergeUserDailyMetrics,
  trackingMirrorFromLogs,
};
