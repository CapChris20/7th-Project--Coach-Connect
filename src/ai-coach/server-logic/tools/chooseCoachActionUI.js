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
  if (userText && !isValidCoachToolProposal(normalized, userText)) return false;
  if (COACH_TOOL_MODAL_REQUIRED.has(name)) return true;
  if (COACH_TOOL_CHIP_ONLY.has(name) && hasCompleteLogToolParams(toolCall) && fromServer) {
    return true;
  }
  return false;
}

export function shouldAutoExecuteCoachTool(toolCall) {
  const name = normalizeToolCall(toolCall)?.name;
  if (!name) return false;
  return COACH_TOOL_AUTO_EXECUTE.has(name);
}

export function isChipOnlyCoachTool(toolCall) {
  const name = normalizeToolCall(toolCall)?.name;
  if (!name || !COACH_TOOL_CHIP_ONLY.has(name)) return false;
  return !hasCompleteLogToolParams(toolCall);
}
