const {
  parseNutritionSearchQuery,
  mapConsensusToFoodRow,
  mapNutritionSearchToFoodRows,
  mergeNutritionSearchWithLegacy,
} = require('../../nutrition/food-search/mergeFoodNutritionSources');

describe('parseNutritionSearchQuery', () => {
  it('splits Jet\'s pizza queries into restaurant + item', () => {
    expect(parseNutritionSearchQuery('Jets four corner pizza')).toEqual({
      foodName: 'four corner pizza',
      restaurant: "Jet's Pizza",
    });
  });

  it('splits mcnuggets queries', () => {
    expect(parseNutritionSearchQuery('20pc mcnuggets')).toMatchObject({
      restaurant: "McDonald's",
    });
  });

  it('keeps plain grocery queries as foodName only', () => {
    expect(parseNutritionSearchQuery('Large Egg')).toEqual({
      foodName: 'Large Egg',
      restaurant: null,
    });
  });
});

describe('mapConsensusToFoodRow', () => {
  it('maps consensus payload into a loggable food row', () => {
    const row = mapConsensusToFoodRow(
      {
        query: { foodName: 'four corner pizza', restaurant: "Jet's Pizza" },
        consensus: {
          calories: { value: 320, sources_agreeing: 4, range: [310, 330], variance: '3%' },
          protein_g: { value: 14, sources_agreeing: 3, range: [13, 15], variance: '5%' },
        },
        sources_used: ['Serper', 'FatSecret'],
        sourceResults: [
          { sourceKey: 'fatSecret', source: 'FatSecret', calories: 320 },
        ],
        cacheHit: false,
        fallbackUsed: false,
      },
      "Jets four corner pizza",
    );

    expect(row).toMatchObject({
      name: 'Jets Four Corner Pizza',
      calories: 320,
      protein: 14,
      source: 'nutrition_consensus',
      source_subtitle: expect.stringMatching(/^via /),
      restaurant: "Jet's Pizza",
    });
  });

  it('rejects low-confidence fallback consensus rows', () => {
    const row = mapConsensusToFoodRow(
      {
        query: { foodName: '20pc mcnuggets', restaurant: "McDonald's" },
        consensus: {
          calories: { value: 27, sources_agreeing: 1, range: [27, 27], variance: '0%' },
        },
        sources_used: ['CalorieKing'],
        fallbackUsed: true,
      },
      '20pc mcnuggets',
    );
    expect(row).toBeNull();
  });
});

describe('mapNutritionSearchToFoodRows', () => {
  it('returns consensus as the primary row when sources agree', () => {
    const rows = mapNutritionSearchToFoodRows(
      {
        query: { foodName: '20 piece mcnuggets', restaurant: "McDonald's" },
        consensus: {
          calories: { value: 850, sources_agreeing: 3, range: [830, 890], variance: '7%' },
        },
        sourceResults: [
          {
            sourceKey: 'fatSecret',
            source: 'FatSecret',
            calories: 830,
            displayName: '20 Piece Chicken McNuggets',
          },
          {
            sourceKey: 'foodFacto',
            source: 'FoodFacto',
            calories: 830,
            displayName: 'Chicken McNuggets (20 piece)',
          },
        ],
        fallbackUsed: false,
      },
      '20pc mcnuggets',
    );

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].source).toBe('nutrition_consensus');
    expect(Number(rows[0].calories)).toBe(850);
    expect(rows[0].source_subtitle).toMatch(/^via /);
  });

  it('names consensus card from the user query', () => {
    const rows = mapNutritionSearchToFoodRows(
      {
        query: { foodName: 'cheese bread', restaurant: "Domino's" },
        consensus: {
          calories: { value: 160, sources_agreeing: 2, range: [155, 165], variance: '6%' },
        },
        sourceResults: [
          { sourceKey: 'calorieKing', source: 'CalorieKing', calories: 800, displayName: 'CalorieKing' },
          { sourceKey: 'fatSecret', source: 'FatSecret', calories: 160, displayName: 'Stuffed Cheesy Bread' },
        ],
        fallbackUsed: false,
      },
      'dominos cheese bread',
    );
    expect(rows[0].source).toBe('nutrition_consensus');
    expect(rows[0].name).toMatch(/cheese bread/i);
    expect(Number(rows[0].calories)).toBe(160);
  });

  it('returns source-only rows when consensus missing', () => {
    const rows = mapNutritionSearchToFoodRows(
      {
        query: { foodName: 'four corner slice', restaurant: "Jet's Pizza" },
        consensus: {},
        sourceResults: [
          { sourceKey: 'fatSecret', source: 'FatSecret', calories: 400 },
        ],
      },
      "Jets four corner",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('fatSecret');
  });
});

describe('mergeNutritionSearchWithLegacy', () => {
  it('pins nutrition rows first and removes near-duplicate legacy hits', () => {
    const nutrition = [
      {
        id: 'c1',
        name: "Jet's Pizza Four Corner",
        calories: 400,
        source: 'nutrition_consensus',
      },
      {
        id: 's1',
        name: 'Four Corner',
        calories: 400,
        source: 'fatSecret',
      },
    ];
    const legacy = [
      { id: 'l1', name: 'Four Corner Pizza Jets', calories: 398, source: 'serper' },
      { id: 'l2', name: 'Side Salad', calories: 80, source: 'serper' },
      { id: 'l3', name: 'Garden Side', calories: 60, source: 'usda' },
    ];
    const merged = mergeNutritionSearchWithLegacy(nutrition, legacy, 10);
    expect(merged[0].id).toBe('c1');
    // FatSecret present → drop Serper legacy; keep non-Serper extras.
    expect(merged.find((r) => r.id === 'l1')).toBeFalsy();
    expect(merged.find((r) => r.id === 'l2')).toBeFalsy();
    expect(merged.find((r) => r.id === 'l3')).toBeTruthy();
  });
});
