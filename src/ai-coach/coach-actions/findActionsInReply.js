// Guesses a dashboard tool when the model forgot to attach JSON but the words still ask for a log.
// Flow: bail on web lookup and plain questions → bail on “already done” replies → run guessers in order → first win.
// Used by: CoachConversationScreen before it shows a Confirm chip.
// Read order: constants → inferToolCallFromCoachMessage (main) → PLUMBING guessers at the bottom.

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
  metricFollowUpFromUserText,
  // vocab: findMoodInText = first canonical mood word/emoji in a sentence (shared with the server)
  findMoodInText,
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
const LOG_MOOD_TOOL = 'logMood';
const RATE_WORKOUT_TOOL = 'rateWorkout';
const OPEN_WORKOUT_PLAN_TOOL = 'openWorkoutPlan';
const LOG_REST_DAY_TOOL = 'logRestDay';
const DELETE_LOG_TOOL = 'deleteLog';
const CURRENT_PLAN_ID = 'current';

// ===== MAIN FUNCTION =====

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

  // 1. A web lookup is research, not a dashboard write.
  if (userText && shouldUseWebAuto(userText)) {
    return null;
  }

  // 2. "Is 200g of protein too much?" is a question. Do not turn it into a button.
  const isPlainQuestion =
    isInformationalUserMessage(userText) && !userExplicitlyRequestsAction(userText);
  if (isPlainQuestion) {
    return null;
  }

  // 3. "I logged it" is past tense. Confirm would run the action twice.
  if (isToolOutcomeMessage(replyText)) {
    return null;
  }

  const combinedLower = `${userText}\n${replyText}`.toLowerCase();
  const guessSteps = orderedGuessCallbacksForReply(replyText, userText, combinedLower);

  // 4. Run each guesser until one returns a normalized tool call.
  for (let stepIndex = 0; stepIndex < guessSteps.length; stepIndex += 1) {
    const tryGuess = guessSteps[stepIndex];
    const guessed = tryGuess();
    if (guessed) {
      return guessed;
    }
  }

  return null;
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

/**
 * True when the reply is describing a finished action.
 * Those replies must not grow a second Confirm button.
 * @param {string} text
 * @returns {boolean}
 */
