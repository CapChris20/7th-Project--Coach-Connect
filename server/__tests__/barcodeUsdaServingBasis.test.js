/**
 * Regression test: USDA barcode results must show label-serving calories/macros,
 * not silently scale them down.
 *
 * Root cause that was fixed: mapUsdaBrandedHitToBarcodeFood set source='usda'
 * but no dataBasis, so isLabelServingBasis() returned false and
 * caloriesForGrams treated the values as per-100g. For a 90g serving with
 * 100 kcal, the confirm sheet showed 90 kcal instead of 100 kcal.
 *
 * Fix: add dataBasis='label_serving' so the math treats the values as
 * label totals (which is what USDA /foods/search branded foods return).
 */

const { mapUsdaBrandedHitToBarcodeFood } = require('../lib/resolveBarcodeLookup');
const {
  caloriesForGrams,
  scaleMacroForGrams,
  isLabelServingBasis,
  resolveServingGrams,
} = require('../../src/nutrition/food-details/servingSizeMath');

function makeUsdaHit({ servingSize = 90, servingSizeUnit = 'g', kcal = 100, protein = 10, carbs = 7, fat = 3 } = {}) {
  return {
    fdcId: 'test-123',
    description: 'Test Food',
    brandOwner: 'Test Brand',
    servingSize,
    servingSizeUnit,
    foodNutrients: [
      { nutrientId: 1008, value: kcal },
      { nutrientId: 1003, value: protein },
      { nutrientId: 1005, value: carbs },
      { nutrientId: 1004, value: fat },
    ],
  };
}

describe('USDA barcode serving-basis fix', () => {
  test('mapped USDA food has dataBasis=label_serving', () => {
    const food = mapUsdaBrandedHitToBarcodeFood(makeUsdaHit());
    expect(food.dataBasis).toBe('label_serving');
  });

  test('isLabelServingBasis returns true for mapped USDA food', () => {
    const food = mapUsdaBrandedHitToBarcodeFood(makeUsdaHit());
    expect(isLabelServingBasis(food)).toBe(true);
  });

  test('1 serving (90g) of a 100-kcal USDA food shows 100 kcal — not 90', () => {
    const food = mapUsdaBrandedHitToBarcodeFood(makeUsdaHit({ servingSize: 90, kcal: 100 }));
    const servingGrams = resolveServingGrams(food);
    // User picks 1 serving → totalGrams = 1 × servingGrams
    const totalGrams = 1 * servingGrams;
    expect(caloriesForGrams(food, totalGrams)).toBe(100);
  });

  test('1 serving (90g) of a 10g-protein USDA food shows 10g protein — not 9', () => {
    const food = mapUsdaBrandedHitToBarcodeFood(makeUsdaHit({ servingSize: 90, protein: 10 }));
    const servingGrams = resolveServingGrams(food);
    const totalGrams = 1 * servingGrams;
    expect(scaleMacroForGrams(food.protein, totalGrams, food)).toBe(10);
  });

  test('2 servings correctly doubles the values', () => {
    const food = mapUsdaBrandedHitToBarcodeFood(makeUsdaHit({ servingSize: 90, kcal: 100, protein: 10 }));
    const servingGrams = resolveServingGrams(food);
    const totalGrams = 2 * servingGrams;
    expect(caloriesForGrams(food, totalGrams)).toBe(200);
    expect(scaleMacroForGrams(food.protein, totalGrams, food)).toBe(20);
  });

  test('0.5 serving correctly halves the values', () => {
    const food = mapUsdaBrandedHitToBarcodeFood(makeUsdaHit({ servingSize: 90, kcal: 100, protein: 10 }));
    const servingGrams = resolveServingGrams(food);
    const totalGrams = 0.5 * servingGrams;
    expect(caloriesForGrams(food, totalGrams)).toBe(50);
    expect(scaleMacroForGrams(food.protein, totalGrams, food)).toBe(5);
  });

  test('a 28g USDA food (e.g. chips) with 140 kcal/serving shows 140 at 1 serving', () => {
    const food = mapUsdaBrandedHitToBarcodeFood(makeUsdaHit({ servingSize: 28, kcal: 140, protein: 2, carbs: 15, fat: 8 }));
    const servingGrams = resolveServingGrams(food);
    expect(servingGrams).toBe(28);
    expect(caloriesForGrams(food, 28)).toBe(140);
    expect(scaleMacroForGrams(food.protein, 28, food)).toBe(2);
  });

  test('source field stays usda after the fix', () => {
    const food = mapUsdaBrandedHitToBarcodeFood(makeUsdaHit());
    expect(food.source).toBe('usda');
  });
});

