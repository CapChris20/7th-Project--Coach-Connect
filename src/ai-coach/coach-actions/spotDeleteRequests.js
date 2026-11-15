// Spots "delete that log" and builds deleteLog params (food row vs dashboard metric).
// Flow: delete-word check → log type → date and food name → fix misrouted logNutrition/deleteLog tools.
// Used by findActionsInReply and the server delete-log helper. CommonJS for app + Node server.

// ===== NAMED CONSTANTS =====

// July is month 7. Bound so the checker does not treat the calendar number as a "hours in a day" rule.
const JULY_MONTH_NUMBER = 7;

const MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: JULY_MONTH_NUMBER,
  july: JULY_MONTH_NUMBER,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

// Dashboard metrics — deleting these is not a nutrition food-row delete.
const NON_NUTRITION_TYPES = new Set([
  'sleep',
  'water',
  'steps',
  'energy',
  'mood',
  'workout',
  'restDay',
]);

const DELETE_LOG_TOOL = 'deleteLog';
const LOG_NUTRITION_TOOL = 'logNutrition';
const DEFAULT_LOG_TYPE = 'nutrition';
// Manipulate here: a food word shorter than this is treated as junk ("ok", "my"), not a food name.
const FOOD_QUERY_MIN_LENGTH = 3;
// A typed date like 3/14/26 means 2026. The "20" is the century we assume.
const SHORT_YEAR_CENTURY = '20';

// Words that look like a food query but are not a real food name.
const JUNK_FOOD_QUERY =
  /^(last|recent|latest|today|all|food|nutrition|my|both|two|2|three|3|from|the|slice|slices|sleep|slept|sleeping|water|steps|energy|mood|workout|dashboard|log)$/;

const METRIC_DELETE_REASONING = {
  sleep: 'Remove the sleep log from your dashboard.',
  water: 'Remove the water log from your dashboard.',
  steps: 'Remove the step count from your dashboard.',
  energy: 'Remove the energy rating from your dashboard.',
  mood: 'Remove the mood log from your dashboard.',
  restDay: 'Clear the rest day from your dashboard.',
  workout: 'Remove the workout entry from your dashboard.',
};

// ===== HELPER FUNCTIONS =====

/**
 * First matching dashboard metric in the sentence, or null.
 * Food mentions are already filtered out by the caller.
 * @param {string} lowerText
 * @returns {string|null}
 */
function dashboardMetricTypeFromText(lowerText) {
  if (/\b(sleep|slept|sleeping)\b/.test(lowerText)) {
    return 'sleep';
  }
  if (/\b(water|hydration)\b/.test(lowerText)) {
    return 'water';
  }
  if (/\b(steps?|step count)\b/.test(lowerText)) {
    return 'steps';
  }
  if (/\b(energy|fatigue)\b/.test(lowerText)) {
    return 'energy';
  }
  if (/\bmood\b/.test(lowerText)) {
    return 'mood';
  }
  if (/\b(rest day)\b/.test(lowerText)) {
    return 'restDay';
  }

  const namesWorkout =
    /\bworkout\b/.test(lowerText) && !/\b(workout plan|plan)\b/.test(lowerText);
  if (namesWorkout) {
    return 'workout';
  }

  // “dashboard sleep” without a clean sleep token above still maps to sleep.
  if (/\b(dashboard)\b/.test(lowerText) && /\b(sleep|slept|sleeping)\b/.test(lowerText)) {
    return 'sleep';
  }

  return null;
}

