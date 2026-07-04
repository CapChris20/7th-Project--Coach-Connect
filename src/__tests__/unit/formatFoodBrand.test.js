const {
  inferBrandFromFoodName,
  normalizeBrandLabel,
  parseMultiBrandField,
  resolveBarcodeBrand,
  resolveFoodBrandLabel,
  stripRetailerSuffix,
  shouldShowFoodBrandSubtitle,
} = require('../../nutrition/food-details/cleanFoodBrandName');

describe('cleanFoodBrandName', () => {
  test('normalizeBrandLabel strips corporate suffixes', () => {
    expect(normalizeBrandLabel('GENERAL MILLS, INC.')).toBe('General Mills');
  });

  test('parseMultiBrandField prefers consumer brand over manufacturer', () => {
    expect(parseMultiBrandField('General Mills, Ghost, en:united-states')).toBe('Ghost');
  });

  test('inferBrandFromFoodName picks Ghost over General Mills in co-branded titles', () => {
    const title = 'General Mills GHOST™ High Protein Cinnamon Breakfast Cereal';
    expect(inferBrandFromFoodName(title)).toBe('Ghost');
  });

  test('stripRetailerSuffix removes store name from search titles', () => {
    expect(stripRetailerSuffix('GHOST™ Protein Cereal Marshmallow, 9.4 oz - Kroger')).toBe(
      'GHOST™ Protein Cereal Marshmallow, 9.4 oz',
    );
  });

  test('resolveBarcodeBrand handles Kroger Ghost cereal title', () => {
    expect(
      resolveBarcodeBrand(
        'General Mills GHOST™ High Protein Cinnamon Breakfast Cereal - Kroger',
        '',
      ),
    ).toBe('Ghost');
  });

  test('resolveFoodBrandLabel prefers title inference when USDA brandOwner is parent company', () => {
    expect(
      resolveFoodBrandLabel(
        'GHOST PROTEIN CEREAL, CINNAMON TOAST CRUNCH',
        'GENERAL MILLS, INC.',
      ),
    ).toBe('Ghost');
  });

  test('shouldShowFoodBrandSubtitle hides duplicate brand under product name', () => {
    expect(shouldShowFoodBrandSubtitle('Ghost Protein Cereal', 'Ghost')).toBe(false);
    expect(shouldShowFoodBrandSubtitle('High Protein Cinnamon Cereal', 'Ghost')).toBe(true);
  });
});
