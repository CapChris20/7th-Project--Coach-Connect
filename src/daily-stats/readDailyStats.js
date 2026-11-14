// Translates between the two daily-metric document shapes.
// Flow: dailyLogs uses flat dashboard_* keys. The old daily_tracking doc uses camelCase. dailyLogs wins when both have a value.
// No Firestore calls here. CommonJS so Node tests can require() it. Keep in sync with saveDailyStats.js.
// Read order: constants → small helpers → main recipes → PLUMBING shape helpers at the bottom.

// ===== NAMED CONSTANTS =====

// Field names below are the contract between dailyLogs and daily_tracking. The letters stay.
const EMPTY_WORKOUT_NAME = '';

// ===== HELPER FUNCTIONS =====

/**
 * True when a value is present and not an empty string.
 * @param {*} value
 * @returns {boolean}
 */
function hasTextValue(value) {
  if (value == null) {
    return false;
  }
  if (value === '') {
    return false;
  }
  return true;
}

/**
 * @param {*} value
 * @returns {number|null}
 */
function finiteNumberOrNull(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }
  return numericValue;
}

/**
 * Snapshot → plain data object. Missing / non-existent docs become {}.
 * @param {object|null|undefined} snapshot
 * @returns {object}
 */
function snapshotDataFromFirestore(snapshot) {
  if (!snapshot) {
    return {};
  }
  if (!snapshot.exists) {
    return {};
  }
  if (!snapshot.exists()) {
    return {};
  }
  const dataFromSnapshot = snapshot.data();
  if (!dataFromSnapshot) {
    return {};
  }
  return dataFromSnapshot;
}

// ===== MAIN FUNCTION =====

/**
 * A dailyLogs patch becomes the matching daily_tracking patch.
 * Only keys present on the patch are copied.
 * @param {object} [logsPatch]
 * @returns {object}
 */
function trackingMirrorFromLogs(logsPatch = {}) {
  const trackingPatch = {};

  // 1. Copy numeric dashboard fields into camelCase tracking keys when the log value is present.
  copyFiniteNumberOntoTracking(trackingPatch, 'waterIntake', logsPatch.dashboard_water);
  copyFiniteNumberOntoTracking(trackingPatch, 'sleepHours', logsPatch.dashboard_sleep);
  copyRatingStringOntoTracking(trackingPatch, 'soreness', logsPatch.dashboard_soreness);
  copyRatingStringOntoTracking(trackingPatch, 'energyLevel', logsPatch.dashboard_energy);
  copyRatingStringOntoTracking(trackingPatch, 'stressLevel', logsPatch.dashboard_stress);

  // 2. Workout text fields and structured log rows mirror separately.
  copyWorkoutFieldsOntoTracking(trackingPatch, logsPatch);

  return trackingPatch;
}

/**
 * One object the dashboard can render. dailyLogs wins. The legacy doc fills gaps.
 * @param {object} logsSnap
 * @param {object} trackingSnap
 * @returns {object}
 */
function parseDailyMetricsFromSnapshots(logsSnap, trackingSnap) {
  const dailyLogData = snapshotDataFromFirestore(logsSnap);
  const trackingData = snapshotDataFromFirestore(trackingSnap);

  // 1. Merge scalar metrics — prefer dashboard_* strings/numbers, fall back to tracking.
  const waterIntake = preferLogNumber(dailyLogData.dashboard_water, trackingData.waterIntake);
  const sleepHours = preferLogNumber(dailyLogData.dashboard_sleep, trackingData.sleepHours);
  const soreness = preferRatingText(dailyLogData.dashboard_soreness, trackingData.soreness);
  const energyLevel = preferRatingText(dailyLogData.dashboard_energy, trackingData.energyLevel);
  const stressLevel = preferRatingText(dailyLogData.dashboard_stress, trackingData.stressLevel);

  // 2. Build today's workout card when we have a name on either doc.
  const todayWorkout = todayWorkoutCardFromBothDocs(dailyLogData, trackingData);

  // 3. Free-text workout summary for the dashboard strip.
  let dashboardWorkoutSummary = null;
  if (dailyLogData.dashboard_workouts) {
    dashboardWorkoutSummary = dailyLogData.dashboard_workouts;
  } else if (trackingData.workoutSummary) {
    dashboardWorkoutSummary = trackingData.workoutSummary;
  }

  return {
    waterIntake: keepFiniteNumberOrNull(waterIntake),
    sleepHours: keepFiniteNumberOrNull(sleepHours),
    soreness,
    energyLevel,
    stressLevel,
    todayWorkout,
    dashboardWorkoutSummary,
  };
}

