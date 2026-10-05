const { handleNutritionSearch } = require('../../../server/routes/nutritionSearchRoutes');
const { clearNutritionSearchCache } = require('../../../server/lib/nutritionMultiSourceSearch/nutritionSearchCache');
const { runScraperSafe } = require('../../../server/lib/nutritionMultiSourceSearch/scrapeNutritionSources');
const { SCRAPE_TIMEOUT_MS } = require('../../../server/lib/nutritionMultiSourceSearch/constants');

function mockMacros(overrides = {}) {
  return {
    calories: 110,
    protein_g: 2,
    carbs_g: 26,
    fat_g: 0,
    fiber_g: null,
    sodium_mg: 15,
    servingBasis: 'per_serving',
    ...overrides,
  };
}

function buildMockScrapers(profile) {
  const delay = profile.delayMs || 0;
  const make = (data) => async () => {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    return data;
  };

  return {
    fatSecret: make(profile.fatSecret ?? null),
    calorieKing: make(profile.calorieKing ?? null),
    fastFoodNutrition: make(profile.fastFoodNutrition ?? null),
    foodFacto: make(profile.foodFacto ?? null),
    openFoodFacts: make(profile.openFoodFacts ?? null),
    serper: make(profile.serper ?? null),
    usdaFdc: make(profile.usdaFdc ?? null),
  };
}

async function invokeSearch(body, deps = {}) {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const req = { body, ip: '127.0.0.1', headers: {} };
  const res = { status, json };
  await handleNutritionSearch(req, res, deps);
  return { status, json, body: json.mock.calls[0]?.[0] };
}

