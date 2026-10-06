// When the coach reply has no attached tool call, guess the action from the words.
// Flow: skip web lookups and plain questions → skip "already done" replies →
//       try each action in order → return the first match, or null.
// Used by the coach conversation screen when it decides whether to show Confirm.

import { readActionsFromReply } from '../coach-actions/readActionsFromReply';
import { normalizeToolCall } from './carryOutAction';
import { shouldUseWebAuto } from '../internet-lookup/shouldLookUpOnInternet';
import {
  userWantsDeleteLog,
  inferDeleteLogParams,
  coerceMisroutedDeleteTool,
  deleteLogReasoning,
} from './spotDeleteRequests';
import {
  isInformationalUserMessage,
  userExplicitlyRequestsAction,
  userWantsExplicitDashboardLog,
} from './shouldAskFirst';

// ===== NAMED CONSTANTS =====

// Manipulate here: fallback macros when the user says chicken and rice but no numbers.
const CHICKEN_AND_RICE_CALORIES = 410;
const CHICKEN_AND_RICE_PROTEIN = 50;
const CHICKEN_AND_RICE_CARBS = 45;
const CHICKEN_AND_RICE_FAT = 4;
// Manipulate here: sleep hours used when they asked to log sleep but no number was found.
const DEFAULT_SLEEP_HOURS = 8;
// Manipulate here: energy is a 1–10 rating. Outside this range we do not offer the button.
const ENERGY_RATING_MIN = 1;
const ENERGY_RATING_MAX = 10;
// Manipulate here: how much of the user's sentence becomes the food name.
const FOOD_NAME_MAX_LENGTH = 80;
const STEP_COUNT_FALLBACK = '0';

const LOG_STEPS_TOOL = 'logSteps';
const LOG_SLEEP_TOOL = 'logSleep';
const LOG_WATER_TOOL = 'logWater';
const LOG_NUTRITION_TOOL = 'logNutrition';
const ADJUST_MACROS_TOOL = 'adjustMacroTargets';
const RATE_ENERGY_TOOL = 'rateEnergy';
const OPEN_WORKOUT_PLAN_TOOL = 'openWorkoutPlan';
const LOG_REST_DAY_TOOL = 'logRestDay';
const DELETE_LOG_TOOL = 'deleteLog';
const CURRENT_PLAN_ID = 'current';

// ===== HELPER FUNCTIONS =====

/**
 * True when the reply is describing a finished action.
 * Those replies must not grow a second Confirm button.
 * @param {string} text
 * @returns {boolean}
 */