/**
 * Workout logger form in dailyLogs shape. `d` is the hydrated doc. `fromLogs` is false when there is nothing to edit.
 * Freeze: return shape keys stay `d` and `fromLogs` — callers read those letters.
 * @param {object} logsSnap
 * @param {object} trackingSnap
 * @returns {{ d: object, fromLogs: boolean }}
 */
function buildWorkoutLogHydration(logsSnap, trackingSnap) {
  const dailyLogData = snapshotDataFromFirestore(logsSnap);
  const trackingData = snapshotDataFromFirestore(trackingSnap);

  // 1. When dailyLogs already has workout signal, use that doc as-is.
  const alreadyOnDailyLogs = workoutSignalFromDailyLog(dailyLogData);
  if (alreadyOnDailyLogs) {
    return { d: dailyLogData, fromLogs: alreadyOnDailyLogs };
  }

  // 2. Legacy structured exercises → synthetic dailyLogs rows the logger can edit.
  if (hasLegacyStructuredWorkout(trackingData)) {
    const hydratedDailyLog = dailyLogFromLegacyWorkout(trackingData, dailyLogData);
    return { d: hydratedDailyLog, fromLogs: true };
  }

  // 3. Legacy free-text summary only → copy title from first line into dashboard_workout_name.
  let legacySummaryText = null;
  if (trackingData.workoutSummary) {
    legacySummaryText = String(trackingData.workoutSummary).trim();
  }
  if (legacySummaryText) {
    const hydratedDailyLog = dailyLogFromLegacySummary(trackingData, dailyLogData);
    return { d: hydratedDailyLog, fromLogs: true };
  }

  return { d: dailyLogData, fromLogs: alreadyOnDailyLogs };
}

module.exports = {
  trackingMirrorFromLogs,
  parseDailyMetricsFromSnapshots,
  buildWorkoutLogHydration,
};

// ===== PLUMBING — skip unless a dashboard card shows the legacy number instead of the dailyLogs number =====

function copyFiniteNumberOntoTracking(trackingPatch, trackingKey, dashboardValue) {
  if (!hasTextValue(dashboardValue)) {
    return;
  }
  const numericValue = finiteNumberOrNull(dashboardValue);
  if (numericValue != null) {
    trackingPatch[trackingKey] = numericValue;
  }
}

function copyRatingStringOntoTracking(trackingPatch, trackingKey, dashboardValue) {
  if (!hasTextValue(dashboardValue)) {
    return;
  }
  trackingPatch[trackingKey] = String(dashboardValue);
}

function copyWorkoutFieldsOntoTracking(trackingPatch, logsPatch) {
  if (logsPatch.dashboard_workout_name != null) {
    trackingPatch.workoutName = logsPatch.dashboard_workout_name;
  }
  if (logsPatch.dashboard_workouts != null) {
    trackingPatch.workoutSummary = logsPatch.dashboard_workouts;
  }
  if (!Array.isArray(logsPatch.workoutLog)) {
    return;
  }
  if (logsPatch.workoutLog.length === 0) {
    return;
  }
  trackingPatch.workoutExercises = workoutLogToLegacyExercises(logsPatch.workoutLog);
}

