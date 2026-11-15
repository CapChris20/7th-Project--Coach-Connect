// Decides whether the AI Coach should load this user's app history into the system prompt.
// Flow: empty text → skip → thread pushback after a false "I can't see logs" → personal phrases → action phrases → otherwise skip.
// Used by: sendMessageToCoach / shouldLookUpOnInternet. Keep patterns in sync with server/lib/coachPersonalDataRouting.js.

// ===== NAMED CONSTANTS =====

// Why we gate this: loading full account context costs Firestore reads and makes the prompt large.
// We only fetch it when the user's message is clearly about *their* data — not for generic
// questions like "how much protein should I eat?"
//
// Data window (documented for the server twin): since account creation (up to 2 years),
// with lifetime averages + last 45 days of meal detail + monthly rollups for older months.

const COACH_ROLE_ASSISTANT = 'assistant';
const COACH_ROLE_AI = 'ai';
// Manipulate here: need at least this many turns before "coach denied logs → user pushback" can fire.
const MIN_THREAD_MESSAGES_FOR_PUSHBACK = 2;

// Phrases that mean "look at MY logs / plan / streak / history."
const PERSONAL_DATA_PHRASE_PATTERNS = [
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

// Phrases that mean "do a write action for me" — still needs their targets / recent context.
const LOG_OR_CHANGE_TARGET_PHRASE_PATTERNS = [
  /\blog (my|the|a|some)\b/,
  /\b(set|change|adjust|update|bump|lower|raise) my (calor|macro|protein|carb|fat|target|goal)\b/,
  /\bmy (calorie|macro) target/,
  /\brate (my )?(workout|energy|mood)\b/,
  /\b(log|track) (sleep|water|steps|mood|energy)\b/,
];

// Coach replies that wrongly claimed zero access to the user's logged food / diary.
const COACH_CLAIMED_NO_LOG_ACCESS_PATTERNS = [
  /\b(don'?t|do not|can'?t|cannot) (have|see|access)\b.*\b(log|logs|food|nutrition|diary|data)\b/,
  /\bnutrition diary is separate\b/,
  /\bno access to your logged\b/,
  /\bask me to check\b.*\bwhat did i eat\b/,
];

// User pushback after that false denial — "what do you mean" / "my food logs" etc.
const USER_PUSHBACK_ABOUT_LOGS_PATTERNS = [
  /\b(what do you mean|wdym|why|how come|that'?s wrong|you should|don'?t you|can'?t you)\b/,
  /\b(food logs?|nutrition (log|diary)|my logs?|my data)\b/,
];

// ===== HELPER FUNCTIONS =====

function lowerCaseTrimmedUserMessage(userText) {
  return String(userText || '')
    .toLowerCase()
    .trim();
}

function textMatchesAnyPattern(text, patternList) {
  for (let patternIndex = 0; patternIndex < patternList.length; patternIndex += 1) {
    const onePattern = patternList[patternIndex];
    if (onePattern.test(text)) {
      return true;
    }
  }
  return false;
}

function messageRoleIsCoach(role) {
  if (role === COACH_ROLE_ASSISTANT) {
    return true;
  }
  if (role === COACH_ROLE_AI) {
    return true;
  }
  return false;
}

function textFromCoachMessage(oneMessage) {
  if (!oneMessage) {
    return '';
  }

  if (oneMessage.content) {
    return String(oneMessage.content);
  }
  if (oneMessage.text) {
    return String(oneMessage.text);
  }
  return '';
}

function lowerCaseTextFromNewestCoachTurn(messages) {
  if (!Array.isArray(messages)) {
    return '';
  }

  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const oneMessage = messages[messageIndex];
    if (!oneMessage) {
      continue;
    }
    if (!messageRoleIsCoach(oneMessage.role)) {
      continue;
    }

    const coachText = textFromCoachMessage(oneMessage);
    return coachText.toLowerCase();
  }

  return '';
}

function coachReplyClaimedNoLogAccess(assistantTextLower) {
  return textMatchesAnyPattern(assistantTextLower, COACH_CLAIMED_NO_LOG_ACCESS_PATTERNS);
}

function userMessageSoundsLikeLogAccessPushback(userTextLower) {
  return textMatchesAnyPattern(userTextLower, USER_PUSHBACK_ABOUT_LOGS_PATTERNS);
}

function userIsPushingBackAfterCoachDeniedLogs(userTextLower, messages) {
  if (!Array.isArray(messages)) {
    return false;
  }
  if (messages.length < MIN_THREAD_MESSAGES_FOR_PUSHBACK) {
    return false;
  }

  const lastCoachTextLower = lowerCaseTextFromNewestCoachTurn(messages);
  if (!coachReplyClaimedNoLogAccess(lastCoachTextLower)) {
    return false;
  }

  return userMessageSoundsLikeLogAccessPushback(userTextLower);
}

// ===== MAIN FUNCTION =====

/**
 * Decides whether the AI Coach should load this user's app history into the system prompt.
 * Flow: 1. check empty  2. check pushback  3. check personal phrases  4. check action phrases
 * @param {string} userText
 * @param {Array|null} [messages]
 * @returns {boolean}
 */
export function shouldIncludeWeeklyContextInCoachPrompt(userText, messages = null) {
  const loweredTrimmedText = lowerCaseTrimmedUserMessage(userText);

  // 1. Empty / whitespace-only never loads account history.
  if (!loweredTrimmedText) {
    return false;
  }

  // 2. Reload if the last coach reply wrongly said it can't see logs and the user is pushing back.
  const threadNeedsPersonalDataAfterDenial = userIsPushingBackAfterCoachDeniedLogs(
    loweredTrimmedText,
    messages,
  );
  if (threadNeedsPersonalDataAfterDenial) {
    return true;
  }

  // 3. Personal phrases ("how am I doing", "my logs", "what's on my plan").
  const userAskedAboutTheirOwnData = textMatchesAnyPattern(
    loweredTrimmedText,
    PERSONAL_DATA_PHRASE_PATTERNS,
  );
  if (userAskedAboutTheirOwnData) {
    return true;
  }

  // 4. Action phrases ("log sleep", "change my macros") — still need their targets in context.
  const userAskedToLogOrChangeTargets = textMatchesAnyPattern(
    loweredTrimmedText,
    LOG_OR_CHANGE_TARGET_PHRASE_PATTERNS,
  );
  if (userAskedToLogOrChangeTargets) {
    return true;
  }

  return false;
}
