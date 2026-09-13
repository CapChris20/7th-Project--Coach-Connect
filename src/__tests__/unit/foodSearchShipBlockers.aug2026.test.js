/**
 * Ship-blocker food search quality suite (NEW — Aug 2026).
 *
 * Brand-new file / brand-new cases. Not a rename of foodSearchQualityGuards
 * or foodSearchScoring. Targets quit-risk: junk SERP titles, poison macros,
 * wrong servings, and ranking that buries the real menu item.
 *
 * Run: npx jest src/__tests__/unit/foodSearchShipBlockers.aug2026.test.js --runInBand
 */
const {
  isJunkWebSearchTitle,
  isJunkFoodTitle,
  sanitizeFoodCardTitle,
  isPlausibleNutritionRow,
  dedupeFoodRows,
  applyFoodCardPresentation,
} = require('../../nutrition/food-search/cleanFoodCardLabels');
const {
  servingConflictsWithFood,
  resolveFoodServingLabel,
  isWeakServingLabel,
  looksLikeMultiBreadOrder,
} = require('../../nutrition/food-search/guessServingSize');
const {
  isPlausibleRestaurantNutritionRow,
  hasImplausibleZeroMacros,
  filterUsableSerperRows,
  rankSerperFoodResultRows,
  scoreSerperFoodResultRow,
} = require('../../nutrition/food-search/isReliableRestaurantFood');
const {
  filterFoodSearchRows,
  scoreFoodSearchRelevance,
  isMenuStyleQuery,
  hasUnrequestedFoodFamilyMismatch,
} = require('../../nutrition/food-search/sortBestFoodMatches');
const { lookupTrustedFoods } = require('../../nutrition/food-search/trustedFoodCatalog');
const { makeReadableFoodTitle } = require('../../nutrition/food-search/makeReadableFoodTitle');
const {
  mapNutritionSearchToFoodRows,
} = require('../../nutrition/food-search/mergeFoodNutritionSources');

function row(partial) {
  return {
    food_name: 'Food',
    brand_name: '',
    serving_label: '1 medium sandwich',
    calories: 200,
    protein: 10,
    carbs: 20,
    fat: 8,
    source: 'serper',
    ...partial,
  };
}

describe('SHIP: junk / tracker titles never win the card', () => {
  const poisonTitles = [
    'Nutrition Facts Label Scanner App',
    'CalorieKing Food Search Results Page',
    'Open Food Facts product list',
    'MyFitnessPal: Search 14 million foods',
    'USDA FoodData Central homepage',
    'Menu with prices PDF download',
    'Crazy Breadmenu Items',
    'GS1 DataBar nutrition barcode',
  ];

  test.each(poisonTitles)('flags as junk: %s', (title) => {
    expect(isJunkWebSearchTitle(title)).toBe(true);
    expect(isJunkFoodTitle(title)).toBe(true);
  });

  test('sanitize falls back to the user query instead of showing poison', () => {
    const cleaned = sanitizeFoodCardTitle(
      'MyFitnessPal: Search 14 million foods',
      'chipotle chicken bowl',
    );
    expect(cleaned.toLowerCase()).toMatch(/chipotle|chicken|bowl/);
    expect(cleaned.toLowerCase()).not.toMatch(/myfitnesspal|million foods/);
  });

  test('makeReadableFoodTitle rewrites junk brand pages to the query', () => {
    const { name } = makeReadableFoodTitle({
      name: 'CalorieKing Food Search Results Page',
      brand: 'CalorieKing',
      userQuery: 'five guys little cheeseburger',
    });
    expect(name.toLowerCase()).toMatch(/five guys|cheeseburger|little/);
    expect(name.toLowerCase()).not.toMatch(/calorieking/);
  });
});

describe('SHIP: zero / nonsense macros are rejected', () => {
  test('all-zero macros are implausible', () => {
    expect(hasImplausibleZeroMacros({ calories: 0, protein: 0, carbs: 0, fat: 0 })).toBe(true);
    expect(isPlausibleRestaurantNutritionRow({ calories: 0, protein: 0, carbs: 0, fat: 0 })).toBe(
      false,
    );
    expect(isPlausibleNutritionRow({ calories: 0, protein: 0, carbs: 0, fat: 0 })).toBe(false);
  });

  test('calories that cannot match macros are rejected', () => {
    // 50 kcal claimed but macros alone are ~400+ kcal
    expect(
      isPlausibleRestaurantNutritionRow({ calories: 50, protein: 40, carbs: 40, fat: 20 }),
    ).toBe(false);
  });

  test('normal burger macros pass', () => {
    expect(
      isPlausibleRestaurantNutritionRow({ calories: 540, protein: 25, carbs: 45, fat: 28 }),
    ).toBe(true);
  });
});