function isToolOutcomeMessage(text) {
  const lowerText = String(text || '').toLowerCase();
  if (!lowerText) {
    return false;
  }

  // Still asking the user to tap Confirm, or still promising to do it — not finished.
  if (/\b(tap confirm|confirm action|confirm in the app)\b/.test(lowerText)) {
    return false;
  }
  if (/\b(i'll|i will|let me|going to|right away|about to)\b/.test(lowerText)) {
    return false;
  }

  if (
    /\b(updated|logged|saved|recorded|set to|target updated|opening|completed|has been notified)\b/.test(
      lowerText,
    )
  ) {
    return true;
  }
  if (/\bdaily target updated\b/.test(lowerText)) {
    return true;
  }
  if (/\bopen nutrition to see\b/.test(lowerText)) {
    return true;
  }
  return false;
}

/**
 * True when the user is asking to write a meal, not a dashboard number or a delete.
 * @param {string} text
 * @returns {boolean}
 */
function userMessageLooksLikeMealLog(text) {
  const lowerText = String(text || '').toLowerCase();
  if (!lowerText.trim()) {
    return false;
  }

  // "log" has to be explicit. A question about food is not a food log.
  if (!userExplicitlyRequestsAction(text)) {
    return false;
  }
  if (userWantsDeleteLog(lowerText)) {
    return false;
  }
  if (/\b(dashboard|for me|able to|something for|on there|on my)\b/.test(lowerText)) {
    return false;
  }
  if (/\b(sleep|slept|energy|water|steps)\b/.test(lowerText)) {
    return false;
  }

  const soundsLikeMacroTargetChange =
    /\b(calor|macro|protein|carb)\b/.test(lowerText) &&
    /\b(change|set|update|target|goal)\b/.test(lowerText);
  if (soundsLikeMacroTargetChange) {
    return false;
  }

  const saysAteOrLogMeal =
    /\b(just ate|ate|eaten|had for|log this meal|log my meal|log a meal|log my food|log food|log that)\b/.test(
      lowerText,
    );
  if (saysAteOrLogMeal) {
    return true;
  }

  const hasMealWord = /\b(breakfast|lunch|dinner|snack)\b/.test(lowerText);
  const hasAteHadLog = /\b(ate|had|log)\b/.test(lowerText);
  if (hasMealWord && hasAteHadLog) {
    return true;
  }

  const hasFoodWord =
    /\b(chicken|rice|eggs|steak|salmon|pizza|burger|oatmeal|yogurt|banana|toast|protein shake)\b/.test(
      lowerText,
    );
  const hasPortionOrAte = /\b(ate|had|log\b|\d\s*oz|cup|grams?|cal)\b/.test(lowerText);
  if (hasFoodWord && hasPortionOrAte) {
    return true;
  }

  return false;
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
  if (isChickenAndRice) {
    foodName = 'Chicken and rice';
  }

  return {
    foodName,
    food: foodName,
    calories: pickMacroFromRegexOrChickenDefault(
      calorieMatch,
      isChickenAndRice,
      CHICKEN_AND_RICE_CALORIES,
    ),
    protein: pickMacroFromRegexOrChickenDefault(
      proteinMatch,
      isChickenAndRice,
      CHICKEN_AND_RICE_PROTEIN,
    ),
    carbs: pickMacroFromRegexOrChickenDefault(
      carbMatch,
      isChickenAndRice,
      CHICKEN_AND_RICE_CARBS,
    ),
    fat: pickMacroFromRegexOrChickenDefault(fatMatch, isChickenAndRice, CHICKEN_AND_RICE_FAT),
    mealType: pickMealTypeFromLowerSentence(lowerText),
  };
}

function pickMacroFromRegexOrChickenDefault(numberMatch, isChickenAndRice, chickenFallback) {
  if (numberMatch) {
    return Number(numberMatch[1]);
  }
  if (isChickenAndRice) {
    return chickenFallback;
  }
  return undefined;
}

function numberFromMatchOrUndefined(numberMatch) {
  if (!numberMatch) {
    return undefined;
  }
  return Number(numberMatch[1]);
}

function pickMealTypeFromLowerSentence(lowerText) {
  if (/breakfast/.test(lowerText)) {
    return 'breakfast';
  }
  if (/dinner/.test(lowerText)) {
    return 'dinner';
  }
  if (/snack/.test(lowerText)) {
    return 'snack';
  }
  return 'lunch';
}

function coachReplyMentionsConfirmButton(replyText) {
  return /\b(tap confirm|confirm in the app|confirm action)\b/i.test(replyText);
}

/**
 * First capture group from a regex match, or empty string when missing.
 * Avoids optional-chain in guessers so the recipe stays plain.
 * @param {RegExpMatchArray|null} match
 * @returns {string}
 */
function firstCaptureGroup(match) {
  if (!match || match[1] == null) {
    return '';
  }
  return String(match[1]);
}

/**
 * Coach said "tap confirm" — the numbers live on the user's message, not the reply.
 * Returns null when this is not a confirm prompt, so the next guess can run.
 * @param {string} replyText
 * @param {string} userText
 * @returns {object|null}
 */
function guessToolFromConfirmPrompt(replyText, userText) {
  if (!userText) {
    return null;
  }
  if (!coachReplyMentionsConfirmButton(replyText)) {
    return null;
  }

  // Numbers often live in the coach sentence ("Logging 10 hours…") when the user
  // only said "help me log my sleep" — search reply first, then the user text.
  const combined = `${replyText}\n${userText}`;

  const stepsMatch = combined.match(/(\d[\d,]*)\s*steps?/i);
  if (stepsMatch && userWantsExplicitDashboardLog(userText, 'steps')) {
    const stepCount = Number(firstCaptureGroup(stepsMatch).replace(/,/g, ''));
    return normalizeToolCall({
      name: LOG_STEPS_TOOL,
      params: { step_count: stepCount },
      reasoning: 'Log steps on your dashboard.',
    });
  }

  // Manipulate here: sleep hour patterns — must catch "Logging 10 hours for last night"
  const sleepMatch =
    combined.match(/log(?:ging|ged)?\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i) ||
    combined.match(
      /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)(?:\s+(?:of\s+)?sleep|\s+for\s+(?:last\s+night|tonight))?/i,
    );
  if (sleepMatch && userWantsExplicitDashboardLog(userText, 'sleep')) {
    return normalizeToolCall({
      name: LOG_SLEEP_TOOL,
      params: { hours: Number(firstCaptureGroup(sleepMatch)) },
      reasoning: 'Log sleep on your dashboard.',
    });
  }

  // Confirm promised, sleep intent, no number → still show the chip so they can fill hours.
  if (userWantsExplicitDashboardLog(userText, 'sleep')) {
    return normalizeToolCall({
      name: LOG_SLEEP_TOOL,
      params: {},
      reasoning: 'Log sleep on your dashboard.',
    });
  }

  // Coach often writes "Logging 90oz for today" without the word "water".
  // Follow-up user turns are often just "90oz" — still offer Confirm.
  const waterMatch =
    combined.match(/(\d+)\s*(?:oz|ounces?)\s*(?:of\s*)?water/i) ||
    combined.match(/(\d+)\s*(?:oz|ounces?)\b/i);
  if (waterMatch) {
    return normalizeToolCall({
      name: LOG_WATER_TOOL,
      params: { amount_oz: Number(firstCaptureGroup(waterMatch)) },
      reasoning: 'Log water intake.',
    });
  }

  const stepsOnlyMatch = combined.match(/(\d[\d,]*)\s*steps?\b/i);
  if (stepsOnlyMatch) {
    const stepCount = Number(firstCaptureGroup(stepsOnlyMatch).replace(/,/g, ''));
    return normalizeToolCall({
      name: LOG_STEPS_TOOL,
      params: { step_count: stepCount },
      reasoning: 'Log steps on your dashboard.',
    });
  }

  return null;
}

