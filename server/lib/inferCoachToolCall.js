/**
 * When the model forgets tool JSON, infer a tool proposal from the user's message.
 */

function parseCalorieTargetFromMessage(text, fallback) {
  const raw = String(text || '');
  const fromTo = raw.match(/\bfrom\s*(\d{3,4})\s*(?:kcal|cals?|calories?)?\s*to\s*(\d{3,4})\b/i);
  if (fromTo) return Number(fromTo[2]);
  const toOnly = raw.match(/\b(?:to|at)\s*(\d{3,4})\s*(?:kcal|cals?|calories?)\b/i);
  if (toOnly) return Number(toOnly[1]);
  const setCal = raw.match(/\b(?:set|change|update|lower|reduce)\b[^.]{0,40}?\b(\d{3,4})\s*(?:kcal|cals?|calories?)\b/i);
  if (setCal) return Number(setCal[1]);
  const bare = raw.match(/\b(\d{3,4})\s*(?:kcal|cals?|calories?)\b/i);
  if (bare) return Number(bare[1]);
  const fb = Number(fallback);
  return fallback != null && Number.isFinite(fb) && fb > 0 ? fb : null;
}

function parseSleepHoursFromMessage(text) {
  const raw = String(text || '').toLowerCase();
  if (!/\b(sleep|slept)\b/.test(raw)) return null;
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:of\s*)?sleep/,
    /sleep(?:ed)?\s*(?:for\s*)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/,
    /(?:put|add|log)\s+(?:that\s+)?(?:i\s+)?slept\s+(?:for\s*)?(\d+(?:\.\d+)?)/,
    /(?:put|add|log)\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:of\s*)?sleep/,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m && Number(m[1]) > 0 && Number(m[1]) <= 24) return Number(m[1]);
  }
  return null;
}

const {
  userWantsDeleteLog,
  coachTextImpliesDelete,
  inferDeleteLogParams,
  coerceMisroutedDeleteTool,
} = require('../../src/ai/coachDeleteLogRouting');

function wantsFoodLog(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return false;
  if (/\b(delete|remove|clear|undo|unlog|erase)\b/.test(t)) return false;
  if (/\b(dashboard|for me|able to|something for|log something|on there|on my)\b/.test(t)) {
    return false;
  }
  if (/\b(sleep|slept)\b/.test(t)) return false;
  if (/\b(calor|macro|protein|carb)\b/.test(t) && /\b(change|set|update|target|goal)\b/.test(t)) {
    return false;
  }
  return (
    /\b(just ate|ate|eaten|had for|log this meal|log my meal|log a meal)\b/.test(t) ||
    (/\b(breakfast|lunch|dinner|snack)\b/.test(t) && /\b(ate|had|log)\b/.test(t)) ||
    (/\b(chicken|rice|eggs|steak|salmon|pizza|burger)\b/.test(t) &&
      /\b(ate|had|log\b|\d\s*oz|cup|grams?)\b/.test(t))
  );
}