describe('POST /api/nutrition/search handler', () => {
  beforeEach(() => {
    clearNutritionSearchCache();
    jest.clearAllMocks();
  });

  it('"Tropicana OJ 8oz" returns ~110 cal consensus', async () => {
    const oj = mockMacros({ calories: 110, carbs_g: 26, protein_g: 2, fat_g: 0 });
    const scrapers = buildMockScrapers({
      fatSecret: oj,
      calorieKing: { ...oj, calories: 111 },
      openFoodFacts: { ...oj, calories: 109 },
      fastFoodNutrition: null,
      foodFacto: null,
      serper: null,
      usdaFdc: { ...oj, calories: 110, servingBasis: 'per_100g' },
    });

    const { status, body } = await invokeSearch(
      { foodName: 'Tropicana OJ 8oz' },
      { scrapers },
    );

    expect(status).not.toHaveBeenCalledWith(404);
    expect(status).not.toHaveBeenCalledWith(503);
    expect(body.consensus.calories.value).toBeGreaterThanOrEqual(109);
    expect(body.consensus.calories.value).toBeLessThanOrEqual(111);
    expect(body.sourceResults.length).toBeGreaterThanOrEqual(2);
    expect(body.sources_used.length).toBeGreaterThanOrEqual(2);
    expect(body.cacheHit).toBe(false);
    expect(body.timestamp).toBeTruthy();
  });

  it('"Chipotle Chicken Bowl" returns ~820 cal consensus', async () => {
    const bowl = mockMacros({
      calories: 820,
      protein_g: 42,
      carbs_g: 75,
      fat_g: 32,
      fiber_g: 10,
      sodium_mg: 1500,
    });
    const scrapers = buildMockScrapers({
      fatSecret: bowl,
      calorieKing: { ...bowl, calories: 815 },
      fastFoodNutrition: { ...bowl, calories: 825 },
      openFoodFacts: { ...bowl, calories: 818 },
      foodFacto: { ...bowl, calories: 822 },
      serper: null,
      usdaFdc: null,
    });

    const { body } = await invokeSearch(
      { foodName: 'Chipotle Chicken Bowl', restaurant: 'Chipotle' },
      { scrapers },
    );

    expect(body.consensus.calories.value).toBeGreaterThanOrEqual(815);
    expect(body.consensus.calories.value).toBeLessThanOrEqual(825);
    expect(body.query.restaurant).toBe('Chipotle');
    expect(body.sourceResults.length).toBeGreaterThanOrEqual(2);
  });

  it('"Large Egg" returns ~72-74 cal consensus', async () => {
    const egg = mockMacros({
      calories: 72,
      protein_g: 6,
      carbs_g: 0,
      fat_g: 5,
      fiber_g: 0,
      sodium_mg: 70,
    });
    const scrapers = buildMockScrapers({
      fatSecret: egg,
      calorieKing: { ...egg, calories: 74 },
      openFoodFacts: { ...egg, calories: 73 },
      fastFoodNutrition: null,
      foodFacto: null,
      serper: null,
      usdaFdc: { ...egg, calories: 72, servingBasis: 'per_100g' },
    });

    const { body } = await invokeSearch({ foodName: 'Large Egg' }, { scrapers });

    expect(body.consensus.calories.value).toBeGreaterThanOrEqual(72);
    expect(body.consensus.calories.value).toBeLessThanOrEqual(74);
  });

  it('returns source rows without consensus when only one inlier', async () => {
    const single = mockMacros({
      calories: 400,
      protein_g: 21,
      carbs_g: 45,
      fat_g: 15,
    });
    const scrapers = buildMockScrapers({
      fatSecret: single,
      calorieKing: null,
      fastFoodNutrition: null,
      openFoodFacts: null,
      foodFacto: null,
      serper: null,
      usdaFdc: null,
    });

    const { status, body } = await invokeSearch(
      { foodName: 'Jet\'s four corner slice', restaurant: "Jet's Pizza" },
      { scrapers },
    );

    expect(status).not.toHaveBeenCalledWith(404);
    expect(body.consensus).toEqual({});
    expect(body.sourceResults).toHaveLength(1);
    expect(body.sourceResults[0].calories).toBe(400);
  });

  it('non-existent food returns 404 when no validated sources', async () => {
    const scrapers = buildMockScrapers({
      fatSecret: null,
      calorieKing: null,
      fastFoodNutrition: null,
      openFoodFacts: null,
      foodFacto: null,
      serper: null,
      usdaFdc: null,
    });

    const { status, body } = await invokeSearch(
      { foodName: 'XyzNonexistentFood999' },
      { scrapers },
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(body.error).toMatch(/No nutrition data found/i);
    expect(body.sourceResults).toEqual([]);
  });

  it('returns 503 when all sources error out', async () => {
    const failing = async () => {
      throw new Error('upstream unavailable');
    };
    const scrapers = {
      fatSecret: failing,
      calorieKing: failing,
      fastFoodNutrition: failing,
      foodFacto: failing,
      openFoodFacts: failing,
      serper: failing,
      usdaFdc: failing,
    };

    const { status, body } = await invokeSearch({ foodName: 'Ghost Food' }, { scrapers });
    expect(status).toHaveBeenCalledWith(503);
    expect(body.error).toMatch(/failed/i);
  });

  it('timeout on one site still returns consensus when 3+ sources succeed', async () => {
    const slow = mockMacros({ calories: 110 });
    const scrapers = {
      fatSecret: async () => slow,
      calorieKing: async () => ({ ...slow, calories: 111 }),
      openFoodFacts: async () => ({ ...slow, calories: 109 }),
      fastFoodNutrition: () => new Promise(() => {}),
      foodFacto: async () => null,
      serper: async () => null,
      usdaFdc: async () => null,
    };

    const siteLogs = [];
    const query = 'Tropicana OJ 8oz';

    const results = await Promise.all([
      runScraperSafe('fatSecret', scrapers.fatSecret, query, SCRAPE_TIMEOUT_MS, siteLogs),
      runScraperSafe('calorieKing', scrapers.calorieKing, query, SCRAPE_TIMEOUT_MS, siteLogs),
      runScraperSafe('openFoodFacts', scrapers.openFoodFacts, query, SCRAPE_TIMEOUT_MS, siteLogs),
      runScraperSafe(
        'fastFoodNutrition',
        scrapers.fastFoodNutrition,
        query,
        SCRAPE_TIMEOUT_MS,
        siteLogs,
      ),
    ]);

    const successCount = results.filter(Boolean).length;
    expect(successCount).toBeGreaterThanOrEqual(2);

    const failed = siteLogs.find((l) => l.source === 'FastFoodNutrition');
    expect(failed?.ok).toBe(false);

    const { body } = await invokeSearch(
      { foodName: 'Tropicana OJ 8oz' },
      { scrapers, timeoutMs: SCRAPE_TIMEOUT_MS },
    );

    expect(body.consensus.calories.value).toBeGreaterThanOrEqual(109);
    expect(body.sources_used.length).toBeGreaterThanOrEqual(2);
  });

  it('lists excluded outlier sources', async () => {
    const nuggetMacros = {
      calories: 830,
      protein_g: 46,
      carbs_g: 51,
      fat_g: 49,
      fiber_g: 2,
      sodium_mg: 1700,
      servingBasis: 'per_serving',
    };
    const scrapers = buildMockScrapers({
      fatSecret: mockMacros(nuggetMacros),
      fastFoodNutrition: mockMacros({ ...nuggetMacros, calories: 890 }),
      calorieKing: mockMacros({ ...nuggetMacros, calories: 600 }),
      openFoodFacts: null,
      foodFacto: mockMacros(nuggetMacros),
      serper: mockMacros({ ...nuggetMacros, calories: 1200 }),
      usdaFdc: null,
    });

    const { body } = await invokeSearch(
      { foodName: '20 piece chicken mcnuggets', restaurant: "McDonald's" },
      { scrapers },
    );

    expect(body.excludedSources.some((e) => e.reason === 'outlier')).toBe(true);
    expect(body.sourceResults.length).toBeGreaterThanOrEqual(2);
  });

  it('serves cached response on repeat query', async () => {
    const scrapers = buildMockScrapers({
      fatSecret: mockMacros(),
      calorieKing: mockMacros({ calories: 111 }),
      openFoodFacts: mockMacros({ calories: 109 }),
    });

    const deps = { scrapers };
    await invokeSearch({ foodName: 'Cached Food' }, deps);
    const second = await invokeSearch({ foodName: 'Cached Food' }, deps);

    expect(second.body.cacheHit).toBe(true);
    expect(second.body.consensus.calories).toBeTruthy();
    expect(Array.isArray(second.body.sourceResults)).toBe(true);
  });
});