// Prefer exerciseName; fall back to name. Empty string when neither is set.
function exerciseNameFromLogRow(exerciseRow) {
  if (exerciseRow.exerciseName) {
    return exerciseRow.exerciseName;
  }
  if (exerciseRow.name) {
    return exerciseRow.name;
  }
  return EMPTY_WORKOUT_NAME;
}

// Only array sets survive the mirror — non-arrays become [].
function arraySetsFromLogRow(exerciseRow) {
  if (!Array.isArray(exerciseRow.sets)) {
    return [];
  }
  return exerciseRow.sets;
}

function legacyExerciseFromLogRow(exerciseRow) {
  return {
    name: exerciseNameFromLogRow(exerciseRow),
    sets: arraySetsFromLogRow(exerciseRow),
  };
}

function workoutLogToLegacyExercises(workoutLog) {
  const legacyExercises = [];
  for (let index = 0; index < workoutLog.length; index += 1) {
    legacyExercises.push(legacyExerciseFromLogRow(workoutLog[index]));
  }
  return legacyExercises;
}

function preferLogNumber(logValue, trackingValue) {
  let numberFromLogs = null;
  if (hasTextValue(logValue)) {
    numberFromLogs = Number(logValue);
  }
  if (Number.isFinite(numberFromLogs)) {
    return numberFromLogs;
  }
  if (typeof trackingValue === 'number') {
    return trackingValue;
  }
  return null;
}

function preferRatingText(logValue, trackingValue) {
  if (hasTextValue(logValue)) {
    return String(logValue);
  }
  if (hasTextValue(trackingValue)) {
    return String(trackingValue);
  }
  return null;
}

function keepFiniteNumberOrNull(value) {
  if (Number.isFinite(value)) {
    return value;
  }
  return null;
}

function todayWorkoutCardFromBothDocs(dailyLogData, trackingData) {
  let workoutName = dailyLogData.dashboard_workout_name;
  if (!workoutName) {
    workoutName = trackingData.workoutName;
  }
  if (!workoutName) {
    return null;
  }
  return {
    name: workoutName,
    exercises: exercisesForTodayCard(dailyLogData, trackingData),
  };
}

// Truthy sets only (not Array.isArray) — matches the old today-card path.
function truthySetsFromLogRow(exerciseRow) {
  if (!exerciseRow.sets) {
    return [];
  }
  return exerciseRow.sets;
}

function todayCardExerciseFromLogRow(exerciseRow) {
  return {
    name: exerciseNameFromLogRow(exerciseRow),
    sets: truthySetsFromLogRow(exerciseRow),
  };
}

function exercisesFromDailyLogs(dailyLogData) {
  if (!Array.isArray(dailyLogData.workoutLog)) {
    return null;
  }
  if (dailyLogData.workoutLog.length === 0) {
    return null;
  }
  const exercises = [];
  for (let index = 0; index < dailyLogData.workoutLog.length; index += 1) {
    exercises.push(todayCardExerciseFromLogRow(dailyLogData.workoutLog[index]));
  }
  return exercises;
}

function exercisesForTodayCard(dailyLogData, trackingData) {
  const exercisesFromLogs = exercisesFromDailyLogs(dailyLogData);
  if (exercisesFromLogs) {
    return exercisesFromLogs;
  }
  if (Array.isArray(trackingData.workoutExercises)) {
    return trackingData.workoutExercises;
  }
  return [];
}

function setRowWithZeroDefaults(setRow) {
  // vocab/symbol: ?? = keep 0 when reps/weight are null/undefined (0 must survive)
  let repsValue = setRow.reps;
  if (repsValue === null || repsValue === undefined) {
    repsValue = 0;
  }
  let weightValue = setRow.weight;
  if (weightValue === null || weightValue === undefined) {
    weightValue = 0;
  }
  return {
    reps: repsValue,
    weight: weightValue,
  };
}

