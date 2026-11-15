const { adaptOpenFoodFactsProduct } = require('../lib/nutritionMultiSourceSearch/scrapers/openFoodFacts');
const { adaptUsdaFood } = require('../lib/nutritionMultiSourceSearch/scrapers/usdaFdc');
const { adaptFatSecretFood } = require('../lib/nutritionMultiSourceSearch/scrapers/fatSecret');
const { adaptCalorieKingResult } = require('../lib/nutritionMultiSourceSearch/scrapers/calorieKing');
const { adaptMenuStatResult } = require('../lib/nutritionMultiSourceSearch/scrapers/menuStat');
const { adaptFastFoodNutritionResult } = require('../lib/nutritionMultiSourceSearch/scrapers/fastFoodNutrition');
const { adaptFoodFactoResult } = require('../lib/nutritionMultiSourceSearch/scrapers/foodFacto');
const { adaptSerperNutritionResult } = require('../lib/nutritionMultiSourceSearch/scrapers/serperNutrition');
const { adaptYazioResult } = require('../lib/nutritionMultiSourceSearch/scrapers/yazio');
const { adaptCronometerResult } = require('../lib/nutritionMultiSourceSearch/scrapers/cronometer');
const { adaptMyFitnessPalResult } = require('../lib/nutritionMultiSourceSearch/scrapers/myFitnessPal');
const { CANDIDATE_ADAPTERS, ALL_SCRAPERS } = require('../lib/nutritionMultiSourceSearch/scrapers');
const { validateCandidate } = require('../../src/nutrition/food-match/candidate');
const { wrapScraperResult } = require('../lib/nutritionMultiSourceSearch/resolveFoodDetail');

describe('food-match scraper adapters', () => {
  test('Open Food Facts adapter keeps raw name/brand and does not tidy', () => {
    const candidate = adaptOpenFoodFactsProduct({
      code: '3017620422003',
      product_name: 'Oat Crunch [PDF] Nutrition Facts',
      brands: 'ACME Foods',
      categories_tags: ['en:breakfast-cereals'],
      serving_size: '30 g',
      nutriments: {
        'energy-kcal_100g': 380,
        proteins_100g: 8,
        carbohydrates_100g: 70,
        fat_100g: 6,
        'energy-kcal_serving': 114,
        proteins_serving: 2.4,
        carbohydrates_serving: 21,
        fat_serving: 1.8,
      },
      states_tags: ['en:nutrition-facts-completed'],
      data_quality_errors_tags: [],
    });

    expect(candidate.name).toBe('Oat Crunch [PDF] Nutrition Facts');
    expect(candidate.brand).toBe('ACME Foods');
    expect(candidate.source).toBe('openFoodFacts');
    expect(candidate.sourceTier).toBe(1);
    expect(candidate.gtin).toBe('3017620422003');
    expect(candidate.per100.kcal).toBe(380);
    expect(validateCandidate(candidate).ok).toBe(true);

    // Contrast: the live wrap path tidies titles. Adapter must not.
    const wrapped = wrapScraperResult(
      { calories: 114, protein_g: 2.4, carbs_g: 21, fat_g: 1.8 },
      { displayName: 'Oat Crunch [PDF] Nutrition Facts' },
    );
    expect(wrapped.displayName).not.toBe('Oat Crunch [PDF] Nutrition Facts');
  });

  test('USDA adapter keeps description/brandOwner raw and marks per100', () => {
    const candidate = adaptUsdaFood({
      fdcId: 123,
      description: 'OATS, RAW',
      brandOwner: '',
      dataType: 'Foundation',
      foodCategory: 'Cereal Grains and Pasta',
      servingSize: 40,
      servingSizeUnit: 'g',
      foodNutrients: [
        { nutrientId: 1008, value: 389 },
        { nutrientId: 1003, value: 17 },
        { nutrientId: 1005, value: 66 },
        { nutrientId: 1004, value: 7 },
      ],
    });
    expect(candidate.name).toBe('OATS, RAW');
    expect(candidate.brand).toBe('');
    expect(candidate.channel).toBe('generic');
    expect(candidate.per100.kcal).toBe(389);
    expect(candidate.sourceTier).toBe(1);
    expect(validateCandidate(candidate).ok).toBe(true);
  });

  test('FatSecret adapter keeps food_name/brand_name raw', () => {
    const candidate = adaptFatSecretFood({
      fatsecretFoodId: '99',
      food_name: 'Chicken Breast',
      brand_name: 'Generic',
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 3.6,
      serving_label: '100 g',
    });
    expect(candidate.name).toBe('Chicken Breast');
    expect(candidate.brand).toBe('Generic');
    expect(candidate.sourceTier).toBe(1);
    expect(candidate.servings[0].origin).toBe('label');
    expect(validateCandidate(candidate).ok).toBe(true);
  });

  test.each([
    ['calorieKing', adaptCalorieKingResult, 2],
    ['menuStat', adaptMenuStatResult, 2],
    ['fastFoodNutrition', adaptFastFoodNutritionResult, 2],
    ['foodFacto', adaptFoodFactoResult, 2],
    ['serper', adaptSerperNutritionResult, 3],
    ['yazio', adaptYazioResult, 3],
    ['cronometer', adaptCronometerResult, 3],
    ['myFitnessPal', adaptMyFitnessPalResult, 3],
  ])('%s adapter emits a valid Candidate at the expected tier', (source, adapt, tier) => {
    const candidate = adapt({
      name: 'Sample Item',
      brand: 'Sample Brand',
      calories: 200,
      protein_g: 10,
      carbs_g: 20,
      fat_g: 8,
      url: 'https://example.test',
    });
    expect(candidate.source).toBe(source);
    expect(candidate.sourceTier).toBe(tier);
    expect(candidate.name).toBe('Sample Item');
    expect(candidate.brand).toBe('Sample Brand');
    expect(validateCandidate(candidate).ok).toBe(true);
  });

  test('CANDIDATE_ADAPTERS covers every live scraper key', () => {
    for (const key of Object.keys(ALL_SCRAPERS)) {
      expect(typeof CANDIDATE_ADAPTERS[key]).toBe('function');
    }
  });

  test('adapters return null for empty payloads', () => {
    expect(adaptOpenFoodFactsProduct(null)).toBeNull();
    expect(adaptUsdaFood({})).toBeNull();
    expect(adaptFatSecretFood({ brand_name: 'Only Brand' })).toBeNull();
  });
});
