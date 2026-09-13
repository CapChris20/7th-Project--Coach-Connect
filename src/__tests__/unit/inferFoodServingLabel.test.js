const {
  isWeakServingLabel,
  servingLabelFromQueryStructure,
  resolveFoodServingLabel,
  formatServingDisplayLine,
} = require('../../nutrition/food-search/guessServingSize');

describe('guessServingSize', () => {
  it('flags generic gram labels as weak', () => {
    expect(isWeakServingLabel('100g serving')).toBe(true);
    expect(isWeakServingLabel('per 100g')).toBe(true);
    expect(isWeakServingLabel('1 serving')).toBe(true);
    expect(isWeakServingLabel('1 slice')).toBe(false);
  });

  it('infers pizza as slice', () => {
    expect(servingLabelFromQueryStructure('cottage inn large cheese pizza')).toBe('1 slice');
    expect(servingLabelFromQueryStructure('jets four corner pizza')).toBe('1 slice');
  });

  it('infers nugget counts from query', () => {
    expect(servingLabelFromQueryStructure('20pc mcnuggets')).toBe('20 pc nuggets');
  });

  it('infers bread as piece', () => {
    expect(servingLabelFromQueryStructure('dominos cheese bread')).toBe('1 piece');
  });

  it('infers crazy bread as breadstick and rejects nugget scraper labels', () => {
    expect(servingLabelFromQueryStructure("little caesars crazy bread")).toBe('1 breadstick');
    expect(
      resolveFoodServingLabel({
        userQuery: "little caesars crazy bread",
        foodName: 'Crazy Bread',
        scraperLabel: '10 pc nuggets',
      }),
    ).toBe('1 breadstick');
  });

  it('relabels high-cal single-piece bread as multi/order', () => {
    expect(
      resolveFoodServingLabel({
        userQuery: 'crazy bread',
        foodName: 'Crazy Bread',
        scraperLabel: '1 piece',
        calories: 980,
      }),
    ).toMatch(/order|multi/i);
  });

  it('infers burgers as sandwich', () => {
    expect(servingLabelFromQueryStructure('wendys baconator')).toBe('1 sandwich');
  });

  it('infers chips as one serving', () => {
    expect(servingLabelFromQueryStructure('doritos nacho cheese chips')).toBe('1 serving');
  });

  it('infers frosty size from query', () => {
    expect(servingLabelFromQueryStructure('wendys small frosty vanilla')).toBe('Small');
  });

  it('labels cheese sticks / breadsticks by calories for any brand', () => {
    expect(
      resolveFoodServingLabel({
        userQuery: "papa john's garlic parmesan cheese sticks",
        foodName: 'Garlic Parmesan Cheese Sticks',
        scraperLabel: '10 pc buff',
        calories: 340,
      }),
    ).toBe('2 cheese sticks');
  });

  it('keeps pizza serving when name mentions wings', () => {
    expect(
      formatServingDisplayLine(
        {
          food_name: 'Buffalo Wing Pizza',
          serving_label: '8 pc wings',
          nf_calories: 280,
        },
        'buffalo wing pizza',
      ),
    ).toBe('1 slice');
  });

  it('resolves weak scraper labels using the user query', () => {
    expect(
      resolveFoodServingLabel({
        userQuery: 'cottage inn large cheese pizza',
        foodName: 'Large Cheese Pizza',
        scraperLabel: '100g',
      }),
    ).toBe('1 slice');
  });

  it('formats display line without 100g serving for menu items', () => {
    expect(
      formatServingDisplayLine(
        {
          source: 'fatSecret',
          food_name: 'Large Cheese Pizza',
          serving_grams: 100,
          serving_unit: 'serving',
        },
        'cottage inn large cheese pizza',
      ),
    ).toBe('1 slice');
  });
});
