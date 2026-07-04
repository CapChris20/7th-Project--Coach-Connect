const {
  classifyCalorieSources,
  buildSourceResultRow,
  getFoodNutritionConsensus,
} = require('../../../server/lib/nutritionMultiSourceSearch/getFoodNutritionConsensus');

describe('classifyCalorieSources', () => {
  it('marks per_100g USDA as wrong_serving_basis', () => {
    const { inlierKeys, excludedSources } = classifyCalorieSources({
      fatSecret: { calories: 830, servingBasis: 'per_serving' },
      usdaFdc: { calories: 200, servingBasis: 'per_100g' },
    });

    expect(inlierKeys.has('fatSecret')).toBe(true);
    expect(excludedSources.some((e) => e.reason === 'wrong_serving_basis')).toBe(true);
  });

  it('flags calorie outliers when 3+ sources disagree', () => {
    const { inlierKeys, excludedSources } = classifyCalorieSources({
      fatSecret: { calories: 830, servingBasis: 'per_serving' },
      foodFacto: { calories: 830, servingBasis: 'per_serving' },
      fastFoodNutrition: { calories: 890, servingBasis: 'per_serving' },
      calorieKing: { calories: 27, servingBasis: 'per_serving' },
    });

    expect(inlierKeys.size).toBeGreaterThanOrEqual(2);
    expect(excludedSources.some((e) => e.calories === 27)).toBe(true);
  });
});

describe('getFoodNutritionConsensus sourceResults', () => {
  it('returns sourceResults and consensus for agreeing sources', () => {
    const raw = {
      fatSecret: {
        calories: 830,
        protein_g: 46,
        carbs_g: 51,
        fat_g: 49,
        servingBasis: 'per_serving',
        sourceKey: 'fatSecret',
      },
      foodFacto: {
        calories: 830,
        protein_g: 46,
        carbs_g: 51,
        fat_g: 49,
        servingBasis: 'per_serving',
      },
      fastFoodNutrition: {
        calories: 890,
        protein_g: 49,
        carbs_g: 51,
        fat_g: 53,
        servingBasis: 'per_serving',
      },
    };

    const result = getFoodNutritionConsensus(raw);
    expect(result.sourceResults.length).toBeGreaterThanOrEqual(2);
    expect(result.consensus.calories.value).toBeGreaterThanOrEqual(820);
    expect(result.consensus.calories.value).toBeLessThanOrEqual(900);
    expect(result.excludedSources.length).toBeGreaterThanOrEqual(0);
  });

  it('buildSourceResultRow includes url and sourceKey', () => {
    const row = buildSourceResultRow('fatSecret', {
      calories: 400,
      protein_g: 20,
      url: 'https://example.com',
      displayName: 'Four Corner Slice',
    });
    expect(row.sourceKey).toBe('fatSecret');
    expect(row.url).toBe('https://example.com');
    expect(row.displayName).toBe('Four Corner Slice');
  });
});
