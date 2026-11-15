const { buildQueryFrame, setTokenStatsForTests } = require('../../src/nutrition/food-match/queryFrame');
const { editDistance } = require('../../src/nutrition/food-match/fuzzyToken');
const { createCandidate } = require('../../src/nutrition/food-match/candidate');
const { runGates } = require('../../src/nutrition/food-match/gates');
const { matchCandidatesV2 } = require('../../src/nutrition/food-match/matchFoodsV2');
const { FEATURE_WEIGHTS } = require('../../src/nutrition/food-match/config/weights');
const { shadowEnabled, buildShadowRankV2 } = require('../../src/nutrition/food-match/shadowRankV2');

const TEST_STATS = {
  documentCount: 100,
  unknownDf: 0,
  tokenDf: {
    coconut: 20,
    water: 40,
    oat: 10,
    crunch: 5,
    cooked: 15,
    grain: 12,
    soup: 8,
    cracker: 6,
    plain: 25,
  },
  brands: ['vita coco', 'acme foods'],
  categoryKcalBands: {
    'en:coconut-waters': { p05: 10, p50: 20, p95: 40, n: 10 },
    'en:cereals': { p05: 300, p50: 380, p95: 450, n: 10 },
  },
};

describe('food-match v2 core', () => {
  beforeAll(() => {
    setTokenStatsForTests(TEST_STATS);
  });

  afterAll(() => {
    setTokenStatsForTests(null);
  });

  test('source-tier feature weight stays at most about 10% of the weight mass', () => {
    const total = Object.values(FEATURE_WEIGHTS).reduce((sum, value) => sum + value, 0);
    expect(FEATURE_WEIGHTS.sourceTier / total).toBeLessThanOrEqual(0.11);
  });

  test('queryFrame attaches IDF and marks unknown tokens rare', () => {
    const frame = buildQueryFrame('coconut water qqqxqj');
    expect(frame.tokenStrings).toEqual(['coconut', 'water', 'qqqxqj']);
    const rare = frame.tokens.find((info) => info.token === 'qqqxqj');
    expect(rare.rare).toBe(true);
  });

  test('editDistance is deterministic', () => {
    expect(editDistance('coconut', 'cocnut')).toBe(1);
    expect(editDistance('coconut', 'coconut')).toBe(0);
  });

  test('unexplained rare token rejects via gates (never confident)', () => {
    const candidate = createCandidate({
      id: 'c1',
      source: 'openFoodFacts',
      name: 'Coconut Water',
      brand: 'Vita Coco',
      channel: 'packaged',
      categoryPath: ['en:coconut-waters'],
      per100: { kcal: 19, protein: 0, carbs: 4, fat: 0, basis: 'g' },
    });
    const decision = matchCandidatesV2('coconut water qqqxqj', [candidate]);
    expect(decision.status).not.toBe('confident');
  });

  test('all-zero non-beverage is rejected', () => {
    const candidate = createCandidate({
      id: 'zero',
      source: 'usdaFdc',
      name: 'cooked grain',
      brand: '',
      channel: 'generic',
      categoryPath: ['en:cereals'],
      per100: { kcal: 0, protein: 0, carbs: 0, fat: 0, basis: 'g' },
    });
    const frame = buildQueryFrame('cooked grain');
    const gate = runGates(frame, candidate);
    expect(gate.pass).toBe(false);
    expect(gate.reasons.some((reason) => reason.includes('all_zero'))).toBe(true);
  });

  test('atwater violation is rejected', () => {
    const candidate = createCandidate({
      id: 'atwater',
      source: 'usdaFdc',
      name: 'plain cracker',
      brand: '',
      channel: 'generic',
      categoryPath: [],
      per100: { kcal: 100, protein: 0, carbs: 0, fat: 40, basis: 'g' },
    });
    const frame = buildQueryFrame('plain cracker');
    const gate = runGates(frame, candidate);
    expect(gate.pass).toBe(false);
  });

  test('serper-only never returns confident', () => {
    const candidate = createCandidate({
      id: 's1',
      source: 'serper',
      name: 'plain cracker',
      brand: '',
      channel: 'unknown',
      servings: [{ label: '1 serving', grams: null, kcal: 180, protein: 3, carbs: 30, fat: 6, origin: 'derived' }],
    });
    const decision = matchCandidatesV2('plain cracker', [candidate]);
    expect(decision.status).not.toBe('confident');
  });

  test('shadow helper is off unless FOOD_MATCH_V2_SHADOW=1', () => {
    expect(shadowEnabled({ FOOD_MATCH_V2_SHADOW: '0' })).toBe(false);
    expect(shadowEnabled({ FOOD_MATCH_V2_SHADOW: '1' })).toBe(true);
    const shadow = buildShadowRankV2('coconut water', [{
      id: 'c1',
      name: 'Coconut Water',
      brand: 'Vita Coco',
      source: 'openfoodfacts',
      calories: 19,
      protein: 0,
      carbs: 4,
      fat: 0,
    }], { oldTopId: 'other' });
    expect(shadow.rankV2.status).toBeTruthy();
    expect(shadow.disagreement).toBeTruthy();
  });

  test('two match runs are byte-identical', () => {
    const candidate = createCandidate({
      id: 'c1',
      source: 'openFoodFacts',
      name: 'Coconut Water',
      brand: 'Vita Coco',
      channel: 'packaged',
      categoryPath: ['en:coconut-waters'],
      per100: { kcal: 19, protein: 0, carbs: 4, fat: 0, basis: 'g' },
    });
    const first = JSON.stringify(matchCandidatesV2('coconut water', [candidate]));
    const second = JSON.stringify(matchCandidatesV2('coconut water', [candidate]));
    expect(first).toBe(second);
  });
});
