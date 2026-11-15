const { createCandidate } = require('../../src/nutrition/food-match/candidate');
const {
  normalizeCandidateServings,
  pickDefaultServing,
  candidateBlocksAutofill,
  FLAG_SERVING_INCONSISTENT,
  DEFAULT_PER100_LABEL,
} = require('../../src/nutrition/food-match/servingNormalizer');
const {
  clusterKey,
  clusterCandidates,
  macrosCompatible,
  pickBestConsensusCluster,
} = require('../../src/nutrition/food-match/entityCluster');
const {
  getFoodNutritionConsensus,
} = require('../lib/nutritionMultiSourceSearch/getFoodNutritionConsensus');
const {
  resolveFoodServingLabelDetailed,
} = require('../../src/nutrition/food-search/guessServingLabel');

describe('servingNormalizer', () => {
  test('cross-check marks label/menu inconsistent when per100 disagrees by more than 15%', () => {
    const candidate = createCandidate({
      source: 'openFoodFacts',
      name: 'Test Bar',
      brand: 'Acme',
      channel: 'packaged',
      per100: { kcal: 400, protein: 10, carbs: 40, fat: 20, basis: 'g' },
      servings: [{
        label: '1 bar (50 g)',
        grams: 50,
        // 50 g at 400 kcal/100g should be 200 kcal — 500 is way off
        kcal: 500,
        protein: 5,
        carbs: 20,
        fat: 10,
        origin: 'label',
      }],
    });

    const normalized = normalizeCandidateServings(candidate);
    expect(candidateBlocksAutofill(normalized)).toBe(true);
    expect(normalized.quality.sourceFlags).toContain(FLAG_SERVING_INCONSISTENT);
  });

  test('cross-check drops derived serving that fights per100', () => {
    const candidate = createCandidate({
      source: 'openFoodFacts',
      name: 'Test Bar',
      brand: 'Acme',
      channel: 'packaged',
      per100: { kcal: 400, protein: 10, carbs: 40, fat: 20, basis: 'g' },
      servings: [{
        label: 'weird derived',
        grams: 50,
        kcal: 500,
        protein: 5,
        carbs: 20,
        fat: 10,
        origin: 'derived',
      }],
    });

    const normalized = normalizeCandidateServings(candidate);
    expect(normalized.servings.some((row) => row.label === 'weird derived')).toBe(false);
    expect(normalized.servings.some((row) => row.label === DEFAULT_PER100_LABEL)).toBe(true);
  });

  test('agreeing serving + per100 stays clean and picks label default', () => {
    const candidate = createCandidate({
      source: 'openFoodFacts',
      name: 'Test Bar',
      brand: 'Acme',
      channel: 'packaged',
      per100: { kcal: 400, protein: 10, carbs: 40, fat: 20, basis: 'g' },
      servings: [{
        label: '1 bar (50 g)',
        grams: 50,
        kcal: 200,
        protein: 5,
        carbs: 20,
        fat: 10,
        origin: 'label',
      }],
    });

    const normalized = normalizeCandidateServings(candidate);
    expect(candidateBlocksAutofill(normalized)).toBe(false);
    const defaults = pickDefaultServing(normalized);
    expect(defaults.label).toBe('1 bar (50 g)');
  });

  test('restaurant channel never invents grams on portions', () => {
    const candidate = createCandidate({
      source: 'menuStat',
      name: 'Chicken Sandwich',
      brand: 'Some Chain',
      channel: 'restaurant',
      servings: [{
        label: '1 sandwich',
        grams: 220,
        kcal: 480,
        protein: 30,
        carbs: 40,
        fat: 18,
        origin: 'derived',
      }],
    });

    const normalized = normalizeCandidateServings(candidate);
    expect(normalized.servings[0].grams).toBeNull();
    expect(normalized.servings[0].label).toBe('1 sandwich');
  });
});

