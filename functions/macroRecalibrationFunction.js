/**
 * Scheduled macro recalibration (day 14+) — America/Detroit 6:00 AM daily.
 */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { runDailyMacroRecalibrationJob } = require('./lib/macroRecalibration');

exports.dailyMacroRecalibration = onSchedule(
  {
    schedule: '0 6 * * *',
    timeZone: 'America/Detroit',
  },
  async () => {
    logger.info('dailyMacroRecalibration started', { at: new Date().toISOString() });
    try {
      const result = await runDailyMacroRecalibrationJob(admin);
      logger.info('dailyMacroRecalibration completed', result);
    } catch (error) {
      logger.error('dailyMacroRecalibration failed', {
        error: error?.message || String(error),
      });
      throw error;
    }
  }
);
