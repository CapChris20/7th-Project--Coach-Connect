const {
  isJunkWebSearchTitle,
  isJunkFoodTitle,
  sanitizeFoodCardTitle,
  applyFoodCardPresentation,
  dedupeFoodRows,
} = require('../../nutrition/food-search/cleanFoodCardLabels');
const {
  servingConflictsWithFood,
  servingLabelFromQueryStructure,
  resolveFoodServingLabel,
  looksLikeMultiBreadOrder,
} = require('../../nutrition/food-search/guessServingSize');
const {
  filterUsableSerperRows,
  scoreSerperFoodResultRow,
  rankSerperFoodResultRows,
} = require('../../nutrition/food-search/isReliableRestaurantFood');
const {
  filterFoodSearchRows,
  scoreFoodSearchRelevance,
  isMenuStyleQuery,
  menuItemTokensFromQuery,
} = require('../../nutrition/food-search/sortBestFoodMatches');
const {
  mapNutritionSearchToFoodRows,
} = require('../../nutrition/food-search/mergeFoodNutritionSources');

describe('trustedFoodCatalog', () => {
  const { lookupTrustedFoods } = require('../../nutrition/food-search/trustedFoodCatalog');

  it('returns Crazy Bread for Little Caesars crazy bread', () => {
    const rows = lookupTrustedFoods("Little Caesar's crazy bread");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].food_name).toMatch(/Crazy Bread/i);
    expect(rows[0].serving_label).toMatch(/breadstick/i);
    expect(rows[0].calories).toBe(100);
  });

  it('returns Big Mac for McDonalds Big Mac', () => {
    const rows = lookupTrustedFoods("McDonald's Big Mac");
    expect(rows[0].food_name).toMatch(/Big Mac/i);
    expect(rows[0].calories).toBeGreaterThan(500);
  });
});

describe('junk title guards', () => {
  it('flags Crazy Breadmenu Items as junk', () => {
    expect(isJunkWebSearchTitle('Crazy Breadmenu Items')).toBe(true);
    expect(isJunkFoodTitle('Crazy Breadmenu Items')).toBe(true);
  });

  it('cleans Breadmenu junk to the user query', () => {
    expect(
      sanitizeFoodCardTitle('Crazy Breadmenu Items', "Little Caesar's crazy bread"),
    ).toMatch(/Crazy Bread/i);
  });

  it('flags tracker / GS1 / menu-items noise', () => {
    expect(isJunkWebSearchTitle('GS1 Tracker Nutrition')).toBe(true);
    expect(isJunkWebSearchTitle('Little Caesars Menu Items')).toBe(true);
  });
});

describe('serving / food conflicts', () => {
  it('rejects bread name with nugget serving', () => {
    expect(
      servingConflictsWithFood({
        userQuery: "Little Caesar's crazy bread",
        foodName: 'Crazy Bread',
        servingLabel: '10 pc nuggets',
      }),
    ).toBe(true);
  });

  it('rejects bread name with wing serving', () => {
    expect(
      servingConflictsWithFood({
        userQuery: 'crazy bread',
        foodName: 'Crazy Bread',
        servingLabel: '8 pc wings',
      }),
    ).toBe(true);
  });

  it('allows breadstick serving on crazy bread', () => {
    expect(
      servingConflictsWithFood({
        userQuery: 'crazy bread',
        foodName: 'Crazy Bread',
        servingLabel: '1 breadstick',
      }),
    ).toBe(false);
  });

  it('never attaches nugget counts to bread query structure', () => {
    expect(servingLabelFromQueryStructure("Little Caesar's crazy bread")).toBe('1 breadstick');
    expect(
      resolveFoodServingLabel({
        userQuery: "Little Caesar's crazy bread",
        foodName: 'Crazy Bread',
        scraperLabel: '10 pc nuggets',
      }),
    ).toBe('1 breadstick');
  });

  it('relabels high-cal multi bread order instead of 1 piece', () => {
    expect(looksLikeMultiBreadOrder(980, '1 piece', 'bread')).toBe(true);
    expect(
      resolveFoodServingLabel({
        userQuery: 'crazy bread',
        foodName: 'Crazy Bread',
        scraperLabel: '1 piece',
        calories: 980,
      }),
    ).toMatch(/order|multi/i);
  });
});

describe('Serper ranking quality guards', () => {
  const query = "Little Caesar's crazy bread";

  it('filters out nugget-serving rows for crazy bread queries', () => {
    const rows = [
      {
        food_name: 'Crazy Bread',
        source: 'serper',
        serving_label: '10 pc nuggets',
        nf_calories: 440,
        nf_protein: 20,
        nf_total_carbohydrate: 40,
        nf_total_fat: 20,
      },
      {
        food_name: 'Crazy Bread',
        source: 'fatSecret',
        serving_label: '1 breadstick',
        nf_calories: 100,
        nf_protein: 3,
        nf_total_carbohydrate: 15,
        nf_total_fat: 3,
      },
    ];
    const usable = filterUsableSerperRows(rows, query);
    expect(usable.every((r) => !/nugget/i.test(r.serving_label || ''))).toBe(true);
    expect(usable.some((r) => /breadstick/i.test(r.serving_label || ''))).toBe(true);
  });

  it('ranks exact crazy bread above unrelated pizzas', () => {
    const bread = {
      food_name: 'Little Caesars Crazy Bread',
      source: 'fatSecret',
      serving_label: '1 breadstick',
      nf_calories: 100,
      nf_protein: 3,
      nf_total_carbohydrate: 15,
      nf_total_fat: 3,
    };
    const pizza = {
      food_name: 'Little Caesars Pepperoni Pizza',
      source: 'serper',
      serving_label: '1 slice',
      nf_calories: 280,
      nf_protein: 12,
      nf_total_carbohydrate: 32,
      nf_total_fat: 11,
    };
    expect(scoreSerperFoodResultRow(bread, query)).toBeGreaterThan(
      scoreSerperFoodResultRow(pizza, query),
    );
  });

  it('demotes incomplete high-cal zero-protein rows', () => {
    const good = {
      food_name: 'Crazy Bread',
      nf_calories: 100,
      nf_protein: 3,
      nf_total_carbohydrate: 15,
      nf_total_fat: 3,
      serving_label: '1 breadstick',
    };
    const bad = {
      food_name: 'Crazy Bread',
      nf_calories: 980,
      nf_protein: 0,
      nf_total_carbohydrate: 0,
      nf_total_fat: 40,
      serving_label: '1 piece',
    };
    expect(scoreSerperFoodResultRow(good, query)).toBeGreaterThan(
      scoreSerperFoodResultRow(bad, query),
    );
  });
});

