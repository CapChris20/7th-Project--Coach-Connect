/** Pure parse/mirror helpers (CJS for Node tests). Keep in sync with dailyMetricsService.js */

function trackingMirrorFromLogs(logsPatch = {}) {
  const tracking = {};
  if (logsPatch.dashboard_water != null && logsPatch.dashboard_water !== '') {
    const n = Number(logsPatch.dashboard_water);
    if (Number.isFinite(n)) tracking.waterIntake = n;
  }
  if (logsPatch.dashboard_sleep != null && logsPatch.dashboard_sleep !== '') {
    const n = Number(logsPatch.dashboard_sleep);
    if (Number.isFinite(n)) tracking.sleepHours = n;
  }
  if (logsPatch.dashboard_soreness != null && logsPatch.dashboard_soreness !== '') {
    tracking.soreness = String(logsPatch.dashboard_soreness);
  }
  if (logsPatch.dashboard_energy != null && logsPatch.dashboard_energy !== '') {
    tracking.energyLevel = String(logsPatch.dashboard_energy);
  }
  if (logsPatch.dashboard_stress != null && logsPatch.dashboard_stress !== '') {
    tracking.stressLevel = String(logsPatch.dashboard_stress);
  }
  if (logsPatch.dashboard_workout_name != null) {
    tracking.workoutName = logsPatch.dashboard_workout_name;
  }
  if (logsPatch.dashboard_workouts != null) {
    tracking.workoutSummary = logsPatch.dashboard_workouts;
  }
  if (Array.isArray(logsPatch.workoutLog) && logsPatch.workoutLog.length > 0) {
    tracking.workoutExercises = logsPatch.workoutLog.map((ex) => ({
      name: ex.exerciseName || ex.name || '',
      sets: Array.isArray(ex.sets) ? ex.sets : [],
    }));
  }
  return tracking;
}

function parseDailyMetricsFromSnapshots(logsSnap, trackingSnap) {
  const logs = logsSnap?.exists?.() ? logsSnap.data() || {} : {};
  const td = trackingSnap?.exists?.() ? trackingSnap.data() || {} : {};

  const waterFromLogs =
    logs.dashboard_water != null && logs.dashboard_water !== ''
      ? Number(logs.dashboard_water)
      : null;
  const waterIntake = Number.isFinite(waterFromLogs)
    ? waterFromLogs
    : typeof td.waterIntake === 'number'
      ? td.waterIntake
      : null;

  const sleepFromLogs =
    logs.dashboard_sleep != null && logs.dashboard_sleep !== ''
      ? Number(logs.dashboard_sleep)
      : null;
  const sleepHours = Number.isFinite(sleepFromLogs)
    ? sleepFromLogs
    : typeof td.sleepHours === 'number'
      ? td.sleepHours
      : null;

  const soreness =
    logs.dashboard_soreness != null && logs.dashboard_soreness !== ''
      ? String(logs.dashboard_soreness)
      : td.soreness != null && td.soreness !== ''
        ? String(td.soreness)
        : null;
  const energyLevel =
    logs.dashboard_energy != null && logs.dashboard_energy !== ''
      ? String(logs.dashboard_energy)
      : td.energyLevel != null && td.energyLevel !== ''
        ? String(td.energyLevel)
        : null;
  const stressLevel =
    logs.dashboard_stress != null && logs.dashboard_stress !== ''
      ? String(logs.dashboard_stress)
      : td.stressLevel != null && td.stressLevel !== ''
        ? String(td.stressLevel)
        : null;

  let todayWorkout = null;
  const workoutName = logs.dashboard_workout_name || td.workoutName;
  if (workoutName) {
    const exercisesFromLogs =
      Array.isArray(logs.workoutLog) && logs.workoutLog.length > 0
        ? logs.workoutLog.map((ex) => ({
            name: ex.exerciseName || ex.name || '',
            sets: ex.sets || [],
          }))
        : null;
    todayWorkout = {
      name: workoutName,
      exercises:
        exercisesFromLogs ||
        (Array.isArray(td.workoutExercises) ? td.workoutExercises : []),
    };
  }

  const dashboardWorkoutSummary = logs.dashboard_workouts || td.workoutSummary || null;

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

/** Merge legacy tracking into dailyLogs-shaped doc for workout logger hydration. */
function buildWorkoutLogHydration(logsSnap, trackingSnap) {
  let d = logsSnap?.exists?.() ? logsSnap.data() || {} : {};
  const td = trackingSnap?.exists?.() ? trackingSnap.data() || {} : {};

  let fromLogs =
    (Array.isArray(d.workoutLog) && d.workoutLog.length > 0) ||
    (Array.isArray(d.dashboard_workout_exercises) && d.dashboard_workout_exercises.length > 0) ||
    (d.dashboard_workout_name && String(d.dashboard_workout_name).trim());

  if (!fromLogs) {
    if (td.workoutName || (Array.isArray(td.workoutExercises) && td.workoutExercises.length)) {
      d = {
        ...d,
        dashboard_workout_name: td.workoutName || d.dashboard_workout_name || '',
        workoutLog:
          Array.isArray(td.workoutExercises) && td.workoutExercises.length
            ? td.workoutExercises.map((ex) => ({
                exerciseName: ex.name || ex.exerciseName || ex.label || '',
                sets: Array.isArray(ex.sets)
                  ? ex.sets.map((s) => ({
                      reps: s.reps != null ? s.reps : 0,
                      weight: s.weight != null ? s.weight : 0,
                    }))
                  : [],
              }))
            : d.workoutLog,
      };
      fromLogs = true;
    } else if (td.workoutSummary && String(td.workoutSummary).trim()) {
      d = {
        ...d,
        dashboard_workout_name:
          String(td.workoutSummary).split('\n')[0].trim() || d.dashboard_workout_name,
        dashboard_workouts: td.workoutSummary,
      };
      fromLogs = true;
    }
  }

  return { d, fromLogs };
}

module.exports = {
  trackingMirrorFromLogs,
  parseDailyMetricsFromSnapshots,
  buildWorkoutLogHydration,
};
