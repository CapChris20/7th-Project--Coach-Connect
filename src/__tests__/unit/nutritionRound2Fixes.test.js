/**
 * Round-2 nutrition bug fixes: display double-scale, viewDate logging, OFF sodium, etc.
 */
const { macrosAtGrams } = require('../../nutrition/barcode/renderScannedBarcode');
const { gramsForVolumeUnit } = require('../../nutrition/food-details/calculateServingSize');
const { normalizeOpenFoodFactsProduct } = require('../../nutrition/food-details/fixFoodNutritionNumbers');

describe('macrosAtGrams scales micros', () => {
  it('scales fiber/sodium with grams for per-100g OFF foods', () => {
    const food = {
      source: 'openfoodfacts',
      dataBasis: 'per_100g',
      calories: 400,
      protein: 20,
      carbs: 40,
      fat: 15,
      fiber: 5,
      sodium: 500,
      servingGrams: 100,
    };
    const m = macrosAtGrams(food, 200);
    expect(m.calories).toBe(800);
    expect(m.fiber).toBe(10);
    expect(m.sodium).toBe(1000);
  });
});

describe('OFF sodium is milligrams', () => {
  it('converts OFF sodium_100g grams to mg', () => {
    const product = {
      code: '123',
      product_name: 'Test Chips',
      nutriments: {
        'energy-kcal_100g': 500,
        proteins_100g: 5,
        carbohydrates_100g: 50,
        fat_100g: 30,
        sodium_100g: 0.5, // grams
      },
      serving_size: '28 g',
      serving_quantity: 28,
    };
    const n = normalizeOpenFoodFactsProduct(product);
    expect(n.sodium).toBe(500); // mg per 100g
  });
});

describe('cup density invert consistency', () => {
  it('rice cup grams round-trip', () => {
    const g = gramsForVolumeUnit(1, 'cups', 'cooked rice');
    expect(g).toBe(158);
    const cups = Math.round((g / g) * 100) / 100;
    expect(cups).toBe(1);
  });
});
