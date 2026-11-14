// Clamps coach tool proposals and decides if Confirm is safe for what the user just said.
// Flow: rename tool aliases → clamp params per tool → drop empties → match user words (including "90oz" follow-ups).
// Used by the coach conversation and the server request handler. CommonJS for Expo app and Node server.
// Read order: constants → exported guard/filter recipes → module.exports → PLUMBING sanitizers at the bottom.
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

// The only mood values Firestore / the dashboard understand. Everything the
// model or the user says ("great", "😊", "Happy!") must land on one of these
// BEFORE a Confirm chip is shown — otherwise the chip confirms, then the
// writer rejects it with "Mood must be one of: …" (Oct 21 regression bug).
// Manipulate here: add a synonym word → the canonical mood it should save as.
const VALID_MOODS = ['happy', 'okay', 'stressed', 'tired', 'anxious'];
const MOOD_ALIASES = {
  happy: 'happy',
  joyful: 'happy',
  glad: 'happy',
  great: 'happy',
  upbeat: 'happy',
  good: 'happy',
  okay: 'okay',
  ok: 'okay',
  fine: 'okay',
  alright: 'okay',
  neutral: 'okay',
  stressed: 'stressed',
  stress: 'stressed',
  overwhelmed: 'stressed',
  tense: 'stressed',
  tired: 'tired',
  exhausted: 'tired',
  sleepy: 'tired',
  fatigued: 'tired',
  anxious: 'anxious',
  anxiety: 'anxious',
  nervous: 'anxious',
  worried: 'anxious',
};
// Manipulate here: emoji the model sometimes sends instead of a mood word.
const MOOD_EMOJI = {
  '😊': 'happy',
  '😀': 'happy',
  '😄': 'happy',
  '🙂': 'happy',
  '😐': 'okay',
  '😑': 'okay',
  '😖': 'stressed',
  '😫': 'stressed',
  '😴': 'tired',
  '🥱': 'tired',
  '😰': 'anxious',
  '😟': 'anxious',
};

const EXPLICIT_LOG_RE = /\b(log|track|record|add|save|enter|put|mark|rate)\b/i;

const DASHBOARD_METRIC_PATTERNS = {
  sleep: /\b(sleep|slept|hours?|hrs?)\b/i,
  // "90oz" has no word-boundary before oz (digit sticks to unit) — match glued forms too.
  water: /\b(water|hydrat|drank)\b|\d+\s*(?:oz|ounces?)\b/i,
  steps: /\b(steps?|step count|walked)\b/i,
  energy: /\b(energy|fatigue)\b/i,
  mood: /\b(mood|feel|feeling)\b/i,
  workout: /\b(workout|trained|lifting|session)\b/i,
  restDay: /\b(rest day|rest)\b/i,
};

// Used when the tool is not a delete. Delete has its own matcher below.
const TOOL_ALIGNMENT_PATTERNS = {
  logSleep: /\b(sleep|slept|hours?|hrs?)\b|\d+(?:\.\d+)?\s*(?:hours?|hrs?)\b/,
  // Same glued-unit hole as DASHBOARD_METRIC_PATTERNS.water ("90oz").
  logWater: /\b(water|hydrat|drank)\b|\d+\s*(?:oz|ounces?)\b/,
  logNutrition: /\b(egg|food|meal|ate|breakfast|lunch|dinner|snack|nutrition|protein|chicken|rice)\b/,
  rateWorkout: /\b(workout|session|training)\b/,
  adjustMacroTargets: /\b(calor(?:ie)?s?|macros?|goal|target|protein|carb|fat|kcal|cals?)\b/,
  logRestDay: /\b(rest)\b/,
  logSteps: /\b(steps?|walked)\b|\d[\d,]*\s*steps?\b/,
  rateEnergy: /\b(energy|fatigue)\b/,
  // Mood words count too: "Log that I'm happy" aligns with logMood even
  // though the user never said the word "mood" (Oct 21 screenshot bug).
  logMood: /\b(mood|feel|feeling|felt|happy|okay|stressed|tired|anxious|exhausted|nervous|worried|overwhelmed)\b/,
  updateGoal: /\b(goal|goals|bulk|cut|recomp|fat|muscle)\b/,
  updateWorkout: /\b(swap|replace|substitute|exercise|press|lift|workout|bench)\b/,
  openWorkoutPlan: /\b(workout|plan|program)\b/,
  bookSession: /\b(book|schedule|session|trainer|appointment)\b/,
  notifyTrainer: /\b(trainer|coach|notify|tell|message|knee|hurt|injur)\b/,
};

// Follow-up turns often reply with only the amount ("90oz") after "help me log water".
// Map that short answer onto the tool it belongs with.
const METRIC_FOLLOW_UP_TOOLS = {
  water: 'logWater',
  sleep: 'logSleep',
  steps: 'logSteps',
  energy: 'rateEnergy',
  workout: 'rateWorkout',
};

