const { normalizeFoodItem } = require('../../nutrition/food-search/normalizeFoodQuery');

describe('foodNormalize', () => {
  it('normalizes FatSecret-style rows', () => {
    const row = normalizeFoodItem({
      food_name: 'Greek Yogurt',
      brand_name: 'Chobani',
      nf_calories: 120,
      nf_protein: 15,
      nf_total_carbohydrate: 8,
      nf_total_fat: 0,
      serving_qty: 1,
      serving_unit: 'cup',
      serving_weight_grams: 170,
      source: 'fatsecret',
    });
    expect(row.name).toBe('Greek Yogurt');
    expect(row.calories).toBe(120);
    expect(row.serving_grams).toBe(170);
    expect(row.brand_name).toBeTruthy();
  });

  it('cleans Serper titles when search query provided', () => {
    const row = normalizeFoodItem(
      {
        name: 'Banana Nutrition Facts - MyFitnessPal',
        calories: 105,
        source: 'serper',
      },
      'banana',
    );
    expect(row.name.toLowerCase()).toContain('banana');
  });
});
