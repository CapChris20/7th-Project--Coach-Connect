/**
 * Native function-calling schemas for the AI Coach (OpenAI-compatible format).
 *
 * Why this file exists: before Oct 2026 the model had to hide a JSON block in
 * its prose ("end your reply with {\"toolCalls\": [...]}") and three layers of
 * regex tried to dig it back out. When the model forgot — or mangled a field
 * like mood — the app said "Tap Confirm" and either no Confirm chip existed
 * or the chip failed after tapping. Native tool calls make the provider
 * return the action as structured data beside the prose, so there is nothing
 * to scrape. The prose-JSON path stays as a fallback for providers without
 * tool calling (Perplexity) and for old replies.
 *
 * Flow: COACH_FUNCTION_TOOLS goes into the DeepSeek request → the response
 * message.tool_calls comes back → parseNativeToolCalls normalizes it to the
 * { name, params, reasoning } shape the rest of the app already uses →
 * mergeCoachToolCalls still runs every call through the guard, so a native
 * call can never bypass validation (e.g. an invalid mood is dropped).
 */

// Manipulate here: the mood enum mirrors VALID_MOODS in
// src/ai-coach/coach-actions/shouldAskFirst.js — keep the two lists in sync.
const MOOD_ENUM = ['happy', 'okay', 'stressed', 'tired', 'anxious'];
const DELETE_LOG_TYPE_ENUM = ['nutrition', 'sleep', 'water', 'steps', 'energy', 'mood', 'workout', 'restDay'];
const DATE_FIELD = { type: 'string', description: 'Optional date, YYYY-MM-DD. Omit for today.' };
const NOTES_FIELD = { type: 'string', description: 'Optional short note from the user.' };

/**
 * Build one OpenAI-format function tool.
 * @param {string} name Must match a name the guard allows (shouldAskFirst ALLOWED_TOOLS).
 * @param {string} description When the model should call it.
 * @param {object} properties JSON-schema properties for the params.
 * @param {string[]} [required]
 */
function functionTool(name, description, properties, required = []) {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties,
        ...(required.length ? { required } : {}),
        additionalProperties: false,
      },
    },
  };
}