// "good / great / fine / ok" describe workouts and meals too ("log a good workout"),
// so in free text they only count as mood next to mood/feel words.
const AMBIGUOUS_MOOD_WORDS = new Set(['good', 'great', 'fine', 'ok']);

// Words that must appear when the delete tool names that logType.
// Manipulate here: add a logType key when a new deletable dashboard row ships.
const DELETE_LOG_TYPE_WORD_PATTERNS = {
  sleep: /\b(sleep|slept|sleeping)\b/,
  water: /\b(water|hydration)\b/,
  steps: /\b(steps?|step count)\b/,
  energy: /\b(energy|fatigue)\b/,
  mood: /\bmood\b/,
  restDay: /\b(rest day|rest)\b/,
};

// ===== MAIN FUNCTION =====

/**
 * One raw model call → a clamped call, or null when the name or the numbers are unusable.
 * @param {object} rawCall
 * @returns {{name: string, params: object, reasoning: string}|null}
 */
function guardCoachToolProposal(rawCall) {
  if (!rawCall || typeof rawCall !== 'object') {
    return null;
  }

  // 1. Read the tool name through alias table and length cap.
  const rawName = clipTrimmedString(rawCall.name || rawCall.tool || rawCall.action, TOOL_NAME_MAX_LENGTH);
  const name = TOOL_NAME_ALIASES[rawName] || rawName;
  if (!name || !ALLOWED_TOOLS.has(name)) {
    return null;
  }

  // 2. Clamp numbers and strings for that tool; null means unusable.
  const params = sanitizeParamsByTool(name, rawCall.params);
  if (params == null) {
    return null;
  }

  // 3. Drop blank fields so Firestore never gets empty strings.
  let reasoning = clipTrimmedString(rawCall.reasoning, REASONING_MAX_LENGTH);
  if (!reasoning) {
    reasoning = '';
  }
  return {
    name,
    params: dropEmptyParamFields(params),
    reasoning,
  };
}

/**
 * Clamp a list of calls and drop duplicates.
 * @param {object[]} rawCalls
 * @returns {object[]}
 */
function listOfRawToolCalls(rawCalls) {
  if (!Array.isArray(rawCalls)) {
    return [];
  }
  return rawCalls;
}

function guardCoachToolProposals(rawCalls) {
  const rawList = listOfRawToolCalls(rawCalls);
  const seenKeys = new Set();
  const safeCalls = [];
  for (let index = 0; index < rawList.length; index += 1) {
    const call = rawList[index];
    const safeCall = guardCoachToolProposal(call);
    if (!safeCall) {
      continue;
    }
    const identityKey = duplicateToolCallFingerprint(safeCall);
    if (seenKeys.has(identityKey)) {
      continue;
    }
    seenKeys.add(identityKey);
    safeCalls.push(safeCall);
  }
  return safeCalls;
}

/**
 * "set/change/update my …" — they want a write, not a tip.
 * @param {string} lowerText
 * @returns {boolean}
 */
function userAskedToChangeMySettings(lowerText) {
  return /\b(set|change|update|adjust)\s+my\b/.test(lowerText);
}

/**
 * Delete / remove / clear a log row (food, sleep, water, …).
 * @param {string} lowerText
 * @returns {boolean}
 */
function userAskedToDeleteALog(lowerText) {
  const hasDeleteVerb = /\b(delete|remove|clear|undo)\b/.test(lowerText);
  if (!hasDeleteVerb) return false;
  return /\b(log|food|meal|entry|entries|nutrition|sleep|water|steps|energy|mood|workout)\b/.test(
    lowerText,
  );
}

/**
 * Book or schedule a session with a trainer.
 * @param {string} lowerText
 * @returns {boolean}
 */
function userAskedToBookASession(lowerText) {
  const hasBookVerb = /\b(book|schedule)\b/.test(lowerText);
  if (!hasBookVerb) return false;
  return /\b(session|trainer|appointment)\b/.test(lowerText);
}

/**
 * Swap one exercise for another in the plan.
 * @param {string} lowerText
 * @returns {boolean}
 */
function userAskedToSwapAnExercise(lowerText) {
  const hasSwapVerb = /\b(swap|replace|substitute)\b/.test(lowerText);
  if (!hasSwapVerb) return false;
  return /\b(exercise|press|lift|workout|bench)\b/.test(lowerText);
}

/**
 * Tell / notify / message the trainer.
 * @param {string} lowerText
 * @returns {boolean}
 */
function userAskedToNotifyTrainer(lowerText) {
  const hasNotifyVerb = /\b(tell|notify|message|text)\b/.test(lowerText);
  if (!hasNotifyVerb) return false;
  return /\b(trainer|coach)\b/.test(lowerText);
}

