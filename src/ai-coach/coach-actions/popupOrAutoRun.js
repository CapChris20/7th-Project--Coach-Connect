// Decides whether a coach action opens a confirm popup, stays a chip, or just runs.
// Flow: name the tool → skip unrelated user text → destructive tools ask → incomplete logs stay chips → complete logs may auto-open.
// Used by: CoachConversationScreen when a reply includes a tool call.

import { normalizeToolCall } from './carryOutAction';
import { isValidCoachToolProposal } from './shouldAskFirst';

// ===== NAMED CONSTANTS =====

// Manipulate here: sleep hours above this are treated as incomplete (popup needs a sane number).
const MAX_SLEEP_HOURS = 24;
// Manipulate here: energy / workout ratings must sit in this inclusive range.
const MIN_RATING = 1;
const MAX_RATING = 10;

// User must use one of these verbs before we treat the sentence as an explicit log request.
const EXPLICIT_LOG_PATTERN = /\b(log|track|record|add|save|enter|put)\b/i;

// Mood spellings the confirm popup accepts. Keep in sync with LogMoodPopup.
const ALLOWED_MOODS = ['happy', 'okay', 'stressed', 'tired', 'anxious'];

// Always open a modal — destructive, booking, or big target changes.
const COACH_TOOL_MODAL_REQUIRED = new Set([
  'deleteLog',
  'notifyTrainer',
  'bookSession',
  'updateWorkout',
  'adjustMacroTargets',
  'updateGoal',
]);

// Runs with no popup (opening a plan is navigation, not a write).
const COACH_TOOL_AUTO_EXECUTE = new Set(['openWorkoutPlan']);

// Log tools that may stay as a Confirm chip when numbers are missing.
const COACH_TOOL_CHIP_ONLY = new Set([
  'logNutrition',
  'logSleep',
  'logWater',
  'logSteps',
  'rateEnergy',
  'logMood',
  'rateWorkout',
  'logRestDay',
]);

// Map tool name → metric word we look for in the user’s sentence.
const METRIC_BY_TOOL = {
  logSleep: 'sleep',
  logWater: 'water',
  logSteps: 'steps',
  rateEnergy: 'energy',
  logMood: 'mood',
  rateWorkout: 'workout',
  logRestDay: 'restDay',
  logNutrition: 'nutrition',
};

const METRIC_WORD_PATTERNS = {
  sleep: /\b(sleep|slept|hour|hrs?)\b/i,
  water: /\b(water|oz|ounce|hydrat|drank)\b/i,
  steps: /\b(steps?|step count|walked)\b/i,
  energy: /\b(energy|fatigue)\b/i,
  mood: /\b(mood|feel|feeling)\b/i,
  workout: /\b(workout|trained|session)\b/i,
  restDay: /\b(rest day|rest)\b/i,
  nutrition: /\b(food|meal|ate|breakfast|lunch|dinner|snack|nutrition|protein)\b/i,
};

// ===== MAIN FUNCTION =====

/**
 * True when a log tool already has the numbers the confirm popup needs.
 * @param {object} toolCall
 * @returns {boolean}
 */
export function hasCompleteLogToolParams(toolCall) {
  // 1. Normalize so name/params always use the same shape.
  const normalizedTool = normalizeToolCall(toolCall);
  const toolName = toolNameFromNormalized(normalizedTool);

  // 2. Unknown log tools are never “complete.”
  const readinessChecker = LOG_TOOL_READY[toolName];
  if (!toolName) {
    return false;
  }
  if (!readinessChecker) {
    return false;
  }

  // 3. Ask that tool’s readiness checker.
  const toolParams = normalizedTool.params || {};
  return readinessChecker(toolParams);
}

/**
 * True when the confirm popup should open by itself (no extra tap on a chip).
 * @param {object} toolCall
 * @param {{ fromServer?: boolean, userText?: string }} [options]
 * @returns {boolean}
 */