// One entry per coach action. Names/descriptions are what the model reads to
// decide — keep descriptions about user intent, not implementation.
const COACH_FUNCTION_TOOLS = [
  functionTool(
    'logMood',
    'Log the user\'s mood on their dashboard when they explicitly ask to log/track/record it. mood must be exactly one of the enum values — map synonyms yourself (feeling great → "happy", exhausted → "tired").',
    { mood: { type: 'string', enum: MOOD_ENUM }, notes: NOTES_FIELD, date: DATE_FIELD },
    ['mood'],
  ),
  functionTool(
    'logSleep',
    'Log hours of sleep on the dashboard when the user explicitly asks to log sleep.',
    { hours: { type: 'number', description: 'Hours slept, 0.5–24.' }, date: DATE_FIELD },
    ['hours'],
  ),
  functionTool(
    'logWater',
    'Log water intake when the user explicitly asks to log water.',
    { amount_oz: { type: 'number', description: 'Water in US fluid ounces.' }, date: DATE_FIELD },
    ['amount_oz'],
  ),
  functionTool(
    'logSteps',
    'Log a step count when the user explicitly asks to log steps.',
    { step_count: { type: 'integer', description: 'Total steps for the day.' }, date: DATE_FIELD },
    ['step_count'],
  ),
  functionTool(
    'rateEnergy',
    'Log an energy rating (1–10) when the user explicitly asks to log/rate their energy.',
    { rating: { type: 'number', description: 'Energy rating 1–10.' }, notes: NOTES_FIELD, date: DATE_FIELD },
    ['rating'],
  ),
  functionTool(
    'rateWorkout',
    'Log a workout rating (1–10) when the user rates a completed workout. Never use this for rest days — use logRestDay.',
    { rating: { type: 'number', description: 'Workout rating 1–10.' }, notes: NOTES_FIELD, date: DATE_FIELD },
    ['rating'],
  ),
  functionTool(
    'logRestDay',
    'Mark a rest day on the dashboard workout card when the user asks to log/mark a rest day or skip today\'s workout.',
    { date: DATE_FIELD },
  ),
  functionTool(
    'logNutrition',
    'Log a food/meal to the nutrition diary when the user asks to log something they ate. Include calories/macros when known.',
    {
      foodName: { type: 'string', description: 'Food or meal name.' },
      calories: { type: 'number' },
      protein: { type: 'number', description: 'Protein grams.' },
      carbs: { type: 'number', description: 'Carb grams.' },
      fat: { type: 'number', description: 'Fat grams.' },
      mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
      date: DATE_FIELD,
    },
    ['foodName'],
  ),
  functionTool(
    'adjustMacroTargets',
    'Change daily calorie/macro targets when the user asks to set/change/adjust them. Include every target value you state in prose.',
    {
      calories: { type: 'number' },
      protein: { type: 'number', description: 'Daily protein grams.' },
      carbs: { type: 'number', description: 'Daily carb grams.' },
      fat: { type: 'number', description: 'Daily fat grams.' },
    },
  ),
  functionTool(
    'deleteLog',
    'Delete a previously logged entry when the user asks to delete/remove/clear/undo it. Match logType to what they named (sleep ≠ nutrition).',
    {
      logType: { type: 'string', enum: DELETE_LOG_TYPE_ENUM },
      foodName: { type: 'string', description: 'For nutrition deletes: the food to remove. Omit to remove the most recent entry.' },
      deleteAll: { type: 'boolean', description: 'True only when they asked to clear all food for the day.' },
      date: DATE_FIELD,
    },
    ['logType'],
  ),
  functionTool(
    'updateWorkout',
    'Swap/replace one exercise in the user\'s workout plan when they ask for a substitution.',
    {
      planId: { type: 'string', description: 'Use "current" for the active plan.' },
      dayIndex: { type: 'integer', description: '0-based day index in the plan.' },
      exerciseIndex: { type: 'integer', description: '0-based exercise index within the day.' },
      newExercise: { type: 'string', description: 'Replacement exercise name.' },
      reason: { type: 'string' },
    },
    ['newExercise'],
  ),
  functionTool(
    'openWorkoutPlan',
    'Open/show the user\'s workout plan when they ask to see it or ask what today\'s session is.',
    { planId: { type: 'string', description: 'Use "current" for the active plan.' } },
  ),
  functionTool(
    'bookSession',
    'Request a training session with their trainer when they ask to book/schedule one. Include the date and time they named.',
    {
      sessionDate: { type: 'string', description: 'Session date, YYYY-MM-DD.' },
      sessionTime: { type: 'string', description: 'Session time, HH:mm 24-hour.' },
      dateTime: { type: 'string', description: 'Use instead of sessionDate/sessionTime when the user gave one combined phrase (e.g. "next Tuesday at 10am").' },
      durationMin: { type: 'number', description: 'Session length in minutes. Default 60.' },
      notes: NOTES_FIELD,
    },
  ),
  functionTool(
    'updateGoal',
    'Change the user\'s primary goal (e.g. lose fat, build muscle, recomp) when they ask to change/update it.',
    { newGoal: { type: 'string', description: 'The new goal in plain words.' } },
    ['newGoal'],
  ),
  functionTool(
    'notifyTrainer',
    'Send a message/alert to their trainer when they ask to tell/notify/message their trainer or coach.',
    {
      message: { type: 'string', description: 'What to tell the trainer, in the user\'s words.' },
      issueType: { type: 'string', description: 'Short category, e.g. injury, check_in.' },
      severity: { type: 'string', enum: ['low', 'medium', 'high'] },
    },
    ['message'],
  ),
];

/**
 * Normalize a provider message's native tool_calls into coach tool calls.
 * DeepSeek/OpenAI shape: message.tool_calls = [{ function: { name, arguments: "<json string>" } }]
 * Bad JSON in arguments drops that one call — the prose fallback can still win.
 * @param {object} message The provider response message object.
 * @returns {Array<{name: string, params: object, reasoning: string}>}
 */
function parseNativeToolCalls(message) {
  const rawCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
  const calls = [];
  for (const raw of rawCalls) {
    const name = String(raw?.function?.name || raw?.name || '').trim();
    if (!name) continue;
    let params = raw?.function?.arguments ?? raw?.arguments ?? {};
    if (typeof params === 'string') {
      try {
        params = JSON.parse(params);
      } catch (_) {
        continue; // unparseable arguments — never guess at a mutation
      }
    }
    if (!params || typeof params !== 'object' || Array.isArray(params)) params = {};
    calls.push({ name, params, reasoning: '' });
  }
  return calls;
}

module.exports = { COACH_FUNCTION_TOOLS, parseNativeToolCalls };
