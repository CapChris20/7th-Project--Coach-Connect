const mockSetDoc = jest.fn(() => Promise.resolve());
const mockGetDoc = jest.fn(() => Promise.resolve({ exists: () => false }));
const mockDeleteDoc = jest.fn(() => Promise.resolve());
const mockDoc = jest.fn((...parts) => ({ parts }));
const mockServerTimestamp = jest.fn(() => 'ts');
const mockDeleteField = jest.fn(() => '__delete__');

jest.mock('firebase/firestore', () => ({
  setDoc: (...args) => mockSetDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  doc: (...args) => mockDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
  deleteField: () => mockDeleteField(),
}));

jest.mock('../../app-start/config', () => ({
  db: {},
}));

describe('dailyMetricsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('saves a dashboard metric field', async () => {
    const { saveDashboardMetricField } = require('../../metrics/daily-metrics/saveDailyMetricsToFirestore');
    await saveDashboardMetricField('uid1', 'dashboard_sleep', '7.5', '2026-06-14');
    expect(mockSetDoc).toHaveBeenCalled();
  });

  test('clears known log type and subcollection doc', async () => {
    const { clearClientDailyMetric } = require('../../metrics/daily-metrics/saveDailyMetricsToFirestore');
    await clearClientDailyMetric('uid1', 'sleep', '2026-06-14');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