function isToolOutcomeMessage(text) {
  const lowerText = String(text || '').toLowerCase();
  if (!lowerText) return false;
  // Still asking the user to tap Confirm, or still promising to do it — not finished.
  if (/\b(tap confirm|confirm action|confirm in the app)\b/.test(lowerText)) return false;
  if (/\b(i'll|i will|let me|going to|right away|about to)\b/.test(lowerText)) return false;
  return (
    /\b(updated|logged|saved|recorded|set to|target updated|opening|completed|has been notified)\b/.test(
      lowerText
    ) ||
    /\bdaily target updated\b/.test(lowerText) ||
    /\bopen nutrition to see\b/.test(lowerText)
  );
}

/**
 * True when the user is asking to write a meal, not a dashboard number or a delete.
 * @param {string} text
 * @returns {boolean}
 */
function doesUserWantFoodLog(text) {
  const lowerText = String(text || '').toLowerCase();
  if (!lowerText.trim()) return false;
  // "log" has to be explicit. A question about food is not a food log.
  if (!userExplicitlyRequestsAction(text)) return false;
  if (userWantsDeleteLog(lowerText)) return false;
  if (/\b(dashboard|for me|able to|something for|on there|on my)\b/.test(lowerText)) return false;
  if (/\b(sleep|slept|energy|water|steps)\b/.test(lowerText)) return false;
  if (/\b(calor|macro|protein|carb)\b/.test(lowerText) && /\b(change|set|update|target|goal)\b/.test(lowerText)) {
    return false;
  }
  return (
    /\b(just ate|ate|eaten|had for|log this meal|log my meal|log a meal|log my food|log food|log that)\b/.test(lowerText) ||
    (/\b(breakfast|lunch|dinner|snack)\b/.test(lowerText) && /\b(ate|had|log)\b/.test(lowerText)) ||
    (/\b(chicken|rice|eggs|steak|salmon|pizza|burger|oatmeal|yogurt|banana|toast|protein shake)\b/.test(lowerText) &&
      /\b(ate|had|log\b|\d\s*oz|cup|grams?|cal)\b/.test(lowerText))
  );
}

/**
 * Pull a food name and macros out of the user's sentence.
 * Chicken and rice with no numbers gets the fallback macros above.
 * @param {string} userText
 * @returns {object}
 */
function inferFoodLogParams(userText) {
  const originalText = String(userText || '').trim();
  const lowerText = originalText.toLowerCase();
  const calorieMatch = originalText.match(/(\d{2,4})\s*(?:cal|kcal|calories)/i);
  const proteinMatch = originalText.match(/(\d+)\s*g?\s*protein/i);
  const carbMatch = originalText.match(/(\d+)\s*g?\s*carb/i);
  const fatMatch = originalText.match(/(\d+)\s*g?\s*fat/i);
  const isChickenAndRice = /chicken/.test(lowerText) && /rice/.test(lowerText);
  let foodName = originalText.slice(0, FOOD_NAME_MAX_LENGTH);
  if (isChickenAndRice) foodName = 'Chicken and rice';
  return {
    foodName,
    food: foodName,
    calories: calorieMatch ? Number(calorieMatch[1]) : isChickenAndRice ? CHICKEN_AND_RICE_CALORIES : undefined,
    protein: proteinMatch ? Number(proteinMatch[1]) : isChickenAndRice ? CHICKEN_AND_RICE_PROTEIN : undefined,
    carbs: carbMatch ? Number(carbMatch[1]) : isChickenAndRice ? CHICKEN_AND_RICE_CARBS : undefined,
    fat: fatMatch ? Number(fatMatch[1]) : isChickenAndRice ? CHICKEN_AND_RICE_FAT : undefined,
    mealType: /breakfast/.test(lowerText) ? 'breakfast' : /dinner/.test(lowerText) ? 'dinner' : /snack/.test(lowerText) ? 'snack' : 'lunch',
  };
}

/**
 * Coach said "tap confirm" — the numbers live on the user's message, not the reply.
 * Returns null when this is not a confirm prompt, so the next guess can run.
 * @param {string} replyText
 * @param {string} userText
 * @returns {object|null}
 */
function inferDashboardLogFromConfirmPrompt(replyText, userText) {
  if (!userText) return null;
  if (!/\b(tap confirm|confirm in the app|confirm action)\b/i.test(replyText)) return null;

  const stepsMatch = userText.match(/(\d[\d,]*)\s*steps?/i);
  if (stepsMatch && userWantsExplicitDashboardLog(userText, 'steps')) {
    return normalizeToolCall({
      name: LOG_STEPS_TOOL,
      params: { step_count: Number(String(stepsMatch[1]).replace(/,/g, '')) },
      reasoning: 'Log steps on your dashboard.',
    });
  }

  const sleepMatch = userText.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)(?:\s+of\s+sleep)?/i);
  if (sleepMatch && userWantsExplicitDashboardLog(userText, 'sleep')) {
    return normalizeToolCall({
      name: LOG_SLEEP_TOOL,
      params: { hours: Number(sleepMatch[1]) },
      reasoning: 'Log sleep on your dashboard.',
    });
  }

  const waterMatch = userText.match(/(\d+)\s*(?:oz|ounces?)\s*(?:of\s*)?water/i);
  if (waterMatch && userWantsExplicitDashboardLog(userText, 'water')) {
    return normalizeToolCall({
      name: LOG_WATER_TOOL,
      params: { amount_oz: Number(waterMatch[1]) },
      reasoning: 'Log water intake.',
    });
  }

  return null;
}

/**
 * @param {string} userText
 * @returns {object|null}
 */
function inferFoodLogTool(userText) {
  if (!userText || !doesUserWantFoodLog(userText)) return null;
  return normalizeToolCall({
    name: LOG_NUTRITION_TOOL,
    params: inferFoodLogParams(userText),
    reasoning: 'Log this meal to your nutrition diary.',
  });
}

/**
 * Macro numbers are read from the coach reply. The "please change my…" intent is the user's.
 * @param {string} replyText
 * @param {string} userText
 * @param {string} combinedLower
 * @returns {object|null}
 */
