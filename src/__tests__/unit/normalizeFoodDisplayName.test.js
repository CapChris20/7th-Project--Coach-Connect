const {
  makeReadableFoodTitle,
  normalizeFoodRecordForStorage,
  collapseRepeatedNameSegments,
  smartTitleCase,
} = require('../../nutrition/food-search/makeReadableFoodTitle');

describe('makeReadableFoodTitle', () => {
  it('title-cases ALL CAPS packaged foods', () => {
    expect(makeReadableFoodTitle({ name: 'KIND BAR DARK CHOCOLATE NUTS & SEA SALT' }).name).toBe(
      'Kind Bar Dark Chocolate Nuts & Sea Salt',
    );
  });

  it('collapses repeated comma segments', () => {
    expect(
      makeReadableFoodTitle({
        name: 'Real Chocolate Chip Cookies, Real Chocolate Chip',
      }).name,
    ).toBe('Real Chocolate Chip Cookies');
  });

  it('strips site suffixes and uses user query for junk titles', () => {
    expect(
      makeReadableFoodTitle({
        name: 'CalorieKing',
        userQuery: "wendy's small frosty vanilla",
      }).name,
    ).toBe("Wendy's Small Frosty Vanilla");
  });

  it('shortens USDA scientific descriptions', () => {
    const { name } = makeReadableFoodTitle({
      name: 'Chicken, broiler or fryers, breast, meat only, cooked, roasted',
      source: 'usda',
    });
    expect(name).toContain('Chicken');
    expect(name.length).toBeLessThan(80);
  });

  it('strips trademark symbols and retailer suffixes', () => {
    expect(
      makeReadableFoodTitle({
        name: 'Ghost® Whey Protein — Walmart',
      }).name,
    ).toBe('Ghost Whey Protein');
  });

  it('removes brand prefix when brand field is explicit', () => {
    const { name, brand } = makeReadableFoodTitle({
      name: 'Chobani Greek Yogurt, Plain',
      brand: 'Chobani',
    });
    expect(brand).toBe('Chobani');
    expect(name.toLowerCase()).not.toMatch(/^chobani\b/);
  });
});

describe('normalizeFoodRecordForStorage', () => {
  it('writes cleaned name to both name and food_name', () => {
    const out = normalizeFoodRecordForStorage({
      name: 'GREEK YOGURT - FATSECRET',
      source: 'fatsecret',
    });
    expect(out.name).toBe('Greek Yogurt');
    expect(out.food_name).toBe('Greek Yogurt');
  });
});

describe('helpers', () => {
  it('collapseRepeatedNameSegments dedupes overlapping parts', () => {
    expect(collapseRepeatedNameSegments('Big Mac, Big Mac')).toBe('Big Mac');
  });

  it('smartTitleCase preserves short uppercase tokens', () => {
    expect(smartTitleCase('IN-N-OUT DOUBLE-DOUBLE')).toBe('IN-N-OUT Double-Double');
  });
});
