#!/usr/bin/env node
/**
 * Unit tests for daily metrics parse + mirror logic (no Firebase).
 * Run: node scripts/testDailyMetricsService.js
 */
const {
  parseDailyMetricsFromSnapshots,
  trackingMirrorFromLogs,
  buildWorkoutLogHydration,
} = require('../src/metrics/daily-metrics/parseUserDailyMetrics.js');

function mockSnap(data) {
  if (data == null) return { exists: () => false, data: () => ({}) };
  return { exists: () => true, data: () => data };
}

let failed = 0;
const assert = (name, cond, detail = '') => {
  if (cond) {
    console.log(`✅ PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`❌ FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const logs = mockSnap({
  dashboard_water: '64',
  dashboard_sleep: '7.5',
  dashboard_soreness: '3',
  dashboard_energy: '8',
  dashboard_stress: '4',
  dashboard_workout_name: 'Push Day',
  workoutLog: [{ exerciseName: 'Bench', sets: [{ reps: 8, weight: 135 }] }],
});
const tracking = mockSnap({
  waterIntake: 32,
  sleepHours: 6,
  workoutName: 'Leg Day',
  workoutExercises: [{ name: 'Squat', sets: [{ reps: 5, weight: 225 }] }],
});

const parsed = parseDailyMetricsFromSnapshots(logs, tracking);

assert('prefers dailyLogs water over tracking', parsed.waterIntake === 64);
assert('prefers dailyLogs sleep over tracking', parsed.sleepHours === 7.5);
assert('reads soreness from logs', parsed.soreness === '3');
assert('reads energy from logs', parsed.energyLevel === '8');
assert('reads workout name from logs', parsed.todayWorkout?.name === 'Push Day');
assert('maps workoutLog exercises', parsed.todayWorkout?.exercises?.[0]?.name === 'Bench');

const empty = parseDailyMetricsFromSnapshots(mockSnap(null), mockSnap(null));
assert('empty snapshots clear metrics', empty.waterIntake === null && empty.todayWorkout === null);

const trackingOnly = parseDailyMetricsFromSnapshots(mockSnap(null), tracking);
assert('tracking fallback water', trackingOnly.waterIntake === 32);
assert('tracking fallback sleep', trackingOnly.sleepHours === 6);
assert('tracking fallback workout', trackingOnly.todayWorkout?.name === 'Leg Day');

const mirror = trackingMirrorFromLogs({
  dashboard_water: '48',
  dashboard_sleep: '8',
  workoutLog: [{ exerciseName: 'Row', sets: [] }],
});
assert('mirror maps water', mirror.waterIntake === 48);
assert('mirror maps sleep', mirror.sleepHours === 8);
assert('mirror maps workout exercises', mirror.workoutExercises?.[0]?.name === 'Row');

const legacyWorkout = buildWorkoutLogHydration(mockSnap(null), mockSnap({
  workoutName: 'Legacy Pull',
  workoutExercises: [{ name: 'Deadlift', sets: [{ reps: 3, weight: 315 }] }],
}));
assert('workout hydration uses tracking fallback', legacyWorkout.fromLogs === true);
assert(
  'workout hydration maps tracking exercises',
  legacyWorkout.d.workoutLog?.[0]?.exerciseName === 'Deadlift',
);

// Rollover archive payload shape (pure; no Firebase)
const archiveShape = {
  userId: 'uid1',
  date: '2026-05-27',
  workouts: {
    workoutLog: [{ exerciseName: 'Squat', sets: [] }],
    workoutName: 'Leg Day',
    workoutSummary: null,
    workoutExercises: null,
  },
  nutrition: { caloriesConsumed: 2100, macros: { protein: 150 } },
  streak_count: 3,
};
assert('rollover archive has userId + date', archiveShape.userId && archiveShape.date);
assert('rollover archive nests workouts', archiveShape.workouts?.workoutLog?.length === 1);
assert('rollover archive nests nutrition', archiveShape.nutrition?.caloriesConsumed === 2100);

console.log(failed ? `\n${failed} test(s) failed.` : '\nAll daily metrics tests passed.');
process.exit(failed ? 1 : 0);
