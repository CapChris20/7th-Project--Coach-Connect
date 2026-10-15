// Makes a coach tool's parameters use one spelling before the app acts on them.
// Flow: shallow copy → pick the normalizer for that tool name → water and meals get field aliases.
// Used by: the coach action runner. Callers still read amount_oz and mealType.

// ===== NAMED CONSTANTS =====

const TOOL_LOG_WATER = 'logWater';
const TOOL_LOG_NUTRITION = 'logNutrition';
const TOOL_LOG_SLEEP = 'logSleep';
const SNACK_MEAL = 'snack';
const SNACKS_MEAL_TYPE = 'snacks';

// ===== MAIN FUNCTION =====

/**
 * Normalize coach tool params so downstream code sees one spelling per field.
 * Flow: 1. safe copy  2. find normalizer  3. run it or return the copy
 * @param {string} toolName
 * @param {object} params
 * @returns {object}
 */
function normalizeToolParams(toolName, params) {
  const hasObjectParams = params && typeof params === 'object';
  const actionParams = hasObjectParams ? { ...params } : {};
  const toolNameText = String(toolName || '');

  // 1. Unknown tools still get a shallow copy so callers never mutate the model object.
  const normalizer = pickParamNormalizer(toolNameText);
  if (!normalizer) return actionParams;

  // 2. Water / nutrition / sleep each apply their own alias rules.
  return normalizer(actionParams);
}

module.exports = {
  normalizeToolParams,
};

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

/**
 * Water tools sometimes send amountOz and sometimes amount_oz. Keep both keys in sync.
 * @param {object} actionParams
 * @returns {object}
 */
function applyWaterAmountAliases(actionParams) {
  // vocab: ?? = use the right side only when the left is null or undefined (0 is kept).
  const ouncesFromEitherKey = actionParams.amountOz ?? actionParams.amount_oz ?? null;
  const amountOzField =
    ouncesFromEitherKey == null ? actionParams.amountOz : ouncesFromEitherKey;
  return {
    ...actionParams,
    amountOz: amountOzField,
    amount_oz: ouncesFromEitherKey,
  };
}

/**
 * Meal type may live on mealType or on meal (with snack → snacks).
 * @param {object} actionParams
 * @returns {object}
 */
function applyMealTypeAliases(actionParams) {
  const mealWord =
    typeof actionParams.meal === 'string'
      ? actionParams.meal.toLowerCase()
      : actionParams.meal;
  const mealTypeFromParams = actionParams.mealType;
  const mealTypeResolved =
    mealTypeFromParams ||
    (mealWord === SNACK_MEAL ? SNACKS_MEAL_TYPE : mealWord || null);
  return {
    ...actionParams,
    mealType: mealTypeResolved,
  };
}

/**
 * Sleep params pass through unchanged today; kept as its own branch so water/meal rules do not mix.
 * @param {object} actionParams
 * @returns {object}
 */
function passThroughSleepParams(actionParams) {
  return actionParams;
}

/**
 * @param {string} toolNameText
 * @returns {((object) => object)|null}
 */
function pickParamNormalizer(toolNameText) {
  if (toolNameText === TOOL_LOG_WATER) return applyWaterAmountAliases;
  if (toolNameText === TOOL_LOG_NUTRITION) return applyMealTypeAliases;
  if (toolNameText === TOOL_LOG_SLEEP) return passThroughSleepParams;
  return null;
}

