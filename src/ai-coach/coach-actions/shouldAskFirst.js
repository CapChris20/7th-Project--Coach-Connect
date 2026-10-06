// Decides whether a coach tool proposal is safe to show as a Confirm button.
// Flow: rename aliases → clamp each tool's params → drop empty fields →
//       only keep the button when the user's sentence actually asked for that action.
// Used by the coach conversation and the server request handler.
// CommonJS on purpose: the Expo app and the Node server both require() this file.

// ===== NAMED CONSTANTS =====

const ALLOWED_LOG_TYPES = new Set([
  'nutrition',
  'sleep',
  'water',
  'steps',
  'energy',
  'mood',
  'workout',
  'restDay',
]);

// Models invent nearby names. Map them onto the one tool we actually run.
const TOOL_NAME_ALIASES = {
  adjustMacros: 'adjustMacroTargets',
  deleteNutritionLog: 'deleteLog',
  deleteFoodLog: 'deleteLog',
  deleteNutrition: 'deleteLog',
};

const ALLOWED_TOOLS = new Set([
  'adjustMacroTargets',
  'logNutrition',
  'logSleep',
  'logWater',
  'logSteps',
  'rateEnergy',
  'logMood',
  'rateWorkout',
  'logRestDay',
  'updateWorkout',
  'openWorkoutPlan',
  'bookSession',
  'updateGoal',
  'notifyTrainer',
  'deleteLog',
]);

// Manipulate here: string caps stop a huge model payload from landing in Firestore.
const STRING_DEFAULT_MAX_LENGTH = 300;
const TOOL_NAME_MAX_LENGTH = 40;
const DATE_MAX_LENGTH = 32;
const NOTES_MAX_LENGTH = 240;
const FOOD_NAME_MAX_LENGTH = 100;
const LOG_TYPE_MAX_LENGTH = 24;
const LOG_ID_MAX_LENGTH = 100;
const MEAL_TYPE_MAX_LENGTH = 24;
const MOOD_MAX_LENGTH = 24;
const PLAN_ID_MAX_LENGTH = 80;
const GOAL_MAX_LENGTH = 80;
const TRAINER_ID_MAX_LENGTH = 80;
const NOTIFY_MESSAGE_MAX_LENGTH = 400;
const ISSUE_TYPE_MAX_LENGTH = 40;
const SEVERITY_MAX_LENGTH = 20;
const SESSION_TIME_MAX_LENGTH = 24;
const SESSION_NOTES_MAX_LENGTH = 300;
const REASON_MAX_LENGTH = 240;
const REASONING_MAX_LENGTH = 240;

// Manipulate here: numbers outside these ranges are dropped, not clamped into a fake log.
const SLEEP_HOURS_MIN = 0.5;
const SLEEP_HOURS_MAX = 24;
const WATER_OUNCES_MIN = 1;
const WATER_OUNCES_MAX = 512;
const STEPS_MIN = 0;
const STEPS_MAX = 100000;
const RATING_MIN = 1;
const RATING_MAX = 10;
const PROTEIN_TARGET_MIN = 1;
const PROTEIN_TARGET_MAX = 400;
const CARBS_TARGET_MIN = 1;
const CARBS_TARGET_MAX = 800;
const FAT_TARGET_MIN = 1;
const FAT_TARGET_MAX = 300;
const CALORIE_TARGET_MIN = 800;
const CALORIE_TARGET_MAX = 6000;
const MEAL_CALORIE_MIN = 1;
const MEAL_CALORIE_MAX = 5000;
const MEAL_PROTEIN_MIN = 0;
const MEAL_PROTEIN_MAX = 500;
const MEAL_CARBS_MIN = 0;
const MEAL_CARBS_MAX = 800;
const MEAL_FAT_MIN = 0;
const MEAL_FAT_MAX = 400;
const SESSION_MINUTES_MIN = 15;
const SESSION_MINUTES_MAX = 240;
const DAY_INDEX_MIN = 0;
const DAY_INDEX_MAX = 13;
const EXERCISE_INDEX_MIN = 0;
const EXERCISE_INDEX_MAX = 50;

