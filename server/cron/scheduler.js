const { runWithDistributedLock } = require('../lib/distributedLock');

/**
 * Start distributed reminder cron jobs (single instance per lock across Cloud Run replicas).
 * @param {Array<[string, () => Promise<void>]>} jobs - [lockId, jobFn] pairs
 */
function startReminderCron(jobs, { intervalMs = 10 * 60 * 1000, startupDelayMs = 20_000 } = {}) {
  const runAll = () => {
    for (const [lockId, fn] of jobs) {
      runWithDistributedLock(lockId, fn, 120).catch((e) =>
        console.warn(`[cron ${lockId}]`, e?.message || e),
      );
    }
  };

  setInterval(runAll, intervalMs);
  setTimeout(runAll, startupDelayMs);
}

module.exports = { startReminderCron };
