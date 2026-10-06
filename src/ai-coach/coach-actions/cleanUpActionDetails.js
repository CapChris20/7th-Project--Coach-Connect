// Makes a coach tool's parameters use one spelling before the app acts on them.
// Flow: copy the object → water, meals, and sleep each get their own field cleanup.
// Used by: the coach action runner. Callers still read amount_oz and mealType.

// ===== NAMED CONSTANTS =====

const TOOL_LOG_WATER = 'logWater';
const TOOL_LOG_NUTRITION = 'logNutrition';
const TOOL_LOG_SLEEP = 'logSleep';
const SNACK_MEAL = 'snack';
const SNACKS_MEAL_TYPE = 'snacks';

// ===== HELPER FUNCTIONS =====

/**
 * @param {object} actionParams
 * @returns {object}
 */
function normalizeWaterParams(actionParams) {
  const amountOz = actionParams.amountOz ?? actionParams.amount_oz ?? null;
  return {
    ...actionParams,
    amountOz: amountOz == null ? actionParams.amountOz : amountOz,
    amount_oz: amountOz,
  };
}

/**
 * @param {object} actionParams
 * @returns {object}
 */
function normalizeMealParams(actionParams) {
  const meal = typeof actionParams.meal === 'string' ? actionParams.meal.toLowerCase() : actionParams.meal;
  const mealType = actionParams.mealType || (meal === SNACK_MEAL ? SNACKS_MEAL_TYPE : meal || null);
  return {
    ...actionParams,
    mealType,
  };
}

// ===== MAIN FUNCTION =====

/**
 * @param {string} toolName
 * @param {object} params
 * @returns {object}
 */
function normalizeToolParams(toolName, params) {
  const actionParams = params && typeof params === 'object' ? { ...params } : {};
  const toolNameText = String(toolName || '');

  if (toolNameText === TOOL_LOG_WATER) return normalizeWaterParams(actionParams);
  if (toolNameText === TOOL_LOG_NUTRITION) return normalizeMealParams(actionParams);
  if (toolNameText === TOOL_LOG_SLEEP) return actionParams;
  return actionParams;
}

module.exports = {
  normalizeToolParams,
};
