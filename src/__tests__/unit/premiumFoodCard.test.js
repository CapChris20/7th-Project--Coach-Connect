const { formatLoggedFoodDisplay, DEMO_YOGURT_BOWL } = require('../../nutrition/components/premiumFoodCard/formatLoggedFoodDisplay');
const { hexToRgba, pillBackgroundGradient, getFoodCardPalette, getNutritionPanelPalette, gradients } = require('../../nutrition/components/premiumFoodCard/theme');

describe('premiumFoodCard', () => {
  it('maps logged food to card shape with calorie-based macro percents', () => {
    const food = formatLoggedFoodDisplay({
      food_name: 'Yogurt Bowl',
      brand_name: 'Chobani',
      calories: 412,
      protein: 32,
      carbs: 42,
      fat: 16,
      serving_grams: 320,
      fiber: 6,
      sodium: 480,
      source: 'usda',
      metadata: { fdcId: '170894' },
    });

    expect(food.name).toBe('Yogurt Bowl');
    expect(food.verified).toBe(true);
    expect(food.subtitle).toContain('Chobani');
    expect(food.macroPercents.carbs + food.macroPercents.protein + food.macroPercents.fat).toBe(100);
    expect(food.micronutrients.fiber.value).toBe('6');
    expect(food.source).toContain('USDA');
  });

  it('uses low-opacity pill gradient stops', () => {
    const bg = pillBackgroundGradient(gradients.carbs);
    expect(bg[0]).toBe(hexToRgba('#A67C00', 0.1));
    expect(bg[1]).toBe(hexToRgba('#FF6B9D', 0.06));
  });

  it('demo food matches mockup macros', () => {
    expect(DEMO_YOGURT_BOWL.calories).toBe(412);
    expect(DEMO_YOGURT_BOWL.macroPercents.carbs).toBe(38);
  });

  it('embedded palette is transparent for meal sections', () => {
    expect(getFoodCardPalette(true, { embedded: true }).background).toBe('transparent');
    expect(getFoodCardPalette(false, { embedded: true }).background).toBe('transparent');
    expect(getFoodCardPalette(false, { embedded: true }).foreground).toBe('#0A0A0F');
    expect(getFoodCardPalette(true, { embedded: true }).foreground).toBe('#FFFFFF');
  });

  it('nutrition panel uses brand colors and light mode is not a dark box', () => {
    const dark = getNutritionPanelPalette(true, { embedded: true });
    expect(dark.panelBg).toBe('#14110F');
    expect(dark.text).toBe('#F4F2EF');
    expect(dark.breakdownGradient).toEqual(['#9A3412', '#FF3D8A']);

    const light = getNutritionPanelPalette(false, { embedded: true });
    expect(light.text).toBe('#0A0A0F');
    expect(light.panelBg).toBe('#FFFBF5');
    expect(light.tileBg).toBe('#FFFFFF');
  });
});