const DEFAULT_DELETE_LOG_TYPE = 'nutrition';
const DEFAULT_PLAN_ID = 'current';

const EXPLICIT_LOG_RE = /\b(log|track|record|add|save|enter|put|mark|rate)\b/i;

const DASHBOARD_METRIC_PATTERNS = {
  sleep: /\b(sleep|slept|hours?|hrs?)\b/i,
  water: /\b(water|oz|ounce|hydrat|drank)\b/i,
  steps: /\b(steps?|step count|walked)\b/i,
  energy: /\b(energy|fatigue)\b/i,
  mood: /\b(mood|feel|feeling)\b/i,
  workout: /\b(workout|trained|lifting|session)\b/i,
  restDay: /\b(rest day|rest)\b/i,
};

// Used when the tool is not a delete. Delete has its own matcher below.
const TOOL_ALIGNMENT_PATTERNS = {
  logSleep: /\b(sleep|slept|hour|hrs?)\b/,
  logWater: /\b(water|oz|ounce|hydrat|drank)\b/,
  logNutrition: /\b(egg|food|meal|ate|breakfast|lunch|dinner|snack|nutrition|protein|chicken|rice)\b/,
  rateWorkout: /\b(workout|session|training)\b/,
  adjustMacroTargets: /\b(calor(?:ie)?s?|macros?|goal|target|protein|carb|fat|kcal|cals?)\b/,
  logRestDay: /\b(rest)\b/,
  logSteps: /\b(steps?|walked)\b/,
  rateEnergy: /\b(energy|fatigue)\b/,
  logMood: /\b(mood|feel|feeling)\b/,
  updateGoal: /\b(goal|goals|bulk|cut|recomp|fat|muscle)\b/,
  updateWorkout: /\b(swap|replace|substitute|exercise|press|lift|workout|bench)\b/,
  openWorkoutPlan: /\b(workout|plan|program)\b/,
  bookSession: /\b(book|schedule|session|trainer|appointment)\b/,
  notifyTrainer: /\b(trainer|coach|notify|tell|message|knee|hurt|injur)\b/,
};

// ===== HELPER FUNCTIONS =====

/**
 * Trim a string and cap its length. Null and blank become undefined so compactObject can drop them.
 * @param {*} value
 * @param {number} [maxLength]
 * @returns {string|undefined}
 */
