// Spots "delete that" and decides whether the row is food or a dashboard number.
// Flow: detect delete words → pick the log type → parse a date and a food name →
//       if the model logged food when the user meant sleep (or the reverse), rewrite the tool.
// Used by findActionsInReply and the server delete-log helper.
// CommonJS on purpose: the Expo app and the Node server both require() this file.

// ===== NAMED CONSTANTS =====

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
  jul: 7,
  july: 7,
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

const JUNK_FOOD_QUERY = /^(last|recent|latest|today|all|food|nutrition|my|both|two|2|three|3|from|the|slice|slices|sleep|slept|sleeping|water|steps|energy|mood|workout|dashboard|log)$/;

// ===== HELPER FUNCTIONS =====

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

/**
 * A known food word, if the sentence has one. Used so "delete my sleep" is not treated as food.
 * @param {string} lowerText
 * @returns {string|null}
 */
function extractDeleteFoodKeyword(lowerText) {
  if (/domino/.test(lowerText)) return 'domino';
  if (/pizza/.test(lowerText)) return 'pizza';
  if (/\b(chicken|rice|burger|shake|eggs|steak|salmon|oatmeal)\b/.test(lowerText)) {
    const keywordMatch = lowerText.match(/\b(chicken|rice|burger|shake|eggs|steak|salmon|oatmeal)\b/);
    return keywordMatch?.[1] || null;
  }
  if (/\b(two|2|both)\s+slices?\b/.test(lowerText) || /\bpizza slices?\b/.test(lowerText)) return 'pizza';
  return null;
}

/**
 * @param {string} lowerText
 * @returns {boolean}
 */
function doesTextMentionFoodDelete(lowerText) {
  return (
    /\b(food|meal|nutrition|ate|eaten|breakfast|lunch|dinner|snack)\b/.test(lowerText) ||
    !!extractDeleteFoodKeyword(lowerText)
  );
}

/**
 * Strip "remove the" / "from today" so the leftover word can be matched to a logged food.
 * @param {string} rawName
 * @returns {string}
 */
function cleanMisroutedFoodName(rawName) {
  return (
    sanitizeDeleteFoodQuery(rawName) ||
    String(rawName || '')
      .replace(/^(remove|delete|clear|undo)\s+(the|my|both)?\s*/i, '')
      .replace(/\s+from\s+.*$/i, '')
      .replace(/\s+x\d+$/i, '')
      .trim()
  );
}

/**
 * The model already returned a sleep/water/steps delete that matches the user. Keep it.
 * @param {string} nameRaw
 * @param {string} existingType
 * @param {object} inferredFromText
 * @param {string} userText
 * @returns {boolean}
 */
function shouldKeepExistingMetricDelete(nameRaw, existingType, inferredFromText, userText) {
  return (
    nameRaw === DELETE_LOG_TOOL &&
    NON_NUTRITION_TYPES.has(existingType) &&
    (inferredFromText.logType === existingType ||
      (inferredFromText.logType === DEFAULT_LOG_TYPE &&
        !doesTextMentionFoodDelete(String(userText || '').toLowerCase())))
  );
}

/**
 * Copy a cleaned food name onto a nutrition delete. Mutates inferred.
 * @param {object} inferred
 * @param {string} foodText
 * @param {object} params
 */
function applyNutritionFoodName(inferred, foodText, params) {
  const foodName = cleanMisroutedFoodName(foodText);
  if (foodName && !/^(remove|delete|clear)/i.test(foodName)) {
    inferred.foodName = foodName;
  } else if (!inferred.foodName && params.foodName) {
    const fromParams = sanitizeDeleteFoodQuery(params.foodName || params.food);
    if (fromParams) inferred.foodName = fromParams;
  }
  if (params.deleteAll) inferred.deleteAll = true;
}

/**
 * "today" means the phone's local day at run time, so a date baked into the reply is removed.
 * Otherwise a date on the tool params wins for food, and fills in when we have none.
 * Mutates inferred.
 * @param {object} inferred
 * @param {object} params
 * @param {string} userText
 */
