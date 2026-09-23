/**
 * normalize Tool Params
 *
 * Purpose: normalize Tool Params — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/ai
 * Key exports: normalizeToolParams
 *
 * @file-header
 */
function normalizeToolParams(toolName, params) {
  const p = params && typeof params === 'object' ? { ...params } : {};
  const name = String(toolName || '');

  if (name === 'logWater') {
    const amountOz = p.amountOz ?? p.amount_oz ?? null;
    return {
      ...p,
      amountOz: amountOz == null ? p.amountOz : amountOz,
      amount_oz: amountOz,
    };
  }

  if (name === 'logNutrition') {
    const meal = typeof p.meal === 'string' ? p.meal.toLowerCase() : p.meal;
    const mealType =
      p.mealType
      || (meal === 'snack' ? 'snacks' : meal || null);
    return {
      ...p,
      mealType,
    };
  }

  if (name === 'logSleep') {
    return p;
  }

  return p;
}

module.exports = {
  normalizeToolParams,
};