function sanitizeString(value, maxLength = STRING_DEFAULT_MAX_LENGTH) {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

/**
 * @param {*} value
 * @returns {number|null}
 */
function asFiniteNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

/**
 * @param {*} value
 * @param {number} min
 * @param {number} max
 * @returns {number|null}
 */
function clamp(value, min, max) {
  const numericValue = asFiniteNumber(value);
  if (numericValue == null) return null;
  return Math.min(max, Math.max(min, numericValue));
}

/**
 * A shallow copy, or {} when the model sent an array or a non-object.
 * @param {*} input
 * @returns {object}
 */
function copyPlainObject(input) {
  return input && typeof input === 'object' && !Array.isArray(input) ? { ...input } : {};
}

/**
 * @param {object} params
 * @returns {object|null}
 */
function sanitizeLogSleepParams(params) {
  const hours = clamp(params.hours ?? params.sleepHours, SLEEP_HOURS_MIN, SLEEP_HOURS_MAX);
  return hours == null ? null : { hours, date: sanitizeString(params.date, DATE_MAX_LENGTH) };
}

/**
 * @param {object} params
 * @returns {object|null}
 */
function sanitizeLogWaterParams(params) {
  const amountOunces = clamp(
    params.amount_oz ?? params.amountOz ?? params.amount ?? params.ounces,
    WATER_OUNCES_MIN,
    WATER_OUNCES_MAX,
  );
  return amountOunces == null ? null : { amount_oz: amountOunces, date: sanitizeString(params.date, DATE_MAX_LENGTH) };
}

/**
 * @param {object} params
 * @returns {object|null}
 */
function sanitizeLogStepsParams(params) {
  const stepCount = clamp(params.step_count ?? params.steps, STEPS_MIN, STEPS_MAX);
  return stepCount == null ? null : { step_count: stepCount, date: sanitizeString(params.date, DATE_MAX_LENGTH) };
}

/**
 * @param {object} params
 * @returns {object|null}
 */
function sanitizeRateEnergyParams(params) {
  const rating = clamp(params.rating ?? params.energy, RATING_MIN, RATING_MAX);
  return rating == null
    ? null
    : {
        rating,
        date: sanitizeString(params.date, DATE_MAX_LENGTH),
        notes: sanitizeString(params.notes || params.note, NOTES_MAX_LENGTH),
      };
}

/**
 * @param {object} params
 * @returns {object|null}
 */
function sanitizeRateWorkoutParams(params) {
  const rating = clamp(params.rating, RATING_MIN, RATING_MAX);
  return rating == null
    ? null
    : {
        rating,
        date: sanitizeString(params.date, DATE_MAX_LENGTH),
        notes: sanitizeString(params.notes || params.note, NOTES_MAX_LENGTH),
      };
}

/**
 * At least one macro must survive the clamp. All-empty means the proposal is junk.
 * @param {object} params
 * @returns {object|null}
 */
function sanitizeMacroTargetParams(params) {
  const protein = clamp(params.protein ?? params.newProtein, PROTEIN_TARGET_MIN, PROTEIN_TARGET_MAX);
  const carbs = clamp(params.carbs ?? params.newCarbs, CARBS_TARGET_MIN, CARBS_TARGET_MAX);
  const fat = clamp(params.fat ?? params.fats ?? params.newFats, FAT_TARGET_MIN, FAT_TARGET_MAX);
  const calories = clamp(
    params.calories ?? params.newCals ?? params.calorieTarget,
    CALORIE_TARGET_MIN,
    CALORIE_TARGET_MAX,
  );
  if (protein == null && carbs == null && fat == null && calories == null) return null;
  return { protein, carbs, fat, calories };
}

/**
 * Unknown log types fall back to nutrition so an old client still deletes a food row.
 * @param {object} params
 * @returns {object}
 */
function sanitizeDeleteLogParams(params) {
  const logTypeRaw = sanitizeString(params.logType, LOG_TYPE_MAX_LENGTH);
  const logType = ALLOWED_LOG_TYPES.has(logTypeRaw) ? logTypeRaw : DEFAULT_DELETE_LOG_TYPE;
  return {
    logType,
    date: sanitizeString(params.date, DATE_MAX_LENGTH),
    foodName: sanitizeString(params.foodName || params.food, FOOD_NAME_MAX_LENGTH),
    logId: sanitizeString(params.logId, LOG_ID_MAX_LENGTH),
    deleteAll: !!(params.deleteAll || params.all),
  };
}

/**
 * @param {object} params
 * @returns {object}
 */
function sanitizeLogNutritionParams(params) {
  return {
    foodName: sanitizeString(params.foodName || params.food, FOOD_NAME_MAX_LENGTH),
    food: sanitizeString(params.food || params.foodName, FOOD_NAME_MAX_LENGTH),
    mealType: sanitizeString(params.mealType, MEAL_TYPE_MAX_LENGTH),
    date: sanitizeString(params.date, DATE_MAX_LENGTH),
    calories: clamp(params.calories ?? params.cals, MEAL_CALORIE_MIN, MEAL_CALORIE_MAX),
    protein: clamp(params.protein, MEAL_PROTEIN_MIN, MEAL_PROTEIN_MAX),
    carbs: clamp(params.carbs, MEAL_CARBS_MIN, MEAL_CARBS_MAX),
    fat: clamp(params.fat ?? params.fats, MEAL_FAT_MIN, MEAL_FAT_MAX),
  };
}

/**
 * @param {object} params
 * @returns {object}
 */
function sanitizeOpenWorkoutPlanParams(params) {
  return { planId: sanitizeString(params.planId, PLAN_ID_MAX_LENGTH) || DEFAULT_PLAN_ID };
}

/**
 * @param {object} params
 * @returns {object}
 */
function sanitizeLogRestDayParams(params) {
  return {
    date: sanitizeString(params.date, DATE_MAX_LENGTH),
    planId: sanitizeString(params.planId, PLAN_ID_MAX_LENGTH),
  };
}

/**
 * @param {object} params
 * @returns {object}
 */
function sanitizeLogMoodParams(params) {
  return {
    mood: sanitizeString(params.mood, MOOD_MAX_LENGTH),
    date: sanitizeString(params.date, DATE_MAX_LENGTH),
    notes: sanitizeString(params.notes || params.note, NOTES_MAX_LENGTH),
  };
}

/**
 * @param {object} params
 * @returns {object}
 */
function sanitizeUpdateGoalParams(params) {
  return { newGoal: sanitizeString(params.newGoal, GOAL_MAX_LENGTH) };
}

/**
 * @param {object} params
 * @returns {object}
 */
function sanitizeNotifyTrainerParams(params) {
  return {
    trainerId: sanitizeString(params.trainerId, TRAINER_ID_MAX_LENGTH),
    message: sanitizeString(params.message, NOTIFY_MESSAGE_MAX_LENGTH),
    issueType: sanitizeString(params.issueType, ISSUE_TYPE_MAX_LENGTH),
    severity: sanitizeString(params.severity, SEVERITY_MAX_LENGTH),
  };
}

/**
 * @param {object} params
 * @returns {object}
 */
function sanitizeBookSessionParams(params) {
  return {
    trainerId: sanitizeString(params.trainerId, TRAINER_ID_MAX_LENGTH),
    sessionDate: sanitizeString(params.sessionDate || params.date, DATE_MAX_LENGTH),
    sessionTime: sanitizeString(params.sessionTime || params.time, SESSION_TIME_MAX_LENGTH),
    durationMin: clamp(
      params.durationMin ?? params.durationMinutes ?? params.duration,
      SESSION_MINUTES_MIN,
      SESSION_MINUTES_MAX,
    ),
    notes: sanitizeString(params.notes, SESSION_NOTES_MAX_LENGTH),
  };
}

/**
 * newExercise is passed through as the model sent it. The workout editor validates the shape later.
 * @param {object} params
 * @returns {object}
 */
function sanitizeUpdateWorkoutParams(params) {
  return {
    planId: sanitizeString(params.planId, PLAN_ID_MAX_LENGTH),
    dayIndex: clamp(params.dayIndex, DAY_INDEX_MIN, DAY_INDEX_MAX),
    exerciseIndex: clamp(params.exerciseIndex, EXERCISE_INDEX_MIN, EXERCISE_INDEX_MAX),
    newExercise: params.newExercise,
    reason: sanitizeString(params.reason, REASON_MAX_LENGTH),
  };
}

/**
 * @param {string} name
 * @param {object} rawParams
 * @returns {object|null}
 */
function sanitizeParamsByTool(name, rawParams) {
  const params = copyPlainObject(rawParams);

  switch (name) {
    case 'logSleep':
      return sanitizeLogSleepParams(params);
    case 'logWater':
      return sanitizeLogWaterParams(params);
    case 'logSteps':
      return sanitizeLogStepsParams(params);
    case 'rateEnergy':
      return sanitizeRateEnergyParams(params);
    case 'rateWorkout':
      return sanitizeRateWorkoutParams(params);
    case 'adjustMacroTargets':
      return sanitizeMacroTargetParams(params);
    case 'deleteLog':
      return sanitizeDeleteLogParams(params);
    case 'logNutrition':
      return sanitizeLogNutritionParams(params);
    case 'openWorkoutPlan':
      return sanitizeOpenWorkoutPlanParams(params);
    case 'logRestDay':
      return sanitizeLogRestDayParams(params);
    case 'logMood':
      return sanitizeLogMoodParams(params);
    case 'updateGoal':
      return sanitizeUpdateGoalParams(params);
    case 'notifyTrainer':
      return sanitizeNotifyTrainerParams(params);
    case 'bookSession':
      return sanitizeBookSessionParams(params);
    case 'updateWorkout':
      return sanitizeUpdateWorkoutParams(params);
    default:
      return copyPlainObject(params);
  }
}

/**
 * Drop null, undefined, and blank strings. 0 and false stay — they are real answers.
 * @param {object} input
 * @returns {object}
 */
function compactObject(input) {
  const compacted = {};
  for (const [fieldName, fieldValue] of Object.entries(input || {})) {
    if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
      compacted[fieldName] = fieldValue;
    }
  }
  return compacted;
}

