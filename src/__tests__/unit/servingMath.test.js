const {
  scaleNutritionByServings,
  totalGramsFromServing,
  parseServingQtyInput,
} = require('../../nutrition/food-details/calculateServingSize');

describe('servingMath', () => {
  it('scales macros by serving count', () => {
    const scaled = scaleNutritionByServings(
      { calories: 200, protein: 20, carbs: 10, fat: 5 },
      2,
    );
    expect(scaled.calories).toBe(400);
    expect(scaled.protein).toBe(40);
    expect(scaled.servings).toBe(2);
  });

  it('computes total grams from qty × grams-per-serving', () => {
    expect(totalGramsFromServing(1.5, 100)).toBe(150);
  });

  it('parses fractional serving qty', () => {
    expect(parseServingQtyInput('1/2')).toBe(0.5);
    expect(parseServingQtyInput('2')).toBe(2);
    expect(parseServingQtyInput('')).toBeNull();
  });
});