describe('SHIP: serving labels must match the food', () => {
  test('bread item cannot use a nugget serving', () => {
    expect(
      servingConflictsWithFood({
        userQuery: 'dominos garlic bread',
        foodName: 'Garlic Bread',
        servingLabel: '10 piece chicken nuggets',
      }),
    ).toBe(true);
  });

  test('soda cannot use a pizza slice serving', () => {
    expect(
      servingConflictsWithFood({
        userQuery: 'coca cola 12 oz can',
        foodName: 'Coca-Cola',
        servingLabel: '1 large pizza slice',
      }),
    ).toBe(true);
  });

  test('weak generic labels are flagged', () => {
    expect(isWeakServingLabel('serving')).toBe(true);
    expect(isWeakServingLabel('1')).toBe(true);
    expect(isWeakServingLabel('1 serving')).toBe(true);
    expect(isWeakServingLabel('1 medium sandwich')).toBe(false);
  });

  test('multi breadstick order calorie+label pattern is detected', () => {
    // API: (calories, label, category) — high-cal "1 piece" bread = full order mislabeled
    expect(looksLikeMultiBreadOrder(900, '1 piece', 'bread')).toBe(true);
    expect(looksLikeMultiBreadOrder(100, '1 breadstick', 'bread')).toBe(false);
  });

  test('resolveFoodServingLabel prefers structured query amount', () => {
    const label = resolveFoodServingLabel({
      userQuery: 'wings 6 piece',
      foodName: 'Chicken Wings',
      servingLabel: '1 serving',
      source: 'serper',
    });
    expect(String(label).toLowerCase()).toMatch(/6|piece|wing/);
  });
});

describe('SHIP: ranking prefers the actual menu item over noise', () => {
  test('big mac is treated as a menu-style query', () => {
    expect(isMenuStyleQuery('big mac')).toBe(true);
    expect(isMenuStyleQuery("mcdonald's big mac")).toBe(true);
  });

  test('chicken sandwich query rejects a pizza result family', () => {
    expect(
      hasUnrequestedFoodFamilyMismatch(
        'Pepperoni Pizza Pizza Hut',
        'chick fil a chicken sandwich',
      ),
    ).toBe(true);
  });

  test('filterFoodSearchRows drops junk-titled rows for a clean query', () => {
    const filtered = filterFoodSearchRows(
      'burger king whopper',
      [
        row({ food_name: 'Whopper', brand_name: 'Burger King', calories: 670 }),
        row({
          food_name: 'Menu with prices PDF download',
          brand_name: 'Tracker',
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        }),
      ],
    );
    const names = filtered.map((r) => r.food_name);
    expect(names.some((n) => /whopper/i.test(n))).toBe(true);
    expect(names.every((n) => !/menu with prices|pdf download/i.test(n))).toBe(true);
  });

  test('scoreFoodSearchRelevance ranks exact item above unrelated', () => {
    const good = scoreFoodSearchRelevance('Chipotle Steak Bowl', 'chipotle steak bowl');
    const bad = scoreFoodSearchRelevance('Apple Juice Box Generic', 'chipotle steak bowl');
    expect(good).toBeGreaterThan(bad);
  });

  test('rankSerperFoodResultRows puts matching food card first', () => {
    const ranked = rankSerperFoodResultRows(
      [
        row({
          food_name: 'Apple Juice Box',
          brand_name: 'Generic',
          calories: 120,
          protein: 0,
          carbs: 28,
          fat: 0,
        }),
        row({
          food_name: 'Spicy Chicken Sandwich',
          brand_name: "Wendy's",
          calories: 500,
          protein: 30,
          carbs: 42,
          fat: 20,
        }),
      ],
      "wendy's spicy chicken sandwich",
    );
    expect(ranked[0].food_name).toMatch(/Spicy Chicken/i);
  });

  test('filterUsableSerperRows keeps plausible menu rows and drops zero poison', () => {
    const usable = filterUsableSerperRows(
      [
        row({
          food_name: 'GS1 Tracker Nutrition',
          brand_name: 'Tracker',
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        }),
        row({
          food_name: 'Double-Double',
          brand_name: 'In-N-Out',
          calories: 670,
          protein: 37,
          carbs: 41,
          fat: 41,
        }),
      ],
      'in n out double double',
    );
    expect(usable.length).toBeGreaterThan(0);
    expect(usable.every((r) => !/gs1|tracker/i.test(r.food_name))).toBe(true);
  });
});