export function shouldAutoOpenCoachToolModal(toolCall, { fromServer = false, userText = '' } = {}) {
  // 1. Need a named tool.
  const normalizedTool = normalizeToolCall(toolCall);
  const toolName = toolNameFromNormalized(normalizedTool);
  if (!toolName) {
    return false;
  }

  // 2. Unrelated user text → do not pop a modal.
  if (shouldSkipModalForUnrelatedText(toolName, normalizedTool, userText)) {
    return false;
  }

  // 3. Auto-run tools never open a modal.
  if (shouldAutoExecuteCoachTool(toolCall, { userText })) {
    return false;
  }

  // 4. Destructive / booking tools always open.
  if (COACH_TOOL_MODAL_REQUIRED.has(toolName)) {
    return true;
  }

  // 5. Chip-only logs open when params are complete and the proposal is trusted.
  return shouldOpenChipModal(toolCall, toolName, normalizedTool, fromServer, userText);
}

/**
 * Opening a workout plan is the one tool that runs with no popup.
 * @param {object} toolCall
 * @param {{ userText?: string }} [options]
 * @returns {boolean}
 */
export function shouldAutoExecuteCoachTool(toolCall, { userText: _userText = '' } = {}) {
  // 1. Need a named tool on the allow-list.
  const normalizedTool = normalizeToolCall(toolCall);
  const toolName = toolNameFromNormalized(normalizedTool);
  if (!toolName) {
    return false;
  }

  // 2. Only openWorkoutPlan auto-runs today.
  return COACH_TOOL_AUTO_EXECUTE.has(toolName);
}

/**
 * Incomplete logs stay a chip so the client can fill the missing numbers.
 * @param {object} toolCall
 * @returns {boolean}
 */
export function isChipOnlyCoachTool(toolCall) {
  // 1. Must be a chip-only log tool.
  const toolName = toolNameFromNormalized(normalizeToolCall(toolCall));
  if (!toolName) {
    return false;
  }
  if (!COACH_TOOL_CHIP_ONLY.has(toolName)) {
    return false;
  }

  // 2. Chip means “not ready yet” — complete params go to the modal path instead.
  const paramsAreComplete = hasCompleteLogToolParams(toolCall);
  if (paramsAreComplete) {
    return false;
  }
  return true;
}

export { COACH_TOOL_MODAL_REQUIRED, COACH_TOOL_AUTO_EXECUTE, COACH_TOOL_CHIP_ONLY };

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging why a Confirm chip vs popup fired wrong

/**
 * Safe tool name from a normalized call (no optional-chain in the recipe).
 * @param {object|null|undefined} normalizedTool
 * @returns {string|undefined}
 */
function toolNameFromNormalized(normalizedTool) {
  if (!normalizedTool) {
    return undefined;
  }
  return normalizedTool.name;
}

function firstDefinedValue(...candidates) {
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (candidate !== null && candidate !== undefined) {
      return candidate;
    }
  }
  return undefined;
}

function sleepHoursFromParams(params) {
  const safeParams = params || {};
  // Keep 0 hours if the model sent 0.
  const rawHours = firstDefinedValue(safeParams.hours, safeParams.sleepHours);
  return Number(rawHours);
}

function hasReadySleepHours(params) {
  const hours = sleepHoursFromParams(params);
  if (!Number.isFinite(hours)) {
    return false;
  }
  if (hours <= 0) {
    return false;
  }
  if (hours > MAX_SLEEP_HOURS) {
    return false;
  }
  return true;
}

function waterOuncesFromParams(params) {
  const safeParams = params || {};
  const rawOunces = firstDefinedValue(
    safeParams.amount_oz,
    safeParams.amountOz,
    safeParams.amount,
  );
  return Number(rawOunces);
}

function hasReadyWaterAmount(params) {
  const ounces = waterOuncesFromParams(params);
  if (!Number.isFinite(ounces)) {
    return false;
  }
  if (ounces <= 0) {
    return false;
  }
  return true;
}

function hasReadyStepCount(params) {
  const safeParams = params || {};
  const rawSteps = firstDefinedValue(safeParams.step_count, safeParams.steps);
  const steps = Number(rawSteps);
  if (!Number.isFinite(steps)) {
    return false;
  }
  if (steps < 0) {
    return false;
  }
  return true;
}

