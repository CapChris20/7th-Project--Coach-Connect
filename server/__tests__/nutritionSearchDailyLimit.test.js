jest.mock('firebase-admin', () => {
  const stores = new Map();

  const makeDocRef = (path) => ({
    path,
    get: jest.fn(async () => {
      const data = stores.get(path);
      return {
        exists: data != null,
        data: () => data,
      };
    }),
    set: jest.fn(async (data, opts) => {
      const prev = stores.get(path) || {};
      stores.set(path, opts?.merge ? { ...prev, ...data } : data);
    }),
  });

  const firestoreFn = jest.fn(() => ({
    collection: jest.fn((name) => ({
      doc: jest.fn((id) => {
        const base = `${name}/${id}`;
        return {
          ...makeDocRef(base),
          collection: jest.fn((sub) => ({
            doc: jest.fn((subId) => makeDocRef(`${base}/${sub}/${subId}`)),
          })),
        };
      }),
    })),
    runTransaction: jest.fn(async (fn) => {
      const tx = {
        get: jest.fn(async (ref) => ref.get()),
        set: jest.fn(async (ref, data, opts) => ref.set(data, opts)),
      };
      return fn(tx);
    }),
  }));

  firestoreFn.FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TS'),
  };

  return {
    apps: [{ name: 'test' }],
    firestore: firestoreFn,
    __stores: stores,
  };
});

const admin = require('firebase-admin');
const {
  enforceNutritionSearchDailyLimit,
  NUTRITION_SEARCH_DAILY_LIMIT,
} = require('../lib/nutritionSearchDailyLimit');

describe('nutrition search daily limit', () => {
  beforeEach(() => {
    admin.__stores.clear();
    jest.clearAllMocks();
  });

  test('allows searches under daily limit', async () => {
    const result = await enforceNutritionSearchDailyLimit('user123', 3);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.count).toBe(1);
  });

  test('blocks at daily limit with 429 semantics', async () => {
    const uid = 'user-limit';
    const limit = 2;
    await enforceNutritionSearchDailyLimit(uid, limit);
    await enforceNutritionSearchDailyLimit(uid, limit);
    const blocked = await enforceNutritionSearchDailyLimit(uid, limit);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.limit).toBe(limit);
  });

  test('default limit is 500/day', () => {
    expect(NUTRITION_SEARCH_DAILY_LIMIT).toBe(500);
  });
});