/**
 * "yes" / "do it" confirms a button the coach already described.
 * @param {string} text
 * @returns {boolean}
 */
function doesUserAffirmPendingCoachAction(text) {
  return /^(do it|yes|yeah|yep|ok|okay|please|go ahead|confirm|yes please|do that|send it)\.?$/i.test(
    String(text || '').trim(),
  );
}

/**
 * Delete is the easy tool to fire on the wrong row (sleep vs food).
 * This is the extra check that toolAlignsWithUserMessage uses only for deleteLog.
 * @param {object} guarded
 * @param {string} userText
 * @returns {boolean}
 */
function doesDeleteLogMatchUserMessage(guarded, userText) {
  const lowerText = String(userText || '').toLowerCase();
  if (doesUserAffirmPendingCoachAction(userText)) return true;

  if (!/\b(delete|remove|clear|undo|unlog|erase)\b/.test(lowerText)) {
    // "not food, dashboard sleep" names the row without using the word delete.
    const logType = String(guarded.params?.logType || DEFAULT_DELETE_LOG_TYPE).toLowerCase();
    if (logType === 'sleep') return /\b(sleep|slept|sleeping|dashboard)\b/.test(lowerText);
    if (logType !== 'nutrition') return true;
    return false;
  }

  const logType = String(guarded.params?.logType || DEFAULT_DELETE_LOG_TYPE).toLowerCase();
  if (logType === 'sleep') return /\b(sleep|slept|sleeping)\b/.test(lowerText);
  if (logType === 'water') return /\b(water|hydration)\b/.test(lowerText);
  if (logType === 'steps') return /\b(steps?|step count)\b/.test(lowerText);
  if (logType === 'energy') return /\b(energy|fatigue)\b/.test(lowerText);
  if (logType === 'mood') return /\bmood\b/.test(lowerText);
  if (logType === 'restDay') return /\b(rest day|rest)\b/.test(lowerText);
  if (logType === 'workout') return /\bworkout\b/.test(lowerText) && !/\b(workout plan|plan)\b/.test(lowerText);
  // A nutrition delete must not run when they clearly meant a dashboard number.
  if (/\b(sleep|slept|sleeping)\b/.test(lowerText) && !/\b(food|meal|nutrition)\b/.test(lowerText)) return false;
  if (/\b(water|hydration)\b/.test(lowerText) && !/\b(food|meal|nutrition)\b/.test(lowerText)) return false;
  if (/\b(steps?)\b/.test(lowerText) && !/\b(food|meal|nutrition)\b/.test(lowerText)) return false;
  return true;
}

