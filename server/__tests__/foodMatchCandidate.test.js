const {
  createCandidate,
  validateCandidate,
  assertCandidate,
  resolveSourceTier,
  SOURCE_TIERS,
} = require('../../src/nutrition/food-match/candidate');

describe('food-match candidate schema', () => {
  test('createCandidate fills required fields and keeps raw name/brand', () => {
    const candidate = createCandidate({
      source: 'openFoodFacts',
      name: 'Oat Crunch [PDF] Nutrition Facts',
      brand: 'ACME Foods',
      categoryPath: ['en:breakfast-cereals'],
      channel: 'packaged',
      gtin: '0123456789012',
      per100: { kcal: 380, protein: 8, carbs: 70, fat: 6, basis: 'g' },
      servings: [{ label: '30 g', grams: 30, kcal: 114, protein: 2.4, carbs: 21, fat: 1.8, origin: 'label' }],
      quality: { completeness: 1, sourceFlags: ['en:nutrition-facts-completed'] },
      provenance: { url: 'https://example.test/p', fetchedAt: '2020-01-01T00:00:00.000Z' },
    });

    expect(candidate.name).toBe('Oat Crunch [PDF] Nutrition Facts');
    expect(candidate.brand).toBe('ACME Foods');
    expect(candidate.sourceTier).toBe(1);
    expect(candidate.channel).toBe('packaged');
    expect(validateCandidate(candidate)).toEqual({ ok: true, errors: [] });
  });

  test('validateCandidate rejects missing name and bad tier', () => {
    const bad = createCandidate({
      source: 'serper',
      name: 'x',
      brand: '',
    });
    bad.name = '';
    bad.sourceTier = 9;
    const result = validateCandidate(bad);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining(['name_missing', 'sourceTier_invalid']));
  });

  test('assertCandidate throws on invalid rows', () => {
    expect(() => assertCandidate(null)).toThrow(/Invalid Candidate/);
  });

  test('resolveSourceTier maps known sources and defaults unknown to 3', () => {
    expect(resolveSourceTier('fatSecret')).toBe(SOURCE_TIERS.fatSecret);
    expect(resolveSourceTier('calorieKing')).toBe(2);
    expect(resolveSourceTier('madeUpSource')).toBe(3);
    expect(resolveSourceTier('madeUpSource', 1)).toBe(1);
  });

  test('brand may be an empty string when the source has no brand', () => {
    const candidate = createCandidate({
      source: 'usdaFdc',
      name: 'raw oats',
      brand: '',
      channel: 'generic',
    });
    expect(candidate.brand).toBe('');
    expect(validateCandidate(candidate).ok).toBe(true);
  });
});