/**
 * Open / show the workout plan screen.
 * @param {string} lowerText
 * @returns {boolean}
 */
function userAskedToOpenWorkoutPlan(lowerText) {
  const hasOpenVerb = /\b(open|show|see|view|pull up)\b/.test(lowerText);
  if (!hasOpenVerb) return false;
  return /\b(workout|plan|program)\b/.test(lowerText);
}

/**
 * Change / set / switch a goal.
 * @param {string} lowerText
 * @returns {boolean}
 */
function userAskedToChangeGoal(lowerText) {
  const namesAGoal = /\b(goal|goals)\b/.test(lowerText);
  if (!namesAGoal) return false;
  return /\b(change|update|set|switch)\b/.test(lowerText);
}

/**
 * Change calories / macros / protein targets.
 * @param {string} lowerText
 * @returns {boolean}
 */
function userAskedToChangeMacros(lowerText) {
  const namesMacros = /\b(calor(?:ie)?s?|kcal|cals?|macros?|protein|carb)\b/.test(lowerText);
  if (!namesMacros) return false;
  return /\b(change|set|update|adjust|lower|raise|bump)\b/.test(lowerText);
}

/**
 * True when the sentence asks us to do something, not just to explain something.
 * @param {string} userText
 * @returns {boolean}
 */
function userExplicitlyRequestsAction(userText) {
  const lowerText = String(userText || '').toLowerCase().trim();
  if (!lowerText) {
    return false;
  }
  if (isInformationalUserMessage(userText)) {
    return false;
  }

  // 1. Plain log / track / record verbs (and "log it").
  if (EXPLICIT_LOG_RE.test(lowerText)) {
    return true;
  }
  if (/\blog\s+it\b/.test(lowerText)) {
    return true;
  }

  // 2. Settings / delete / book / swap / notify / plan / goal / macros.
  if (userAskedToChangeMySettings(lowerText)) {
    return true;
  }
  if (userAskedToDeleteALog(lowerText)) {
    return true;
  }
  if (userAskedToBookASession(lowerText)) {
    return true;
  }
  if (userAskedToSwapAnExercise(lowerText)) {
    return true;
  }
  if (userAskedToNotifyTrainer(lowerText)) {
    return true;
  }
  if (userAskedToOpenWorkoutPlan(lowerText)) {
    return true;
  }
  if (userAskedToChangeGoal(lowerText)) {
    return true;
  }
  if (userAskedToChangeMacros(lowerText)) {
    return true;
  }

  return false;
}

/**
 * True when they named a dashboard metric AND used a log verb.
 * @param {string} userText
 * @param {string} metric One of the DASHBOARD_METRIC_PATTERNS keys
 * @returns {boolean}
 */
function userWantsExplicitDashboardLog(userText, metric) {
  const messageText = String(userText || '').trim();
  if (!messageText) {
    return false;
  }

  const hasLogVerb = EXPLICIT_LOG_RE.test(messageText);
  const hasLogIt = /\blog\s+it\b/i.test(messageText);
  if (!hasLogVerb && !hasLogIt) {
    return false;
  }

  const pattern = DASHBOARD_METRIC_PATTERNS[metric];
  if (!pattern) {
    return false;
  }
  return pattern.test(messageText);
}

/**
 * Short amount-only replies after the coach asked "how much?" — e.g. "90oz", "8 hours", "12k steps".
 * @param {string} userText
 * @returns {'water'|'sleep'|'steps'|'energy'|'workout'|null}
 */
function metricFollowUpFromUserText(userText) {
  const messageText = String(userText || '').trim();
  if (!messageText) return null;
  if (looksLikeWaterAmountOnly(messageText)) return 'water';
  if (looksLikeSleepHoursOnly(messageText)) return 'sleep';
  if (looksLikeStepCountOnly(messageText)) return 'steps';
  if (looksLikeEnergyRatingOnly(messageText)) return 'energy';
  return null;
}

function looksLikeWaterAmountOnly(messageText) {
  return /^\d+(?:\.\d+)?\s*(?:oz|ounces?)$/i.test(messageText);
}

function looksLikeSleepHoursOnly(messageText) {
  return /^\d+(?:\.\d+)?\s*(?:hours?|hrs?)$/i.test(messageText);
}

function looksLikeStepCountOnly(messageText) {
  return /^\d[\d,]*\s*steps?$/i.test(messageText);
}

function looksLikeEnergyRatingOnly(messageText) {
  return /^\d{1,2}\s*(?:\/\s*10|out of 10)?$/i.test(messageText);
}

/**
 * True when the sentence is a research / opinion question, not a log request.
 * @param {string} messageText
 * @returns {boolean}
 */