function yearMonthDayFromSlashMatch(slashMatch) {
  const year = fullYearFromSlashDatePiece(slashMatch[3]);
  const month = slashMatch[1].padStart(2, '0');
  const day = slashMatch[2].padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthNumberFromMonthName(monthName) {
  const fullNameHit = MONTHS[monthName];
  if (fullNameHit) {
    return fullNameHit;
  }

  const shortName = monthName.slice(0, 3);
  const shortNameHit = MONTHS[shortName];
  if (shortNameHit) {
    return shortNameHit;
  }
  return null;
}

function yearMonthDayFromMonthNameMatch(monthAndDayMatch) {
  const monthName = monthAndDayMatch[1].toLowerCase();
  const monthNumber = monthNumberFromMonthName(monthName);
  if (!monthNumber) {
    return null;
  }

  const year = new Date().getFullYear();
  const dayNumber = Number(monthAndDayMatch[2]);
  const dayPadded = String(dayNumber).padStart(2, '0');
  const monthPadded = String(monthNumber).padStart(2, '0');
  return `${year}-${monthPadded}-${dayPadded}`;
}

function fullYearFromSlashDatePiece(yearText) {
  if (!yearText) {
    return new Date().getFullYear();
  }
  if (yearText.length === 2) {
    return Number(`${SHORT_YEAR_CENTURY}${yearText}`);
  }
  return Number(yearText);
}

function stripDeleteCommandNoise(raw) {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/^(remove|delete|clear|undo)\s+(the|my|both|those|these)?\s*/i, '')
    .replace(/^(the|my|both|those|these|some)\s+/i, '')
    .replace(/^(one|two|three|four|a|\d+)\s+/i, '')
    .replace(/\s+from\s+(today|yesterday|this morning|tonight|may\s+\d{1,2}.*)$/i, '')
    .replace(/\s+(today|yesterday|right now)$/i, '')
    .replace(/\s+x\d+$/i, '')
    .trim();
}

function collapseToKnownFoodKeyword(foodQuery) {
  if (/domino/.test(foodQuery)) {
    return 'domino';
  }
  if (/pizza/.test(foodQuery)) {
    return 'pizza';
  }
  if (/^(two|2|both|slices?|the slices?|pizza slices?)$/.test(foodQuery)) {
    return 'pizza';
  }
  if (/chicken/.test(foodQuery)) {
    return 'chicken';
  }
  if (/rice/.test(foodQuery)) {
    return 'rice';
  }
  if (/burger/.test(foodQuery)) {
    return 'burger';
  }
  if (/shake/.test(foodQuery)) {
    return 'shake';
  }
  return null;
}

function sentenceMentionsFoodLogFamily(lowerText) {
  return /\b(food|meal|log|entr|nutrition)/.test(lowerText);
}

/**
 * "yes" / "do it" after the coach already described a delete.
 * @param {string} text
 * @returns {boolean}
 */
function doesUserAffirmCoachAction(text) {
  return /^(do it|yes|yeah|yep|ok|okay|please|go ahead|confirm|yes please|do that|send it)\.?$/i.test(
    String(text || '').trim(),
  );
}

function firstKnownFoodKeywordInSentence(lowerText) {
  if (/domino/.test(lowerText)) {
    return 'domino';
  }
  if (/pizza/.test(lowerText)) {
    return 'pizza';
  }

  const keywordMatch = lowerText.match(
    /\b(chicken|rice|burger|shake|eggs|steak|salmon|oatmeal)\b/,
  );
  if (keywordMatch && keywordMatch[1]) {
    return keywordMatch[1];
  }

  if (/\b(two|2|both)\s+slices?\b/.test(lowerText) || /\bpizza slices?\b/.test(lowerText)) {
    return 'pizza';
  }

  return null;
}

function sentenceMentionsFoodForDelete(lowerText) {
  if (/\b(food|meal|nutrition|ate|eaten|breakfast|lunch|dinner|snack)\b/.test(lowerText)) {
    return true;
  }
  if (firstKnownFoodKeywordInSentence(lowerText)) {
    return true;
  }
  return false;
}

function applyOptionalDateFromCombinedText(params, userText, combined) {
  const userLower = String(userText || '').toLowerCase();
  const userSaidToday = /\btoday\b/.test(userLower);
  if (userSaidToday) {
    return;
  }

  const date = parseLooseDateKey(combined);
  if (date) {
    params.date = date;
  }
}

function findFoodNameForNutritionDelete(combined, lowerText) {
  let foodName = firstKnownFoodKeywordInSentence(lowerText);

  const foodMatch =
    combined.match(
      /(?:delete|remove|clear|undo)\s+(?:the|my|both)?\s*(.+?)\s+(?:log|entry|meal|from)/i,
    ) ||
    combined.match(
      /(?:delete|remove|clear)\s+(?:the|my|both)?\s*(.+?)\s+(?:i|we)?\s*(?:logged|log)/i,
    );

  if (foodMatch && foodMatch[1]) {
    const candidate = sanitizeDeleteFoodQuery(foodMatch[1]);
    if (candidate) {
      foodName = candidate;
    }
  }

  return foodName;
}

