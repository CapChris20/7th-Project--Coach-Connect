/**
 * Regression tests for nutrition critical bug fixes (logged_totals, density, OFF/USDA basis).
 */
const {
  isLabelServingBasis,
  isLoggedTotalsBasis,
  normalizeDataBasis,
  gramsForVolumeUnit,
  macrosDisagreeWithCalories,
  caloriesForGrams,
  finalizeBarcodeFood,
} = require('../../nutrition/food-details/calculateServingSize');
const { normalizeFoodForLog, mapSearchRowToFoodShape } = require('../../nutrition/food-search/normalizeFoodQuery');
const { mapNutritionSearchToFoodRows } = require('../../nutrition/food-search/mergeFoodNutritionSources');

describe('dataBasis logged_total vs logged_totals', () => {
  it('normalizes singular and plural to logged_totals', () => {
    expect(normalizeDataBasis('logged_total')).toBe('logged_totals');
    expect(normalizeDataBasis('logged_totals')).toBe('logged_totals');
    expect(isLoggedTotalsBasis({ dataBasis: 'logged_total' })).toBe(true);
    expect(isLoggedTotalsBasis({ dataBasis: 'logged_totals' })).toBe(true);
  });

  it('treats logged totals as label basis (no per-100g rescale)', () => {
    const food = {
      name: 'Peanut Butter',
      source: 'usda',
      calories: 1176,
      protein: 50,
      servingGrams: 200,
      dataBasis: 'logged_total',
    };
    expect(isLabelServingBasis(food)).toBe(true);
    expect(caloriesForGrams(food, 200)).toBe(1176);
    expect(finalizeBarcodeFood(food).calories).toBe(1176);
  });

  it('normalizeFoodForLog preserves logged_total as logged_totals', () => {
    const out = normalizeFoodForLog({
      name: 'Greek Yogurt',
      source: 'usda',
      calories: 100,
      protein: 17,
      carbs: 6,
      fat: 0,
      servingGrams: 170,
      servingSize: 1,
      dataBasis: 'logged_total',
    });
    expect(out.dataBasis).toBe('logged_totals');
    expect(out.calories).toBe(100);
  });
});

describe('gramsForVolumeUnit density', () => {
  it('uses cooked rice density not 240g water default', () => {
    expect(gramsForVolumeUnit(1, 'cups', 'white rice cooked')).toBe(158);
    expect(gramsForVolumeUnit(1, 'cups', 'cooked pasta')).toBe(140);
  });

  it('uses peanut butter tbsp ≈ 16g', () => {
    expect(gramsForVolumeUnit(2, 'tbsp', 'peanut butter')).toBe(32);
  });
});

describe('macrosDisagreeWithCalories', () => {
  it('flags incomplete macros vs calories', () => {
    expect(macrosDisagreeWithCalories({ calories: 530, protein: 0, carbs: 0, fat: 0 })).toBe(true);
    expect(macrosDisagreeWithCalories({ calories: 580, protein: 25, carbs: 45, fat: 34 })).toBe(false);
  });
});

describe('USDA / OFF / FatSecret search row basis', () => {
  it('maps USDA per_100g search rows with servingGrams', () => {
    const row = mapSearchRowToFoodShape({
      name: 'Peanut butter',
      source: 'usda',
      calories: 588,
      protein: 25,
      carbs: 20,
      fat: 50,
      servingGrams: 32,
      dataBasis: 'per_100g',
    });
    expect(row.dataBasis).toBe('per_100g');
    expect(row.servingGrams).toBe(32);
    expect(caloriesForGrams(row, 32)).toBe(Math.round(588 * 0.32));
  });

  it('maps FatSecret label_serving without treating as per-100g', () => {
    const row = mapSearchRowToFoodShape({
      name: 'Peanut Butter',
      source: 'fatsecret',
      calories: 190,
      protein: 8,
      carbs: 6,
      fat: 16,
      servingGrams: 32,
      dataBasis: 'label_serving',
      serving_label: 'Per 2 tbsp',
    });
    expect(row.dataBasis).toBe('label_serving');
    expect(caloriesForGrams(row, 32)).toBe(190);
    expect(caloriesForGrams(row, 16)).toBe(95);
  });

  it('maps Serper label_serving with parsed grams', () => {
    const row = mapSearchRowToFoodShape({
      name: 'Milk, 1 cup',
      source: 'serper',
      calories: 149,
      protein: 8,
      carbs: 12,
      fat: 8,
      servingGrams: 244,
      dataBasis: 'label_serving',
    });
    expect(isLabelServingBasis(row)).toBe(true);
    expect(caloriesForGrams(row, 244)).toBe(149);
  });
});

describe('consensus prefers scraper title', () => {
  it('uses source displayName instead of renaming to raw query only', () => {
    const rows = mapNutritionSearchToFoodRows(
      {
        consensus: {
          calories: { value: 530, sources_agreeing: 3 },
          protein_g: { value: 16, sources_agreeing: 2 },
          carbs_g: { value: 50, sources_agreeing: 2 },
          fat_g: { value: 29, sources_agreeing: 2 },
        },
        sourceResults: [
          {
            source: 'FatSecret',
            sourceKey: 'fatsecret',
            displayName: 'Taco Bell Crunchwrap Supreme',
            calories: 530,
            protein_g: 16,
            carbs_g: 50,
            fat_g: 29,
            servingLabel: '1 item',
          },
        ],
        sources_used: ['fatsecret'],
        query: { foodName: 'crunchwrap', restaurant: 'Taco Bell' },
        fallbackUsed: false,
      },
      'crunchwrap',
      5,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(String(rows[0].name || rows[0].food_name).toLowerCase()).toContain('crunchwrap');
    expect(rows[0].dataBasis).toBe('label_serving');
  });
});
