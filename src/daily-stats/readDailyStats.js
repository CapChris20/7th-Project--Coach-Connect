// Translates between the two daily-metric document shapes.
// Flow: dailyLogs uses flat dashboard_* keys. The old daily_tracking doc uses camelCase. dailyLogs wins when both have a value.
// No Firestore calls here. CommonJS so Node tests can require() it. Keep in sync with saveDailyStats.js.

// ===== NAMED CONSTANTS =====

// Field names below are the contract between dailyLogs and daily_tracking. The letters stay.

// ===== HELPER FUNCTIONS =====

// PLUMBING — skip unless a dashboard card shows the legacy number instead of the dailyLogs number.

function hasTextValue(value) {
  return value != null && value !== '';
}

function finiteNumberOrNull(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return numericValue;
}

function copyFiniteNumber(tracking, trackingKey, dashboardValue) {
  if (!hasTextValue(dashboardValue)) return;
  const numericValue = finiteNumberOrNull(dashboardValue);
  if (numericValue != null) tracking[trackingKey] = numericValue;
}

function copyRatingString(tracking, trackingKey, dashboardValue) {
  if (!hasTextValue(dashboardValue)) return;
  tracking[trackingKey] = String(dashboardValue);
}

function workoutLogToLegacyExercises(workoutLog) {
  return workoutLog.map((exercise) => ({
    name: exercise.exerciseName || exercise.name || '',
    sets: Array.isArray(exercise.sets) ? exercise.sets : [],
  }));
}

function preferLogNumber(logValue, trackingValue) {
  const numberFromLogs = hasTextValue(logValue) ? Number(logValue) : null;
  if (Number.isFinite(numberFromLogs)) return numberFromLogs;
  if (typeof trackingValue === 'number') return trackingValue;
  return null;
}

function preferRatingText(logValue, trackingValue) {
  if (hasTextValue(logValue)) return String(logValue);
  if (hasTextValue(trackingValue)) return String(trackingValue);
  return null;
}

function exercisesFromDailyLogs(logs) {
  if (!Array.isArray(logs.workoutLog) || logs.workoutLog.length === 0) return null;
  return logs.workoutLog.map((exercise) => ({
    name: exercise.exerciseName || exercise.name || '',
    sets: exercise.sets || [],
  }));
}

function setRowWithZeroDefaults(setRow) {
  return {
    reps: setRow.reps ?? 0,
    weight: setRow.weight ?? 0,
  };
}

function dailyLogFromLegacyWorkout(trackingData, dailyLog) {
  const hasLegacyExercises =
    Array.isArray(trackingData.workoutExercises) && trackingData.workoutExercises.length;
  let workoutLog = dailyLog.workoutLog;
  if (hasLegacyExercises) {
    workoutLog = trackingData.workoutExercises.map((exercise) => ({
      exerciseName: exercise.name || exercise.exerciseName || exercise.label || '',
      sets: Array.isArray(exercise.sets) ? exercise.sets.map(setRowWithZeroDefaults) : [],
    }));
  }
  return {
    ...dailyLog,
    dashboard_workout_name: trackingData.workoutName || dailyLog.dashboard_workout_name || '',
    workoutLog,
  };
}

function firstLineOfSummary(workoutSummary) {
  return String(workoutSummary).split('\n')[0].trim();
}

function dailyLogFromLegacySummary(trackingData, dailyLog) {
  const titleLine = firstLineOfSummary(trackingData.workoutSummary);
  return {
    ...dailyLog,
    dashboard_workout_name: titleLine || dailyLog.dashboard_workout_name,
    dashboard_workouts: trackingData.workoutSummary,
  };
}

function workoutSignalFromDailyLog(dailyLog) {
  if (Array.isArray(dailyLog.workoutLog) && dailyLog.workoutLog.length > 0) return true;
  const namedExercises = dailyLog.dashboard_workout_exercises;
  if (Array.isArray(namedExercises) && namedExercises.length > 0) return true;
  const workoutName = dailyLog.dashboard_workout_name;
  if (workoutName && String(workoutName).trim()) return String(workoutName).trim();
  return false;
}

function hasLegacyStructuredWorkout(trackingData) {
  if (trackingData.workoutName) return true;
  return Array.isArray(trackingData.workoutExercises) && trackingData.workoutExercises.length;
}

function snapshotData(snapshot) {
  if (!snapshot || !snapshot.exists || !snapshot.exists()) return {};
  return snapshot.data() || {};
}

function exercisesForTodayCard(logs, trackingData) {
  const exercisesFromLogs = exercisesFromDailyLogs(logs);
  if (exercisesFromLogs) return exercisesFromLogs;
  if (Array.isArray(trackingData.workoutExercises)) return trackingData.workoutExercises;
  return [];
}

function finiteOrNull(value) {
  if (Number.isFinite(value)) return value;
  return null;
}

// ===== MAIN FUNCTION =====

/**
 * A dailyLogs patch becomes the matching daily_tracking patch.
 * Only keys present on the patch are copied.
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
 * One object the dashboard can render. dailyLogs wins. The legacy doc fills gaps.
 * @param {object} logsSnap
 * @param {object} trackingSnap
 * @returns {object}
 */
function parseDailyMetricsFromSnapshots(logsSnap, trackingSnap) {
  const logs = snapshotData(logsSnap);
  const trackingData = snapshotData(trackingSnap);

  const waterIntake = preferLogNumber(logs.dashboard_water, trackingData.waterIntake);
  const sleepHours = preferLogNumber(logs.dashboard_sleep, trackingData.sleepHours);
  const soreness = preferRatingText(logs.dashboard_soreness, trackingData.soreness);
  const energyLevel = preferRatingText(logs.dashboard_energy, trackingData.energyLevel);
  const stressLevel = preferRatingText(logs.dashboard_stress, trackingData.stressLevel);

  let todayWorkout = null;
  const workoutName = logs.dashboard_workout_name || trackingData.workoutName;
  if (workoutName) {
    todayWorkout = {
      name: workoutName,
      exercises: exercisesForTodayCard(logs, trackingData),
    };
  }

  const dashboardWorkoutSummary = logs.dashboard_workouts || trackingData.workoutSummary || null;

  return {
    waterIntake: finiteOrNull(waterIntake),
    sleepHours: finiteOrNull(sleepHours),
    soreness,
    energyLevel,
    stressLevel,
    todayWorkout,
    dashboardWorkoutSummary,
  };
}

/**
 * Workout logger form in dailyLogs shape. `d` is the hydrated doc. `fromLogs` is false when there is nothing to edit.
 * @param {object} logsSnap
 * @param {object} trackingSnap
 * @returns {{ d: object, fromLogs: boolean }}
 */
function buildWorkoutLogHydration(logsSnap, trackingSnap) {
  const dailyLog = snapshotData(logsSnap);
  const trackingData = snapshotData(trackingSnap);
  const fromDailyLogs = workoutSignalFromDailyLog(dailyLog);

  if (fromDailyLogs) {
    return { d: dailyLog, fromLogs: fromDailyLogs };
  }
  if (hasLegacyStructuredWorkout(trackingData)) {
    return { d: dailyLogFromLegacyWorkout(trackingData, dailyLog), fromLogs: true };
  }
  if (trackingData.workoutSummary && String(trackingData.workoutSummary).trim()) {
    return { d: dailyLogFromLegacySummary(trackingData, dailyLog), fromLogs: true };
  }
  return { d: dailyLog, fromLogs: fromDailyLogs };
}

module.exports = {
  trackingMirrorFromLogs,
  parseDailyMetricsFromSnapshots,
  buildWorkoutLogHydration,
};
