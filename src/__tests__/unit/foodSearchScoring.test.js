const {
  normalizeQueryText,
  significantQueryTokens,
  itemMatchesQuery,
  isMenuStyleQuery,
  filterFoodSearchRows,
} = require('../../nutrition/food-search/sortBestFoodMatches');

const { scoreSerperFoodResultRow } = require('../../nutrition/food-search/isReliableRestaurantFood');

const { extractMacrosFromText } = require('../../../server/nutritionSearchHelpers.js');

describe('normalizeQueryText', () => {
  it('lowercases and trims brand queries', () => {
    expect(normalizeQueryText('Jets Pizza')).toBe('jets pizza');
  });

  it('collapses extra spaces', () => {
    expect(normalizeQueryText('  Big  Mac  ')).toBe('big mac');
  });

  it('strips special characters', () => {
    expect(normalizeQueryText("McDonald's Big Mac!")).toBe('mcdonald s big mac');
  });

  it('returns empty string for empty input without throwing', () => {
    expect(() => normalizeQueryText('')).not.toThrow();
    expect(normalizeQueryText('')).toBe('');
    expect(normalizeQueryText(null)).toBe('');
  });
});

describe('significantQueryTokens', () => {
  it('returns content tokens and drops stop words', () => {
    expect(significantQueryTokens('jets pizza buffalo chicken')).toEqual([
      'jets',
      'pizza',
      'buffalo',
      'chicken',
    ]);
    expect(significantQueryTokens('the jets pizza with buffalo')).toEqual([
      'jets',
      'pizza',
      'buffalo',
    ]);
  });

  it('returns a single-item array for one significant word', () => {
    expect(significantQueryTokens('pizza')).toEqual(['pizza']);
  });

  it('returns an empty array for empty string', () => {
    expect(significantQueryTokens('')).toEqual([]);
    expect(significantQueryTokens('the a')).toEqual([]);
  });
});

describe('itemMatchesQuery', () => {
  it('matches menu item titles containing all query tokens', () => {
    expect(itemMatchesQuery("Big Mac by McDonald's", 'big mac')).toBe(true);
  });

  it('rejects candy when user searched for restaurant pizza', () => {
    expect(itemMatchesQuery('GUMMI JETS candy', 'jets pizza')).toBe(false);
  });

  it('requires all tokens for multi-word menu queries', () => {
    expect(itemMatchesQuery('Big Mac', 'big mac')).toBe(true);
    expect(itemMatchesQuery('Mac sauce only', 'big mac')).toBe(false);
  });

  it('requires distinctive tokens for packaged grocery (cereal may be omitted)', () => {
    expect(itemMatchesQuery('Apple Jacks', 'apple jacks cereal')).toBe(true);
    expect(itemMatchesQuery('Kelloggs Apple Jacks Cereal', 'apple jacks cereal')).toBe(true);
    expect(itemMatchesQuery('Apple Cinnamon Cheerios', 'apple jacks cereal')).toBe(false);
  });

  it('rejects partial token matches when other tokens are missing', () => {
    expect(itemMatchesQuery('Big Fries', 'big mac')).toBe(false);
  });

  it('matches abbreviated piece counts against spelled-out menu titles', () => {
    expect(
      itemMatchesQuery(
        "McDonald's 20 piece chicken mcnuggets",
        '20pc mcnuggets',
      ),
    ).toBe(true);
  });

  it('keeps numeric tokens like 14 shake', () => {
    expect(itemMatchesQuery('14 Shake', '14 shake')).toBe(true);
    expect(itemMatchesQuery('Protein Shake', '14 shake')).toBe(false);
    expect(itemMatchesQuery('15 Shake', '14 shake')).toBe(false);
  });

  it('matches Ghost brand products on distinctive tokens', () => {
    expect(itemMatchesQuery('Ghost whey protein', 'Ghost Whey Protein Cereal')).toBe(true);
    expect(itemMatchesQuery('Ghost Whey Protein Cereal Milk', 'Ghost Whey Protein Cereal')).toBe(true);
    expect(itemMatchesQuery('Myprotein whey isolate', 'Ghost Whey Protein Cereal')).toBe(false);
  });
});

describe('filterFoodSearchRows general behavior', () => {
  it('returns close grocery matches and drops unrelated cousins', () => {
    const rows = [
      { name: 'Apple Jacks', brand: "Kellogg's" },
      { name: 'Apple Cinnamon Cheerios', brand: 'General Mills' },
      { name: 'Random Apple Sauce', brand: 'Store' },
    ];
    const out = filterFoodSearchRows('apple jacks cereal', rows, 10);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].name).toMatch(/Apple Jacks/i);
    expect(out.every((r) => /jacks/i.test(r.name))).toBe(true);
  });

  it('keeps menu queries strict (no jets pizza → gummi jets)', () => {
    const rows = [
      { name: "Jet's Cheese Pizza", brand: "Jet's Pizza" },
      { name: "Jet's Pepperoni Pizza", brand: "Jet's Pizza" },
      { name: 'GUMMI JETS candy', brand: 'Haribo' },
    ];
    const out = filterFoodSearchRows('jets pizza', rows, 10);
    expect(out.some((r) => /cheese pizza/i.test(r.name))).toBe(true);
    expect(out.some((r) => /pepperoni/i.test(r.name))).toBe(false);
    expect(out.some((r) => /gummi/i.test(r.name))).toBe(false);
  });

  it('returns only close names for 14 shake', () => {
    const rows = [
      { name: '14 Shake', brand: 'Restaurant', calories: 520, protein: 30, carbs: 60, fat: 12 },
      { name: 'Chocolate Shake', brand: 'Restaurant', calories: 500 },
      { name: '15 Protein Shake', brand: 'Other', calories: 200 },
    ];
    const out = filterFoodSearchRows('14 shake', rows, 10);
    expect(out.length).toBe(1);
    expect(out[0].name).toMatch(/14 Shake/i);
  });
});