/**
 * @param {string} userText
 * @returns {object|null}
 */
function inferFoodLogTool(userText) {
  if (!userText || !userMessageLooksLikeMealLog(userText)) {
    return null;
  }
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
      userText,
    ) || /\b(set|change|adjust|update)\s+my\b/i.test(userText);

  const calorieMatch = replyText.match(/(\d{3,4})\s*(?:calor|kcal)/i);
  const proteinMatch = replyText.match(/(\d+)\s*g?\s*protein/i);
  const carbMatch = replyText.match(/(\d+)\s*g?\s*carb/i);
  const fatMatch = replyText.match(/(\d+)\s*g?\s*fat/i);
  const hasMacroSignal =
    Boolean(calorieMatch) || Boolean(proteinMatch) || /\badjust.*macro/i.test(combinedLower);

  if (!doesUserWantMacroChange) {
    return null;
  }
  if (!hasMacroSignal) {
    return null;
  }

  return normalizeToolCall({
    name: ADJUST_MACROS_TOOL,
    params: {
      calories: numberFromMatchOrUndefined(calorieMatch),
      protein: numberFromMatchOrUndefined(proteinMatch),
      carbs: numberFromMatchOrUndefined(carbMatch),
      fat: numberFromMatchOrUndefined(fatMatch),
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
  if (!userText) {
    return null;
  }
  if (!userWantsExplicitDashboardLog(userText, 'sleep')) {
    return null;
  }

  // "log my sleep" must match (old `\blog\s*sleep` missed the "my").
  // "logging 10 hours for last night" must match (coach prose, no "of sleep").
  const sleepMatch =
    combinedLower.match(/log(?:ging|ged)?\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i) ||
    combinedLower.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:of\s*)?sleep/i) ||
    combinedLower.match(
      /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:for\s+)?(?:last\s+night|tonight|today|yesterday)/i,
    ) ||
    combinedLower.match(/(?:log|add)\s+(?:in\s+)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i);

  const askedToLogSleep =
    /\blog\s+(?:my\s+)?sleep\b/i.test(combinedLower) || /\blog\s*sleep\b/i.test(combinedLower);

  if (!(sleepMatch || askedToLogSleep)) {
    return null;
  }

  const hoursText = firstCaptureGroup(sleepMatch) || String(DEFAULT_SLEEP_HOURS);
  return normalizeToolCall({
    name: LOG_SLEEP_TOOL,
    // Prefer a parsed number; fall back to DEFAULT only when they clearly asked to log sleep.
    params: { hours: Number(hoursText) },
    reasoning: 'Log sleep on your dashboard.',
  });
}

/**
 * @param {string} userText
 * @param {string} combinedLower
 * @returns {object|null}
 */
function inferStepsLog(userText, combinedLower) {
  if (!userText) {
    return null;
  }
  if (!userWantsExplicitDashboardLog(userText, 'steps')) {
    return null;
  }

  const stepsMatch = combinedLower.match(/(\d[\d,]*)\s*steps/i);
  const askedToLogSteps = /\blog\s*steps/i.test(combinedLower);
  if (!(stepsMatch || askedToLogSteps)) {
    return null;
  }

  const stepsText = firstCaptureGroup(stepsMatch) || STEP_COUNT_FALLBACK;
  return normalizeToolCall({
    name: LOG_STEPS_TOOL,
    params: { step_count: Number(String(stepsText).replace(/,/g, '')) },
    reasoning: 'Log steps on your dashboard.',
  });
}

