const { normalizeFoodItem } = require('../../nutrition/food-search/normalizeFoodQuery');
const {
  scaleNutritionByServings,
  caloriesForGrams,
} = require('../../nutrition/food-details/calculateServingSize');

describe('food search → log integration', () => {
  test('search result scales to logged serving without 100× calorie blowup', () => {
    const searchRow = normalizeFoodItem({
      food_name: 'Greek Yogurt',
      nf_calories: 120,
      nf_protein: 15,
      nf_total_carbohydrate: 8,
      nf_total_fat: 0,
      serving_weight_grams: 170,
      source: 'fatsecret',
    });

    const perServing = scaleNutritionByServings(
      {
        calories: searchRow.calories,
        protein: searchRow.protein,
        carbs: searchRow.carbs,
        fat: searchRow.fat,
      },
      1,
    );

    expect(perServing.calories).toBeLessThan(500);
    expect(perServing.calories).toBe(searchRow.calories);
  });

  test('per-100g barcode food logs correct grams-based calories', () => {
    const food = {
      source: 'openfoodfacts',
      calories: 530,
      servingGrams: 28,
      kcalPer100Unit: 530,
    };
    const logged = caloriesForGrams(food, 28);
    expect(logged).toBeGreaterThan(100);
    expect(logged).toBeLessThan(200);
  });
});
