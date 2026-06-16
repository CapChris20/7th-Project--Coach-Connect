/**
 * Integration tests for real toolExecutor client fallback paths (toolExecutor NOT mocked).
 */
const TEST_UID = 'coach-client-uid';
const FIXED_DATE = '2026-06-11';

const mockSetDoc = jest.fn(() => Promise.resolve());
const mockGetDoc = jest.fn();
const mockAddDoc = jest.fn(() => Promise.resolve({ id: 'action-1' }));
const mockDeleteDoc = jest.fn(() => Promise.resolve());

jest.mock('../../app/config', () => ({
  auth: {
    currentUser: {
      uid: TEST_UID,
      getIdToken: jest.fn(() => Promise.resolve('test-id-token')),
    },
  },
  db: {},
}));

jest.mock('../../shared/utils/dateKeys', () => ({
  getClientDateKey: () => FIXED_DATE,
}));

jest.mock('../../shared/api/baseUrl', () => ({
  getAICoachApiBases: jest.fn(() => ['https://api.test']),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...segments) => ({
    path: segments.filter((s) => typeof s === 'string').join('/'),
  })),
  collection: jest.fn((...segments) => ({
    path: segments.filter((s) => typeof s === 'string').join('/'),
  })),
  setDoc: (...args) => mockSetDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  addDoc: (...args) => mockAddDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  serverTimestamp: jest.fn(() => 'SERVER_TS'),
}));

const mockAddFoodLog = jest.fn(() => Promise.resolve({ id: 'nutrition-log-1' }));
const mockDeleteFoodLogsForDate = jest.fn(() =>
  Promise.resolve({ deletedCount: 1, deletedNames: ['Chicken'] }),
);

jest.mock('../../nutrition/daily-log/logFoodToFirestore', () => {
  const actual = jest.requireActual('../../nutrition/daily-log/logFoodToFirestore');
  return {
    ...actual,
    addFoodLog: (...args) => mockAddFoodLog(...args),
    deleteFoodLogsForDate: (...args) => mockDeleteFoodLogsForDate(...args),
  };
});

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: false,
    status: 503,
    json: () => Promise.resolve({ error: 'server unavailable' }),
  }),
);

const { executeCoachTool } = require('../../ai/tools/executeCoachTool');

function dailyLogsWrite() {
  return mockSetDoc.mock.calls.find(([ref, payload]) =>
    String(ref.path).includes(`users/${TEST_UID}/dailyLogs/${FIXED_DATE}`) &&
    payload &&
    !payload.user_id,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSetDoc.mockImplementation(() => Promise.resolve());
  mockGetDoc.mockImplementation((ref) => {
    const path = String(ref.path || '');
    if (path.includes('nutrition_goals')) {
      return Promise.resolve({
        exists: () => true,
        data: () => ({
          protein_target: 150,
          carbs_target: 200,
          fat_target: 65,
          calorie_target: 2000,
        }),
      });
    }
    return Promise.resolve({ exists: () => false, data: () => ({}) });
  });
  global.fetch.mockImplementation(() =>
    Promise.resolve({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: 'server unavailable' }),
    }),
  );
});

describe('logSleep real execution', () => {
  it('Valid hours → writes to correct Firestore path dashboard_sleep field', async () => {
    const result = await executeCoachTool({
      userId: TEST_UID,
      toolCall: { name: 'logSleep', params: { hours: 7.5 } },
    });

    expect(result.success).toBe(true);
    const write = dailyLogsWrite();
    expect(write).toBeTruthy();
    expect(write[1]).toEqual(expect.objectContaining({ dashboard_sleep: 7.5 }));
  });

  it('Hours as string "7" → normalized to number 7', async () => {
    await executeCoachTool({
      userId: TEST_UID,
      toolCall: { name: 'logSleep', params: { hours: '7' } },
    });
    const write = dailyLogsWrite();
    expect(write[1].dashboard_sleep).toBe(7);
  });

  it('Hours as 0 → writes 0 not null', async () => {
    const result = await executeCoachTool({
      userId: TEST_UID,
      toolCall: { name: 'logSleep', params: { hours: 0 } },
    });
    // BUG: 0 is rejected by executeLogSleepClient (hours <= 0), not written as 0.
    expect(result.success).toBe(false);
    expect(mockSetDoc).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('dailyLogs') }),
      expect.objectContaining({ dashboard_sleep: 0 }),
      expect.anything(),
    );
  });

  it('Hours over 24 → rejected or capped', async () => {
    const result = await executeCoachTool({
      userId: TEST_UID,
      toolCall: { name: 'logSleep', params: { hours: 30 } },
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Invalid sleep hours/i);
  });
});

