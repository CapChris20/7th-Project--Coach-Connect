// One spelling per field before the app runs a coach tool (water oz, meal type, sleep).
// Flow: shallow-copy model params → pick the fixer for that tool → return the fixed object.
// Used by the coach action runner. Downstream code still reads amount_oz and mealType.
// Read order: constants → normalizeToolParams (main) → export → PLUMBING at the bottom.

// ===== NAMED CONSTANTS =====

const TOOL_LOG_WATER = 'logWater';
const TOOL_LOG_NUTRITION = 'logNutrition';
const TOOL_LOG_SLEEP = 'logSleep';
const SNACK_MEAL_WORD = 'snack';
const SNACKS_MEAL_TYPE = 'snacks';

// ===== MAIN FUNCTION =====

/**
 * Normalize coach tool params so downstream code sees one spelling per field.
 * @param {string} toolName
 * @param {object} params
 * @returns {object}
 */
function normalizeToolParams(toolName, params) {
  // 1. Shallow copy so callers never mutate the model object.
  const actionParams = shallowCopyParamsOrEmptyObject(params);
  const toolNameText = String(toolName || '');

  // 2. Unknown tools still return that copy.
  const paramFixer = pickParamFixerForToolName(toolNameText);
  if (!paramFixer) {
    return actionParams;
  }

  // 3. Water, nutrition, and sleep each apply their own alias rules.
  return paramFixer(actionParams);
}

module.exports = {
  normalizeToolParams,
};

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging water / meal / sleep alias spelling

function shallowCopyParamsOrEmptyObject(params) {
  if (!params) {
    return {};
  }
  if (typeof params !== 'object') {
    return {};
  }
  return { ...params };
}

/**
 * Water tools sometimes send amountOz and sometimes amount_oz. Keep both keys in sync.
 * @param {object} actionParams
 * @returns {object}
 */
function fixWaterAmountFieldAliases(actionParams) {
  // Prefer amountOz first, then amount_oz — both end up filled. Keep 0 oz.
  let ouncesFromEitherKey = null;
  if (actionParams.amountOz !== null && actionParams.amountOz !== undefined) {
    ouncesFromEitherKey = actionParams.amountOz;
  } else if (actionParams.amount_oz !== null && actionParams.amount_oz !== undefined) {
    ouncesFromEitherKey = actionParams.amount_oz;
  }

  let amountOzField = actionParams.amountOz;
  if (ouncesFromEitherKey != null) {
    amountOzField = ouncesFromEitherKey;
  }

  return {
    ...actionParams,
    amountOz: amountOzField,
    amount_oz: ouncesFromEitherKey,
  };
}

/**
 * Turn the free-text meal word into the lowercase spelling mealType expects.
 * snack → snacks; other words pass through; blank → null.
 * @param {unknown} mealWord
 * @returns {string|null}
 */
function mealTypeFromMealWord(mealWord) {
  if (!mealWord) {
    return null;
  }
  if (mealWord === SNACK_MEAL_WORD) {
    return SNACKS_MEAL_TYPE;
  }
  return mealWord;
}

/**
 * Meal type may live on mealType or on meal (with snack → snacks).
 * @param {object} actionParams
 * @returns {object}
 */
function fixNutritionMealTypeAliases(actionParams) {
  // Why: the model sometimes sends meal:"snack" and sometimes mealType:"snacks".
  // Downstream food logging only reads mealType — keep that one key filled.
  let mealWord = actionParams.meal;
  if (typeof mealWord === 'string') {
    mealWord = mealWord.toLowerCase();
  }

  if (actionParams.mealType) {
    return {
      ...actionParams,
      mealType: actionParams.mealType,
    };
  }

  return {
    ...actionParams,
    mealType: mealTypeFromMealWord(mealWord),
  };
}

/**
 * Sleep params pass through unchanged today; kept as its own branch so water/meal rules do not mix.
 * @param {object} actionParams
 * @returns {object}
 */
function passSleepParamsThroughUnchanged(actionParams) {
  return actionParams;
}

/**
 * @param {string} toolNameText
 * @returns {((object) => object)|null}
 */
function pickParamFixerForToolName(toolNameText) {
  if (toolNameText === TOOL_LOG_WATER) {
    return fixWaterAmountFieldAliases;
  }
  if (toolNameText === TOOL_LOG_NUTRITION) {
    return fixNutritionMealTypeAliases;
  }
  if (toolNameText === TOOL_LOG_SLEEP) {
    return passSleepParamsThroughUnchanged;
  }
  return null;
}