/**
 * @param {string} userText
 * @param {string} combinedLower
 * @returns {object|null}
 */
function inferWaterLog(userText, combinedLower) {
  if (!userText) {
    return null;
  }

  // Allow amount-only follow-ups ("90oz") after a prior "log my water" turn —
  // userWantsExplicitDashboardLog alone rejects those because there is no log verb.
  const isAmountFollowUp = metricFollowUpFromUserText(userText) === 'water';
  const wantsWaterLog = userWantsExplicitDashboardLog(userText, 'water') || isAmountFollowUp;
  if (!wantsWaterLog) {
    return null;
  }

  const waterMatch =
    combinedLower.match(/(\d+)\s*(?:oz|ounces?)\s*(?:of\s*)?water/i) ||
    combinedLower.match(/(\d+)\s*(?:oz|ounces?)\b/i);

  if (!(waterMatch || /\blog\s*water/i.test(combinedLower))) {
    return null;
  }

  // "log water" with no ounces: no number to confirm, so offer nothing here.
  // (The old code read waterMatch[1] anyway and threw a TypeError, which
  // killed the whole guess pipeline for that reply.)
  if (!waterMatch) {
    return null;
  }

  return normalizeToolCall({
    name: LOG_WATER_TOOL,
    params: { amount_oz: Number(firstCaptureGroup(waterMatch)) },
    reasoning: 'Log water intake.',
  });
}

/**
 * @param {string} userText
 * @param {string} combinedLower
 * @returns {object|null}
 */
function inferEnergyRating(userText, combinedLower) {
  if (!userText) {
    return null;
  }
  if (!userWantsExplicitDashboardLog(userText, 'energy')) {
    return null;
  }

  const energyMatch =
    combinedLower.match(/(?:energy|log\s*(?:my\s*)?energy)[^\d]{0,24}(\d+)\s*(?:\/\s*10|out of 10)?/i) ||
    combinedLower.match(/(\d+)\s*(?:\/\s*10|out of 10)\s*(?:energy|energy level)/i) ||
    combinedLower.match(/(?:rate|log)\s*(?:my\s*)?energy\s*(?:as|at|to)?\s*(\d+)/i);

  const askedToLogEnergy = /\blog\s*(?:my\s*)?energy/i.test(combinedLower);
  if (!(energyMatch || askedToLogEnergy)) {
    return null;
  }

  const rating = Number(firstCaptureGroup(energyMatch));
  if (!Number.isFinite(rating) || rating < ENERGY_RATING_MIN || rating > ENERGY_RATING_MAX) {
    return null;
  }

  return normalizeToolCall({
    name: RATE_ENERGY_TOOL,
    params: { rating },
    reasoning: 'Log your energy level on the dashboard.',
  });
}

/**
 * Mood was missing from this client pipeline entirely (server-only before):
 * when the model forgot its JSON and the server inferrer missed a phrasing,
 * the phone could never recover — the coach said "Tap Confirm" and no chip
 * existed. Any explicit log verb + a mood word ("Log that I'm happy",
 * "log my mood: happy") is enough; findMoodInText normalizes the spelling.
 * @param {string} userText
 * @returns {object|null}
 */
function inferMoodLog(userText) {
  if (!userText) {
    return null;
  }
  if (!/\b(log|track|record|add|save|enter|put|mark|rate)\b/i.test(userText)) {
    return null;
  }

  const mood = findMoodInText(userText);
  if (!mood) {
    return null;
  }

  return normalizeToolCall({
    name: LOG_MOOD_TOOL,
    params: { mood },
    reasoning: 'Log your mood on the dashboard.',
  });
}

/**
 * Workout rating had the same hole as mood: server-only, no client fallback.
 * @param {string} userText
 * @param {string} combinedLower
 * @returns {object|null}
 */
