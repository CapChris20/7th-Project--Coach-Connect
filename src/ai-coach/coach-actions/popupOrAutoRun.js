// Decides whether a coach action opens a confirm popup, a chip, or just runs.
// Flow: name the tool → if it is destructive, ask → if it is a log with missing numbers, show a chip → otherwise run it.
// Used by the coach conversation when a reply includes a tool.

import { normalizeToolCall } from './carryOutAction';
import { isValidCoachToolProposal } from './shouldAskFirst';

// ===== NAMED CONSTANTS =====

const MAX_SLEEP_HOURS = 24;
const MIN_RATING = 1;
const MAX_RATING = 10;

const EXPLICIT_LOG_PATTERN = /\b(log|track|record|add|save|enter|put)\b/i;

const ALLOWED_MOODS = ['happy', 'okay', 'stressed', 'tired', 'anxious'];

const COACH_TOOL_MODAL_REQUIRED = new Set([
  'deleteLog',
  'notifyTrainer',
  'bookSession',
  'updateWorkout',
  'adjustMacroTargets',
  'updateGoal',
]);

const COACH_TOOL_AUTO_EXECUTE = new Set(['openWorkoutPlan']);

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
  const normalizedTool = normalizeToolCall(toolCall);
  const toolName = normalizedTool?.name;
  if (!toolName || !LOG_TOOL_READY[toolName]) return false;
  return LOG_TOOL_READY[toolName](normalizedTool.params || {});
}

/**
 * True when the confirm popup should open by itself.
 * @param {object} toolCall
 * @param {{ fromServer?: boolean, userText?: string }} [options]
 * @returns {boolean}
 */
export function shouldAutoOpenCoachToolModal(toolCall, { fromServer = false, userText = '' } = {}) {
  const normalizedTool = normalizeToolCall(toolCall);
  const toolName = normalizedTool?.name;
  if (!toolName) return false;
  if (shouldSkipModalForUnrelatedText(toolName, normalizedTool, userText)) return false;
  if (shouldAutoExecuteCoachTool(toolCall, { userText })) return false;
  if (COACH_TOOL_MODAL_REQUIRED.has(toolName)) return true;
  return shouldOpenChipModal(toolCall, toolName, normalizedTool, fromServer, userText);
}

/**
 * Opening a workout plan is the one tool that runs with no popup.
 * @param {object} toolCall
 * @param {{ userText?: string }} [options]
 * @returns {boolean}
 */
export function shouldAutoExecuteCoachTool(toolCall, { userText: _userText = '' } = {}) {
  const normalizedTool = normalizeToolCall(toolCall);
  const toolName = normalizedTool?.name;
  if (!toolName) return false;
  return COACH_TOOL_AUTO_EXECUTE.has(toolName);
}

/**
 * Incomplete logs stay a chip so the client can fill the missing numbers.
 * @param {object} toolCall
 * @returns {boolean}
 */
export function isChipOnlyCoachTool(toolCall) {
  const toolName = normalizeToolCall(toolCall)?.name;
  if (!toolName || !COACH_TOOL_CHIP_ONLY.has(toolName)) return false;
  return !hasCompleteLogToolParams(toolCall);
}

export { COACH_TOOL_MODAL_REQUIRED, COACH_TOOL_AUTO_EXECUTE, COACH_TOOL_CHIP_ONLY };

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function hasReadySleepHours(params) {
  const hours = Number(params?.hours ?? params?.sleepHours);
  return Number.isFinite(hours) && hours > 0 && hours <= MAX_SLEEP_HOURS;
}

function hasReadyWaterAmount(params) {
  const ounces = Number(params?.amount_oz ?? params?.amountOz ?? params?.amount);
  return Number.isFinite(ounces) && ounces > 0;
}

function hasReadyStepCount(params) {
  const steps = Number(params?.step_count ?? params?.steps);
  return Number.isFinite(steps) && steps >= 0;
}

function hasReadyEnergyRating(params) {
  const rating = Number(params?.rating ?? params?.energy);
  return Number.isFinite(rating) && rating >= MIN_RATING && rating <= MAX_RATING;
}

function hasReadyMood(params) {
  const mood = String(params?.mood || '').toLowerCase().trim();
  return ALLOWED_MOODS.includes(mood);
}

function hasReadyWorkoutRating(params) {
  const rating = Number(params?.rating);
  return Number.isFinite(rating) && rating >= MIN_RATING && rating <= MAX_RATING;
}

function hasReadyFoodLog(params) {
  const foodName = String(params?.food || params?.foodName || '').trim();
  const calories = Number(params?.cals ?? params?.calories);
  return Boolean(foodName) && Number.isFinite(calories) && calories > 0;
}

const LOG_TOOL_READY = {
  logSleep: hasReadySleepHours,
  logWater: hasReadyWaterAmount,
  logSteps: hasReadyStepCount,
  rateEnergy: hasReadyEnergyRating,
  logMood: hasReadyMood,
  rateWorkout: hasReadyWorkoutRating,
  logRestDay: () => true,
  logNutrition: hasReadyFoodLog,
};

function userExplicitlyRequestsLog(userText, toolName) {
  const trimmedText = String(userText || '').trim();
  if (!trimmedText || !EXPLICIT_LOG_PATTERN.test(trimmedText)) return false;
  const metricName = METRIC_BY_TOOL[toolName];
  if (!metricName) return false;
  const metricPattern = METRIC_WORD_PATTERNS[metricName];
  if (!metricPattern) return false;
  return metricPattern.test(trimmedText);
}

function shouldSkipModalForUnrelatedText(toolName, normalizedTool, userText) {
  if (!userText) return false;
  if (COACH_TOOL_MODAL_REQUIRED.has(toolName)) return false;
  if (isValidCoachToolProposal(normalizedTool, userText)) return false;
  if (userExplicitlyRequestsLog(userText, toolName)) return false;
  return true;
}

function shouldOpenChipModal(toolCall, toolName, normalizedTool, fromServer, userText) {
  if (!COACH_TOOL_CHIP_ONLY.has(toolName)) return false;
  if (!hasCompleteLogToolParams(toolCall)) return false;
  if (fromServer) return true;
  if (userText && isValidCoachToolProposal(normalizedTool, userText)) return true;
  if (userText && userExplicitlyRequestsLog(userText, toolName)) return true;
  return false;
}

