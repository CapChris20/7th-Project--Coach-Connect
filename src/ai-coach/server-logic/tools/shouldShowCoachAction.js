/**
 * coach Tool Proposal Guards
 *
 * Purpose: coach Tool Proposal Guards — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/ai
 * Key exports: guardCoachToolProposal, guardCoachToolProposals, isValidCoachToolProposal, filterValidCoachToolProposals
 *
 * @file-header
 */
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

function sanitizeString(value, maxLen = 300) {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function asFinite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max) {
  const n = asFinite(value);
  if (n == null) return null;
  return Math.min(max, Math.max(min, n));
}

function pickObject(input) {
  return input && typeof input === 'object' && !Array.isArray(input) ? { ...input } : {};
}

function sanitizeParamsByTool(name, rawParams) {
  const p = pickObject(rawParams);

  switch (name) {
    case 'logSleep': {
      const hours = clamp(p.hours ?? p.sleepHours, 0.5, 24);
      return hours == null ? null : { hours, date: sanitizeString(p.date, 32) };
    }
    case 'logWater': {
      const amount_oz = clamp(p.amount_oz ?? p.amountOz ?? p.amount ?? p.ounces, 1, 512);
      return amount_oz == null ? null : { amount_oz, date: sanitizeString(p.date, 32) };
    }
    case 'logSteps': {
      const step_count = clamp(p.step_count ?? p.steps, 0, 100000);
      return step_count == null ? null : { step_count, date: sanitizeString(p.date, 32) };
    }
    case 'rateEnergy': {
      const rating = clamp(p.rating ?? p.energy, 1, 10);
      return rating == null
        ? null
        : { rating, date: sanitizeString(p.date, 32), notes: sanitizeString(p.notes || p.note, 240) };
    }
    case 'rateWorkout': {
      const rating = clamp(p.rating, 1, 10);
      return rating == null
        ? null
        : { rating, date: sanitizeString(p.date, 32), notes: sanitizeString(p.notes || p.note, 240) };
    }
    case 'adjustMacroTargets': {
      const protein = clamp(p.protein ?? p.newProtein, 1, 400);
      const carbs = clamp(p.carbs ?? p.newCarbs, 1, 800);
      const fat = clamp(p.fat ?? p.fats ?? p.newFats, 1, 300);
      const calories = clamp(p.calories ?? p.newCals ?? p.calorieTarget, 800, 6000);
      if (protein == null && carbs == null && fat == null && calories == null) return null;
      return { protein, carbs, fat, calories };
    }
    case 'deleteLog': {
      const logTypeRaw = sanitizeString(p.logType, 24);
      const logType = ALLOWED_LOG_TYPES.has(logTypeRaw) ? logTypeRaw : 'nutrition';
      return {
        logType,
        date: sanitizeString(p.date, 32),
        foodName: sanitizeString(p.foodName || p.food, 100),
        logId: sanitizeString(p.logId, 100),
        deleteAll: !!(p.deleteAll || p.all),
      };
    }
    case 'logNutrition':
      return {
        foodName: sanitizeString(p.foodName || p.food, 100),
        food: sanitizeString(p.food || p.foodName, 100),
        mealType: sanitizeString(p.mealType, 24),
        date: sanitizeString(p.date, 32),
        calories: clamp(p.calories ?? p.cals, 1, 5000),
        protein: clamp(p.protein, 0, 500),
        carbs: clamp(p.carbs, 0, 800),
        fat: clamp(p.fat ?? p.fats, 0, 400),
      };
    case 'openWorkoutPlan':
      return { planId: sanitizeString(p.planId, 80) || 'current' };
    case 'logRestDay':
      return { date: sanitizeString(p.date, 32), planId: sanitizeString(p.planId, 80) };
    case 'logMood':
      return { mood: sanitizeString(p.mood, 24), date: sanitizeString(p.date, 32), notes: sanitizeString(p.notes || p.note, 240) };
    case 'updateGoal':
      return { newGoal: sanitizeString(p.newGoal, 80) };
    case 'notifyTrainer':
      return {
        trainerId: sanitizeString(p.trainerId, 80),
        message: sanitizeString(p.message, 400),
        issueType: sanitizeString(p.issueType, 40),
        severity: sanitizeString(p.severity, 20),
      };
    case 'bookSession':
      return {
        trainerId: sanitizeString(p.trainerId, 80),
        sessionDate: sanitizeString(p.sessionDate || p.date, 32),
        sessionTime: sanitizeString(p.sessionTime || p.time, 24),
        durationMin: clamp(p.durationMin ?? p.durationMinutes ?? p.duration, 15, 240),
        notes: sanitizeString(p.notes, 300),
      };
    case 'updateWorkout':
      return {
        planId: sanitizeString(p.planId, 80),
        dayIndex: clamp(p.dayIndex, 0, 13),
        exerciseIndex: clamp(p.exerciseIndex, 0, 50),
        newExercise: p.newExercise,
        reason: sanitizeString(p.reason, 240),
      };
    default:
      return pickObject(p);
  }
}