function inferWorkoutRating(userText, combinedLower) {
  if (!userText) {
    return null;
  }
  if (!userWantsExplicitDashboardLog(userText, 'workout')) {
    return null;
  }

  const ratingMatch =
    combinedLower.match(
      /(?:workout|session)\s*(?:was|is|rate[sd]?|as)?\s*(\d+)\s*(?:\/\s*10|out of 10)?/i,
    ) ||
    combinedLower.match(
      /(?:rate|log)\s*(?:my\s*|today'?s\s*)?(?:workout|session)\s*(?:as|at|to)?\s*(\d+)/i,
    );

  const rating = Number(firstCaptureGroup(ratingMatch));
  if (!Number.isFinite(rating) || rating < ENERGY_RATING_MIN || rating > ENERGY_RATING_MAX) {
    return null;
  }

  return normalizeToolCall({
    name: RATE_WORKOUT_TOOL,
    params: { rating },
    reasoning: 'Log your workout rating on the dashboard.',
  });
}

/**
 * Only the user's words count. A web answer that mentions "workout plan" must not open the plan.
 * @param {string} userText
 * @returns {object|null}
 */
function openCurrentWorkoutPlanToolCall() {
  return normalizeToolCall({
    name: OPEN_WORKOUT_PLAN_TOOL,
    params: { planId: CURRENT_PLAN_ID },
    reasoning: "Open your workout plan and show today's session.",
  });
}

function inferOpenWorkoutPlan(userText) {
  if (!userText) {
    return null;
  }

  const userLower = userText.toLowerCase();
  const saysOpenShow =
    /\b(open|show|see|view|pull up)\b/i.test(userLower) &&
    /\b(workout|plan|program)\b/i.test(userLower);
  if (saysOpenShow) {
    return openCurrentWorkoutPlanToolCall();
  }

  const todaysWorkout = /\btoday'?s?\s*(workout|session)\b/i.test(userLower);
  if (todaysWorkout) {
    return openCurrentWorkoutPlanToolCall();
  }

  const whatsOnMyPlan = /\bwhat('?s| is) (on|in) my (workout|plan|program)\b/i.test(userLower);
  if (!whatsOnMyPlan) {
    return null;
  }

  return openCurrentWorkoutPlanToolCall();
}

/**
 * @param {string} userText
 * @param {string} combinedLower
 * @returns {object|null}
 */
function inferRestDayLog(userText, combinedLower) {
  if (!userWantsExplicitDashboardLog(userText, 'restDay')) {
    return null;
  }
  if (!/\b(rest day|log rest|mark.*rest|take a rest)\b/i.test(combinedLower)) {
    return null;
  }

  const dateMatch = combinedLower.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const dateText = firstCaptureGroup(dateMatch) || undefined;

  return normalizeToolCall({
    name: LOG_REST_DAY_TOOL,
    params: { date: dateText },
    reasoning: 'Log a rest day on your dashboard workout card.',
  });
}

/**
 * Delete only when the user asked. Coach prose like "remove from your diet" is not enough.
 * @param {string} userText
 * @param {string} replyText
 * @returns {object|null}
 */
function guessDeleteToolFromUserText(userText, replyText) {
  if (!userWantsDeleteLog(userText)) {
    return null;
  }
  const inferred = inferDeleteLogParams(userText, replyText);
  return normalizeToolCall({
    name: DELETE_LOG_TOOL,
    params: inferred,
    reasoning: deleteLogReasoning(inferred),
  });
}

/**
 * Real JSON in the reply beats every word guess. Delete misroutes get corrected here.
 * @param {string} replyText
 * @param {string} userText
 * @returns {object|null}
 */
function guessToolFromJsonEmbeddedInReply(replyText, userText) {
  const parsedActions = readActionsFromReply(replyText);
  if (!parsedActions.length) {
    return null;
  }
  return coerceMisroutedDeleteTool(parsedActions[0], userText, replyText, normalizeToolCall);
}

/**
 * Ordered guessers after early exits. First non-null wins.
 * @param {string} replyText
 * @param {string} userText
 * @param {string} combinedLower
 * @returns {Array<() => object|null>}
 */
function orderedGuessCallbacksForReply(replyText, userText, combinedLower) {
  return [
    () => guessToolFromConfirmPrompt(replyText, userText),
    () => guessToolFromJsonEmbeddedInReply(replyText, userText),
    () => inferFoodLogTool(userText),
    () => inferMacroTargetChange(replyText, userText, combinedLower),
    () => inferSleepLog(userText, combinedLower),
    () => inferStepsLog(userText, combinedLower),
    () => inferWaterLog(userText, combinedLower),
    () => inferEnergyRating(userText, combinedLower),
    () => inferMoodLog(userText),
    () => inferWorkoutRating(userText, combinedLower),
    () => inferOpenWorkoutPlan(userText),
    () => inferRestDayLog(userText, combinedLower),
    () => guessDeleteToolFromUserText(userText, replyText),
  ];
}

export { isToolOutcomeMessage };