/**
 * @param {object} guarded
 * @param {string} userText
 * @returns {boolean}
 */
function toolAlignsWithUserMessage(guarded, userText) {
  if (guarded.name === 'deleteLog') {
    return doesDeleteLogMatchUserMessage(guarded, userText);
  }
  const lowerText = String(userText || '').toLowerCase();
  const pattern = TOOL_ALIGNMENT_PATTERNS[guarded.name];
  if (!pattern) return true;
  return pattern.test(lowerText);
}

/**
 * "Can you log…" is a request. "Can you tell me…" is a question.
 * Checked before the generic question detector so polite requests are not thrown out.
 * @param {string} messageText
 * @returns {boolean}
 */
function isPoliteActionRequest(messageText) {
  if (!/^(can|could|would)\s+you\b/i.test(messageText)) return false;
  return /\b(adjust|set|change|update|log|track|record|add|delete|remove|open|book|notify|fix|increase|decrease|raise|lower)\b/i.test(
    messageText,
  );
}

/**
 * Same name + same params = the same button. Used to drop duplicates in a batch.
 * @param {object} safeCall
 * @returns {string}
 */
function toolCallIdentityKey(safeCall) {
  return `${safeCall.name}:${JSON.stringify(safeCall.params)}`;
}

// ===== MAIN FUNCTION =====

