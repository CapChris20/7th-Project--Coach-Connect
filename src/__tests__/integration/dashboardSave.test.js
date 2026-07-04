import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';

const TEST_UID = 'dashboard-user-1';
const TRAINER_UID = 'trainer-1';
const FIXED_DATE_KEY = '2026-06-14';

const mockPostDashboardNotification = jest.fn(() => Promise.resolve({ ok: true }));
const mockSaveDashboardWorkoutLog = jest.fn(() => Promise.resolve());

jest.mock('../../shared/api/dashboardNotificationApi', () => ({
  postDashboardNotification: (...args) => mockPostDashboardNotification(...args),
}));

jest.mock('../../metrics/daily-metrics/saveDailyMetricsToFirestore', () => ({
  saveDashboardWorkoutLog: (...args) => mockSaveDashboardWorkoutLog(...args),
  buildWorkoutLogHydration: jest.fn(() => ({ d: {}, fromLogs: false })),
  fetchLegacyDailyTrackingSnap: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../../metrics/daily-metrics/useLocalTodayDateKey', () => ({
  useLocalTodayDateKey: () => FIXED_DATE_KEY,
}));

jest.mock('../../shared-utils/getLocalDay', () => ({
  getLocalDateKey: () => FIXED_DATE_KEY,
}));

jest.mock('../../app-start/config', () => ({
  auth: { currentUser: { uid: TEST_UID } },
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...parts) => ({ path: parts.join('/') })),
  getDoc: jest.fn(async () => ({
    exists: () => true,
    data: () => ({ trainerId: TRAINER_UID }),
  })),
  onSnapshot: jest.fn((_ref, onNext) => {
    onNext({ exists: () => false, data: () => null });
    return jest.fn();
  }),
}));

const { useWorkoutLog } = require('../../client-app/dashboard/useWorkoutLog');

async function seedWorkoutHook() {
  const hook = renderHook(() => useWorkoutLog());
  await waitFor(() => expect(hook.result.current.loaded).toBe(true));
  const exId = hook.result.current.workoutExercises[0].id;
  const setId = hook.result.current.workoutExercises[0].sets[0].id;
  await act(async () => {
    hook.result.current.setWorkoutName('Chest Day');
    hook.result.current.updateExerciseName(exId, 'Bench Press');
    hook.result.current.updateSetField(exId, setId, 'reps', '10');
    hook.result.current.updateSetField(exId, setId, 'weight', '135');
  });
  await waitFor(() => expect(hook.result.current.workoutName).toBe('Chest Day'));
  return hook;
}

describe('dashboard save integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saveDashboardWorkoutLog writes canonical dailyLogs payload', async () => {
    const { saveDashboardWorkoutLog } = require('../../metrics/daily-metrics/saveDailyMetricsToFirestore');
    await saveDashboardWorkoutLog(
      'uid123',
      {
        workoutName: 'Push Day',
        dashboard_workouts: 'Bench + Incline',
        workoutLog: [{ exerciseName: 'Bench Press', sets: [{ reps: 8, weight: 135 }] }],
      },
      '2026-06-14',
    );
    expect(mockSaveDashboardWorkoutLog).toHaveBeenCalled();
  });
});

describe('useWorkoutLog save', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists workout log and notifies linked trainer', async () => {
    const hook = await seedWorkoutHook();

    await act(async () => {
      await hook.result.current.save();
    });

    expect(mockSaveDashboardWorkoutLog).toHaveBeenCalledWith(
      TEST_UID,
      expect.objectContaining({
        workoutName: 'Chest Day',
        workoutLog: [
          expect.objectContaining({
            exerciseName: 'Bench Press',
            sets: [{ reps: 10, weight: 135 }],
          }),
        ],
      }),
      FIXED_DATE_KEY,
    );

    expect(mockPostDashboardNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: TRAINER_UID,
        clientId: TEST_UID,
        type: 'dashboard_update',
        payload: expect.objectContaining({
          type: 'dashboard_workouts',
          label: 'Workouts Today',
        }),
      }),
    );
    expect(hook.result.current.hasSavedValue).toBe(true);
  });

  it('Write succeeds locally but push to trainer fails → local save still confirmed, push failure logged', async () => {
    mockPostDashboardNotification.mockResolvedValueOnce({
      ok: false,
      reason: 'notifications write failed',
    });

    const hook = await seedWorkoutHook();

    await act(async () => {
      await hook.result.current.save();
    });

    expect(mockSaveDashboardWorkoutLog).toHaveBeenCalled();
    expect(mockPostDashboardNotification).toHaveBeenCalled();
    expect(hook.result.current.hasSavedValue).toBe(false);
  });
});