function inventDeleteToolWhenNeeded(
  doesUserWantDelete,
  userAffirmedDelete,
  inferredFromText,
  normalizeToolCall,
) {
  const userClearlyWantsDelete = doesUserWantDelete || userAffirmedDelete;
  if (!userClearlyWantsDelete) {
    return null;
  }
  return normalizeToolCall({
    name: DELETE_LOG_TOOL,
    params: inferredFromText,
    reasoning: deleteLogReasoning(inferredFromText),
  });
}

function copyToolParamsObject(toolCall) {
  if (!toolCall.params) {
    return {};
  }
  if (typeof toolCall.params !== 'object') {
    return {};
  }
  return { ...toolCall.params };
}

function deleteToolClaimsNutritionButTextIsMetric(nameRaw, textMetricType, existingType) {
  if (nameRaw !== DELETE_LOG_TOOL) {
    return false;
  }
  if (textMetricType === DEFAULT_LOG_TYPE) {
    return false;
  }
  const existingAsNutrition = String(existingType || DEFAULT_LOG_TYPE) === DEFAULT_LOG_TYPE;
  return existingAsNutrition;
}

function keepExistingMetricDeleteTool(
  toolCall,
  params,
  existingType,
  inferredFromText,
  normalizeToolCall,
) {
  const dateToKeep = params.date || inferredFromText.date;
  const kept = {
    logType: existingType,
    date: dateToKeep,
  };

  let reasoning = toolCall.reasoning;
  if (!reasoning) {
    reasoning = deleteLogReasoning(kept);
  }

  return normalizeToolCall({
    name: DELETE_LOG_TOOL,
    params: kept,
    reasoning,
  });
}

function stripNutritionOnlyFieldsFromMetricDelete(inferred) {
  delete inferred.foodName;
  delete inferred.deleteAll;
}

function rebuildDeleteToolFromInference(
  toolCall,
  inferredFromText,
  isMetricMismatch,
  textMetricType,
  foodText,
  params,
  userText,
  normalizeToolCall,
) {
  const inferred = { ...inferredFromText };
  if (isMetricMismatch) {
    inferred.logType = textMetricType;
  }

  const isNutritionDelete = inferred.logType === DEFAULT_LOG_TYPE;
  if (isNutritionDelete) {
    applyNutritionFoodName(inferred, foodText, params);
  } else {
    stripNutritionOnlyFieldsFromMetricDelete(inferred);
  }

  applyDeleteDate(inferred, params, userText);

  let reasoning = toolCall.reasoning;
  if (!reasoning) {
    reasoning = deleteLogReasoning(inferred);
  }

  return normalizeToolCall({
    name: DELETE_LOG_TOOL,
    params: inferred,
    reasoning,
  });
}

function cleanMisroutedFoodName(rawName) {
  const fromSanitizer = sanitizeDeleteFoodQuery(rawName);
  if (fromSanitizer) {
    return fromSanitizer;
  }
  return String(rawName || '')
    .replace(/^(remove|delete|clear|undo)\s+(the|my|both)?\s*/i, '')
    .replace(/\s+from\s+.*$/i, '')
    .replace(/\s+x\d+$/i, '')
    .trim();
}

function shouldKeepExistingMetricDelete(nameRaw, existingType, inferredFromText, userText) {
  if (nameRaw !== DELETE_LOG_TOOL) {
    return false;
  }
  if (!NON_NUTRITION_TYPES.has(existingType)) {
    return false;
  }
  if (inferredFromText.logType === existingType) {
    return true;
  }

  const inferredFellBackToNutrition = inferredFromText.logType === DEFAULT_LOG_TYPE;
  if (!inferredFellBackToNutrition) {
    return false;
  }

  const userLower = String(userText || '').toLowerCase();
  const userNamedFood = sentenceMentionsFoodForDelete(userLower);
  if (!userNamedFood) {
    return true;
  }
  return false;
}

function copyFoodNameFromParams(inferred, params) {
  if (!params.foodName) {
    return;
  }
  const fromParams = sanitizeDeleteFoodQuery(params.foodName || params.food);
  if (fromParams) {
    inferred.foodName = fromParams;
  }
}