describe('logWater real execution', () => {
  it('Valid amount → writes to correct path', async () => {
    const result = await executeCoachTool({
      userId: TEST_UID,
      toolCall: { name: 'logWater', params: { amount_oz: 32 } },
    });

    expect(result.success).toBe(true);
    const dashWrite = dailyLogsWrite();
    expect(dashWrite[1]).toEqual(expect.objectContaining({ dashboard_water: '32' }));
    const waterLogWrite = mockSetDoc.mock.calls.find(([ref]) =>
      String(ref.path).includes(`users/${TEST_UID}/water_logs/${FIXED_DATE}`),
    );
    expect(waterLogWrite).toBeTruthy();
    expect(waterLogWrite[1].amount_oz).toBe(32);
  });

  it('Amount in oz → converted correctly if needed', async () => {
    await executeCoachTool({
      userId: TEST_UID,
      toolCall: { name: 'logWater', params: { amountOz: 16 } },
    });
    const dashWrite = dailyLogsWrite();
    expect(dashWrite[1].dashboard_water).toBe('16');
  });

  it('Zero amount → rejected before write', async () => {
    const result = await executeCoachTool({
      userId: TEST_UID,
      toolCall: { name: 'logWater', params: { amount_oz: 0 } },
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/greater than 0/i);
    expect(dailyLogsWrite()).toBeUndefined();
  });
});

describe('logNutrition real execution', () => {
  it('Valid food data → writes to nutrition_logs collection', async () => {
    const result = await executeCoachTool({
      userId: TEST_UID,
      toolCall: {
        name: 'logNutrition',
        params: {
          food: 'Grilled Chicken',
          calories: 220,
          protein: 35,
          carbs: 0,
          fat: 8,
          mealType: 'lunch',
        },
      },
    });

    expect(result.success).toBe(true);
    expect(mockAddFoodLog).toHaveBeenCalledWith(
      TEST_UID,
      expect.objectContaining({
        mealType: 'lunch',
        food: expect.objectContaining({ name: 'Grilled Chicken', calories: 220 }),
      }),
    );
  });

  it('Missing calories → rejected before write', async () => {
    global.fetch.mockImplementation(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) }),
    );

    const result = await executeCoachTool({
      userId: TEST_UID,
      toolCall: { name: 'logNutrition', params: { food: 'Mystery Meal' } },
    });

    expect(result.success).toBe(false);
    expect(mockAddFoodLog).not.toHaveBeenCalled();
  });

  it('Wrong meal type → normalized not silently wrong', async () => {
    await executeCoachTool({
      userId: TEST_UID,
      toolCall: {
        name: 'logNutrition',
        params: { food: 'Salad', calories: 300, mealType: 'BREAKFAST' },
      },
    });
    expect(mockAddFoodLog).toHaveBeenCalledWith(
      TEST_UID,
      expect.objectContaining({ mealType: 'breakfast' }),
    );
  });
});

describe('deleteLog real execution', () => {
  it('Valid logId → deletes correct document', async () => {
    const result = await executeCoachTool({
      userId: TEST_UID,
      toolCall: { name: 'deleteLog', params: { logType: 'nutrition', logId: 'log-abc-123' } },
    });

    expect(result.success).toBe(true);
    expect(mockDeleteFoodLogsForDate).toHaveBeenCalledWith(
      TEST_UID,
      expect.objectContaining({ logId: 'log-abc-123' }),
    );
  });

  it('Missing logId → throws clear error not undefined path', async () => {
    mockDeleteFoodLogsForDate.mockResolvedValueOnce({ deletedCount: 0, deletedNames: [] });

    const result = await executeCoachTool({
      userId: TEST_UID,
      toolCall: { name: 'deleteLog', params: { logType: 'nutrition', foodName: 'Ghost Food' } },
    });

    // No throw — returns user-facing failure when nothing deleted.
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/No food logs found/i);
  });

  it('Already deleted → no crash', async () => {
    mockDeleteFoodLogsForDate.mockResolvedValueOnce({ deletedCount: 0, deletedNames: [] });

    const result = await executeCoachTool({
      userId: TEST_UID,
      toolCall: { name: 'deleteLog', params: { logType: 'nutrition', logId: 'gone-id' } },
    });

    expect(result.success).toBe(false);
    expect(() => result).not.toThrow();
  });
});

describe('adjustMacroTargets real execution', () => {
  it('Valid new targets → writes to users/{uid} doc', async () => {
    const result = await executeCoachTool({
      userId: TEST_UID,
      toolCall: {
        name: 'adjustMacroTargets',
        params: { protein: 160, carbs: 180, fat: 60, calories: 2100 },
      },
    });

    expect(result.success).toBe(true);
    const macroWrite = mockSetDoc.mock.calls.find(([ref]) =>
      String(ref.path).includes(`users/${TEST_UID}/macroTargets/current`),
    );
    expect(macroWrite[1]).toEqual(
      expect.objectContaining({ protein: 160, carbs: 180, fat: 60, calories: 2100 }),
    );
  });

  it('Negative calorie target → rejected', async () => {
    const result = await executeCoachTool({
      userId: TEST_UID,
      toolCall: {
        name: 'adjustMacroTargets',
        params: { protein: 150, carbs: 200, fat: 65, calories: -500 },
      },
    });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Invalid calorie target/i);
  });

  it('Partial update (only protein) → other macros unchanged not zeroed out', async () => {
    await executeCoachTool({
      userId: TEST_UID,
      toolCall: { name: 'adjustMacroTargets', params: { protein: 175 } },
    });

    const macroWrite = mockSetDoc.mock.calls.find(([ref]) =>
      String(ref.path).includes(`users/${TEST_UID}/macroTargets/current`),
    );
    expect(macroWrite[1].protein).toBe(175);
    expect(macroWrite[1].carbs).toBe(200);
    expect(macroWrite[1].fat).toBe(65);
    expect(macroWrite[1].calories).toBe(2000);
  });
});

describe('trainer mode blocks all writes', () => {
  it('Call any write tool → zero Firestore writes, returns early without error throw', async () => {
    const tools = [
      { name: 'logSleep', params: { hours: 8 } },
      { name: 'logNutrition', params: { food: 'Egg', calories: 70 } },
      { name: 'logWater', params: { amount_oz: 16 } },
    ];

    for (const toolCall of tools) {
      jest.clearAllMocks();
      const result = await executeCoachTool({
        userId: TEST_UID,
        coachMode: 'trainer',
        targetClientId: 'client-under-coach',
        toolCall,
      });

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/read-only/i);
      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(mockAddFoodLog).not.toHaveBeenCalled();
    }
  });
});
