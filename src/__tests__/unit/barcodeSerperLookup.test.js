const {
  parseBarcodeNutritionText,
  isSerperBarcodeNoise,
  scoreSerperOrganicResult,
  serperOrganicToFood,
  barcodeGtinVariants,
} = require('../../../server/lib/barcodeSerperLookup');

describe('barcodeSerperLookup', () => {
  test('barcodeGtinVariants pads UPC-A to 12 and 13 digits', () => {
    expect(barcodeGtinVariants('01600022984')).toEqual(
      expect.arrayContaining(['01600022984', '0001600022984', '00001600022984']),
    );
  });

  test('parseBarcodeNutritionText reads Kroger-style macro strings', () => {
    const text =
      'Total Carbohydrate12g ; Dietary Fiber1g ; Sugar6g ; Added Sugar6g ; Protein17g';
    expect(parseBarcodeNutritionText(text)).toMatchObject({
      protein: 17,
      carbs: 12,
    });
  });

  test('isSerperBarcodeNoise rejects generic barcode tracker pages', () => {
    expect(
      isSerperBarcodeNoise(
        'Food Barcode Trackers - GS1 US',
        'https://www.gs1us.org/upcs-barcodes-prefixes/food-barcode-trackers',
      ),
    ).toBe(true);
  });

  test('scoreSerperOrganicResult prefers retailer hit with barcode in URL', () => {
    const kroger = {
      title: 'General Mills GHOST™ High Protein Cinnamon Breakfast Cereal',
      snippet: 'Protein17g ; Total Carbohydrate12g ; Sugar6g',
      link: 'https://www.kroger.com/p/general-mills-ghost-high-protein-cinnamon-breakfast-cereal/0001600022984',
    };
    const junk = {
      title: 'Food Barcode Trackers - GS1 US',
      snippet: '450 cal per serving',
      link: 'https://www.gs1us.org/food-barcode-trackers',
    };
    expect(scoreSerperOrganicResult(kroger, '01600022984')).toBeGreaterThan(
      scoreSerperOrganicResult(junk, '01600022984'),
    );
  });

  test('serperOrganicToFood maps Kroger Ghost cereal snippet to food row', () => {
    const food = serperOrganicToFood(
      {
        title: 'General Mills GHOST™ High Protein Cinnamon Breakfast Cereal',
        snippet: 'Protein17g ; Total Carbohydrate12g ; Sugar6g',
        link: 'https://www.kroger.com/p/general-mills-ghost-high-protein-cinnamon-breakfast-cereal/0001600022984',
      },
      '01600022984',
    );
    expect(food).toMatchObject({
      name: 'General Mills GHOST™ High Protein Cinnamon Breakfast Cereal',
      protein: 17,
      carbs: 12,
      source: 'serper',
    });
    expect(food.calories).toBeGreaterThan(0);
  });
});