function applyDeleteDate(inferred, params, userText) {
  const userLower = String(userText || '').toLowerCase();
  if (/\btoday\b/.test(userLower)) {
    delete inferred.date;
  } else if (params.date && inferred.logType === DEFAULT_LOG_TYPE) {
    inferred.date = params.date;
  } else if (params.date && !inferred.date) {
    inferred.date = params.date;
  }
}

// ===== MAIN FUNCTION =====

/**
 * True when the sentence is asking to delete a log, not just using the word "remove" in advice.
 * @param {string} text
 * @returns {boolean}
 */
function userWantsDeleteLog(text) {
  const lowerText = String(text || '').toLowerCase();
  if (!/\b(delete|remove|clear|undo|unlog|erase)\b/i.test(lowerText)) return false;
  if (
    /\b(food|meal|entry|entries|nutrition|log|sleep|slept|sleeping|water|steps|energy|mood|workout|rest|recent|last|today|yesterday|dashboard)\b/i.test(
      lowerText,
    )
  ) {
    return true;
  }
  return /\b(delete|remove|clear|undo)\b.*\b(it|that|this|one)\b/i.test(lowerText);
}

/**
 * True when the coach reply itself is describing a delete (so a plain "yes" can confirm it).
 * @param {string} text
 * @returns {boolean}
 */
function coachTextImpliesDelete(text) {
  const replyText = String(text || '');
  return (
    userWantsDeleteLog(replyText) ||
    /\b(i'?ll|i will|going to|i am|i'm)\s+(delete|remove|clear)\b/i.test(replyText) ||
    /\b(deleted|removed|cleared|removing|deleting)\b.*\b(from your|from the|sleep|log|dashboard)\b/i.test(replyText) ||
    /\b(remove|clear|delete)\b.*\b(sleep|water|steps|energy|mood|workout|food|log)\b/i.test(replyText)
  );
}

/**
 * Turn "May 3", "03/14", or "2026-05-03" into YYYY-MM-DD. Null when no date is there.
 * Two-digit years are read as 20xx. A missing year means this calendar year.
 * @param {string} text
 * @returns {string|null}
 */
function parseLooseDateKey(text) {
  const rawText = String(text || '');
  const isoMatch = rawText.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  const slashMatch = rawText.match(/\b(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])(?:\/(\d{2,4}))?\b/);
  if (slashMatch) {
    const year = slashMatch[3]
      ? slashMatch[3].length === 2
        ? Number(`${SHORT_YEAR_CENTURY}${slashMatch[3]}`)
        : Number(slashMatch[3])
      : new Date().getFullYear();
    return `${year}-${slashMatch[1].padStart(2, '0')}-${slashMatch[2].padStart(2, '0')}`;
  }

  const monthAndDayMatch = rawText.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\b/i,
  );
  if (monthAndDayMatch) {
    const monthName = monthAndDayMatch[1].toLowerCase();
    const month = MONTHS[monthName] || MONTHS[monthName.slice(0, 3)];
    if (month) {
      const year = new Date().getFullYear();
      return `${year}-${String(month).padStart(2, '0')}-${String(Number(monthAndDayMatch[2])).padStart(2, '0')}`;
    }
  }
  return null;
}

/**
 * Reduce "remove the two pizza slices from today" to a word we can match in the food log.
 * @param {string} raw
 * @returns {string|null}
 */
function sanitizeDeleteFoodQuery(raw) {
  let foodQuery = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/^(remove|delete|clear|undo)\s+(the|my|both|those|these)?\s*/i, '')
    .replace(/^(the|my|both|those|these|some)\s+/i, '')
    .replace(/^(one|two|three|four|a|\d+)\s+/i, '')
    .replace(/\s+from\s+(today|yesterday|this morning|tonight|may\s+\d{1,2}.*)$/i, '')
    .replace(/\s+(today|yesterday|right now)$/i, '')
    .replace(/\s+x\d+$/i, '')
    .trim();

  if (!foodQuery) return null;

  if (/domino/.test(foodQuery)) return 'domino';
  if (/pizza/.test(foodQuery)) return 'pizza';
  if (/^(two|2|both|slices?|the slices?|pizza slices?)$/.test(foodQuery)) return 'pizza';
  if (/chicken/.test(foodQuery)) return 'chicken';
  if (/rice/.test(foodQuery)) return 'rice';
  if (/burger/.test(foodQuery)) return 'burger';
  if (/shake/.test(foodQuery)) return 'shake';

  if (JUNK_FOOD_QUERY.test(foodQuery)) return null;

  return foodQuery.length >= FOOD_QUERY_MIN_LENGTH ? foodQuery : null;
}