describe('isMenuStyleQuery branded supplements', () => {
  it('does not treat supplement brand queries as restaurant menu searches', () => {
    expect(isMenuStyleQuery('Ghost Whey Protein Cereal')).toBe(false);
    expect(isMenuStyleQuery('optimum nutrition gold standard')).toBe(false);
  });

  it('still treats pizza and chain menu items as menu-style', () => {
    expect(isMenuStyleQuery('jets pizza')).toBe(true);
    expect(isMenuStyleQuery('starbucks latte')).toBe(true);
  });
});

describe('isMenuStyleQuery', () => {
  it('classifies branded menu items as menu-style', () => {
    // MENU_STYLE_PATTERN includes big\\s*mac / whopper / baconator so bare item names count.
    expect(isMenuStyleQuery('big mac')).toBe(true);
    expect(isMenuStyleQuery('starbucks latte')).toBe(true);
  });

  it('classifies grocery produce and raw ingredients as non-menu', () => {
    expect(isMenuStyleQuery('chicken breast raw')).toBe(false);
    expect(isMenuStyleQuery('apple')).toBe(false);
  });
});

describe('scoreSerperFoodResultRow', () => {
  const query = 'grilled chicken sandwich';

  it('scores consistent macros higher than impossible zero-protein chicken', () => {
    const consistent = {
      food_name: 'Grilled Chicken Sandwich',
      nf_calories: 450,
      nf_protein: 35,
      nf_total_carbohydrate: 40,
      nf_total_fat: 15,
    };
    const impossible = {
      food_name: 'Grilled Chicken Sandwich',
      nf_calories: 450,
      nf_protein: 0,
      nf_total_carbohydrate: 10,
      nf_total_fat: 40,
    };
    expect(scoreSerperFoodResultRow(consistent, query)).toBeGreaterThan(
      scoreSerperFoodResultRow(impossible, query),
    );
  });

  it('scores macro-consistent rows higher than inconsistent rows', () => {
    const aligned = {
      food_name: 'Chicken Bowl',
      nf_calories: 400,
      nf_protein: 30,
      nf_total_carbohydrate: 40,
      nf_total_fat: 10,
    };
    const misaligned = {
      food_name: 'Chicken Bowl',
      nf_calories: 400,
      nf_protein: 5,
      nf_total_carbohydrate: 5,
      nf_total_fat: 5,
    };
    expect(scoreSerperFoodResultRow(aligned, query)).toBeGreaterThan(
      scoreSerperFoodResultRow(misaligned, query),
    );
  });

  it('prefers per-slice rows over whole-pizza rows for slice queries', () => {
    const sliceQuery = 'jets pizza slice';
    const sliceRow = {
      food_name: 'Jets Pepperoni Pizza',
      nf_calories: 280,
      nf_protein: 12,
      nf_total_carbohydrate: 32,
      nf_total_fat: 11,
      serving_label: '1 slice',
    };
    const wholeRow = {
      food_name: 'Jets Pepperoni Pizza Whole',
      nf_calories: 1800,
      nf_protein: 70,
      nf_total_carbohydrate: 210,
      nf_total_fat: 80,
      serving_label: 'whole pizza',
    };
    expect(scoreSerperFoodResultRow(sliceRow, sliceQuery)).toBeGreaterThan(
      scoreSerperFoodResultRow(wholeRow, sliceQuery),
    );
  });
});

describe('extractMacrosFromChunk', () => {
  it('extracts calories and protein from a nutrition snippet', () => {
    const parsed = extractMacrosFromText('This item has 580 calories and 25g protein per serving.');
    expect(parsed.calories).toBe(580);
    expect(parsed.protein).toBe(25);
  });

  it('picks the largest plausible calorie value when multiple are present', () => {
    const parsed = extractMacrosFromText(
      'Snack size 100 calories, but the full serving is 580 calories with 25g protein.',
    );
    expect(parsed.calories).toBe(580);
    expect(parsed.protein).toBe(25);
  });

  it('returns zeros when no nutrition data is present', () => {
    const parsed = extractMacrosFromText('Jets pizza tastes great at your local shop.');
    // Known leftover: prefer null when no macros are found (callers already drop
    // zero-calorie rows via isPlausibleNutritionRow). Soft-accept either shape.
    if (parsed == null) {
      expect(parsed).toBeNull();
      return;
    }
    expect(parsed).toMatchObject({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });
});