/**
 * One raw model call → a clamped call, or null when the name or the numbers are unusable.
 * @param {object} rawCall
 * @returns {{name: string, params: object, reasoning: string}|null}
 */
function guardCoachToolProposal(rawCall) {
  if (!rawCall || typeof rawCall !== 'object') return null;
  const rawName = sanitizeString(rawCall.name || rawCall.tool || rawCall.action, TOOL_NAME_MAX_LENGTH);
  const name = TOOL_NAME_ALIASES[rawName] || rawName;
  if (!name || !ALLOWED_TOOLS.has(name)) return null;
  const params = sanitizeParamsByTool(name, rawCall.params);
  if (params == null) return null;
  return {
    name,
    params: compactObject(params),
    reasoning: sanitizeString(rawCall.reasoning, REASONING_MAX_LENGTH) || '',
  };
}

/**
 * Clamp a list of calls and drop duplicates.
 * @param {object[]} rawCalls
 * @returns {object[]}
 */
function guardCoachToolProposals(rawCalls) {
  const seenKeys = new Set();
  const safeCalls = [];
  for (const call of Array.isArray(rawCalls) ? rawCalls : []) {
    const safeCall = guardCoachToolProposal(call);
    if (!safeCall) continue;
    const identityKey = toolCallIdentityKey(safeCall);
    if (seenKeys.has(identityKey)) continue;
    seenKeys.add(identityKey);
    safeCalls.push(safeCall);
  }
  return safeCalls;
}

/**
 * True when the sentence asks us to do something, not just to explain something.
 * @param {string} userText
 * @returns {boolean}
 */
function userExplicitlyRequestsAction(userText) {
  const lowerText = String(userText || '').toLowerCase().trim();
  if (!lowerText) return false;
  if (isInformationalUserMessage(userText)) return false;
  return (
    EXPLICIT_LOG_RE.test(lowerText) ||
    /\b(set|change|update|adjust)\s+my\b/.test(lowerText) ||
    /\blog\s+it\b/.test(lowerText) ||
    (/\b(delete|remove|clear|undo)\b/.test(lowerText) &&
      /\b(log|food|meal|entry|entries|nutrition|sleep|water|steps|energy|mood|workout)\b/.test(lowerText)) ||
    (/\b(book|schedule)\b/.test(lowerText) && /\b(session|trainer|appointment)\b/.test(lowerText)) ||
    (/\b(swap|replace|substitute)\b/.test(lowerText) && /\b(exercise|press|lift|workout|bench)\b/.test(lowerText)) ||
    (/\b(tell|notify|message|text)\b/.test(lowerText) && /\b(trainer|coach)\b/.test(lowerText)) ||
    (/\b(open|show|see|view|pull up)\b/.test(lowerText) && /\b(workout|plan|program)\b/.test(lowerText)) ||
    (/\b(goal|goals)\b/.test(lowerText) && /\b(change|update|set|switch)\b/.test(lowerText)) ||
    (/\b(calor(?:ie)?s?|kcal|cals?|macros?|protein|carb)\b/.test(lowerText) &&
      /\b(change|set|update|adjust|lower|raise|bump)\b/.test(lowerText))
  );
}

