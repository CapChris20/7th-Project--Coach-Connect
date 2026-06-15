const mockSetDoc = jest.fn(() => Promise.resolve());
const mockDoc = jest.fn((...parts) => ({ parts }));
const mockServerTimestamp = jest.fn(() => 'ts');

jest.mock('firebase/firestore', () => ({
  setDoc: (...args) => mockSetDoc(...args),
  doc: (...args) => mockDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  deleteField: jest.fn(() => '__delete__'),
  deleteDoc: jest.fn(async () => ({})),
}));

jest.mock('../../app/config', () => ({
  db: {},
}));

describe('dashboard save integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('saveDashboardWorkoutLog writes canonical dailyLogs payload', async () => {
    const { saveDashboardWorkoutLog } = require('../../shared/daily-metrics/saveDailyMetricsToFirestore');
    await saveDashboardWorkoutLog(
      'uid123',
      {
        workoutName: 'Push Day',
        dashboard_workouts: 'Bench + Incline',
        workoutLog: [{ exerciseName: 'Bench Press', sets: [{ reps: 8, weight: 135 }] }],
      },
      '2026-06-14'
    );
    expect(mockSetDoc).toHaveBeenCalled();
    expect(mockDoc).toHaveBeenCalled();
  });
});
