/**
 * SERVER copy of client routing logic (same rules, CommonJS export).
 *
 * Decides whether the AI Coach should load this user's last-7-days logs
 * into the system prompt before calling DeepSeek / Perplexity.
 *
 * Why: Weekly context = extra Firestore reads + a longer prompt.
 * Only load when the message is clearly about *this user's* logs.
 *
 * Keep patterns in sync with: src/ai/context/gatherCoachContextFromUser.js
 *
 * --- Regex cheat sheet ---
 * / ... /     → regular expression
 * \b          → word boundary (whole word, not substring inside another word)
 * (a|b)       → match a OR b
 * '?          → optional apostrophe in contractions (aren't / arent)
 * .*          → any text between two required phrases
 */

/**
 * @param {string} userText — latest user message from POST /ai-coach body
 * @returns {boolean} true = fetch weekly context from Firestore; false = skip
 */
function shouldIncludeWeeklyContextInCoachPrompt(userText) {
  const t = String(userText || '')
    .toLowerCase()
    .trim();
  if (!t) return false;

  const personalPatterns = [
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
    // "from my log" / "from my data" — user wants answer grounded in their records
    /\bfrom my (log|data)\b/,
    /\bwhat did i (eat|log)\b/,
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
    /\b(book|schedule)\b.*\b(session|trainer|appointment)\b/,
    /\btrainer (notes|files|shared|documents)\b/,
    /\bnotes from (my )?trainer\b/,
    /\bfiles from (my )?trainer\b/,
    /\bmy (streak|consistency)\b/,
    /\btaking progress\b/,
    /\bnot taking progress\b/,
  ];
  if (personalPatterns.some((p) => p.test(t))) return true;

  const actionPatterns = [
    /\blog (my|the|a|some)\b/,
    /\b(set|change|adjust|update|bump|lower|raise) my (calor|macro|protein|carb|fat|target|goal)\b/,
    /\bmy (calorie|macro) target/,
    /\brate (my )?(workout|energy|mood)\b/,
    /\b(log|track) (sleep|water|steps|mood|energy)\b/,
  ];
  if (actionPatterns.some((p) => p.test(t))) return true;

  return false;
}

module.exports = { shouldIncludeWeeklyContextInCoachPrompt };
