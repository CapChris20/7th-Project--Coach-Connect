// Pure translators between the two daily-metric document shapes.
// Flow: dailyLogs uses flat `dashboard_*` keys; the legacy daily_tracking doc uses
//       camelCase (`waterIntake`, `sleepHours`). These functions convert either direction
//       and merge the two when reading, so screens see one clean shape.
// No Firestore calls here — deliberately pure, and CommonJS so Node tests can require it.
// Keep in sync with saveDailyStats.js, which is the only writer.

// Write direction: given a dailyLogs patch, produce the equivalent daily_tracking patch.
// Only keys actually present in the patch are mirrored, so a partial save doesn't
// blank out unrelated legacy fields.
function trackingMirrorFromLogs(logsPatch = {}) {
  const tracking = {};
  // Numeric fields are coerced and finite-checked: dashboard inputs are text fields,
  // so "" or "abc" must not be mirrored as NaN into the legacy doc.
  // Rating fields (soreness/energy/stress) stay STRINGS on purpose — they're scale
  // labels, not quantities.
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
  // Exercises need a real shape change, not just a rename: dailyLogs calls the field
  // `exerciseName`, the legacy doc calls it `name`.
  if (Array.isArray(logsPatch.workoutLog) && logsPatch.workoutLog.length > 0) {
    tracking.workoutExercises = logsPatch.workoutLog.map((ex) => ({
      name: ex.exerciseName || ex.name || '',
      sets: Array.isArray(ex.sets) ? ex.sets : [],
    }));
  }
  return tracking;
}

// Read direction: combine both day docs into the single object the dashboard renders.
// The rule throughout is dailyLogs-wins-if-present, legacy-doc-as-fallback, null if neither.
function parseDailyMetricsFromSnapshots(logsSnap, trackingSnap) {
  // vocab/symbol: ?.exists?.() = these may be real Firestore snapshots, undefined, or
  //               test doubles — this calls exists() only if it's actually there.
  // Defaulting to {} lets every lookup below read fields without null checks.
  const logs = logsSnap?.exists?.() ? logsSnap.data() || {} : {};
  const td = trackingSnap?.exists?.() ? trackingSnap.data() || {} : {};

  // Water/sleep: try dailyLogs as a number first; only if that isn't finite do we accept
  // the legacy value (and only when it's already a number, to avoid re-introducing strings).
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

  // Rating fields follow the same precedence but stay strings. The repeated
  // `!= null && !== ''` pair is the "has a real answer" test — an empty string is a
  // cleared field, not a rating of "".
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

  // Workout: the NAME gates everything. Without a name there's nothing to show, so
  // `todayWorkout` stays null and the dashboard renders its empty state.
  let todayWorkout = null;
  const workoutName = logs.dashboard_workout_name || td.workoutName;
  if (workoutName) {
    // Convert dailyLogs exercises into the display shape (exerciseName → name).
    // Stays null when there are none so the `||` below can reach the legacy list.
    const exercisesFromLogs =
      Array.isArray(logs.workoutLog) && logs.workoutLog.length > 0
        ? logs.workoutLog.map((ex) => ({
            name: ex.exerciseName || ex.name || '',
            sets: ex.sets || [],
          }))
        : null;
    todayWorkout = {
      name: workoutName,
      // Legacy exercises are already in display shape, so they need no mapping.
      // Final `[]` guarantees the UI can always .map() over this.
      exercises:
        exercisesFromLogs ||
        (Array.isArray(td.workoutExercises) ? td.workoutExercises : []),
    };
  }

  // The free-text summary a client can type instead of logging structured sets.
  const dashboardWorkoutSummary = logs.dashboard_workouts || td.workoutSummary || null;

  // One flat, predictable object — every numeric field re-checked for finiteness so the
  // dashboard never has to guard against NaN.
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
// Prepares the workout logger's edit form. Unlike the read above, the output must be in
// dailyLogs shape (`exerciseName`, not `name`) because whatever the user saves is written
// straight back to dailyLogs.
// Returns `{ d, fromLogs }` — `d` is the hydrated doc, `fromLogs` tells the caller whether
// we found any workout at all (false → open a blank logger).
function buildWorkoutLogHydration(logsSnap, trackingSnap) {
  let d = logsSnap?.exists?.() ? logsSnap.data() || {} : {};
  const td = trackingSnap?.exists?.() ? trackingSnap.data() || {} : {};

  // Does dailyLogs already have something usable? Three acceptable signals: structured
  // sets, an older exercises array, or just a workout name.
  let fromLogs =
    (Array.isArray(d.workoutLog) && d.workoutLog.length > 0) ||
    (Array.isArray(d.dashboard_workout_exercises) && d.dashboard_workout_exercises.length > 0) ||
    (d.dashboard_workout_name && String(d.dashboard_workout_name).trim());

  // Only reach into the legacy doc when dailyLogs had nothing — otherwise we'd risk
  // overwriting fresh data with an older mirror.
  if (!fromLogs) {
    // Preferred legacy shape: a real name and/or structured exercises.
    if (td.workoutName || (Array.isArray(td.workoutExercises) && td.workoutExercises.length)) {
      d = {
        ...d,
        dashboard_workout_name: td.workoutName || d.dashboard_workout_name || '',
        // Translate legacy → dailyLogs shape. `ex.label` is a third historical spelling.
        // Sets are rebuilt field-by-field with 0 defaults so the logger's number inputs
        // never receive undefined (which would make them uncontrolled).
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
    // Last resort: only a free-text summary exists. Use its first line as the workout
    // name so the logger at least has a title, and keep the full text alongside it.
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
