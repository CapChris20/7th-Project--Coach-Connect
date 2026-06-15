const {
  parseDailyMetricsFromSnapshots,
  trackingMirrorFromLogs,
  buildWorkoutLogHydration,
} = require('../../shared/daily-metrics/dailyMetricsParse.cjs');

function mockSnap(data) {
  if (data == null) return { exists: () => false, data: () => ({}) };
  return { exists: () => true, data: () => data };
}

describe('parseDailyMetricsFromSnapshots', () => {
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

  it('prefers dailyLogs water over tracking', () => {
    expect(parsed.waterIntake).toBe(64);
  });

  it('prefers dailyLogs sleep over tracking', () => {
    expect(parsed.sleepHours).toBe(7.5);
  });

  it('reads soreness from logs', () => {
    expect(parsed.soreness).toBe('3');
  });

  it('reads energy from logs', () => {
    expect(parsed.energyLevel).toBe('8');
  });

  it('reads workout name from logs', () => {
    expect(parsed.todayWorkout?.name).toBe('Push Day');
  });

  it('maps workoutLog exercises', () => {
    expect(parsed.todayWorkout?.exercises?.[0]?.name).toBe('Bench');
  });

  it('empty snapshots clear metrics', () => {
    const empty = parseDailyMetricsFromSnapshots(mockSnap(null), mockSnap(null));
    expect(empty.waterIntake).toBeNull();
    expect(empty.todayWorkout).toBeNull();
  });

  it('tracking fallback water', () => {
    const trackingOnly = parseDailyMetricsFromSnapshots(mockSnap(null), tracking);
    expect(trackingOnly.waterIntake).toBe(32);
  });

  it('tracking fallback sleep', () => {
    const trackingOnly = parseDailyMetricsFromSnapshots(mockSnap(null), tracking);
    expect(trackingOnly.sleepHours).toBe(6);
  });

  it('tracking fallback workout', () => {
    const trackingOnly = parseDailyMetricsFromSnapshots(mockSnap(null), tracking);
    expect(trackingOnly.todayWorkout?.name).toBe('Leg Day');
  });
});

describe('trackingMirrorFromLogs', () => {
  const mirror = trackingMirrorFromLogs({
    dashboard_water: '48',
    dashboard_sleep: '8',
    workoutLog: [{ exerciseName: 'Row', sets: [] }],
  });

  it('mirror maps water', () => {
    expect(mirror.waterIntake).toBe(48);
  });

  it('mirror maps sleep', () => {
    expect(mirror.sleepHours).toBe(8);
  });

  it('mirror maps workout exercises', () => {
    expect(mirror.workoutExercises?.[0]?.name).toBe('Row');
  });
});

describe('buildWorkoutLogHydration', () => {
  const legacyWorkout = buildWorkoutLogHydration(
    mockSnap(null),
    mockSnap({
      workoutName: 'Legacy Pull',
      workoutExercises: [{ name: 'Deadlift', sets: [{ reps: 3, weight: 315 }] }],
    }),
  );

  it('workout hydration uses tracking fallback', () => {
    expect(legacyWorkout.fromLogs).toBe(true);
  });

  it('workout hydration maps tracking exercises', () => {
    expect(legacyWorkout.d.workoutLog?.[0]?.exerciseName).toBe('Deadlift');
  });
});

describe('rollover archive payload shape', () => {
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

  it('rollover archive has userId + date', () => {
    expect(archiveShape.userId).toBeTruthy();
    expect(archiveShape.date).toBeTruthy();
  });

  it('rollover archive nests workouts', () => {
    expect(archiveShape.workouts?.workoutLog?.length).toBe(1);
  });

  it('rollover archive nests nutrition', () => {
    expect(archiveShape.nutrition?.caloriesConsumed).toBe(2100);
  });
});
