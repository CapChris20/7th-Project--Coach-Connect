/**
 * infer Coach Tool Call Client
 *
 * Purpose: infer Coach Tool Call Client — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/ai
 * Key exports: inferToolCallFromCoachMessage
 *
 * @file-header
 */
/**
 * Lightweight client-side tool inference when the API didn't attach toolCalls
 * but the coach message implies an action (or embeds JSON).
 */
import { parseCoachToolCalls } from '../../tools/parseCoachToolCalls';
import { normalizeToolCall } from './runCoachAction';
import { shouldUseWebAuto } from '../chat-api/shouldUseWebSearch';
import {
  userWantsDeleteLog,
  inferDeleteLogParams,
  coerceMisroutedDeleteTool,
} from './detectDeleteFoodRequest';
import {
  isInformationalUserMessage,
  userExplicitlyRequestsAction,
  userWantsExplicitDashboardLog,
} from './shouldShowCoachAction';

/** AI messages that describe a completed action — never show Confirm again. */
function isToolOutcomeMessage(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return false;
  if (/\b(tap confirm|confirm action|confirm in the app)\b/.test(t)) return false;
  if (/\b(i'll|i will|let me|going to|right away|about to)\b/.test(t)) return false;
  return (
    /\b(updated|logged|saved|recorded|set to|target updated|opening|completed|has been notified)\b/.test(
      t
    ) ||
    /\bdaily target updated\b/.test(t) ||
    /\bopen nutrition to see\b/.test(t)
  );
}

function wantsFoodLog(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return false;
  if (!userExplicitlyRequestsAction(text)) return false;
  if (userWantsDeleteLog(t)) return false;
  if (/\b(dashboard|for me|able to|something for|on there|on my)\b/.test(t)) return false;
  if (/\b(sleep|slept|energy|water|steps)\b/.test(t)) return false;
  if (/\b(calor|macro|protein|carb)\b/.test(t) && /\b(change|set|update|target|goal)\b/.test(t)) {
    return false;
  }
  return (
    /\b(just ate|ate|eaten|had for|log this meal|log my meal|log a meal|log my food|log food|log that)\b/.test(t) ||
    (/\b(breakfast|lunch|dinner|snack)\b/.test(t) && /\b(ate|had|log)\b/.test(t)) ||
    (/\b(chicken|rice|eggs|steak|salmon|pizza|burger|oatmeal|yogurt|banana|toast|protein shake)\b/.test(t) &&
      /\b(ate|had|log\b|\d\s*oz|cup|grams?|cal)\b/.test(t))
  );
}

function inferFoodLogParams(userText) {
  const raw = String(userText || '').trim();
  const t = raw.toLowerCase();
  const calMatch = raw.match(/(\d{2,4})\s*(?:cal|kcal|calories)/i);
  const proteinMatch = raw.match(/(\d+)\s*g?\s*protein/i);
  const carbMatch = raw.match(/(\d+)\s*g?\s*carb/i);
  const fatMatch = raw.match(/(\d+)\s*g?\s*fat/i);
  const isChickenRice = /chicken/.test(t) && /rice/.test(t);
  let foodName = raw.slice(0, 80);
  if (isChickenRice) foodName = 'Chicken and rice';
  return {
    foodName,
    food: foodName,
    calories: calMatch ? Number(calMatch[1]) : isChickenRice ? 410 : undefined,
    protein: proteinMatch ? Number(proteinMatch[1]) : isChickenRice ? 50 : undefined,
    carbs: carbMatch ? Number(carbMatch[1]) : isChickenRice ? 45 : undefined,
    fat: fatMatch ? Number(fatMatch[1]) : isChickenRice ? 4 : undefined,
    mealType: /breakfast/.test(t) ? 'breakfast' : /dinner/.test(t) ? 'dinner' : /snack/.test(t) ? 'snack' : 'lunch',
  };
}

export { isToolOutcomeMessage };

export function inferToolCallFromCoachMessage(text, userMessage = '') {
  const raw = String(text || '');
  const user = String(userMessage || '').trim();

  if (user && shouldUseWebAuto(user)) return null;

  if (isInformationalUserMessage(user) && !userExplicitlyRequestsAction(user)) return null;

  const combined = `${user}\n${raw}`.toLowerCase();

  if (isToolOutcomeMessage(raw)) return null;

  // Coach asked to confirm — infer the dashboard log from the user's message.
  if (/\b(tap confirm|confirm in the app|confirm action)\b/i.test(raw) && user) {
    const stepsOnly = user.match(/(\d[\d,]*)\s*steps?/i);
    if (stepsOnly && userWantsExplicitDashboardLog(user, 'steps')) {
      return normalizeToolCall({
        name: 'logSteps',
        params: { step_count: Number(String(stepsOnly[1]).replace(/,/g, '')) },
        reasoning: 'Log steps on your dashboard.',
      });
    }
    const sleepOnly = user.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)(?:\s+of\s+sleep)?/i);
    if (sleepOnly && userWantsExplicitDashboardLog(user, 'sleep')) {
      return normalizeToolCall({
        name: 'logSleep',
        params: { hours: Number(sleepOnly[1]) },
        reasoning: 'Log sleep on your dashboard.',
      });
    }
    const waterOnly = user.match(/(\d+)\s*(?:oz|ounces?)\s*(?:of\s*)?water/i);
    if (waterOnly && userWantsExplicitDashboardLog(user, 'water')) {
      return normalizeToolCall({
        name: 'logWater',
        params: { amount_oz: Number(waterOnly[1]) },
        reasoning: 'Log water intake.',
      });
    }
  }

  const parsed = parseCoachToolCalls(raw);
  if (parsed.length) {
    return coerceMisroutedDeleteTool(parsed[0], user, raw, normalizeToolCall);
  }

  if (user && wantsFoodLog(user)) {
    return normalizeToolCall({
      name: 'logNutrition',
      params: inferFoodLogParams(user),
      reasoning: 'Log this meal to your nutrition diary.',
    });
  }

  const userWantsMacroChange =
    /\b(set|change|adjust|update|bump|lower|raise|move)\b.*\b(calor|macro|protein|carb|fat|target|kcal)/i.test(
      user
    ) || /\b(set|change|adjust|update)\s+my\b/i.test(user);

  const calorieMatch = raw.match(/(\d{3,4})\s*(?:calor|kcal)/i);
  const proteinMatch = raw.match(/(\d+)\s*g?\s*protein/i);
  const carbMatch = raw.match(/(\d+)\s*g?\s*carb/i);
  const fatMatch = raw.match(/(\d+)\s*g?\s*fat/i);
  if (userWantsMacroChange && (calorieMatch || proteinMatch || /\badjust.*macro/i.test(combined))) {
    return normalizeToolCall({
      name: 'adjustMacroTargets',
      params: {
        calories: calorieMatch ? Number(calorieMatch[1]) : undefined,
        protein: proteinMatch ? Number(proteinMatch[1]) : undefined,
        carbs: carbMatch ? Number(carbMatch[1]) : undefined,
        fat: fatMatch ? Number(fatMatch[1]) : undefined,
      },
      reasoning: 'Apply the nutrition target change the coach suggested.',
    });
  }

  const sleepMatch =
    combined.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:of\s*)?sleep/i) ||
    combined.match(/(?:log|add)\s+(?:in\s+)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i);
  if (user && userWantsExplicitDashboardLog(user, 'sleep') && (sleepMatch || /\blog\s*sleep/i.test(combined))) {
    return normalizeToolCall({
      name: 'logSleep',
      params: { hours: Number(sleepMatch?.[1] || 8) },
      reasoning: 'Log sleep on your dashboard.',
    });
  }

  const stepsMatch = combined.match(/(\d[\d,]*)\s*steps/i);
  if (user && userWantsExplicitDashboardLog(user, 'steps') && (stepsMatch || /\blog\s*steps/i.test(combined))) {
    return normalizeToolCall({
      name: 'logSteps',
      params: { step_count: Number(String(stepsMatch?.[1] || '0').replace(/,/g, '')) },
      reasoning: 'Log steps on your dashboard.',
    });
  }

  const waterMatch = combined.match(/(\d+)\s*(?:oz|ounces?)\s*(?:of\s*)?water/i);
  if (user && userWantsExplicitDashboardLog(user, 'water') && (waterMatch || /\blog\s*water/i.test(combined))) {
    return normalizeToolCall({
      name: 'logWater',
      params: { amount_oz: Number(waterMatch[1]) },
      reasoning: 'Log water intake.',
    });
  }

  const energyMatch =
    combined.match(/(?:energy|log\s*(?:my\s*)?energy)[^\d]{0,24}(\d+)\s*(?:\/\s*10|out of 10)?/i) ||
    combined.match(/(\d+)\s*(?:\/\s*10|out of 10)\s*(?:energy|energy level)/i) ||
    combined.match(/(?:rate|log)\s*(?:my\s*)?energy\s*(?:as|at|to)?\s*(\d+)/i);
  if (user && userWantsExplicitDashboardLog(user, 'energy') && (energyMatch || /\blog\s*(?:my\s*)?energy/i.test(combined))) {
    const rating = Number(energyMatch?.[1]);
    if (Number.isFinite(rating) && rating >= 1 && rating <= 10) {
      return normalizeToolCall({
        name: 'rateEnergy',
        params: { rating },
        reasoning: 'Log your energy level on the dashboard.',
      });
    }
  }

  // Only infer from the user's message — web-search replies often mention "workout plan"
  // in passing and must not trigger the open-plan modal.
  const userLower = user.toLowerCase();
  if (
    user &&
    ((/\b(open|show|see|view|pull up)\b/i.test(userLower) &&
      /\b(workout|plan|program)\b/i.test(userLower)) ||
      /\btoday'?s?\s*(workout|session)\b/i.test(userLower) ||
      /\bwhat('?s| is) (on|in) my (workout|plan|program)\b/i.test(userLower))
  ) {
    return normalizeToolCall({
      name: 'openWorkoutPlan',
      params: { planId: 'current' },
      reasoning: 'Open your workout plan and show today\'s session.',
    });
  }

  if (userWantsExplicitDashboardLog(user, 'restDay') && /\b(rest day|log rest|mark.*rest|take a rest)\b/i.test(combined)) {
    const dateMatch = combined.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    return normalizeToolCall({
      name: 'logRestDay',
      params: { date: dateMatch?.[1] },
      reasoning: 'Log a rest day on your dashboard workout card.',
    });
  }

  // Delete only when the user asked — never from coach prose ("remove from your diet", etc.).
  if (userWantsDeleteLog(user)) {
    const inferred = inferDeleteLogParams(user, raw);

    if (/\b(sleep|slept)\b/i.test(combined)) {
      return normalizeToolCall({ name: 'deleteLog', params: { logType: 'sleep', ...inferred }, reasoning: 'Remove the sleep log from your dashboard.' });
    }
    if (/\b(water|hydration)\b/i.test(combined)) {
      return normalizeToolCall({ name: 'deleteLog', params: { logType: 'water', ...inferred }, reasoning: 'Remove the water log from your dashboard.' });
    }
    if (/\b(steps|step count)\b/i.test(combined)) {
      return normalizeToolCall({ name: 'deleteLog', params: { logType: 'steps', ...inferred }, reasoning: 'Remove the step count from your dashboard.' });
    }
    if (/\b(energy|fatigue)\b/i.test(combined)) {
      return normalizeToolCall({ name: 'deleteLog', params: { logType: 'energy', ...inferred }, reasoning: 'Remove the energy rating from your dashboard.' });
    }
    if (/\b(mood|feeling)\b/i.test(combined)) {
      return normalizeToolCall({ name: 'deleteLog', params: { logType: 'mood', ...inferred }, reasoning: 'Remove the mood log from your dashboard.' });
    }
    if (/\b(rest day|rest)\b/i.test(combined) && !/\bfood\b/i.test(combined)) {
      return normalizeToolCall({ name: 'deleteLog', params: { logType: 'restDay', ...inferred }, reasoning: 'Clear the rest day from your dashboard.' });
    }
    if (/\b(workout)\b/i.test(combined) && !/\b(workout plan|plan)\b/i.test(combined)) {
      return normalizeToolCall({ name: 'deleteLog', params: { logType: 'workout', ...inferred }, reasoning: 'Remove the workout entry from your dashboard.' });
    }

    const deleteAll = !!inferred.deleteAll;
    const foodName = inferred.foodName;

    return normalizeToolCall({
      name: 'deleteLog',
      params: {
        logType: 'nutrition',
        ...inferred,
      },
      reasoning: foodName
        ? `Remove "${foodName}" from your nutrition log.`
        : deleteAll
          ? 'Clear all food logs for today.'
          : 'Remove your most recent food entry.',
    });
  }

  return null;
}