function inferMacroTargetChange(replyText, userText, combinedLower) {
  const doesUserWantMacroChange =
    /\b(set|change|adjust|update|bump|lower|raise|move)\b.*\b(calor|macro|protein|carb|fat|target|kcal)/i.test(
      userText
    ) || /\b(set|change|adjust|update)\s+my\b/i.test(userText);

  const calorieMatch = replyText.match(/(\d{3,4})\s*(?:calor|kcal)/i);
  const proteinMatch = replyText.match(/(\d+)\s*g?\s*protein/i);
  const carbMatch = replyText.match(/(\d+)\s*g?\s*carb/i);
  const fatMatch = replyText.match(/(\d+)\s*g?\s*fat/i);
  const hasMacroSignal = calorieMatch || proteinMatch || /\badjust.*macro/i.test(combinedLower);
  if (!doesUserWantMacroChange || !hasMacroSignal) return null;

  return normalizeToolCall({
    name: ADJUST_MACROS_TOOL,
    params: {
      calories: calorieMatch ? Number(calorieMatch[1]) : undefined,
      protein: proteinMatch ? Number(proteinMatch[1]) : undefined,
      carbs: carbMatch ? Number(carbMatch[1]) : undefined,
      fat: fatMatch ? Number(fatMatch[1]) : undefined,
    },
    reasoning: 'Apply the nutrition target change the coach suggested.',
  });
}

/**
 * @param {string} userText
 * @param {string} combinedLower
 * @returns {object|null}
 */
function inferSleepLog(userText, combinedLower) {
  if (!userText) return null;
  if (!userWantsExplicitDashboardLog(userText, 'sleep')) return null;
  const sleepMatch =
    combinedLower.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:of\s*)?sleep/i) ||
    combinedLower.match(/(?:log|add)\s+(?:in\s+)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i);
  if (!(sleepMatch || /\blog\s*sleep/i.test(combinedLower))) return null;
  return normalizeToolCall({
    name: LOG_SLEEP_TOOL,
    params: { hours: Number(sleepMatch?.[1] || DEFAULT_SLEEP_HOURS) },
    reasoning: 'Log sleep on your dashboard.',
  });
}

/**
 * @param {string} userText
 * @param {string} combinedLower
 * @returns {object|null}
 */
function inferStepsLog(userText, combinedLower) {
  if (!userText) return null;
  if (!userWantsExplicitDashboardLog(userText, 'steps')) return null;
  const stepsMatch = combinedLower.match(/(\d[\d,]*)\s*steps/i);
  if (!(stepsMatch || /\blog\s*steps/i.test(combinedLower))) return null;
  return normalizeToolCall({
    name: LOG_STEPS_TOOL,
    params: { step_count: Number(String(stepsMatch?.[1] || STEP_COUNT_FALLBACK).replace(/,/g, '')) },
    reasoning: 'Log steps on your dashboard.',
  });
}

/**
 * @param {string} userText
 * @param {string} combinedLower
 * @returns {object|null}
 */
function inferWaterLog(userText, combinedLower) {
  if (!userText) return null;
  if (!userWantsExplicitDashboardLog(userText, 'water')) return null;
  const waterMatch = combinedLower.match(/(\d+)\s*(?:oz|ounces?)\s*(?:of\s*)?water/i);
  if (!(waterMatch || /\blog\s*water/i.test(combinedLower))) return null;
  // waterMatch[1] is read even when the "log water" phrase matched without ounces.
  // That matches the previous behavior (it throws if the ounces group is missing).
  return normalizeToolCall({
    name: LOG_WATER_TOOL,
    params: { amount_oz: Number(waterMatch[1]) },
    reasoning: 'Log water intake.',
  });
}

/**
 * @param {string} userText
 * @param {string} combinedLower
 * @returns {object|null}
 */
function inferEnergyRating(userText, combinedLower) {
  if (!userText) return null;
  if (!userWantsExplicitDashboardLog(userText, 'energy')) return null;
  const energyMatch =
    combinedLower.match(/(?:energy|log\s*(?:my\s*)?energy)[^\d]{0,24}(\d+)\s*(?:\/\s*10|out of 10)?/i) ||
    combinedLower.match(/(\d+)\s*(?:\/\s*10|out of 10)\s*(?:energy|energy level)/i) ||
    combinedLower.match(/(?:rate|log)\s*(?:my\s*)?energy\s*(?:as|at|to)?\s*(\d+)/i);
  if (!(energyMatch || /\blog\s*(?:my\s*)?energy/i.test(combinedLower))) return null;
  const rating = Number(energyMatch?.[1]);
  if (!Number.isFinite(rating) || rating < ENERGY_RATING_MIN || rating > ENERGY_RATING_MAX) return null;
  return normalizeToolCall({
    name: RATE_ENERGY_TOOL,
    params: { rating },
    reasoning: 'Log your energy level on the dashboard.',
  });
}

