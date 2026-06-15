const { normalizeFoodItem } = require('../../nutrition/food-search/normalizeFoodQuery');
const { guardBarcodeResult } = require('../../../server/lib/barcodeMerge');

describe('foodNormalizeBarcode', () => {
  test('normalizes barcode row with per-serving macros', () => {
    const row = normalizeFoodItem({
      food_name: 'Doritos Nacho Cheese',
      brand_name: 'Frito-Lay',
      nf_calories: 140,
      nf_protein: 2,
      nf_total_carbohydrate: 18,
      nf_total_fat: 8,
      serving_qty: 1,
      serving_unit: 'oz',
      serving_weight_grams: 28,
      source: 'fatsecret',
      barcode: '01600022984',
    });
    expect(row.name).toContain('Doritos');
    expect(row.calories).toBe(140);
    expect(row.serving_grams).toBe(28);
  });

  test('guardBarcodeResult caps insane per-100g calories', () => {
    const guarded = guardBarcodeResult({
      name: 'Snack',
      source: 'openfoodfacts',
      calories: 12900,
      servingGrams: 100,
      protein: 5,
      carbs: 60,
      fat: 10,
    });
    expect(guarded.calories).toBeLessThanOrEqual(1000);
  });

  test('guardBarcodeResult fixes ml unit on solid foods', () => {
    const guarded = guardBarcodeResult({
      name: 'Chicken Nuggets',
      source: 'usda',
      servingUnit: 'ml',
      calories: 250,
      servingGrams: 90,
    });
    expect(guarded.servingUnit).toBe('g');
  });
});
