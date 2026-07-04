/**
 * Food search → log flow (logFoodToFirestore + searchFoodsService).
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../shared/api/baseUrl', () => ({
  getResilientApiBases: jest.fn(() => ['https://api.test']),
  getApiBaseCandidates: jest.fn(() => ['https://api.test']),
}));

jest.mock('../../shared/api/getAuthHeaders', () => ({
  getApiAuthHeaders: jest.fn(() =>
    Promise.resolve({
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    }),
  ),
}));

jest.mock('../../shared/api/logErrorToServer', () => ({
  __esModule: true,
  default: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('../../app-start/config', () => ({
  db: {},
}));

jest.mock('../../utils/autoLogError', () => ({
  autoLogErrorSync: jest.fn(),
}));

const mockAddDoc = jest.fn(() => Promise.resolve({ id: 'log-doc-1' }));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'nutrition_logs'),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: (...args) => mockAddDoc(...args),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
  limit: jest.fn(),
}));

const AsyncStorage = require('@react-native-async-storage/async-storage');
const searchFoodsService = require('../../nutrition/food-search/searchFoodsService').default;
const { searchFoods, addFoodLog } = require('../../nutrition/daily-log/logFoodToFirestore');

const SERVER_SEARCH = 'https://api.test/api/food/search';
const NUTRITION_SEARCH = 'https://api.test/api/nutrition/search';
const OFF_SEARCH = 'https://search.openfoodfacts.org/search';

function nutritionSearchEmpty() {
  return {
    match: (url, init) =>
      url.startsWith(NUTRITION_SEARCH) && String(init?.method || 'GET').toUpperCase() === 'POST',
    handler: () => jsonResponse({ error: 'No nutrition data found for this food' }, 404),
  };
}

function makeServerFood(id, name, macros = {}) {
  return {
    id,
    name,
    calories: macros.calories ?? 100,
    protein: macros.protein ?? 10,
    carbs: macros.carbs ?? 12,
    fat: macros.fat ?? 5,
    servingSize: 1,
    servingUnit: 'serving',
    servingGrams: 100,
    source: 'server',
  };
}

function offHitsResponse(products) {
  return {
    hits: products.map((p, i) => ({
      code: p.code || `off_${i}`,
      product_name: p.name,
      brands: p.brand || 'Brand',
      nutriments: {
        'energy-kcal_100g': p.calories ?? 200,
        proteins_100g: p.protein ?? 8,
        carbohydrates_100g: p.carbs ?? 20,
        fat_100g: p.fat ?? 9,
      },
    })),
  };
}

function mockFetchRouter(handlers) {
  global.fetch = jest.fn(async (url, init = {}) => {
    const href = String(url);
    for (const { match, handler } of handlers) {
      if (match(href, init)) return handler(href, init);
    }
    throw new Error(`Unhandled fetch: ${href}`);
  });
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  searchFoodsService.clearAllCaches();
  AsyncStorage.getItem.mockResolvedValue(null);
});

describe('Food search → results', () => {
  it('returns 3 structured results from a successful server search', async () => {
    const serverResults = [
      makeServerFood('bm-1', 'Big Mac', { calories: 550, protein: 26, carbs: 45, fat: 30 }),
      makeServerFood('bm-2', 'Big Mac Meal', { calories: 920, protein: 32, carbs: 98, fat: 44 }),
      makeServerFood('bm-3', 'Big Mac Sauce', { calories: 90, protein: 0, carbs: 4, fat: 9 }),
    ];

    mockFetchRouter([
      nutritionSearchEmpty(),
      {
        match: (url) => url.startsWith(SERVER_SEARCH),
        handler: () => jsonResponse({ results: serverResults }),
      },
    ]);

    const results = await searchFoods('big mac', 20);

    expect(results).toHaveLength(3);
    results.forEach((row) => {
      expect(row).toEqual(
        expect.objectContaining({
          name: expect.any(String),
          calories: expect.any(Number),
          protein: expect.any(Number),
          carbs: expect.any(Number),
          fat: expect.any(Number),
        }),
      );
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls.some(([url]) => String(url).includes('query=big%20mac'))).toBe(true);
  });

  it('uses in-memory cache on the second identical search (server called once)', async () => {
    const serverResults = [makeServerFood('cache-1', 'Big Mac')];

    mockFetchRouter([
      nutritionSearchEmpty(),
      {
        match: (url) => url.startsWith(SERVER_SEARCH),
        handler: () => jsonResponse({ results: serverResults }),
      },
    ]);

    const first = await searchFoods('big mac', 20);
    const second = await searchFoods('big mac', 20);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('falls back to Open Food Facts when the server is unreachable', async () => {
    mockFetchRouter([
      nutritionSearchEmpty(),
      {
        match: (url) => url.startsWith(SERVER_SEARCH),
        handler: () => {
          throw new TypeError('Network request failed');
        },
      },
      {
        match: (url) => url.includes('openfoodfacts.org'),
        handler: () =>
          jsonResponse(
            offHitsResponse([
              { name: 'Greek Yogurt Plain', calories: 100, protein: 17, carbs: 6, fat: 0 },
              { name: 'Greek Yogurt Vanilla', calories: 120, protein: 15, carbs: 10, fat: 3 },
            ]),
          ),
      },
    ]);

    const results = await searchFoods('greek yogurt', 20);

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        calories: expect.any(Number),
        protein: expect.any(Number),
        carbs: expect.any(Number),
        fat: expect.any(Number),
      }),
    );
    expect(global.fetch.mock.calls.some(([url]) => String(url).includes('openfoodfacts.org'))).toBe(
      true,
    );
  });

  it('returns an empty array (not null) when the server has no matches', async () => {
    mockFetchRouter([
      nutritionSearchEmpty(),
      {
        match: (url) => url.startsWith(SERVER_SEARCH),
        handler: () => jsonResponse({ results: [] }),
      },
      {
        match: (url) => url.startsWith(OFF_SEARCH),
        handler: () => jsonResponse({ hits: [] }),
      },
      {
        match: (url) => url.includes('openfoodfacts.org/cgi/search.pl'),
        handler: () => jsonResponse({ products: [] }),
      },
    ]);

    const results = await searchFoods('zzzz-nonexistent-food-xyz', 20);

    expect(results).toEqual([]);
    expect(results).not.toBeNull();
  });
});

describe('Food log → Firestore write', () => {
  const userId = 'user-food-1';
  const foodItem = {
    name: 'Grilled Chicken',
    calories: 220,
    protein: 42,
    carbs: 0,
    fat: 5,
    servingSize: 1,
    servingGrams: 150,
    source: 'manual',
  };

  it('writes a nutrition log with date, meal_type, macros, and user_id', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'saved-log-99' });

    await addFoodLog(userId, {
      date: '2026-06-11',
      mealType: 'lunch',
      food: foodItem,
    });

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const payload = mockAddDoc.mock.calls[0][1];

    expect(payload).toEqual(
      expect.objectContaining({
        user_id: userId,
        date: '2026-06-11',
        meal_type: 'lunch',
        calories: 220,
        protein: 42,
        carbs: 0,
        fat: 5,
        food_name: 'Grilled Chicken',
      }),
    );
    expect(payload.created_at).toBe('SERVER_TIMESTAMP');
  });

  it('throws on malformed date strings instead of writing NaN-NaN-NaN', async () => {
    await expect(
      addFoodLog(userId, {
        date: 'not-a-date',
        mealType: 'breakfast',
        food: foodItem,
      }),
    ).rejects.toThrow(/Invalid date passed to food log/);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});