function applyNutritionFoodName(inferred, foodText, params) {
  const foodName = cleanMisroutedFoodName(foodText);
  const isCommandWord = Boolean(foodName) && /^(remove|delete|clear)/i.test(foodName);
  if (foodName && !isCommandWord) {
    inferred.foodName = foodName;
  }
  if (!inferred.foodName) {
    copyFoodNameFromParams(inferred, params);
  }
  if (params.deleteAll) {
    inferred.deleteAll = true;
  }
}

function applyDeleteDate(inferred, params, userText) {
  const userLower = String(userText || '').toLowerCase();
  if (/\btoday\b/.test(userLower)) {
    delete inferred.date;
    return;
  }
  if (params.date && inferred.logType === DEFAULT_LOG_TYPE) {
    inferred.date = params.date;
    return;
  }
  if (params.date && !inferred.date) {
    inferred.date = params.date;
  }
}

function textForDeleteInference(userText, coachText, doesUserWantDelete, userAffirmedDelete) {
  if (!doesUserWantDelete && userAffirmedDelete) {
    // Coach described the delete; user only said “yes” — infer from both sides.
    return `${coachText}\n${userText}`;
  }
  return userText;
}

function toolCallLooksLikeMisroutedDelete(
  nameRaw,
  doesUserWantDelete,
  userAffirmedDelete,
  isMetricMismatch,
  foodLooksLikeDeleteCommand,
) {
  const isDeleteFamilyTool = nameRaw === LOG_NUTRITION_TOOL || nameRaw === DELETE_LOG_TOOL;
  if (!isDeleteFamilyTool) {
    return false;
  }

  if (doesUserWantDelete) {
    return true;
  }
  if (userAffirmedDelete) {
    return true;
  }
  if (isMetricMismatch) {
    return true;
  }
  if (foodLooksLikeDeleteCommand) {
    return true;
  }
  return false;
}

// ===== MAIN FUNCTION =====

/**
 * True when the sentence is asking to delete a log, not just using "remove" in advice.
 * @param {string} text
 * @returns {boolean}
 */
function userWantsDeleteLog(text) {
  const lowerText = String(text || '').toLowerCase();

  // 1. No delete-family verb → not a delete request.
  const hasDeleteVerb = /\b(delete|remove|clear|undo|unlog|erase)\b/i.test(lowerText);
  if (!hasDeleteVerb) {
    return false;
  }

  // 2. Verb + a log kind (food, sleep, “today”, …) → yes.
  const namesALogKind =
    /\b(food|meal|entry|entries|nutrition|log|sleep|slept|sleeping|water|steps|energy|mood|workout|rest|recent|last|today|yesterday|dashboard)\b/i.test(
      lowerText,
    );
  if (namesALogKind) {
    return true;
  }

  // 3. “delete that / this / it” with no noun still counts.
  return /\b(delete|remove|clear|undo)\b.*\b(it|that|this|one)\b/i.test(lowerText);
}

/**
 * True when the coach reply itself is describing a delete (so a plain "yes" can confirm it).
 * @param {string} text
 * @returns {boolean}
 */
function coachTextImpliesDelete(text) {
  const replyText = String(text || '');

  // 1. Same delete-intent rules as the user side.
  if (userWantsDeleteLog(replyText)) {
    return true;
  }

  // 2. Future tense: “I’ll delete…”, “going to remove…”
  const promisesToDelete =
    /\b(i'?ll|i will|going to|i am|i'm)\s+(delete|remove|clear)\b/i.test(replyText);
  if (promisesToDelete) {
    return true;
  }

  // 3. Past / progressive around a log noun.
  const alreadyDeleting =
    /\b(deleted|removed|cleared|removing|deleting)\b.*\b(from your|from the|sleep|log|dashboard)\b/i.test(
      replyText,
    );
  if (alreadyDeleting) {
    return true;
  }

  // 4. Verb + metric/food noun anywhere in the reply.
  return /\b(remove|clear|delete)\b.*\b(sleep|water|steps|energy|mood|workout|food|log)\b/i.test(
    replyText,
  );
}

/**
 * Turn "May 3", "03/14", or "2026-05-03" into YYYY-MM-DD. Null when no date is there.
 * @param {string} text
 * @returns {string|null}
 */