/**
 * Only the user's words count. A web answer that mentions "workout plan" must not open the plan.
 * @param {string} userText
 * @returns {object|null}
 */
function inferOpenWorkoutPlan(userText) {
  if (!userText) return null;
  const userLower = userText.toLowerCase();
  const doesUserWantPlan =
    (/\b(open|show|see|view|pull up)\b/i.test(userLower) &&
      /\b(workout|plan|program)\b/i.test(userLower)) ||
    /\btoday'?s?\s*(workout|session)\b/i.test(userLower) ||
    /\bwhat('?s| is) (on|in) my (workout|plan|program)\b/i.test(userLower);
  if (!doesUserWantPlan) return null;
  return normalizeToolCall({
    name: OPEN_WORKOUT_PLAN_TOOL,
    params: { planId: CURRENT_PLAN_ID },
    reasoning: 'Open your workout plan and show today\'s session.',
  });
}

/**
 * @param {string} userText
 * @param {string} combinedLower
 * @returns {object|null}
 */
function inferRestDayLog(userText, combinedLower) {
  if (!userWantsExplicitDashboardLog(userText, 'restDay')) return null;
  if (!/\b(rest day|log rest|mark.*rest|take a rest)\b/i.test(combinedLower)) return null;
  const dateMatch = combinedLower.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return normalizeToolCall({
    name: LOG_REST_DAY_TOOL,
    params: { date: dateMatch?.[1] },
    reasoning: 'Log a rest day on your dashboard workout card.',
  });
}

/**
 * Delete only when the user asked. Coach prose like "remove from your diet" is not enough.
 * @param {string} userText
 * @param {string} replyText
 * @returns {object|null}
 */
function inferDeleteFromUserText(userText, replyText) {
  if (!userWantsDeleteLog(userText)) return null;
  const inferred = inferDeleteLogParams(userText, replyText);
  return normalizeToolCall({
    name: DELETE_LOG_TOOL,
    params: inferred,
    reasoning: deleteLogReasoning(inferred),
  });
}

// ===== MAIN FUNCTION =====

export { isToolOutcomeMessage };

/**
 * Guess one coach tool call from the reply text plus the user's message.
 * First match wins. Null means "do not show a confirm button."
 * @param {string} text Coach reply
 * @param {string} [userMessage]
 * @returns {object|null}
 */
export function inferToolCallFromCoachMessage(text, userMessage = '') {
  const replyText = String(text || '');
  const userText = String(userMessage || '').trim();

  // A web lookup is research, not a dashboard write.
  if (userText && shouldUseWebAuto(userText)) return null;

  // "Is 200g of protein too much?" is a question. Do not turn it into a button.
  if (isInformationalUserMessage(userText) && !userExplicitlyRequestsAction(userText)) return null;

  // "I logged it" is past tense. Confirm would run the action twice.
  if (isToolOutcomeMessage(replyText)) return null;

  const combinedLower = `${userText}\n${replyText}`.toLowerCase();

  const confirmLog = inferDashboardLogFromConfirmPrompt(replyText, userText);
  if (confirmLog) return confirmLog;

  // Real JSON in the reply beats every word guess. Delete misroutes get corrected here.
  const parsedActions = readActionsFromReply(replyText);
  if (parsedActions.length) {
    return coerceMisroutedDeleteTool(parsedActions[0], userText, replyText, normalizeToolCall);
  }

  const foodLog = inferFoodLogTool(userText);
  if (foodLog) return foodLog;

  const macroChange = inferMacroTargetChange(replyText, userText, combinedLower);
  if (macroChange) return macroChange;

  const sleepLog = inferSleepLog(userText, combinedLower);
  if (sleepLog) return sleepLog;

  const stepsLog = inferStepsLog(userText, combinedLower);
  if (stepsLog) return stepsLog;

  const waterLog = inferWaterLog(userText, combinedLower);
  if (waterLog) return waterLog;

  const energyRating = inferEnergyRating(userText, combinedLower);
  if (energyRating) return energyRating;

  const openPlan = inferOpenWorkoutPlan(userText);
  if (openPlan) return openPlan;

  const restDayLog = inferRestDayLog(userText, combinedLower);
  if (restDayLog) return restDayLog;

  const deleteLog = inferDeleteFromUserText(userText, replyText);
  if (deleteLog) return deleteLog;

  return null;
}
