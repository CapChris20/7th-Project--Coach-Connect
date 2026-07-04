const {
  isBarcodeJunkName,
  isUsableBarcodeFood,
  barcodeNotFoundPayload,
} = require('../../nutrition/barcode/validateBarcodeFood');

describe('validateBarcodeFood', () => {
  test('rejects GS1 barcode tracker junk', () => {
    expect(
      isUsableBarcodeFood({
        name: 'Food Barcode Trackers',
        brand: 'Food Barcode',
        source: 'serper',
        calories: 450,
        protein: 0,
        carbs: 0,
        fat: 0,
      }),
    ).toBe(false);
    expect(isBarcodeJunkName('Food Barcode Trackers')).toBe(true);
  });

  test('rejects zero-macro serper rows', () => {
    expect(
      isUsableBarcodeFood({
        name: 'Some Product',
        source: 'serper',
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      }),
    ).toBe(false);
  });

  test('accepts Ghost cereal serper row with protein', () => {
    expect(
      isUsableBarcodeFood({
        name: 'General Mills GHOST High Protein Cinnamon Breakfast Cereal',
        brand: 'Ghost',
        source: 'serper',
        calories: 170,
        protein: 17,
        carbs: 12,
        fat: 0,
      }),
    ).toBe(true);
  });

  test('barcodeNotFoundPayload includes suggested search', () => {
    const payload = barcodeNotFoundPayload('01600022984', ['Ghost Protein Cereal']);
    expect(payload.notFound).toBe(true);
    expect(payload.suggestedSearchQueries[0]).toMatch(/Ghost/i);
  });
});