/**
 * True when they named a dashboard metric AND used a log verb.
 * @param {string} userText
 * @param {string} metric One of the DASHBOARD_METRIC_PATTERNS keys
 * @returns {boolean}
 */
function userWantsExplicitDashboardLog(userText, metric) {
  const messageText = String(userText || '').trim();
  if (!messageText) return false;
  if (!EXPLICIT_LOG_RE.test(messageText) && !/\blog\s+it\b/i.test(messageText)) return false;
  const pattern = DASHBOARD_METRIC_PATTERNS[metric];
  return pattern ? pattern.test(messageText) : false;
}

/**
 * Questions, web lookups, and "is this too much?" stay as chat. They do not become buttons.
 * Case is kept on purpose: a few checks below are case-sensitive.
 * @param {string} userText
 * @returns {boolean}
 */
function isInformationalUserMessage(userText) {
  const messageText = String(userText || '').trim();
  if (!messageText) return false;
  if (isPoliteActionRequest(messageText)) return false;
  // "Can u log 15000 steps" is an action, not a generic "can you" question.
  if (EXPLICIT_LOG_RE.test(messageText)) return false;
  if (
    /\b(delete|remove|clear|undo)\b/.test(messageText) &&
    /\b(log|food|sleep|water|steps|energy|mood|workout)\b/.test(messageText)
  ) {
    return false;
  }
  if (/\?$/.test(messageText)) return true;
  if (/\b(too much|too little|too many|good for me|should i)\b/i.test(messageText)) return true;
  if (/\b(on the web|online|on the internet)\b/i.test(messageText)) return true;
  if (/\blook up\b/i.test(messageText) && /\b(web|online|internet|google)\b/i.test(messageText)) return true;
  if (
    /\b(search the web|search online|google it|look it up online|what does the research|what do studies|cite sources|any sources|pull up sources)\b/i.test(
      messageText,
    )
  ) {
    return true;
  }
  return /^(what|how|is|are|should|can|could|would|why|when|where|search)\b/i.test(messageText);
}

/**
 * Whether this proposal should be shown for confirmation given what the user just said.
 * @param {object} rawCall
 * @param {string} userText
 * @returns {boolean}
 */
function isValidCoachToolProposal(rawCall, userText) {
  const guarded = guardCoachToolProposal(rawCall);
  if (!guarded) return false;

  if (userExplicitlyRequestsAction(userText)) {
    return toolAlignsWithUserMessage(guarded, userText);
  }

  if (isInformationalUserMessage(userText)) return false;

  return false;
}

/**
 * The proposals that both clamp cleanly and match the user's sentence.
 * @param {object[]} rawCalls
 * @param {string} userText
 * @returns {object[]}
 */
function filterValidCoachToolProposals(rawCalls, userText) {
  if (!Array.isArray(rawCalls)) return [];
  const safeCalls = [];
  const seenKeys = new Set();
  for (const call of rawCalls) {
    if (!isValidCoachToolProposal(call, userText)) continue;
    const safeCall = guardCoachToolProposal(call);
    if (!safeCall) continue;
    const identityKey = toolCallIdentityKey(safeCall);
    if (seenKeys.has(identityKey)) continue;
    seenKeys.add(identityKey);
    safeCalls.push(safeCall);
  }
  return safeCalls;
}

module.exports = {
  guardCoachToolProposal,
  guardCoachToolProposals,
  isValidCoachToolProposal,
  filterValidCoachToolProposals,
  userWantsExplicitDashboardLog,
  userExplicitlyRequestsAction,
  isInformationalUserMessage,
};
