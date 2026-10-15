// Decides whether the AI Coach should load this user's app history into the system prompt.
// Flow: empty text → skip → thread pushback after a false "I can't see logs" → personal phrases → action phrases → otherwise skip.
// Used by: the coach conversation prompt builder. Keep patterns in sync with server/lib/coachPersonalDataRouting.js.

// ===== NAMED CONSTANTS =====

const COACH_ROLE_ASSISTANT = 'assistant';
const COACH_ROLE_AI = 'ai';
const MIN_THREAD_MESSAGES_FOR_PUSHBACK = 2;

// Why we gate this: loading full account context costs Firestore reads and makes the prompt large.
// We only fetch it when the user's message is clearly about *their* data — not for generic
// questions like "how much protein should I eat?"
//
// Data window (documented for the server twin): since account creation (up to 2 years),
// with lifetime averages + last 45 days of meal detail + monthly rollups for older months.
//
// --- Regex cheat sheet (used in every pattern below) ---
// / ... /     → regular expression (pattern matcher for text)
// \b          → "word boundary" — start/end of a word (so "log" won't match "blog")
// (a|b)       → "a OR b" — match either option inside the parentheses
// '?          → the ? before ' makes the apostrophe optional ("arent" vs "aren't")
// .*          → any characters (.* = "anything in between" two phrases)

