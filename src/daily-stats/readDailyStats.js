// Translates between the two daily-metric document shapes.
// Flow: dailyLogs uses flat dashboard_* keys. The old daily_tracking doc uses
//       camelCase (waterIntake, sleepHours). These functions convert either way
//       and, when reading, let dailyLogs win.
// No Firestore calls here. CommonJS so Node tests can require() it.
// Keep in sync with saveDailyStats.js, which is the only writer.

// ===== NAMED CONSTANTS =====

// There are no tunable timeouts in this file. The field names below are the contract
// between the new dailyLogs doc and the legacy daily_tracking doc. The letters stay.

// ===== HELPER FUNCTIONS =====

/**
 * A real answer. Null and "" are a cleared field, not a value of zero or blank text.
 * @param {*} value
 * @returns {boolean}
 */
function hasTextValue(value) {
  return value != null && value !== '';
}

/**
 * @param {*} value
 * @returns {number|null}
 */
function finiteNumberOrNull(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

/**
 * Copy one dashboard number onto the legacy doc when it is a real finite number.
 * Text fields can be "" or "abc". Those must not become NaN on the old doc.
 * @param {object} tracking
 * @param {string} trackingKey
 * @param {*} dashboardValue
 */
function copyFiniteNumber(tracking, trackingKey, dashboardValue) {
  if (!hasTextValue(dashboardValue)) return;
  const numericValue = finiteNumberOrNull(dashboardValue);
  if (numericValue != null) tracking[trackingKey] = numericValue;
}

/**
 * Ratings stay strings. They are scale labels, not quantities.
 * @param {object} tracking
 * @param {string} trackingKey
 * @param {*} dashboardValue
 */
function copyRatingString(tracking, trackingKey, dashboardValue) {
  if (!hasTextValue(dashboardValue)) return;
  tracking[trackingKey] = String(dashboardValue);
}

/**
 * dailyLogs calls the exercise field exerciseName. The legacy doc calls it name.
 * @param {object[]} workoutLog
 * @returns {object[]}
 */
function workoutLogToLegacyExercises(workoutLog) {
  return workoutLog.map((exercise) => ({
    name: exercise.exerciseName || exercise.name || '',
    sets: Array.isArray(exercise.sets) ? exercise.sets : [],
  }));
}

/**
 * Prefer the dailyLogs number. Fall back to the legacy value only when it is already a number.
 * @param {*} logValue
 * @param {*} trackingValue
 * @returns {number|null}
 */
function preferLogNumber(logValue, trackingValue) {
  const numberFromLogs = hasTextValue(logValue) ? Number(logValue) : null;
  if (Number.isFinite(numberFromLogs)) return numberFromLogs;
  if (typeof trackingValue === 'number') return trackingValue;
  return null;
}

/**
 * Same precedence as preferLogNumber, but the result stays a string.
 * @param {*} logValue
 * @param {*} trackingValue
 * @returns {string|null}
 */
function preferRatingText(logValue, trackingValue) {
  if (hasTextValue(logValue)) return String(logValue);
  if (hasTextValue(trackingValue)) return String(trackingValue);
  return null;
}

/**
 * Display shape for the dashboard card: exerciseName becomes name.
 * Null when dailyLogs has no sets, so the caller can use the legacy list instead.
 * @param {object} logs
 * @returns {object[]|null}
 */
function exercisesFromDailyLogs(logs) {
  if (!Array.isArray(logs.workoutLog) || logs.workoutLog.length === 0) return null;
  return logs.workoutLog.map((exercise) => ({
    name: exercise.exerciseName || exercise.name || '',
    sets: exercise.sets || [],
  }));
}

/**
 * Legacy exercises are already { name, sets }. Rebuild sets with 0 defaults so the
 * logger's number inputs never receive undefined.
 * @param {object} trackingData
 * @param {object} dailyLog
 * @returns {object}
 */
function dailyLogFromLegacyWorkout(trackingData, dailyLog) {
  return {
    ...dailyLog,
    dashboard_workout_name: trackingData.workoutName || dailyLog.dashboard_workout_name || '',
    workoutLog:
      Array.isArray(trackingData.workoutExercises) && trackingData.workoutExercises.length
        ? trackingData.workoutExercises.map((exercise) => ({
            exerciseName: exercise.name || exercise.exerciseName || exercise.label || '',
            sets: Array.isArray(exercise.sets)
              ? exercise.sets.map((setRow) => ({
                  reps: setRow.reps != null ? setRow.reps : 0,
                  weight: setRow.weight != null ? setRow.weight : 0,
                }))
              : [],
          }))
        : dailyLog.workoutLog,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Write direction: a dailyLogs patch becomes the matching daily_tracking patch.
 * Only keys present on the patch are copied, so a partial save does not blank other legacy fields.
 * @param {object} [logsPatch]
 * @returns {object}
 */
function trackingMirrorFromLogs(logsPatch = {}) {
  const tracking = {};
  copyFiniteNumber(tracking, 'waterIntake', logsPatch.dashboard_water);
  copyFiniteNumber(tracking, 'sleepHours', logsPatch.dashboard_sleep);
  copyRatingString(tracking, 'soreness', logsPatch.dashboard_soreness);
  copyRatingString(tracking, 'energyLevel', logsPatch.dashboard_energy);
  copyRatingString(tracking, 'stressLevel', logsPatch.dashboard_stress);
  if (logsPatch.dashboard_workout_name != null) {
    tracking.workoutName = logsPatch.dashboard_workout_name;
  }
  if (logsPatch.dashboard_workouts != null) {
    tracking.workoutSummary = logsPatch.dashboard_workouts;
  }
  if (Array.isArray(logsPatch.workoutLog) && logsPatch.workoutLog.length > 0) {
    tracking.workoutExercises = workoutLogToLegacyExercises(logsPatch.workoutLog);
  }
  return tracking;
}

/**
 * Read direction: one object the dashboard can render.
 * dailyLogs wins when it has a real value. The legacy doc fills gaps. Null when neither does.
 * vocab/symbol: ?.exists?.() = call exists() only when this is a real snapshot or a test double.
 * @param {object} logsSnap
 * @param {object} trackingSnap
 * @returns {object}
 */
function parseDailyMetricsFromSnapshots(logsSnap, trackingSnap) {
  const logs = logsSnap?.exists?.() ? logsSnap.data() || {} : {};
  const trackingData = trackingSnap?.exists?.() ? trackingSnap.data() || {} : {};

  const waterIntake = preferLogNumber(logs.dashboard_water, trackingData.waterIntake);
  const sleepHours = preferLogNumber(logs.dashboard_sleep, trackingData.sleepHours);
  const soreness = preferRatingText(logs.dashboard_soreness, trackingData.soreness);
  const energyLevel = preferRatingText(logs.dashboard_energy, trackingData.energyLevel);
  const stressLevel = preferRatingText(logs.dashboard_stress, trackingData.stressLevel);

  // The name gates the card. No name means the dashboard shows its empty state.
  let todayWorkout = null;
  const workoutName = logs.dashboard_workout_name || trackingData.workoutName;
  if (workoutName) {
    const exercisesFromLogs = exercisesFromDailyLogs(logs);
    todayWorkout = {
      name: workoutName,
      exercises: exercisesFromLogs || (Array.isArray(trackingData.workoutExercises) ? trackingData.workoutExercises : []),
    };
  }

  const dashboardWorkoutSummary = logs.dashboard_workouts || trackingData.workoutSummary || null;

  return {
    waterIntake: Number.isFinite(waterIntake) ? waterIntake : null,
    sleepHours: Number.isFinite(sleepHours) ? sleepHours : null,
    soreness,
    energyLevel,
    stressLevel,
    todayWorkout,
    dashboardWorkoutSummary,
  };
}

/**
 * Prepare the workout logger's edit form in dailyLogs shape (exerciseName, not name),
 * because the next save writes straight back to dailyLogs.
 * `d` is the hydrated doc. `fromLogs` is false when there is nothing to edit.
 * @param {object} logsSnap
 * @param {object} trackingSnap
 * @returns {{ d: object, fromLogs: boolean }}
 */
function buildWorkoutLogHydration(logsSnap, trackingSnap) {
  let dailyLog = logsSnap?.exists?.() ? logsSnap.data() || {} : {};
  const trackingData = trackingSnap?.exists?.() ? trackingSnap.data() || {} : {};

  // Three signals count as "we already have a workout": structured sets, an older name list, or just a name.
  let fromLogs =
    (Array.isArray(dailyLog.workoutLog) && dailyLog.workoutLog.length > 0) ||
    (Array.isArray(dailyLog.dashboard_workout_exercises) && dailyLog.dashboard_workout_exercises.length > 0) ||
    (dailyLog.dashboard_workout_name && String(dailyLog.dashboard_workout_name).trim());

  // Only read the legacy doc when dailyLogs had nothing. Otherwise an older mirror could overwrite a fresh log.
  if (!fromLogs) {
    const hasLegacyWorkout = trackingData.workoutName
      || (Array.isArray(trackingData.workoutExercises) && trackingData.workoutExercises.length);
    if (hasLegacyWorkout) {
      dailyLog = dailyLogFromLegacyWorkout(trackingData, dailyLog);
      fromLogs = true;
    } else if (trackingData.workoutSummary && String(trackingData.workoutSummary).trim()) {
      // Last resort: a free-text summary. The first line becomes the title.
      dailyLog = {
        ...dailyLog,
        dashboard_workout_name:
          String(trackingData.workoutSummary).split('\n')[0].trim() || dailyLog.dashboard_workout_name,
        dashboard_workouts: trackingData.workoutSummary,
      };
      fromLogs = true;
    }
  }

  return { d: dailyLog, fromLogs };
}

module.exports = {
  trackingMirrorFromLogs,
  parseDailyMetricsFromSnapshots,
  buildWorkoutLogHydration,
};