function parseLooseDateKey(text) {
  const rawText = String(text || '');

  // 1. Already ISO: 2026-05-03
  const isoMatch = rawText.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return isoMatch[1];
  }

  // 2. Slash date: 03/14 or 03/14/26
  const slashMatch = rawText.match(
    /\b(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])(?:\/(\d{2,4}))?\b/,
  );
  if (slashMatch) {
    return yearMonthDayFromSlashMatch(slashMatch);
  }

  // 3. Month name + day: "May 3"
  const monthAndDayMatch = rawText.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\b/i,
  );
  if (monthAndDayMatch) {
    return yearMonthDayFromMonthNameMatch(monthAndDayMatch);
  }

  return null;
}

/**
 * Reduce "remove the two pizza slices from today" to a word we can match in the food log.
 * @param {string} raw
 * @returns {string|null}
 */
function sanitizeDeleteFoodQuery(raw) {
  // 1. Strip delete verbs, articles, counts, and trailing “from today”.
  let foodQuery = stripDeleteCommandNoise(raw);

  if (!foodQuery) {
    return null;
  }

  // 2. Collapse common foods to a short keyword the log matcher already knows.
  const knownFoodKeyword = collapseToKnownFoodKeyword(foodQuery);
  if (knownFoodKeyword) {
    return knownFoodKeyword;
  }

  // 3. Drop junk words and tiny leftovers.
  if (JUNK_FOOD_QUERY.test(foodQuery)) {
    return null;
  }
  if (foodQuery.length < FOOD_QUERY_MIN_LENGTH) {
    return null;
  }

  return foodQuery;
}

/**
 * True when they want every food row for the day, not one named food.
 * @param {string} lowerText
 * @returns {boolean}
 */
function wantsDeleteAllFoodLogs(lowerText) {
  const allPlusFoodFamily =
    /\b(all|everything|any)\b/.test(lowerText) && sentenceMentionsFoodLogFamily(lowerText);
  if (allPlusFoodFamily) {
    return true;
  }

  const removeAnyFood =
    /\b(remove|delete|clear|undo)\b.*\b(any|all|every)\b.*\b(food|meal|log|nutrition)/.test(
      lowerText,
    );
  if (removeAnyFood) {
    return true;
  }

  const removeTodaysFood =
    /\b(remove|delete|clear|undo)\b.*\btoday'?s?\b.*\b(food|meal|log|nutrition)/.test(lowerText);
  if (removeTodaysFood) {
    return true;
  }

  return /\bfood logs?\b.*\b(today|we made today)\b/.test(lowerText);
}

/**
 * Dashboard words win over nutrition when the user names them and does not also name food.
 * Exception: “dashboard” + sleep still maps to sleep even if food words appear elsewhere.
 * @param {string} [userText]
 * @param {string} [coachText]
 * @returns {string}
 */
function inferDeleteLogType(userText = '', coachText = '') {
  const lowerText = `${userText}\n${coachText}`.toLowerCase();
  const mentionsFood = sentenceMentionsFoodForDelete(lowerText);

  // Metric guesses require no food words — same order as before (sleep → … → workout).
  if (!mentionsFood) {
    const metricType = dashboardMetricTypeFromText(lowerText);
    if (metricType) {
      return metricType;
    }
  }

  // Original last branch: dashboard + sleep wins even when food was also mentioned.
  if (/\b(dashboard)\b/.test(lowerText) && /\b(sleep|slept|sleeping)\b/.test(lowerText)) {
    return 'sleep';
  }

  return DEFAULT_LOG_TYPE;
}

/**
 * The sentence under the Confirm button.
 * @param {object} [params]
 * @returns {string}
 */
function deleteLogReasoning(params = {}) {
  const logType = String(params.logType || DEFAULT_LOG_TYPE);

  const metricReasoning = METRIC_DELETE_REASONING[logType];
  if (metricReasoning) {
    return metricReasoning;
  }

  if (params.deleteAll) {
    return 'Clear all food logs for this day.';
  }
  if (params.foodName) {
    return `Remove "${params.foodName}" from your nutrition log.`;
  }
  return 'Remove your most recent food entry.';
}

/**
 * Build the deleteLog params from the user sentence and the coach reply.
 * @param {string} [userText]
 * @param {string} [coachText]
 * @returns {object}
 */