function hasReadyEnergyRating(params) {
  const safeParams = params || {};
  const rawRating = firstDefinedValue(safeParams.rating, safeParams.energy);
  const rating = Number(rawRating);
  if (!Number.isFinite(rating)) {
    return false;
  }
  if (rating < MIN_RATING) {
    return false;
  }
  if (rating > MAX_RATING) {
    return false;
  }
  return true;
}

function hasReadyMood(params) {
  const safeParams = params || {};
  const mood = String(safeParams.mood || '')
    .toLowerCase()
    .trim();
  return ALLOWED_MOODS.includes(mood);
}

function hasReadyWorkoutRating(params) {
  const safeParams = params || {};
  const rating = Number(safeParams.rating);
  if (!Number.isFinite(rating)) {
    return false;
  }
  if (rating < MIN_RATING) {
    return false;
  }
  if (rating > MAX_RATING) {
    return false;
  }
  return true;
}

function hasReadyFoodLog(params) {
  const safeParams = params || {};
  const foodName = String(safeParams.food || safeParams.foodName || '').trim();
  const calories = Number(firstDefinedValue(safeParams.cals, safeParams.calories));
  const hasFoodName = Boolean(foodName);
  const caloriesLookReal = Number.isFinite(calories) && calories > 0;
  if (!hasFoodName) {
    return false;
  }
  if (!caloriesLookReal) {
    return false;
  }
  return true;
}

function hasReadyRestDay() {
  // Rest day has no numbers to fill — always ready for confirm.
  return true;
}

const LOG_TOOL_READY = {
  logSleep: hasReadySleepHours,
  logWater: hasReadyWaterAmount,
  logSteps: hasReadyStepCount,
  rateEnergy: hasReadyEnergyRating,
  logMood: hasReadyMood,
  rateWorkout: hasReadyWorkoutRating,
  logRestDay: hasReadyRestDay,
  logNutrition: hasReadyFoodLog,
};

/**
 * User said an explicit log verb AND mentioned this tool’s metric words.
 * @param {string} userText
 * @param {string} toolName
 * @returns {boolean}
 */
function userExplicitlyRequestsLog(userText, toolName) {
  const trimmedText = String(userText || '').trim();
  if (!trimmedText) {
    return false;
  }
  if (!EXPLICIT_LOG_PATTERN.test(trimmedText)) {
    return false;
  }

  const metricName = METRIC_BY_TOOL[toolName];
  if (!metricName) {
    return false;
  }

  const metricPattern = METRIC_WORD_PATTERNS[metricName];
  if (!metricPattern) {
    return false;
  }

  return metricPattern.test(trimmedText);
}

/**
 * Soft log tools must match the user’s words; otherwise we skip the modal.
 * Destructive tools always show even if the sentence is vague.
 * @returns {boolean}
 */
function shouldSkipModalForUnrelatedText(toolName, normalizedTool, userText) {
  if (!userText) {
    return false;
  }
  if (COACH_TOOL_MODAL_REQUIRED.has(toolName)) {
    return false;
  }
  if (isValidCoachToolProposal(normalizedTool, userText)) {
    return false;
  }
  if (userExplicitlyRequestsLog(userText, toolName)) {
    return false;
  }
  return true;
}

/**
 * Chip-only tools may auto-open when params are complete and trusted.
 * @returns {boolean}
 */
function shouldOpenChipModal(toolCall, toolName, normalizedTool, fromServer, userText) {
  if (!COACH_TOOL_CHIP_ONLY.has(toolName)) {
    return false;
  }
  if (!hasCompleteLogToolParams(toolCall)) {
    return false;
  }

  // Server-attached tools are already vetted by the model pipeline.
  if (fromServer) {
    return true;
  }

  if (userText && isValidCoachToolProposal(normalizedTool, userText)) {
    return true;
  }
  if (userText && userExplicitlyRequestsLog(userText, toolName)) {
    return true;
  }

  return false;
}