/**
 * True when they want every food row for the day, not one named food.
 * @param {string} lowerText
 * @returns {boolean}
 */
function wantsDeleteAllFoodLogs(lowerText) {
  if (/\b(all|everything|any)\b/.test(lowerText) && /\b(food|meal|log|entr|nutrition)/.test(lowerText)) {
    return true;
  }
  if (/\b(remove|delete|clear|undo)\b.*\b(any|all|every)\b.*\b(food|meal|log|nutrition)/.test(lowerText)) {
    return true;
  }
  if (/\b(remove|delete|clear|undo)\b.*\btoday'?s?\b.*\b(food|meal|log|nutrition)/.test(lowerText)) {
    return true;
  }
  if (/\bfood logs?\b.*\b(today|we made today)\b/.test(lowerText)) {
    return true;
  }
  return false;
}

/**
 * Dashboard words win over nutrition when the user names them and does not also name food.
 * @param {string} [userText]
 * @param {string} [coachText]
 * @returns {string}
 */
function inferDeleteLogType(userText = '', coachText = '') {
  const lowerText = `${userText}\n${coachText}`.toLowerCase();
  const mentionsFood = doesTextMentionFoodDelete(lowerText);

  if (/\b(sleep|slept|sleeping)\b/.test(lowerText) && !mentionsFood) return 'sleep';
  if (/\b(water|hydration)\b/.test(lowerText) && !mentionsFood) return 'water';
  if (/\b(steps?|step count)\b/.test(lowerText) && !mentionsFood) return 'steps';
  if (/\b(energy|fatigue)\b/.test(lowerText) && !mentionsFood) return 'energy';
  if (/\bmood\b/.test(lowerText) && !mentionsFood) return 'mood';
  if (/\b(rest day)\b/.test(lowerText) && !mentionsFood) return 'restDay';
  if (/\bworkout\b/.test(lowerText) && !/\b(workout plan|plan)\b/.test(lowerText) && !mentionsFood) return 'workout';
  if (/\b(dashboard)\b/.test(lowerText) && /\b(sleep|slept|sleeping)\b/.test(lowerText)) return 'sleep';

  return DEFAULT_LOG_TYPE;
}

/**
 * The sentence under the Confirm button.
 * @param {object} [params]
 * @returns {string}
 */
function deleteLogReasoning(params = {}) {
  const logType = String(params.logType || DEFAULT_LOG_TYPE);
  if (logType === 'sleep') return 'Remove the sleep log from your dashboard.';
  if (logType === 'water') return 'Remove the water log from your dashboard.';
  if (logType === 'steps') return 'Remove the step count from your dashboard.';
  if (logType === 'energy') return 'Remove the energy rating from your dashboard.';
  if (logType === 'mood') return 'Remove the mood log from your dashboard.';
  if (logType === 'restDay') return 'Clear the rest day from your dashboard.';
  if (logType === 'workout') return 'Remove the workout entry from your dashboard.';
  if (params.deleteAll) return 'Clear all food logs for this day.';
  if (params.foodName) return `Remove "${params.foodName}" from your nutrition log.`;
  return 'Remove your most recent food entry.';
}

/**
 * Build the deleteLog params from the user sentence and the coach reply.
 * "today" is left unset so the executor uses the phone's local date.
 * @param {string} [userText]
 * @param {string} [coachText]
 * @returns {object}
 */