const PERSONAL_PATTERNS = [
  /\bwhy (am|aren'?t|is|do) i\b/,
  /\bwhy (am|aren'?t) i not\b/,
  /\b(no|low|zero) energy\b/,
  /\bnot (feeling|seeing|making) (good|progress|results|better)\b/,
  /\b(feeling|feel) (bad|awful|like crap|off|weak|tight|worse)\b/,
  /\b(haven'?t|not) (logged|tracking|been logging)\b/,
  /\b(days? )?(without|didn'?t) log\b/,
  /\bmy (log|logs|data|tracking|progress|results)\b/,
  /\bhow am i doing\b/,
  /\breview my (week|progress|logs)\b/,
  /\bthis week\b.*\b(eat|ate|workout|sleep|log|progress|doing)\b/,
  /\b(eat|ate|workout|sleep|log).*\bthis week\b/,
  /\b(on track|off track)\b/,
  /\bplateau\b/,
  /\bnot losing\b/,
  /\bnot gaining\b/,
  /\bstalled\b/,
  /\bam i eating enough\b/,
  /\bam i overeating\b/,
  /\bam i undereating\b/,
  /\bhow'?s my (sleep|recovery|nutrition|diet)\b/,
  /\bbased on my\b/,
  /\blooking at my (log|data|week)\b/,
  /\bfrom my (log|data)\b/,
  /\bwhat did i (eat|log)\b/,
  /\bfood logs?\b/,
  /\bnutrition (log|diary|logs|tracking|data)\b/,
  /\b(can you|can't you|can'?t you|don'?t you) (see|access|read|pull|get)\b.*\b(my )?(log|logs|food|nutrition|data)\b/,
  /\b(do you|you) (have|got) access\b.*\b(log|logs|food|nutrition|data|diary)\b/,
  /\bwhat do you mean\b.*\b(log|logs|food|nutrition|diary|access)\b/,
  /\b(don'?t|do not|can'?t|cannot) (have|see|access)\b.*\b(log|logs|food|nutrition|diary|data)\b/,
  /\bwhat\b.*\b(food|meal|foods|meals)\b.*\b(logged|log)\b/,
  /\bwhat (have|did) i (eat|eaten|log|logged)\b/,
  /\bwhat('?s| is) (in|on) my (food|nutrition|meal) log\b/,
  /\b(show|tell|list|see|view|pull up|look up|check)\b.*\b(food|nutrition|meal) log\b/,
  /\b(food|meal)s?\b.*\blogged\b/,
  /\blogged\b.*\b(today|yesterday|this morning|tonight)\b/,
  /\bhow (much|many cal).*\b(have i|did i)\b.*\b(eat|eaten|log|logged)\b/,
  /\bhow many calories\b.*\b(today|did i|have i)\b/,
  /\blook up\b.*\b(log|data|food|nutrition)\b/,
  /\b(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\b/,
  /\b20\d{2}-\d{2}-\d{2}\b/,
  /\b(delete|remove|clear|undo|unlog)\b.*\b(food|meal|log|nutrition|logged)\b/,
  /\b(delete|remove|clear)\b.*\b(chicken|rice|pizza|protein|breakfast|lunch|dinner|snack|shake|burger|eggs)\b/,
  /\bdid i (eat|log|hit)\b/,
  /\bmy (workout|program|plan|routine|training plan)\b/,
  /\bwhat('?s| is) my (workout|program|plan)\b/,
  /\b(today'?s?|this week'?s?) workout\b/,
  /\bwhat am i (training|working out)\b/,
  /\b(open|show|see|view|pull up)\b.*\b(workout|plan|program)\b/,
  /\bworkout plan\b/,
  /\b(open|can't you open)\b.*\b(for me|it)\b/,
  /\b(other days|rest of the week|whole week|full week|all days|each day)\b/,
  /\b(specific|exact|actual)\b.*\b(workout|exercise|plan)/,
  /\b(see|show|list)\b.*\b(exercise|workout|session)/,
  /\bwhat('?s| is) (on|in)\b.*\b(plan|program|schedule)/,
  /\b(not (even )?close|wrong plan|made up|generic guess|that('?s| is) not my plan)/,
  /\b(two|both|other)\b.*\b(workout )?plans?\b/,
  /\b(bulgarian|renegade|burpee|rdl|lunge|split squat|deadlift|squat)\b/,
  /\b(book|schedule)\b.*\b(session|trainer|appointment)\b/,
  /\btrainer (notes|files|shared|documents)\b/,
  /\bnotes from (my )?trainer\b/,
  /\bfiles from (my )?trainer\b/,
  /\bmy (streak|consistency)\b/,
  /\b(since|from) (i joined|joining|signing up|account creation|creating my account|day one)\b/,
  /\b(all[- ]time|entire history|whole history|full history|ever since)\b/,
  /\b(first|earliest|when did i) (log|logged|start|started)\b/,
  /\bhow (long|many days) have i (been logging|logged)\b/,
  /\bmy (overall|lifetime|historical)\b/,
  /\b(lifetime|all[- ]time)\b.*\b(average|avg|stats|numbers|nutrition|protein|calories)\b/,
  /\bcompare my (sleep|nutrition|protein|calories|workouts?|training|logs?)\b/,
  /\bmy (sleep|nutrition|protein|calories|workouts?|training|logs?).*\b(vs|versus|compared to|relative to)\b/,
  /\b(month|year|months|years) (ago|back|of logs?|of data)\b/,
  /\bover the (past|last) (month|year|90 days|6 months|few months)\b/,
  /\bprogress cycle\b/,
  /\b(since|from) (i )?started\b/,
  /\bmy (fitness )?journey\b/,
  /\battribute\b.*\b(progress|gains|results|change)\b/,
  /\bwhat changed\b.*\b(since|over|when|after|before)\b/,
  /\b(cut|bulk|maintain|recomp)\b.*\b(phase|cycle|period)\b/,
  /\bphase(s)?\b.*\b(training|nutrition|cut|bulk|maintain|progress)\b/,
  /\btaking progress\b/,
  /\bnot taking progress\b/,
];

const ACTION_PATTERNS = [
  /\blog (my|the|a|some)\b/,
  /\b(set|change|adjust|update|bump|lower|raise) my (calor|macro|protein|carb|fat|target|goal)\b/,
  /\bmy (calorie|macro) target/,
  /\brate (my )?(workout|energy|mood)\b/,
  /\b(log|track) (sleep|water|steps|mood|energy)\b/,
];

const COACH_DENIED_DATA_PATTERNS = [
  /\b(don'?t|do not|can'?t|cannot) (have|see|access)\b.*\b(log|logs|food|nutrition|diary|data)\b/,
  /\bnutrition diary is separate\b/,
  /\bno access to your logged\b/,
  /\bask me to check\b.*\bwhat did i eat\b/,
];

const USER_PUSHBACK_PATTERNS = [
  /\b(what do you mean|wdym|why|how come|that'?s wrong|you should|don'?t you|can'?t you)\b/,
  /\b(food logs?|nutrition (log|diary)|my logs?|my data)\b/,
];

// ===== MAIN FUNCTION =====

/**
 * true = load account history context; false = skip it.
 * @param {string} userText — what the client typed in AI Coach chat
 * @param {Array<{role:string,content?:string,text?:string}>} [messages] — prior turns for thread-aware routing
 * @returns {boolean}
 */
export function shouldIncludeWeeklyContextInCoachPrompt(userText, messages = null) {
  const normalizedText = normalizeUserText(userText);

  // 1. Empty text never loads account history.
  if (!normalizedText) return false;

  // 2. Reload if the last coach reply wrongly said it can't see logs.
  if (threadNeedsPersonalDataReload(normalizedText, messages)) return true;

  // 3. Personal phrases ("how am I doing", "my logs").
  if (messageLooksPersonal(normalizedText)) return true;

  // 4. Action phrases ("log sleep", "change my macros").
  if (messageLooksLikeALogAction(normalizedText)) return true;

  return false;
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function normalizeUserText(userText) {
  return String(userText || '')
    .toLowerCase()
    .trim();
}

function matchesAnyPattern(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function isCoachMessageRole(role) {
  return role === COACH_ROLE_ASSISTANT || role === COACH_ROLE_AI;
}

function lastCoachMessageText(messages) {
  const lastCoachMessage = [...messages].reverse().find((message) => isCoachMessageRole(message?.role));
  return String(lastCoachMessage?.content || lastCoachMessage?.text || '').toLowerCase();
}

function coachDeniedPersonalData(assistantText) {
  return matchesAnyPattern(assistantText, COACH_DENIED_DATA_PATTERNS);
}

function userIsPushingBackAboutLogs(userTextLower) {
  return matchesAnyPattern(userTextLower, USER_PUSHBACK_PATTERNS);
}

/**
 * User pushing back after coach wrongly said it can't see their app logs.
 * Reloading personal data lets the next reply actually use the food log.
 * @param {string} userText
 * @param {Array|null} messages
 * @returns {boolean}
 */
function threadNeedsPersonalDataReload(userText, messages) {
  if (!Array.isArray(messages) || messages.length < MIN_THREAD_MESSAGES_FOR_PUSHBACK) return false;

  const assistantText = lastCoachMessageText(messages);
  if (!coachDeniedPersonalData(assistantText)) return false;

  return userIsPushingBackAboutLogs(normalizeUserText(userText));
}

function messageLooksPersonal(normalizedText) {
  return matchesAnyPattern(normalizedText, PERSONAL_PATTERNS);
}

function messageLooksLikeALogAction(normalizedText) {
  return matchesAnyPattern(normalizedText, ACTION_PATTERNS);
}