describe('branded restaurant ranking', () => {
  it('treats crazy bread as menu-style', () => {
    expect(isMenuStyleQuery("Little Caesar's crazy bread")).toBe(true);
    expect(isMenuStyleQuery("McDonald's Big Mac")).toBe(true);
    expect(isMenuStyleQuery('Chipotle chicken bowl')).toBe(true);
  });

  it('extracts item tokens without the chain', () => {
    expect(menuItemTokensFromQuery("Little Caesar's crazy bread")).toEqual(
      expect.arrayContaining(['crazy', 'bread']),
    );
  });

  it('ranks exact item above unrelated menu items', () => {
    const rows = [
      { name: 'Pepperoni Pizza', brand: 'Little Caesars' },
      { name: 'Crazy Bread', brand: 'Little Caesars' },
      { name: 'Cheese Pizza', brand: 'Little Caesars' },
      { name: 'Pineapple Soda', brand: 'Little Caesars' },
    ];
    const out = filterFoodSearchRows("Little Caesar's crazy bread", rows, 10);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].name).toMatch(/Crazy Bread/i);
    expect(out.every((r) => !/pizza|soda/i.test(r.name))).toBe(true);
  });

  it('ranks Big Mac above nuggets for Big Mac query', () => {
    const rows = [
      { name: 'Chicken McNuggets', brand: "McDonald's" },
      { name: 'Big Mac', brand: "McDonald's" },
      { name: 'Medium Fries', brand: "McDonald's" },
    ];
    const out = filterFoodSearchRows("McDonald's Big Mac", rows, 10);
    expect(out[0].name).toMatch(/Big Mac/i);
  });
});

describe('near-duplicate dedupe', () => {
  it('collapses 99 vs 100 cal near-identical crazy bread rows', () => {
    const rows = [
      {
        food_name: 'Crazy Bread',
        brand: 'Little Caesars',
        nf_calories: 99,
        nf_protein: 0,
        nf_total_carbohydrate: 15,
        nf_total_fat: 3,
        serving_label: '1 breadstick',
      },
      {
        food_name: 'Crazy Bread',
        brand: 'Little Caesars',
        nf_calories: 100,
        nf_protein: 0,
        nf_total_carbohydrate: 15,
        nf_total_fat: 3,
        serving_label: '1 breadstick',
      },
    ];
    expect(dedupeFoodRows(rows)).toHaveLength(1);
  });
});

describe('presentation + DB preference', () => {
  it('presentation never leaves nugget serving on crazy bread', () => {
    const row = applyFoodCardPresentation(
      {
        source: 'serper',
        food_name: 'Crazy Bread',
        serving_label: '10 pc nuggets',
        nf_calories: 100,
        nf_protein: 3,
        nf_total_carbohydrate: 15,
        nf_total_fat: 3,
      },
      "Little Caesar's crazy bread",
    );
    expect(row.serving_label).not.toMatch(/nugget/i);
  });

  it('prefers FatSecret over consensus when both exist', () => {
    const payload = {
      query: { foodName: 'crazy bread', restaurant: 'Little Caesars' },
      sources_used: ['fatSecret', 'serper'],
      fallbackUsed: false,
      consensus: {
        calories: { value: 100, sources_agreeing: 2 },
        protein_g: { value: 3, sources_agreeing: 2 },
        carbs_g: { value: 15, sources_agreeing: 2 },
        fat_g: { value: 3, sources_agreeing: 2 },
      },
      sourceResults: [
        {
          sourceKey: 'fatSecret',
          source: 'FatSecret',
          displayName: 'Crazy Bread',
          calories: 100,
          protein_g: 3,
          carbs_g: 15,
          fat_g: 3,
          servingLabel: '1 breadstick',
        },
      ],
    };
    const rows = mapNutritionSearchToFoodRows(payload, "Little Caesar's crazy bread");
    expect(rows[0].source).toMatch(/fatSecret/i);
  });
});

describe('rankSerperFoodResultRows acceptance', () => {
  it('does not surface nugget serving as top crazy bread result', () => {
    const ranked = rankSerperFoodResultRows(
      [
        {
          food_name: 'Crazy Bread',
          serving_label: '10 pc nuggets',
          nf_calories: 440,
          nf_protein: 22,
          nf_total_carbohydrate: 30,
          nf_total_fat: 22,
          source: 'serper',
        },
        {
          food_name: 'Crazy Bread',
          serving_label: '1 breadstick',
          nf_calories: 100,
          nf_protein: 3,
          nf_total_carbohydrate: 15,
          nf_total_fat: 3,
          source: 'fatSecret',
        },
      ],
      "Little Caesar's crazy bread",
    );
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].serving_label).not.toMatch(/nugget/i);
  });
});