function compactObject(input) {
  const out = {};
  for (const [k, v] of Object.entries(input || {})) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

function guardCoachToolProposal(rawCall) {
  if (!rawCall || typeof rawCall !== 'object') return null;
  const rawName = sanitizeString(rawCall.name || rawCall.tool || rawCall.action, 40);
  const name = TOOL_NAME_ALIASES[rawName] || rawName;
  if (!name || !ALLOWED_TOOLS.has(name)) return null;
  const params = sanitizeParamsByTool(name, rawCall.params);
  if (params == null) return null;
  return {
    name,
    params: compactObject(params),
    reasoning: sanitizeString(rawCall.reasoning, 240) || '',
  };
}

function guardCoachToolProposals(rawCalls) {
  const seen = new Set();
  const out = [];
  for (const call of Array.isArray(rawCalls) ? rawCalls : []) {
    const safe = guardCoachToolProposal(call);
    if (!safe) continue;
    const key = `${safe.name}:${JSON.stringify(safe.params)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(safe);
  }
  return out;
}

function userAffirmsPendingCoachAction(text) {
  return /^(do it|yes|yeah|yep|ok|okay|please|go ahead|confirm|yes please|do that|send it)\.?$/i.test(
    String(text || '').trim(),
  );
}

function toolAlignsWithUserMessage(guarded, userText) {
  const t = String(userText || '').toLowerCase();
  const { name } = guarded;
  if (name === 'deleteLog') {
    if (userAffirmsPendingCoachAction(userText)) return true;
    if (!/\b(delete|remove|clear|undo|unlog|erase)\b/.test(t)) {
      // Clarification like "not food, dashboard sleep"
      const logType = String(guarded.params?.logType || 'nutrition').toLowerCase();
      if (logType === 'sleep') return /\b(sleep|slept|sleeping|dashboard)\b/.test(t);
      if (logType !== 'nutrition') return true;
      return false;
    }
    const logType = String(guarded.params?.logType || 'nutrition').toLowerCase();
    if (logType === 'sleep') return /\b(sleep|slept|sleeping)\b/.test(t);
    if (logType === 'water') return /\b(water|hydration)\b/.test(t);
    if (logType === 'steps') return /\b(steps?|step count)\b/.test(t);
    if (logType === 'energy') return /\b(energy|fatigue)\b/.test(t);
    if (logType === 'mood') return /\bmood\b/.test(t);
    if (logType === 'restDay') return /\b(rest day|rest)\b/.test(t);
    if (logType === 'workout') return /\bworkout\b/.test(t) && !/\b(workout plan|plan)\b/.test(t);
    // nutrition deletes must not fire when the user clearly meant a dashboard metric
    if (/\b(sleep|slept|sleeping)\b/.test(t) && !/\b(food|meal|nutrition)\b/.test(t)) return false;
    if (/\b(water|hydration)\b/.test(t) && !/\b(food|meal|nutrition)\b/.test(t)) return false;
    if (/\b(steps?)\b/.test(t) && !/\b(food|meal|nutrition)\b/.test(t)) return false;
    return true;
  }
  const patterns = {
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
  const re = patterns[name];
  if (!re) return true;
  return re.test(t);
}

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

function userExplicitlyRequestsAction(userText) {
  const t = String(userText || '').toLowerCase().trim();
  if (!t) return false;
  if (isInformationalUserMessage(userText)) return false;
  return (
    EXPLICIT_LOG_RE.test(t) ||
    /\b(set|change|update|adjust)\s+my\b/.test(t) ||
    /\blog\s+it\b/.test(t) ||
    (/\b(delete|remove|clear|undo)\b/.test(t) &&
      /\b(log|food|meal|entry|entries|nutrition|sleep|water|steps|energy|mood|workout)\b/.test(t)) ||
    (/\b(book|schedule)\b/.test(t) && /\b(session|trainer|appointment)\b/.test(t)) ||
    (/\b(swap|replace|substitute)\b/.test(t) && /\b(exercise|press|lift|workout|bench)\b/.test(t)) ||
    (/\b(tell|notify|message|text)\b/.test(t) && /\b(trainer|coach)\b/.test(t)) ||
    (/\b(open|show|see|view|pull up)\b/.test(t) && /\b(workout|plan|program)\b/.test(t)) ||
    (/\b(goal|goals)\b/.test(t) && /\b(change|update|set|switch)\b/.test(t)) ||
    (/\b(calor(?:ie)?s?|kcal|cals?|macros?|protein|carb)\b/.test(t) &&
      /\b(change|set|update|adjust|lower|raise|bump)\b/.test(t))
  );
}

function userWantsExplicitDashboardLog(userText, metric) {
  const raw = String(userText || '').trim();
  if (!raw) return false;
  if (!EXPLICIT_LOG_RE.test(raw) && !/\blog\s+it\b/i.test(raw)) return false;
  const pattern = DASHBOARD_METRIC_PATTERNS[metric];
  return pattern ? pattern.test(raw) : false;
}

function isPoliteActionRequest(raw) {
  if (!/^(can|could|would)\s+you\b/i.test(raw)) return false;
  return /\b(adjust|set|change|update|log|track|record|add|delete|remove|open|book|notify|fix|increase|decrease|raise|lower)\b/i.test(
    raw,
  );
}

function isInformationalUserMessage(userText) {
  const raw = String(userText || '').trim();
  if (!raw) return false;
  if (isPoliteActionRequest(raw)) return false;
  // "Can u log 15000 steps" is an action request, not a generic question.
  if (EXPLICIT_LOG_RE.test(raw)) return false;
  if (/\b(delete|remove|clear|undo)\b/.test(raw) && /\b(log|food|sleep|water|steps|energy|mood|workout)\b/.test(raw)) {
    return false;
  }
  if (/\?$/.test(raw)) return true;
  if (/\b(too much|too little|too many|good for me|should i)\b/i.test(raw)) return true;
  if (/\b(on the web|online|on the internet)\b/i.test(raw)) return true;
  if (/\blook up\b/i.test(raw) && /\b(web|online|internet|google)\b/i.test(raw)) return true;
  if (
    /\b(search the web|search online|google it|look it up online|what does the research|what do studies|cite sources|any sources|pull up sources)\b/i.test(
      raw,
    )
  ) {
    return true;
  }
  return /^(what|how|is|are|should|can|could|would|why|when|where|search)\b/i.test(raw);
}

/**
 * Whether a tool proposal should be shown for user confirmation given their message intent.
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

function filterValidCoachToolProposals(rawCalls, userText) {
  if (!Array.isArray(rawCalls)) return [];
  const out = [];
  const seen = new Set();
  for (const call of rawCalls) {
    if (!isValidCoachToolProposal(call, userText)) continue;
    const safe = guardCoachToolProposal(call);
    if (!safe) continue;
    const key = `${safe.name}:${JSON.stringify(safe.params)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(safe);
  }
  return out;
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
