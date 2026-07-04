const {
  getFoodNutritionConsensus,
  removeOutliersIqr,
  buildNutrientConsensus,
} = require('../../../server/lib/nutritionMultiSourceSearch/getFoodNutritionConsensus');

describe('removeOutliersIqr', () => {
  it('removes extreme outliers', () => {
    expect(removeOutliersIqr([110, 112, 111, 500])).toEqual([110, 112, 111]);
  });

  it('returns original values when only two data points', () => {
    expect(removeOutliersIqr([72, 74])).toEqual([72, 74]);
  });
});

describe('buildNutrientConsensus', () => {
  it('includes nutrient when variance is under 10%', () => {
    const result = buildNutrientConsensus([110, 111, 109, 110]);
    expect(result).toMatchObject({
      value: 110,
      sources_agreeing: 4,
      range: [109, 111],
    });
    expect(result.warning).toBeUndefined();
  });

  it('flags verify_manually when variance is 10-20%', () => {
    const result = buildNutrientConsensus([25, 27, 26, 30]);
    expect(result).toBeTruthy();
    expect(result.warning).toBe('verify_manually');
  });

  it('excludes nutrient when only one source', () => {
    expect(buildNutrientConsensus([110])).toBeNull();
  });

  it('excludes nutrient when variance exceeds 20%', () => {
    expect(buildNutrientConsensus([72, 120])).toBeNull();
  });
});

describe('getFoodNutritionConsensus', () => {
  it('aggregates agreeing sources and omits null nutrients', () => {
    const raw = {
      fatSecret: { calories: 110, protein_g: 2, carbs_g: 26, fat_g: 0, fiber_g: null, sodium_mg: 15, servingBasis: 'per_serving' },
      calorieKing: { calories: 111, protein_g: 2, carbs_g: 26, fat_g: 0, fiber_g: null, sodium_mg: 15, servingBasis: 'per_serving' },
      openFoodFacts: { calories: 109, protein_g: 2, carbs_g: 25, fat_g: 0, fiber_g: null, sodium_mg: 14, servingBasis: 'per_serving' },
      fastFoodNutrition: null,
    };

    const { consensus, sources_used, sourceResults } = getFoodNutritionConsensus(raw);

    expect(sources_used).toEqual(['FatSecret', 'CalorieKing', 'OpenFoodFacts']);
    expect(consensus.calories.value).toBe(110);
    expect(consensus.calories.sources_agreeing).toBe(3);
    expect(sourceResults.length).toBeGreaterThanOrEqual(2);
    expect(consensus.protein_g.value).toBe(2);
    expect(consensus.fiber_g).toBeUndefined();
  });

  it('returns empty consensus when all sources null', () => {
    const { consensus, sources_used } = getFoodNutritionConsensus({
      fatSecret: null,
      calorieKing: null,
      fastFoodNutrition: null,
      openFoodFacts: null,
      menuStat: null,
    });
    expect(sources_used).toEqual([]);
    expect(Object.keys(consensus)).toHaveLength(0);
  });
});
