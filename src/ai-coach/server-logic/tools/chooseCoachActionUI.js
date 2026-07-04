/**
 * When coach tools should interrupt with a modal vs inline chip vs auto-run.
 */
import { normalizeToolCall } from './runCoachAction';
import { isValidCoachToolProposal } from './shouldShowCoachAction';

/** Destructive or affects others — auto-open confirm modal. */
export const COACH_TOOL_MODAL_REQUIRED = new Set([
  'deleteLog',
  'notifyTrainer',
  'bookSession',
  'updateWorkout',
  'adjustMacroTargets',
  'updateGoal',
]);

/** Read-only — run immediately, no modal. */
export const COACH_TOOL_AUTO_EXECUTE = new Set(['openWorkoutPlan']);

/** Dashboard logs — show inline chip when params incomplete. */
export const COACH_TOOL_CHIP_ONLY = new Set([
  'logNutrition',
  'logSleep',
  'logWater',
  'logSteps',
  'rateEnergy',
  'logMood',
  'rateWorkout',
  'logRestDay',
]);

const EXPLICIT_LOG_RE = /\b(log|track|record|add|save|enter|put)\b/i;

const LOG_TOOL_READY = {
  logSleep: (p) => {
    const hours = Number(p?.hours ?? p?.sleepHours);
    return Number.isFinite(hours) && hours > 0 && hours <= 24;
  },
  logWater: (p) => {
    const oz = Number(p?.amount_oz ?? p?.amountOz ?? p?.amount);
    return Number.isFinite(oz) && oz > 0;
  },
  logSteps: (p) => {
    const steps = Number(p?.step_count ?? p?.steps);
    return Number.isFinite(steps) && steps >= 0;
  },
  rateEnergy: (p) => {
    const rating = Number(p?.rating ?? p?.energy);
    return Number.isFinite(rating) && rating >= 1 && rating <= 10;
  },
  logMood: (p) => {
    const mood = String(p?.mood || '').toLowerCase().trim();
    return ['happy', 'okay', 'stressed', 'tired', 'anxious'].includes(mood);
  },
  rateWorkout: (p) => {
    const rating = Number(p?.rating);
    return Number.isFinite(rating) && rating >= 1 && rating <= 10;
  },
  logRestDay: () => true,
  logNutrition: (p) => {
    const food = String(p?.food || p?.foodName || '').trim();
    const cals = Number(p?.cals ?? p?.calories);
    return !!food && Number.isFinite(cals) && cals > 0;
  },
};

export function hasCompleteLogToolParams(toolCall) {
  const normalized = normalizeToolCall(toolCall);
  const name = normalized?.name;
  if (!name || !LOG_TOOL_READY[name]) return false;
  return LOG_TOOL_READY[name](normalized.params || {});
}

export function shouldAutoOpenCoachToolModal(toolCall, { fromServer = false, userText = '' } = {}) {
  const normalized = normalizeToolCall(toolCall);
  const name = normalized?.name;
  if (!name) return false;
  if (
    userText &&
    !COACH_TOOL_MODAL_REQUIRED.has(name) &&
    !isValidCoachToolProposal(normalized, userText) &&
    !userExplicitlyRequestsLog(userText, name)
  ) {
    return false;
  }
  if (shouldAutoExecuteCoachTool(toolCall, { userText })) return false;
  if (COACH_TOOL_MODAL_REQUIRED.has(name)) return true;
  if (COACH_TOOL_CHIP_ONLY.has(name) && hasCompleteLogToolParams(toolCall)) {
    if (fromServer) return true;
    if (userText && isValidCoachToolProposal(normalized, userText)) return true;
    // Inferred client-side when user explicitly asked to log (e.g. "Can u log 15000 steps").
    if (userText && userExplicitlyRequestsLog(userText, name)) return true;
  }
  return false;
}

function userExplicitlyRequestsLog(userText, toolName) {
  const raw = String(userText || '').trim();
  if (!raw || !EXPLICIT_LOG_RE.test(raw)) return false;
  const metricByTool = {
    logSleep: 'sleep',
    logWater: 'water',
    logSteps: 'steps',
    rateEnergy: 'energy',
    logMood: 'mood',
    rateWorkout: 'workout',
    logRestDay: 'restDay',
    logNutrition: 'nutrition',
  };
  const metric = metricByTool[toolName];
  if (!metric) return false;
  const patterns = {
    sleep: /\b(sleep|slept|hour|hrs?)\b/i,
    water: /\b(water|oz|ounce|hydrat|drank)\b/i,
    steps: /\b(steps?|step count|walked)\b/i,
    energy: /\b(energy|fatigue)\b/i,
    mood: /\b(mood|feel|feeling)\b/i,
    workout: /\b(workout|trained|session)\b/i,
    restDay: /\b(rest day|rest)\b/i,
    nutrition: /\b(food|meal|ate|breakfast|lunch|dinner|snack|nutrition|protein)\b/i,
  };
  return patterns[metric] ? patterns[metric].test(raw) : false;
}

export function shouldAutoExecuteCoachTool(toolCall, { userText = '' } = {}) {
  const normalized = normalizeToolCall(toolCall);
  const name = normalized?.name;
  if (!name) return false;
  if (COACH_TOOL_AUTO_EXECUTE.has(name)) return true;
  return false;
}

export function isChipOnlyCoachTool(toolCall) {
  const name = normalizeToolCall(toolCall)?.name;
  if (!name || !COACH_TOOL_CHIP_ONLY.has(name)) return false;
  return !hasCompleteLogToolParams(toolCall);
}