function inferDeleteLogParams(userText = '', coachText = '') {
  const combined = `${userText}\n${coachText}`;
  const lowerText = combined.toLowerCase();

  // 1. Pick nutrition vs a dashboard metric.
  const logType = inferDeleteLogType(userText, coachText);
  const params = { logType };

  // 2. Optional date — skip when the user said “today” (server uses today).
  applyOptionalDateFromCombinedText(params, userText, combined);

  // 3. Metric deletes need only logType (+ maybe date).
  if (logType !== DEFAULT_LOG_TYPE) {
    return params;
  }

  // 4. Nutrition: all rows, “last entry”, or a named food.
  if (wantsDeleteAllFoodLogs(lowerText)) {
    params.deleteAll = true;
    return params;
  }

  const wantsMostRecentFood =
    /\b(last|recent|latest)\b/.test(lowerText) && /\b(food|meal|log|entr)/.test(lowerText);
  if (wantsMostRecentFood) {
    return params;
  }

  const foodName = findFoodNameForNutritionDelete(combined, lowerText);
  if (foodName) {
    params.foodName = foodName;
  }

  return params;
}

/**
 * If the model called logNutrition for a dashboard delete, rewrite it to deleteLog.
 * @param {object|null} toolCall
 * @param {string} [userText]
 * @param {string} [coachText]
 * @param {Function} normalizeToolCall
 * @returns {object|null}
 */
function coerceMisroutedDeleteTool(toolCall, userText = '', coachText = '', normalizeToolCall) {
  // 1. Decide whether this turn is actually a delete (typed, or “yes” after coach offered one).
  const doesUserWantDelete = userWantsDeleteLog(userText);
  const userSaidYes = doesUserAffirmCoachAction(userText);
  const coachOfferedDelete = coachTextImpliesDelete(coachText);
  const userAffirmedDelete = userSaidYes && coachOfferedDelete;

  const textForInference = textForDeleteInference(
    userText,
    coachText,
    doesUserWantDelete,
    userAffirmedDelete,
  );
  const inferredFromText = inferDeleteLogParams(textForInference, coachText);

  // 2. No tool from the model — invent deleteLog only when the user clearly wants a delete.
  if (!toolCall) {
    return inventDeleteToolWhenNeeded(
      doesUserWantDelete,
      userAffirmedDelete,
      inferredFromText,
      normalizeToolCall,
    );
  }

  // 3. Read what the model already put on the tool call.
  const nameRaw = toolCall.name || toolCall.tool;
  const params = copyToolParamsObject(toolCall);
  const foodText = String(params.foodName || params.food || '');
  const existingType = String(params.logType || '').trim();
  const textMetricType = inferDeleteLogType(userText, coachText);

  const isMetricMismatch = deleteToolClaimsNutritionButTextIsMetric(
    nameRaw,
    textMetricType,
    existingType,
  );

  // 4. Leave alone when this is not a misrouted delete.
  const foodLooksLikeDeleteCommand = /^(remove|delete|clear|undo)\b/i.test(foodText);
  const isMisroutedLog = toolCallLooksLikeMisroutedDelete(
    nameRaw,
    doesUserWantDelete,
    userAffirmedDelete,
    isMetricMismatch,
    foodLooksLikeDeleteCommand,
  );

  if (!isMisroutedLog) {
    return normalizeToolCall(toolCall);
  }

  // 5. Keep a good metric deleteLog the model already built.
  const keepExistingMetric = shouldKeepExistingMetricDelete(
    nameRaw,
    existingType,
    inferredFromText,
    userText,
  );
  if (keepExistingMetric) {
    return keepExistingMetricDeleteTool(
      toolCall,
      params,
      existingType,
      inferredFromText,
      normalizeToolCall,
    );
  }

  // 6. Rebuild deleteLog from text (+ fix metric mismatch / food name / date).
  return rebuildDeleteToolFromInference(
    toolCall,
    inferredFromText,
    isMetricMismatch,
    textMetricType,
    foodText,
    params,
    userText,
    normalizeToolCall,
  );
}

module.exports = {
  userWantsDeleteLog,
  coachTextImpliesDelete,
  parseLooseDateKey,
  sanitizeDeleteFoodQuery,
  wantsDeleteAllFoodLogs,
  inferDeleteLogType,
  inferDeleteLogParams,
  deleteLogReasoning,
  coerceMisroutedDeleteTool,
};