function mapLegacySetsWithDefaults(setsArray) {
  const mappedSets = [];
  for (let index = 0; index < setsArray.length; index += 1) {
    mappedSets.push(setRowWithZeroDefaults(setsArray[index]));
  }
  return mappedSets;
}

// Legacy rows prefer name, then exerciseName, then label.
function exerciseNameFromLegacyRow(exerciseRow) {
  if (exerciseRow.name) {
    return exerciseRow.name;
  }
  if (exerciseRow.exerciseName) {
    return exerciseRow.exerciseName;
  }
  if (exerciseRow.label) {
    return exerciseRow.label;
  }
  return EMPTY_WORKOUT_NAME;
}

function setsFromLegacyRow(exerciseRow) {
  if (!Array.isArray(exerciseRow.sets)) {
    return [];
  }
  return mapLegacySetsWithDefaults(exerciseRow.sets);
}

function workoutLogRowFromLegacyExercise(exerciseRow) {
  return {
    exerciseName: exerciseNameFromLegacyRow(exerciseRow),
    sets: setsFromLegacyRow(exerciseRow),
  };
}

function workoutLogRowsFromLegacyExercises(workoutExercises) {
  const workoutLogRows = [];
  for (let index = 0; index < workoutExercises.length; index += 1) {
    workoutLogRows.push(workoutLogRowFromLegacyExercise(workoutExercises[index]));
  }
  return workoutLogRows;
}

function workoutNameFromLegacyOrLog(trackingData, dailyLogData) {
  if (trackingData.workoutName) {
    return trackingData.workoutName;
  }
  if (dailyLogData.dashboard_workout_name) {
    return dailyLogData.dashboard_workout_name;
  }
  return EMPTY_WORKOUT_NAME;
}

function dailyLogFromLegacyWorkout(trackingData, dailyLogData) {
  const hasLegacyExercises =
    Array.isArray(trackingData.workoutExercises) && trackingData.workoutExercises.length > 0;
  let workoutLogRows = dailyLogData.workoutLog;
  if (hasLegacyExercises) {
    workoutLogRows = workoutLogRowsFromLegacyExercises(trackingData.workoutExercises);
  }
  const workoutNameOnLog = workoutNameFromLegacyOrLog(trackingData, dailyLogData);
  return Object.assign({}, dailyLogData, {
    dashboard_workout_name: workoutNameOnLog,
    workoutLog: workoutLogRows,
  });
}

function firstLineOfSummary(workoutSummary) {
  const summaryAsString = String(workoutSummary);
  const lines = summaryAsString.split('\n');
  return lines[0].trim();
}

function dailyLogFromLegacySummary(trackingData, dailyLogData) {
  const titleLine = firstLineOfSummary(trackingData.workoutSummary);
  let workoutNameOnLog = dailyLogData.dashboard_workout_name;
  if (titleLine) {
    workoutNameOnLog = titleLine;
  }
  return Object.assign({}, dailyLogData, {
    dashboard_workout_name: workoutNameOnLog,
    dashboard_workouts: trackingData.workoutSummary,
  });
}

function workoutSignalFromDailyLog(dailyLogData) {
  if (Array.isArray(dailyLogData.workoutLog) && dailyLogData.workoutLog.length > 0) {
    return true;
  }
  const namedExercises = dailyLogData.dashboard_workout_exercises;
  if (Array.isArray(namedExercises) && namedExercises.length > 0) {
    return true;
  }
  const workoutName = dailyLogData.dashboard_workout_name;
  if (!workoutName) {
    return false;
  }
  const trimmedName = String(workoutName).trim();
  if (trimmedName) {
    return trimmedName;
  }
  return false;
}

function hasLegacyStructuredWorkout(trackingData) {
  if (trackingData.workoutName) {
    return true;
  }
  if (!Array.isArray(trackingData.workoutExercises)) {
    return false;
  }
  if (trackingData.workoutExercises.length > 0) {
    return true;
  }
  return false;
}