function inferDeleteLogParams(userText = '', coachText = '') {
  const combined = `${userText}\n${coachText}`;
  const lowerText = combined.toLowerCase();
  const logType = inferDeleteLogType(userText, coachText);
  const params = { logType };

  if (/\btoday\b/.test(String(userText || '').toLowerCase())) {
    // Use local today at execution — don't override with coach prose dates.
  } else {
    const date = parseLooseDateKey(combined);
    if (date) params.date = date;
  }

  if (logType !== DEFAULT_LOG_TYPE) {
    return params;
  }

  if (wantsDeleteAllFoodLogs(lowerText)) {
    params.deleteAll = true;
    return params;
  }

  if (/\b(last|recent|latest)\b/.test(lowerText) && /\b(food|meal|log|entr)/.test(lowerText)) {
    return params;
  }

  let foodName = extractDeleteFoodKeyword(lowerText);

  const foodMatch =
    combined.match(/(?:delete|remove|clear|undo)\s+(?:the|my|both)?\s*(.+?)\s+(?:log|entry|meal|from)/i) ||
    combined.match(/(?:delete|remove|clear)\s+(?:the|my|both)?\s*(.+?)\s+(?:i|we)?\s*(?:logged|log)/i);
  if (foodMatch?.[1]) {
    const candidate = sanitizeDeleteFoodQuery(foodMatch[1]);
    if (candidate) foodName = candidate;
  }

  if (foodName) params.foodName = foodName;

  return params;
}

/**
 * If the model called logNutrition (or a nutrition delete) for a dashboard delete, rewrite it.
 * No tool call at all still becomes a delete when the user asked, or when they affirmed one.
 * @param {object|null} toolCall
 * @param {string} [userText]
 * @param {string} [coachText]
 * @param {Function} normalizeToolCall
 * @returns {object|null}
 */
function coerceMisroutedDeleteTool(toolCall, userText = '', coachText = '', normalizeToolCall) {
  const doesUserWantDelete = userWantsDeleteLog(userText);
  const doesUserAffirmDelete = doesUserAffirmCoachAction(userText) && coachTextImpliesDelete(coachText);
  // A bare "yes" has no date or food in it. Read those off the coach sentence instead.
  const inferredFromText = inferDeleteLogParams(
    doesUserWantDelete || !doesUserAffirmDelete ? userText : `${coachText}\n${userText}`,
    coachText,
  );

  if (!toolCall) {
    if (!doesUserWantDelete && !doesUserAffirmDelete) return null;
    return normalizeToolCall({
      name: DELETE_LOG_TOOL,
      params: inferredFromText,
      reasoning: deleteLogReasoning(inferredFromText),
    });
  }

  const nameRaw = toolCall.name || toolCall.tool;
  const params = toolCall.params && typeof toolCall.params === 'object' ? { ...toolCall.params } : {};
  const foodText = String(params.foodName || params.food || '');
  const existingType = String(params.logType || '').trim();
  const textMetricType = inferDeleteLogType(userText, coachText);
  const isMetricMismatch =
    nameRaw === DELETE_LOG_TOOL &&
    textMetricType !== DEFAULT_LOG_TYPE &&
    String(existingType || DEFAULT_LOG_TYPE) === DEFAULT_LOG_TYPE;

  const isMisroutedLog =
    (nameRaw === LOG_NUTRITION_TOOL || nameRaw === DELETE_LOG_TOOL) &&
    (doesUserWantDelete ||
      doesUserAffirmDelete ||
      isMetricMismatch ||
      /^(remove|delete|clear|undo)\b/i.test(foodText));

  if (!isMisroutedLog) return normalizeToolCall(toolCall);

  if (shouldKeepExistingMetricDelete(nameRaw, existingType, inferredFromText, userText)) {
    const kept = {
      logType: existingType,
      date: params.date || inferredFromText.date,
    };
    return normalizeToolCall({
      name: DELETE_LOG_TOOL,
      params: kept,
      reasoning: toolCall.reasoning || deleteLogReasoning(kept),
    });
  }

  const inferred = { ...inferredFromText };
  if (isMetricMismatch) {
    inferred.logType = textMetricType;
  }

  if (inferred.logType === DEFAULT_LOG_TYPE) {
    applyNutritionFoodName(inferred, foodText, params);
  } else {
    delete inferred.foodName;
    delete inferred.deleteAll;
  }

  applyDeleteDate(inferred, params, userText);

  return normalizeToolCall({
    name: DELETE_LOG_TOOL,
    params: inferred,
    reasoning: toolCall.reasoning || deleteLogReasoning(inferred),
  });
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