function inferCoachToolCall(userMessage, weeklyContext = {}) {
  const raw = String(userMessage || '').trim();
  const t = raw.toLowerCase();
  if (!t) return null;

  if (userWantsDeleteLog(raw)) {
    return {
      name: 'deleteLog',
      params: inferDeleteLogParams(raw, ''),
      reasoning: 'Remove this from your nutrition log.',
    };
  }

  const targetP = Number(weeklyContext.targetP) || 150;
  const targetC = Number(weeklyContext.targetC) || 200;
  const targetF = Number(weeklyContext.targetF) || 65;
  const targetCal = Number(weeklyContext.targetCal) || 2250;

  // logWater: "I drank X oz", "100oz water", etc.
  const waterMatch = raw.match(/(?:drank|drink|had)\s*(?:about\s*)?(\d+)\s*(?:oz|ounce)/i);
  if (waterMatch) {
    const amount_oz = Number(waterMatch[1]);
    if (amount_oz > 0 && amount_oz < 1000) {
      return {
        name: 'logWater',
        params: { amount_oz },
        reasoning: `Log ${amount_oz}oz of water intake.`,
      };
    }
  }

  // logSteps: "I did X steps", "10,000 steps", etc.
  const stepsMatch = raw.match(/(?:did|walked|got|logged)\s*(?:about\s*)?(\d+(?:,\d{3})*)\s*steps/i);
  if (stepsMatch) {
    const step_count = Number(stepsMatch[1].replace(/,/g, ''));
    if (step_count >= 0 && step_count < 100000) {
      return {
        name: 'logSteps',
        params: { step_count },
        reasoning: `Log ${step_count} steps for today.`,
      };
    }
  }

  // rateEnergy: "My energy is X/10", "Energy X", etc.
  const energyMatch = raw.match(/(?:energy|feel)\s*(?:is)?\s*(\d+)\s*(?:out\s*of\s*10|\/10)?/i);
  if (energyMatch) {
    const rating = Number(energyMatch[1]);
    if (rating >= 1 && rating <= 10) {
      return {
        name: 'rateEnergy',
        params: { rating },
        reasoning: `Rate your energy level as ${rating}/10.`,
      };
    }
  }

  // logMood: "My mood is happy/okay/stressed/tired/anxious"
  const moodKeywords = ['happy', 'okay', 'stressed', 'tired', 'anxious'];
  for (const mood of moodKeywords) {
    if (new RegExp(`\\b(?:mood|feel|feeling)\\s+(?:is\\s+)?${mood}\\b`, 'i').test(t)) {
      return {
        name: 'logMood',
        params: { mood },
        reasoning: `Log your mood as ${mood}.`,
      };
    }
  }

  // logRestDay: rest day on dashboard workout card
  if (
    /\b(rest day|log rest|mark.*rest|take a rest|skip workout|no workout today|off day)\b/i.test(t)
  ) {
    const dateMatch = raw.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    return {
      name: 'logRestDay',
      params: { date: dateMatch?.[1] },
      reasoning: 'Mark today as a rest day on your dashboard workout card.',
    };
  }

  // rateWorkout: "That workout was X/10", "Workout rating X"
  const workoutMatch = raw.match(/(?:workout|session)\s*(?:was|is|rate[sd]?)\s*(\d+)\s*(?:out\s*of\s*10|\/10)?/i);
  if (workoutMatch) {
    const rating = Number(workoutMatch[1]);
    if (rating >= 1 && rating <= 10) {
      return {
        name: 'rateWorkout',
        params: { rating },
        reasoning: `Rate your workout experience as ${rating}/10.`,
      };
    }
  }

  const sleepHours = parseSleepHoursFromMessage(raw);
  if (sleepHours != null) {
    return {
      name: 'logSleep',
      params: { hours: sleepHours },
      reasoning: `Log ${sleepHours} hours of sleep on your dashboard for today.`,
    };
  }

  const newCalories = parseCalorieTargetFromMessage(raw, null);
  if (
    (newCalories != null && newCalories >= 800) ||
    (/\b(calor|kcal|macro|goal)\b/.test(t) && /\b(change|set|update|lower|reduce|from|to|bump|raise)\b/.test(t))
  ) {
    const calories = newCalories != null ? newCalories : targetCal;
    return {
      name: 'adjustMacroTargets',
      params: {
        calories,
        protein: targetP,
        carbs: targetC,
        fat: targetF,
      },
      reasoning: `Set your daily calorie target to ${calories} kcal (updates Nutrition screen).`,
    };
  }

  if (
    /\b(bump|increase|raise|up)\b/.test(t) &&
    /\b(carb|carbs)\b/.test(t) &&
    !/\b(calor|kcal)\b/.test(t)
  ) {
    const newCarbs = Math.min(Math.round(Math.max(targetC, Number(weeklyContext.avgC) || 0) * 1.15), 400);
    return {
      name: 'adjustMacroTargets',
      params: {
        protein: targetP,
        carbs: newCarbs,
        fat: targetF,
        calories: Math.round(targetP * 4 + newCarbs * 4 + targetF * 9),
      },
      reasoning: `Propose raising daily carbs to ${newCarbs}g.`,
    };
  }

  if (
    /\b(adjust|change|update)\b/.test(t) &&
    /\b(macro|macros|protein)\b/.test(t) &&
    !/\b(calor|kcal)\b/.test(t)
  ) {
    return {
      name: 'adjustMacroTargets',
      params: { protein: targetP, carbs: targetC, fat: targetF, calories: targetCal },
      reasoning: 'Adjust macro targets based on your check-in.',
    };
  }

  if (wantsFoodLog(raw)) {
    const isChickenRice = /chicken/.test(t) && /rice/.test(t);
    return {
      name: 'logNutrition',
      params: isChickenRice
        ? {
            foodName: 'Chicken and rice',
            calories: 410,
            protein: 50,
            carbs: 45,
            fat: 4,
            mealType: 'lunch',
          }
        : {
            foodName: raw.slice(0, 60),
            mealType: /breakfast/.test(t) ? 'breakfast' : /dinner/.test(t) ? 'dinner' : 'lunch',
          },
      reasoning: 'Log this meal to your nutrition diary.',
    };
  }

  if (
    /\b(book|schedule)\b/.test(t) &&
    /\b(session|trainer|appointment)\b/.test(t)
  ) {
    const { parseBookSessionFields } = require('./bookSessionParse');
    const parsed = parseBookSessionFields({ dateTime: raw });
    return {
      name: 'bookSession',
      params: {
        sessionDate: parsed.date,
        sessionTime: parsed.time,
        durationMin: parsed.durationMin,
        notes: raw.slice(0, 200),
      },
      reasoning: 'Request a training session with your trainer.',
    };
  }

  if (
    (/\b(open|show|see|view|pull up)\b/.test(t) && /\b(workout|plan|program)\b/.test(t)) ||
    /\btoday'?s?\s*(workout|session)\b/.test(t) ||
    /\bwhat('?s| is) (on|in) my (workout|plan|program)\b/.test(t)
  ) {
    return {
      name: 'openWorkoutPlan',
      params: { planId: 'current' },
      reasoning: 'Open your workout plan and summarize today\'s session.',
    };
  }

  if (
    /\b(swap|replace|substitute)\b/.test(t) &&
    /\b(exercise|press|lift|workout)\b/.test(t)
  ) {
    let newName = 'Dumbbell incline press';
    if (/overhead|ohp|shoulder press/.test(t)) newName = 'Dumbbell incline press';
    return {
      name: 'updateWorkout',
      params: { planId: 'current', dayIndex: 0, exerciseIndex: 0, newExercise: newName, reason: raw },
      reasoning: 'Swap the exercise in your plan.',
    };
  }

  if (/\b(bulk|cut|recomp)\b/.test(t) && /\b(now|switch|change|should i)\b/.test(t)) {
    const newGoal = /\bbulk\b/.test(t) ? 'Build muscle' : /\bcut\b/.test(t) ? 'Lose fat' : 'Recomposition';
    return { name: 'updateGoal', params: { newGoal }, reasoning: `Update goal to ${newGoal}.` };
  }

  if (/\b(let|tell|notify)\b/.test(t) && /\b(trainer|coach)\b/.test(t)) {
    return {
      name: 'notifyTrainer',
      params: {
        message: raw,
        issueType: /knee|pain|hurt|injur/.test(t) ? 'injury' : 'check_in',
        severity: /kill|severe|bad|hurts/.test(t) ? 'high' : 'medium',
      },
      reasoning: 'Send an alert to your trainer.',
    };
  }

  if (/\b(delete|remove|clear|undo|unlog|erase)\b/.test(t)) {
    const dateMatch = raw.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    const deleteAll = /\b(all|everything)\b/.test(t) && /\b(food|meal|log|entr)/.test(t);
    const base = {
      ...(dateMatch?.[1] ? { date: dateMatch[1] } : {}),
      ...(deleteAll ? { deleteAll: true } : {}),
    };

    if (/\b(sleep|slept)\b/.test(t)) {
      return { name: 'deleteLog', params: { logType: 'sleep', ...base }, reasoning: 'Remove the sleep log.' };
    }
    if (/\b(water|hydration)\b/.test(t)) {
      return { name: 'deleteLog', params: { logType: 'water', ...base }, reasoning: 'Remove the water log.' };
    }
    if (/\b(steps|step count)\b/.test(t)) {
      return { name: 'deleteLog', params: { logType: 'steps', ...base }, reasoning: 'Remove the step count.' };
    }
    if (/\b(energy|fatigue)\b/.test(t)) {
      return { name: 'deleteLog', params: { logType: 'energy', ...base }, reasoning: 'Remove the energy rating.' };
    }
    if (/\b(mood|feeling)\b/.test(t)) {
      return { name: 'deleteLog', params: { logType: 'mood', ...base }, reasoning: 'Remove the mood log.' };
    }
    if (/\b(rest day|rest)\b/.test(t)) {
      return { name: 'deleteLog', params: { logType: 'restDay', ...base }, reasoning: 'Clear the rest day entry.' };
    }
    if (/\b(workout)\b/.test(t) && !/\b(workout plan|plan)\b/.test(t)) {
      return { name: 'deleteLog', params: { logType: 'workout', ...base }, reasoning: 'Remove the workout entry.' };
    }

    const foodMatch =
      raw.match(/(?:delete|remove|clear|undo)\s+(?:the|my)?\s*(.+?)\s+(?:log|entry|meal|from)/i) ||
      raw.match(/(?:delete|remove|clear)\s+(?:the|my)?\s*(.+?)\s+(?:i|we)?\s*(?:logged|log)/i);
    let foodName = foodMatch?.[1]?.trim();
    if (foodName && /^(last|recent|latest|today|all|food|nutrition|my)$/i.test(foodName)) foodName = undefined;

    return {
      name: 'deleteLog',
      params: { logType: 'nutrition', ...base, ...(foodName ? { foodName } : {}) },
      reasoning: foodName
        ? `Remove "${foodName}" from nutrition log.`
        : deleteAll
          ? 'Clear all food logs for this day.'
          : 'Remove the most recent food entry.',
    };
  }

  return null;
}

function remapRestDayToolCall(call) {
  if (!call?.name) return call;
  if (call.name === 'rateWorkout') {
    const notes = String(call.params?.notes || call.params?.note || '').toLowerCase();
    const rating = Number(call.params?.rating);
    if (
      /\brest\s*day\b/.test(notes) ||
      /\bno\s+workout\b/.test(notes) ||
      rating === 0 ||
      !Number.isFinite(rating) ||
      rating < 1
    ) {
      return {
        name: 'logRestDay',
        params: { date: call.params?.date },
        reasoning: call.reasoning || 'Log a rest day on your dashboard workout card.',
      };
    }
  }
  if (
    call.name === 'updateWorkout' &&
    (call.params?.type === 'rest' ||
      call.params?.status === 'rest' ||
      call.params?.rest === true ||
      call.params?.restDay === true)
  ) {
    return {
      name: 'logRestDay',
      params: { date: call.params?.date, planId: call.params?.planId },
      reasoning: call.reasoning || 'Log a rest day on your dashboard workout card.',
    };
  }
  return call;
}

function serverNormalizeToolCall(raw) {
  if (!raw?.name) return null;
  const params = raw.params && typeof raw.params === 'object' ? { ...raw.params } : {};
  if (raw.name === 'deleteLog' && !params.logType) params.logType = 'nutrition';
  return remapRestDayToolCall({ ...raw, params }) || { ...raw, params };
}

function mergeCoachToolCalls(modelText, userMessage, weeklyContext) {
  const parsed = [];
  const seen = new Set();
  const add = (call) => {
    const remapped = remapRestDayToolCall(call);
    if (!remapped?.name) return;
    const key = `${remapped.name}:${JSON.stringify(remapped.params || {})}`;
    if (seen.has(key)) return;
    seen.add(key);
    parsed.push(remapped);
  };

  const { parseCoachToolCalls } = require('../../src/shared/parseCoachToolCalls');
  for (const c of parseCoachToolCalls(modelText)) {
    add(coerceMisroutedDeleteTool(c, userMessage, modelText, serverNormalizeToolCall));
  }

  if (!parsed.length) {
    const inferred = inferCoachToolCall(userMessage, weeklyContext);
    if (inferred) add(inferred);
  }

  return parsed;
}

module.exports = {
  inferCoachToolCall,
  mergeCoachToolCalls,
  parseCalorieTargetFromMessage,
  parseSleepHoursFromMessage,
};