describe('entityCluster', () => {
  test('different brand+name keys stay in separate clusters', () => {
    const grain = createCandidate({
      source: 'usdaFdc',
      name: 'cooked grain',
      brand: '',
      servings: [{ label: '1 serving', grams: null, kcal: 180, protein: 8, carbs: 22, fat: 6, origin: 'label' }],
    });
    const soup = createCandidate({
      source: 'fatSecret',
      name: 'canned soup',
      brand: '',
      servings: [{ label: '1 serving', grams: null, kcal: 180, protein: 8, carbs: 22, fat: 6, origin: 'label' }],
    });

    const clusters = clusterCandidates([grain, soup]);
    expect(clusters).toHaveLength(2);
    expect(clusterKey(grain)).not.toBe(clusterKey(soup));
    expect(pickBestConsensusCluster(clusters)).toBeNull();
  });

  test('same GTIN clusters together even when names differ', () => {
    const left = createCandidate({
      source: 'openFoodFacts',
      name: 'Cola 12oz',
      brand: 'Acme',
      gtin: '00012345678905',
      servings: [{ label: '1 can', grams: null, kcal: 140, protein: 0, carbs: 39, fat: 0, origin: 'label' }],
    });
    const right = createCandidate({
      source: 'fatSecret',
      name: 'Cola Can',
      brand: 'Acme',
      gtin: '00012345678905',
      servings: [{ label: '1 can', grams: null, kcal: 142, protein: 0, carbs: 39, fat: 0, origin: 'label' }],
    });

    const clusters = clusterCandidates([left, right]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toHaveLength(2);
    expect(macrosCompatible(left, right)).toBe(true);
  });

  test('same name with incompatible macros splits into subclusters', () => {
    const light = createCandidate({
      source: 'usdaFdc',
      name: 'yogurt',
      brand: 'acme',
      servings: [{ label: '1 cup', grams: null, kcal: 100, protein: 10, carbs: 10, fat: 2, origin: 'label' }],
    });
    const heavy = createCandidate({
      source: 'fatSecret',
      name: 'yogurt',
      brand: 'acme',
      servings: [{ label: '1 cup', grams: null, kcal: 300, protein: 10, carbs: 30, fat: 15, origin: 'label' }],
    });

    const clusters = clusterCandidates([light, heavy]);
    expect(clusters).toHaveLength(2);
    expect(pickBestConsensusCluster(clusters)).toBeNull();
  });
});

describe('getFoodNutritionConsensus cluster isolation', () => {
  test('never merges cooked grain with canned soup even when calories match', () => {
    const consensus = getFoodNutritionConsensus({
      usdaFdc: {
        calories: 180,
        protein_g: 8,
        carbs_g: 22,
        fat_g: 6,
        displayName: 'cooked grain',
        servingBasis: 'per_serving',
      },
      fatSecret: {
        calories: 180,
        protein_g: 8,
        carbs_g: 22,
        fat_g: 6,
        displayName: 'canned soup',
        servingBasis: 'per_serving',
      },
    });

    expect(consensus.consensus.calories).toBeUndefined();
    expect(
      consensus.excludedSources.some((row) => row.reason === 'different_entity_cluster')
        || Object.keys(consensus.consensus).length === 0,
    ).toBe(true);
  });

  test('still merges when two sources share the same display name', () => {
    const consensus = getFoodNutritionConsensus({
      usdaFdc: {
        calories: 540,
        protein_g: 25,
        carbs_g: 45,
        fat_g: 28,
        displayName: 'big mac',
        servingBasis: 'per_serving',
      },
      fatSecret: {
        calories: 550,
        protein_g: 26,
        carbs_g: 46,
        fat_g: 29,
        displayName: 'big mac',
        servingBasis: 'per_serving',
      },
    });

    expect(consensus.consensus.calories?.value).toBeGreaterThan(500);
    expect(consensus.consensus.calories?.sources_agreeing).toBe(2);
  });
});

describe('guessServingLabel display-only', () => {
  test('resolveFoodServingLabelDetailed never mutates input macros and never returns macro fields', () => {
    const food = {
      calories: 720,
      protein: 32,
      carbs: 60,
      fat: 28,
      nf_calories: 720,
    };
    const before = JSON.stringify(food);

    const result = resolveFoodServingLabelDetailed({
      userQuery: 'burger',
      foodName: 'Burger',
      restaurant: 'Some Place',
      scraperLabel: '1 sandwich',
      calories: food.calories,
    });

    expect(JSON.stringify(food)).toBe(before);
    expect(Object.keys(result).sort()).toEqual([
      'label',
      'multiServingFallback',
      'nutrition_unverified',
    ]);
    expect(result.calories).toBeUndefined();
    expect(result.protein).toBeUndefined();
    expect(result.carbs).toBeUndefined();
    expect(result.fat).toBeUndefined();
    expect(typeof result.label).toBe('string');
  });
});
