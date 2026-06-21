const {
  sanitizeFoodCardTitle,
  applyFoodCardPresentation,
  applyFoodCardPresentationToRows,
} = require('../../nutrition/food-search/cleanFoodCardLabels');

describe('sanitizeFoodCardTitle (all sources)', () => {
  it('strips legacy source suffixes from cached titles', () => {
    expect(sanitizeFoodCardTitle('Cheese Pizza — FatSecret (240 cal)', 'cottage inn cheese pizza')).toBe(
      'Cheese Pizza',
    );
  });

  it('rejects source-only junk titles and uses the user query', () => {
    expect(sanitizeFoodCardTitle('CalorieKing', "wendy's small frosty vanilla")).toBe(
      "Wendy's Small Frosty Vanilla",
    );
  });

  it('removes dangling em dashes', () => {
    expect(sanitizeFoodCardTitle('Cottage Inn Large Cheese Pizza —', 'cottage inn large cheese pizza')).toBe(
      'Cottage Inn Large Cheese Pizza',
    );
  });

  it('cleans USDA and packaged food titles with site suffixes', () => {
    expect(sanitizeFoodCardTitle('Greek Yogurt - FatSecret', 'greek yogurt')).toBe('Greek Yogurt');
    expect(sanitizeFoodCardTitle('Large Egg', 'large egg')).toBe('Large Egg');
  });
});

describe('applyFoodCardPresentation (every provider)', () => {
  const query = 'chipotle chicken bowl';

  it('formats nutrition pipeline rows', () => {
    const row = applyFoodCardPresentation(
      {
        source: 'fatSecret',
        name: 'CalorieKing',
        food_name: 'CalorieKing',
        calories: 500,
      },
      query,
    );
    expect(row.food_name).toBe('Chipotle Chicken Bowl');
    expect(row.source_subtitle).toBe('via FatSecret');
  });

  it('formats legacy Serper rows', () => {
    const row = applyFoodCardPresentation(
      {
        source: 'serper',
        name: 'Calories in Chipotle Chicken Bowl - MyFitnessPal',
        calories: 500,
      },
      query,
    );
    expect(row.food_name).toBe('Chipotle Chicken Bowl');
    expect(row.source_subtitle).toBe('via Web');
  });

  it('formats USDA rows', () => {
    const row = applyFoodCardPresentation(
      {
        source: 'usda',
        name: 'Chicken, broiler or fryers, breast, meat only, cooked, roasted',
        calories: 165,
      },
      'chicken breast',
    );
    expect(row.food_name).toContain('Chicken');
    expect(row.source_subtitle).toBe('via USDA');
  });

  it('formats Open Food Facts rows', () => {
    const row = applyFoodCardPresentation(
      {
        source: 'openfoodfacts',
        name: 'OpenFoodFacts',
        calories: 120,
      },
      'kind bar dark chocolate',
    );
    expect(row.food_name).toBe('Kind Bar Dark Chocolate');
    expect(row.source_subtitle).toBe('via Open Food Facts');
  });

  it('batch-applies to mixed result lists', () => {
    const rows = applyFoodCardPresentationToRows(
      [
        { source: 'nutrition_consensus', name: 'Big Mac —', source_subtitle: 'via FatSecret' },
        { source: 'serper', name: 'PDF Nutrition Facts Big Mac' },
      ],
      'big mac',
    );
    expect(rows[0].food_name).toBe('Big Mac');
    expect(rows[1].food_name).toBe('Big Mac');
  });
});