describe('SHIP: trusted catalog beats random web junk for known items', () => {
  test('McDonald Big Mac has real calories from catalog', () => {
    const rows = lookupTrustedFoods("McDonald's Big Mac");
    expect(rows[0].food_name).toMatch(/Big Mac/i);
    expect(Number(rows[0].calories)).toBeGreaterThan(400);
    expect(Number(rows[0].calories)).toBeLessThan(900);
  });

  test('Little Caesars Crazy Bread catalog row is not a junk title', () => {
    const rows = lookupTrustedFoods("Little Caesar's crazy bread");
    expect(rows.length).toBeGreaterThan(0);
    expect(isJunkFoodTitle(rows[0].food_name)).toBe(false);
    expect(Number(rows[0].calories)).toBeGreaterThan(0);
  });
});

describe('SHIP: presentation + dedupe do not resurrect junk', () => {
  test('applyFoodCardPresentation cleans poison title', () => {
    const presented = applyFoodCardPresentation(
      row({
        food_name: 'Crazy Breadmenu Items',
        brand_name: 'Little Caesars',
      }),
      "Little Caesar's crazy bread",
    );
    expect(isJunkFoodTitle(presented.food_name || presented.name)).toBe(false);
  });

  test('dedupeFoodRows collapses near-identical cards', () => {
    const deduped = dedupeFoodRows([
      row({ food_name: 'Big Mac', brand_name: "McDonald's", calories: 590 }),
      row({ food_name: 'Big Mac', brand_name: "McDonald's", calories: 590 }),
      row({ food_name: 'Big Mac Sandwich', brand_name: "McDonald's", calories: 590 }),
    ]);
    expect(deduped.length).toBeLessThan(3);
  });
});

describe('SHIP: consensus mapper never emits junk-only cards', () => {
  test('mapNutritionSearchToFoodRows prefers a real food name', () => {
    const rows = mapNutritionSearchToFoodRows(
      {
        query: { restaurant: 'Starbucks', foodName: 'Caffe Latte' },
        fallbackUsed: false,
        sources_used: ['fatSecret', 'calorieKing'],
        consensus: {
          calories: { value: 190, sources_agreeing: 2 },
          protein_g: { value: 13, sources_agreeing: 2 },
          carbs_g: { value: 18, sources_agreeing: 2 },
          fat_g: { value: 7, sources_agreeing: 2 },
          serving: { value: 'Grande 16 fl oz', sources_agreeing: 2 },
        },
        sourceResults: [],
      },
      'starbucks caffe latte grande',
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(isJunkFoodTitle(rows[0].food_name || rows[0].name)).toBe(false);
    expect(Number(rows[0].calories)).toBeGreaterThan(0);
  });
});

describe('SHIP: serper scorer prefers matching menu cards', () => {
  test('official-looking menu card scores higher than unrelated juice', () => {
    const query = 'taco bell crunchwrap supreme';
    const brandPage = scoreSerperFoodResultRow(
      row({
        food_name: 'Crunchwrap Supreme',
        brand_name: 'Taco Bell',
        calories: 530,
        protein: 16,
        carbs: 71,
        fat: 21,
        _organicScore: 40,
      }),
      query,
    );
    const blog = scoreSerperFoodResultRow(
      row({
        food_name: 'Apple Juice Box',
        brand_name: 'Generic',
        calories: 120,
        protein: 0,
        carbs: 28,
        fat: 0,
        _organicScore: 5,
      }),
      query,
    );
    expect(brandPage).toBeGreaterThan(blog);
  });
});