function looksLikeResearchOrOpinionQuestion(messageText) {
  if (/\?$/.test(messageText)) {
    return true;
  }
  if (/\b(too much|too little|too many|good for me|should i)\b/i.test(messageText)) {
    return true;
  }
  if (/\b(on the web|online|on the internet)\b/i.test(messageText)) {
    return true;
  }

  const saysLookUp = /\blook up\b/i.test(messageText);
  const namesWeb = /\b(web|online|internet|google)\b/i.test(messageText);
  if (saysLookUp && namesWeb) {
    return true;
  }

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
 * Questions, web lookups, and "is this too much?" stay as chat. They do not become buttons.
 * Case is kept on purpose: a few checks below are case-sensitive.
 * @param {string} userText
 * @returns {boolean}
 */
function isInformationalUserMessage(userText) {
  const messageText = String(userText || '').trim();
  if (!messageText) {
    return false;
  }

  // 1. Polite "can you log…" and explicit log/delete verbs are actions, not questions.
  // Case stays as typed on purpose — a few checks below are case-sensitive.
  if (userAskedPolitelyForAnAction(messageText)) {
    return false;
  }
  if (EXPLICIT_LOG_RE.test(messageText)) return false;
  const hasDeleteVerb = /\b(delete|remove|clear|undo)\b/.test(messageText);
  const namesALogRow = /\b(log|food|sleep|water|steps|energy|mood|workout)\b/.test(messageText);
  if (hasDeleteVerb && namesALogRow) return false;

  // 2. Everything else that looks like research / opinion stays as chat only.
  return looksLikeResearchOrOpinionQuestion(messageText);
}

/**
 * Whether this proposal should be shown for confirmation given what the user just said.
 * @param {object} rawCall
 * @param {string} userText
 * @returns {boolean}
 */
function isValidCoachToolProposal(rawCall, userText) {
  const guarded = guardCoachToolProposal(rawCall);
  if (!guarded) {
    return false;
  }

  // 1. User used a log verb — tool words must line up with their sentence.
  if (userExplicitlyRequestsAction(userText)) {
    return proposedToolMatchesUserWords(guarded, userText);
  }

  // 2. Multi-turn amount-only follow-up ("90oz" after "log water").
  const followUpMetric = metricFollowUpFromUserText(userText);
  if (followUpMetric && METRIC_FOLLOW_UP_TOOLS[followUpMetric] === guarded.name) {
    return true;
  }

  // 3. Questions and research-only turns never get Confirm.
  if (isInformationalUserMessage(userText)) {
    return false;
  }

  return false;
}

/**
 * The proposals that both clamp cleanly and match the user's sentence.
 * @param {object[]} rawCalls
 * @param {string} userText
 * @returns {object[]}
 */
function filterValidCoachToolProposals(rawCalls, userText) {
  if (!Array.isArray(rawCalls)) {
    return [];
  }
  const safeCalls = [];
  const seenKeys = new Set();
  for (let index = 0; index < rawCalls.length; index += 1) {
    const call = rawCalls[index];
    if (!isValidCoachToolProposal(call, userText)) {
      continue;
    }
    const safeCall = guardCoachToolProposal(call);
    if (!safeCall) {
      continue;
    }
    const identityKey = duplicateToolCallFingerprint(safeCall);
    if (seenKeys.has(identityKey)) {
      continue;
    }
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
  // Mood spelling lives here so server + client + writers never disagree.
  normalizeMoodValue,
  findMoodInText,
  VALID_MOODS,
  userWantsExplicitDashboardLog,
  userExplicitlyRequestsAction,
  isInformationalUserMessage,
  metricFollowUpFromUserText,
};

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

/**
 * Trim a string and cap its length. Null and blank become undefined so dropEmptyParamFields can drop them.
 * @param {*} value
 * @param {number} [maxLength]
 * @returns {string|undefined}
 */
function clipTrimmedString(value, maxLength = STRING_DEFAULT_MAX_LENGTH) {
  if (value == null) {
    return undefined;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, maxLength);
}

/**
 * @param {*} value
 * @returns {number|null}
 */
function finiteNumberOrNull(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }
  return numericValue;
}

function clamp(value, min, max) {
  const numericValue = finiteNumberOrNull(value);
  if (numericValue == null) {
    return null;
  }
  return Math.min(max, Math.max(min, numericValue));
}

function shallowPlainObjectCopy(input) {
  if (!input) {
    return {};
  }
  if (typeof input !== 'object') {
    return {};
  }
  if (Array.isArray(input)) {
    return {};
  }
  return { ...input };
}

/**
 * @param {object} params
 * @returns {object|null}
 */
function sanitizeLogSleepParams(params) {
  // Missing hours is OK — LogSleepPopup lets them fill before Confirm (Tap-Confirm gap recovery).
  const hours = clamp(params.hours ?? params.sleepHours, SLEEP_HOURS_MIN, SLEEP_HOURS_MAX);
  return { hours, date: clipTrimmedString(params.date, DATE_MAX_LENGTH) };
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
  if (amountOunces == null) {
    return null;
  }
  return {
    amount_oz: amountOunces,
    date: clipTrimmedString(params.date, DATE_MAX_LENGTH),
  };
}

function sanitizeLogStepsParams(params) {
  const stepCount = clamp(params.step_count ?? params.steps, STEPS_MIN, STEPS_MAX);
  if (stepCount == null) {
    return null;
  }
  return {
    step_count: stepCount,
    date: clipTrimmedString(params.date, DATE_MAX_LENGTH),
  };
}

/**
 * @param {object} params
 * @returns {object|null}
 */
function sanitizeRateEnergyParams(params) {
  const rating = clamp(params.rating ?? params.energy, RATING_MIN, RATING_MAX);
  if (rating == null) {
    return null;
  }
  return {
    rating,
    date: clipTrimmedString(params.date, DATE_MAX_LENGTH),
    notes: clipTrimmedString(params.notes || params.note, NOTES_MAX_LENGTH),
  };
}

/**
 * @param {object} params
 * @returns {object|null}
 */
function sanitizeRateWorkoutParams(params) {
  const rating = clamp(params.rating, RATING_MIN, RATING_MAX);
  if (rating == null) {
    return null;
  }
  return {
    rating,
    date: clipTrimmedString(params.date, DATE_MAX_LENGTH),
    notes: clipTrimmedString(params.notes || params.note, NOTES_MAX_LENGTH),
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
  const logTypeRaw = clipTrimmedString(params.logType, LOG_TYPE_MAX_LENGTH);
  let logType = DEFAULT_DELETE_LOG_TYPE;
  if (ALLOWED_LOG_TYPES.has(logTypeRaw)) {
    logType = logTypeRaw;
  }

  const deleteAllFlag = !!(params.deleteAll || params.all);
  return {
    logType,
    date: clipTrimmedString(params.date, DATE_MAX_LENGTH),
    foodName: clipTrimmedString(params.foodName || params.food, FOOD_NAME_MAX_LENGTH),
    logId: clipTrimmedString(params.logId, LOG_ID_MAX_LENGTH),
    deleteAll: deleteAllFlag,
  };
}

/**
 * @param {object} params
 * @returns {object}
 */
function sanitizeLogNutritionParams(params) {
  // No food named → nothing the popup could ever confirm. Drop it here
  // (same rule as mood above) instead of showing a "Log meal / —" chip.
  const foodName = clipTrimmedString(params.foodName || params.food, FOOD_NAME_MAX_LENGTH);
  if (!foodName) return null;
  return {
    foodName,
    food: clipTrimmedString(params.food || params.foodName, FOOD_NAME_MAX_LENGTH),
    mealType: clipTrimmedString(params.mealType, MEAL_TYPE_MAX_LENGTH),
    date: clipTrimmedString(params.date, DATE_MAX_LENGTH),
    calories: clamp(params.calories ?? params.cals, MEAL_CALORIE_MIN, MEAL_CALORIE_MAX),
    protein: clamp(params.protein, MEAL_PROTEIN_MIN, MEAL_PROTEIN_MAX),
    carbs: clamp(params.carbs, MEAL_CARBS_MIN, MEAL_CARBS_MAX),
    fat: clamp(params.fat ?? params.fats, MEAL_FAT_MIN, MEAL_FAT_MAX),
  };
}

/**
 * One exercise entry → a display name, or null when the model sent junk.
 * @param {*} exerciseItem
 * @returns {string|null}
 */
function displayNameFromExerciseItem(exerciseItem) {
  if (typeof exerciseItem === 'string') {
    return exerciseItem;
  }
  if (exerciseItem && exerciseItem.name) {
    return exerciseItem.name;
  }
  return null;
}

/**
 * Join display names from an exercises array (skip blank entries).
 * @param {Array} exercisesArray
 * @returns {string}
 */
function commaTextFromExerciseArray(exercisesArray) {
  const names = [];
  for (let index = 0; index < exercisesArray.length; index += 1) {
    const name = displayNameFromExerciseItem(exercisesArray[index]);
    if (!name) continue;
    names.push(name);
  }
  return names.join(', ');
}

/**
 * Turn an exercises array (or a fallback string) into comma-separated names for the confirm sheet.
 * @param {*} exercisesField
 * @param {*} exerciseListFallback
 * @returns {string}
 */
function exerciseListAsCommaText(exercisesField, exerciseListFallback) {
  if (Array.isArray(exercisesField)) {
    return commaTextFromExerciseArray(exercisesField);
  }
  if (exercisesField) {
    return String(exercisesField);
  }
  if (exerciseListFallback) {
    return String(exerciseListFallback);
  }
  return '';
}

function sanitizeOpenWorkoutPlanParams(params) {
  // planId drives the opener; the extra strings are display-only for the confirm sheet (PNG 17).
  return {
    planId: clipTrimmedString(params.planId, PLAN_ID_MAX_LENGTH) || DEFAULT_PLAN_ID,
    planName: clipTrimmedString(params.planName || params.title, FOOD_NAME_MAX_LENGTH),
    split: clipTrimmedString(params.split || params.planLabel || params.planSummary, REASON_MAX_LENGTH),
    todayFocus: clipTrimmedString(
      params.todayFocus || params.dayName || params.today || params.focus,
      FOOD_NAME_MAX_LENGTH,
    ),
    exercises: clipTrimmedString(
      exerciseListAsCommaText(params.exercises, params.exerciseList),
      REASON_MAX_LENGTH,
    ),
  };
}

/**
 * @param {object} params
 * @returns {object}
 */
function sanitizeLogRestDayParams(params) {
  return {
    date: clipTrimmedString(params.date, DATE_MAX_LENGTH),
    planId: clipTrimmedString(params.planId, PLAN_ID_MAX_LENGTH),
  };
}

/**
 * @param {object} params
 * @returns {object}
 */
/**
 * One raw mood value → a canonical VALID_MOODS entry, or undefined.
 * Handles case ("Happy"), punctuation ("happy!"), emoji ("happy 😊", "😊"),
 * synonyms ("great"), and the alias keys models invent (feeling / value).
 * Why here: the guard, both inferrers, and both writers all share this file,
 * so mood spelling is decided in exactly one place.
 * @param {*} value
 * @returns {string|undefined}
 */
function moodFromEmojiInText(rawText) {
  const emojiKeys = Object.keys(MOOD_EMOJI);
  for (let emojiIndex = 0; emojiIndex < emojiKeys.length; emojiIndex += 1) {
    const emoji = emojiKeys[emojiIndex];
    if (rawText.includes(emoji)) {
      return MOOD_EMOJI[emoji];
    }
  }
  return undefined;
}

function letterOnlyWordsFromText(rawText) {
  const lowerText = rawText.toLowerCase().replace(/[^a-z]/g, ' ');
  const splitPieces = lowerText.split(/\s+/);
  const words = [];
  for (let wordIndex = 0; wordIndex < splitPieces.length; wordIndex += 1) {
    const oneWord = splitPieces[wordIndex];
    if (!oneWord) {
      continue;
    }
    words.push(oneWord);
  }
  return words;
}

function wordsKeepingApostrophes(lowerText) {
  const cleaned = lowerText.replace(/[^a-z']/g, ' ');
  const splitPieces = cleaned.split(/\s+/);
  const words = [];
  for (let wordIndex = 0; wordIndex < splitPieces.length; wordIndex += 1) {
    const oneWord = splitPieces[wordIndex];
    if (!oneWord) {
      continue;
    }
    words.push(oneWord);
  }
  return words;
}

function normalizeMoodValue(value) {
  if (value == null) {
    return undefined;
  }
  const rawText = String(value).trim();
  if (!rawText) {
    return undefined;
  }

  // Emoji first — a lone "😊" has no letters for the word scan below to find.
  const moodFromEmoji = moodFromEmojiInText(rawText);
  if (moodFromEmoji) {
    return moodFromEmoji;
  }

  const words = letterOnlyWordsFromText(rawText);
  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    const word = words[wordIndex];
    if (MOOD_ALIASES[word]) {
      return MOOD_ALIASES[word];
    }
  }
  return undefined;
}

function findMoodInText(text) {
  const rawText = String(text || '');
  if (!rawText.trim()) {
    return undefined;
  }

  const moodFromEmoji = moodFromEmojiInText(rawText);
  if (moodFromEmoji) {
    return moodFromEmoji;
  }

  const lowerText = rawText.toLowerCase();
  const hasMoodContext = /\b(mood|feel|feeling|felt)\b/.test(lowerText);
  const words = wordsKeepingApostrophes(lowerText);

  // Earliest mood word wins ("tired but happy" logs tired — spoken first).
  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    const word = words[wordIndex];
    if (!MOOD_ALIASES[word]) {
      continue;
    }
    if (AMBIGUOUS_MOOD_WORDS.has(word) && !hasMoodContext) {
      continue;
    }
    return MOOD_ALIASES[word];
  }
  return undefined;
}

function sanitizeLogMoodParams(params) {
  // Models have sent the mood as mood / feeling / value / emotion — read them all.
  const mood = normalizeMoodValue(params.mood ?? params.feeling ?? params.value ?? params.emotion);
  // No usable mood → null, like sleep with no hours. Before this, an empty
  // mood passed the guard, showed a "Log mood / —" chip, and only failed
  // AFTER the user tapped Confirm ("Mood must be one of: …").
  if (!mood) {
    return null;
  }
  return {
    mood,
    date: clipTrimmedString(params.date, DATE_MAX_LENGTH),
    notes: clipTrimmedString(params.notes || params.note, NOTES_MAX_LENGTH),
  };
}

/**
 * @param {object} params
 * @returns {object}
 */
function sanitizeUpdateGoalParams(params) {
  const newGoal = clipTrimmedString(params.newGoal || params.goal, GOAL_MAX_LENGTH);
  // No goal text → the popup would show "—" and confirm would fail. Drop it.
  if (!newGoal) {
    return null;
  }
  return { newGoal };
}

/**
 * @param {object} params
 * @returns {object}
 */
function sanitizeNotifyTrainerParams(params) {
  const message = clipTrimmedString(params.message, NOTIFY_MESSAGE_MAX_LENGTH);
  // No message → nothing to send the trainer. Drop it instead of a blank popup.
  if (!message) return null;
  return {
    trainerId: clipTrimmedString(params.trainerId, TRAINER_ID_MAX_LENGTH),
    message,
    issueType: clipTrimmedString(params.issueType, ISSUE_TYPE_MAX_LENGTH),
    severity: clipTrimmedString(params.severity, SEVERITY_MAX_LENGTH),
  };
}

/**
 * @param {object} params
 * @returns {object}
 */
function sanitizeBookSessionParams(params) {
  const sessionDate = clipTrimmedString(params.sessionDate || params.date, DATE_MAX_LENGTH);
  // vocab: dateTime = one combined string ("next Tuesday at 10am" or ISO).
  // The server parser can split it, so keep it — dropping it used to turn a
  // valid booking into a popup showing Date "—" / Time "—".
  const dateTime = clipTrimmedString(params.dateTime, SESSION_NOTES_MAX_LENGTH);
  if (!sessionDate && !dateTime) return null;
  return {
    trainerId: clipTrimmedString(params.trainerId, TRAINER_ID_MAX_LENGTH),
    sessionDate,
    dateTime,
    sessionTime: clipTrimmedString(params.sessionTime || params.time, SESSION_TIME_MAX_LENGTH),
    durationMin: clamp(
      params.durationMin ?? params.durationMinutes ?? params.duration,
      SESSION_MINUTES_MIN,
      SESSION_MINUTES_MAX,
    ),
    notes: clipTrimmedString(params.notes, SESSION_NOTES_MAX_LENGTH),
  };
}

/**
 * newExercise is passed through as the model sent it. The workout editor validates the shape later.
 * @param {object} params
 * @returns {object}
 */
function exerciseNameFromUpdateWorkoutParams(params) {
  if (typeof params.newExercise === 'string') {
    return params.newExercise;
  }

  if (params.newExercise && params.newExercise.name) {
    return params.newExercise.name;
  }
  if (params.exerciseName) {
    return params.exerciseName;
  }
  if (params.exerciseId) {
    return params.exerciseId;
  }
  return undefined;
}

function sanitizeUpdateWorkoutParams(params) {
  const exerciseName = exerciseNameFromUpdateWorkoutParams(params);
  const clippedExerciseName = clipTrimmedString(exerciseName, FOOD_NAME_MAX_LENGTH);
  // No replacement exercise named → the swap popup has nothing to confirm.
  if (!clippedExerciseName) {
    return null;
  }

  return {
    planId: clipTrimmedString(params.planId, PLAN_ID_MAX_LENGTH),
    dayIndex: clamp(params.dayIndex, DAY_INDEX_MIN, DAY_INDEX_MAX),
    exerciseIndex: clamp(params.exerciseIndex, EXERCISE_INDEX_MIN, EXERCISE_INDEX_MAX),
    newExercise: params.newExercise,
    exerciseName: clippedExerciseName,
    reason: clipTrimmedString(params.reason, REASON_MAX_LENGTH),
  };
}

// Map tool name → param sanitizer. Keeps sanitizeParamsByTool flat (no switch nesting).
const TOOL_PARAM_CLEANERS_BY_NAME = {
  logSleep: sanitizeLogSleepParams,
  logWater: sanitizeLogWaterParams,
  logSteps: sanitizeLogStepsParams,
  rateEnergy: sanitizeRateEnergyParams,
  rateWorkout: sanitizeRateWorkoutParams,
  adjustMacroTargets: sanitizeMacroTargetParams,
  deleteLog: sanitizeDeleteLogParams,
  logNutrition: sanitizeLogNutritionParams,
  openWorkoutPlan: sanitizeOpenWorkoutPlanParams,
  logRestDay: sanitizeLogRestDayParams,
  logMood: sanitizeLogMoodParams,
  updateGoal: sanitizeUpdateGoalParams,
  notifyTrainer: sanitizeNotifyTrainerParams,
  bookSession: sanitizeBookSessionParams,
  updateWorkout: sanitizeUpdateWorkoutParams,
};

/**
 * @param {string} name
 * @param {object} rawParams
 * @returns {object|null}
 */
function sanitizeParamsByTool(name, rawParams) {
  const params = shallowPlainObjectCopy(rawParams);
  const sanitizer = TOOL_PARAM_CLEANERS_BY_NAME[name];
  if (sanitizer) {
    return sanitizer(params);
  }
  return shallowPlainObjectCopy(params);
}

/**
 * Drop null, undefined, and blank strings. 0 and false stay — they are real answers.
 * @param {object} input
 * @returns {object}
 */
function dropEmptyParamFields(input) {
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
function userConfirmedWithShortYes(text) {
  return /^(do it|yes|yeah|yep|ok|okay|please|go ahead|confirm|yes please|do that|send it)\.?$/i.test(
    String(text || '').trim(),
  );
}


/**
 * Without a delete verb — "not food, dashboard sleep" still names the row.
 * @param {string} logType
 * @param {string} lowerText
 * @returns {boolean}
 */
function deleteWithoutVerbStillMatches(logType, lowerText) {
  if (logType === 'sleep') {
    return /\b(sleep|slept|sleeping|dashboard)\b/.test(lowerText);
  }
  if (logType !== 'nutrition') {
    return true;
  }
  return false;
}

/**
 * Nutrition delete must not fire when they clearly meant a dashboard metric.
 * @param {string} lowerText
 * @returns {boolean}
 */
function nutritionDeleteBlockedByDashboardWords(lowerText) {
  const namesFood = /\b(food|meal|nutrition)\b/.test(lowerText);
  if (namesFood) return false;
  if (/\b(sleep|slept|sleeping)\b/.test(lowerText)) return true;
  if (/\b(water|hydration)\b/.test(lowerText)) return true;
  if (/\b(steps?)\b/.test(lowerText)) return true;
  return false;
}

/**
 * Delete is the easy tool to fire on the wrong row (sleep vs food).
 * This is the extra check that proposedToolMatchesUserWords uses only for deleteLog.
 * @param {object} guarded
 * @param {string} userText
 * @returns {boolean}
 */
function logTypeFromGuardedDelete(guarded) {
  if (!guarded.params) {
    return DEFAULT_DELETE_LOG_TYPE;
  }
  if (!guarded.params.logType) {
    return DEFAULT_DELETE_LOG_TYPE;
  }
  return String(guarded.params.logType).toLowerCase();
}

function deleteProposalMatchesUserSentence(guarded, userText) {
  const lowerText = String(userText || '').toLowerCase();
  const logType = logTypeFromGuardedDelete(guarded);

  // 1. Short "yes / do it" after the coach already described the delete.
  if (userConfirmedWithShortYes(userText)) {
    return true;
  }

  // 2. No delete verb — only accept when the sentence still names the right row.
  const hasDeleteVerb = /\b(delete|remove|clear|undo|unlog|erase)\b/.test(lowerText);
  if (!hasDeleteVerb) {
    return deleteWithoutVerbStillMatches(logType, lowerText);
  }

  // 3. Typed delete + a known dashboard logType → sentence must name that metric.
  const typePattern = DELETE_LOG_TYPE_WORD_PATTERNS[logType];
  if (typePattern) {
    return typePattern.test(lowerText);
  }
  if (logType === 'workout') {
    const namesWorkout = /\bworkout\b/.test(lowerText);
    const namesPlanOnly = /\b(workout plan|plan)\b/.test(lowerText);
    return namesWorkout && !namesPlanOnly;
  }

  // 4. Default nutrition delete — refuse when they named a dashboard number instead.
  if (nutritionDeleteBlockedByDashboardWords(lowerText)) {
    return false;
  }
  return true;
}

/**
 * @param {object} guarded
 * @param {string} userText
 * @returns {boolean}
 */
function proposedToolMatchesUserWords(guarded, userText) {
  if (guarded.name === 'deleteLog') {
    return deleteProposalMatchesUserSentence(guarded, userText);
  }
  const lowerText = String(userText || '').toLowerCase();
  const pattern = TOOL_ALIGNMENT_PATTERNS[guarded.name];
  if (!pattern) {
    return true;
  }
  return pattern.test(lowerText);
}

/**
 * "Can you log…" is a request. "Can you tell me…" is a question.
 * Checked before the generic question detector so polite requests are not thrown out.
 * @param {string} messageText
 * @returns {boolean}
 */
function userAskedPolitelyForAnAction(messageText) {
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
function duplicateToolCallFingerprint(safeCall) {
  return `${safeCall.name}:${JSON.stringify(safeCall.params)}`;
}

