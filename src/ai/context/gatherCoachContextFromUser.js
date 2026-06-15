/**
 * coach Personal Data Routing
 *
 * Purpose: coach Personal Data Routing — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/ai
 * Key exports: shouldIncludeWeeklyContextInCoachPrompt
 *
 * @file-header
 */
/**
 * Decides whether the AI Coach should load this user's last-7-days logs
 * (nutrition, workouts, sleep, etc.) into the system prompt.
 *
 * Why: Loading weekly context costs Firestore reads and makes the prompt huge.
 * We only fetch it when the user's message is clearly about *their* data —
 * not for generic questions like "how much protein should I eat?"
 *
 * Keep patterns in sync with: server/lib/coachPersonalDataRouting.js
 *
 * --- Regex cheat sheet (used in every pattern below) ---
 * / ... /     → regular expression (pattern matcher for text)
 * \b          → "word boundary" — start/end of a word (so "log" won't match "blog")
 * (a|b)       → "a OR b" — match either option inside the parentheses
 * '?          → the ? before ' makes the apostrophe optional ("arent" vs "aren't")
 * .*          → any characters (.* = "anything in between" two phrases)
 * \b at end   → word must end cleanly (not be part of a longer word)
 */

/**
 * @param {string} userText — what the client typed in AI Coach chat
 * @returns {boolean} true = load 7-day weekly context; false = skip it
 */
export function shouldIncludeWeeklyContextInCoachPrompt(userText) {
  // Normalize input: always a string, lowercase, no leading/trailing spaces
  const t = String(userText || '')
    .toLowerCase()
    .trim();

  // Empty message → nothing personal to look up
  if (!t) return false;

  // Phrases that mean "talk about MY history / how I'm doing"
  const personalPatterns = [
    // "why am I tired", "why aren't I losing", "why do I feel..."
    /\bwhy (am|aren'?t|is|do) i\b/,
    // "why am I not seeing results"
    /\bwhy (am|aren'?t) i not\b/,
    // "no energy", "low energy", "zero energy"
    /\b(no|low|zero) energy\b/,
    // "not feeling progress", "not seeing results", "not making better"
    /\bnot (feeling|seeing|making) (good|progress|results|better)\b/,
    // "feeling awful", "feel weak", "feel off"
    /\b(feeling|feel) (bad|awful|like crap|off|weak|tight|worse)\b/,
    // "haven't logged", "not tracking", "not been logging"
    /\b(haven'?t|not) (logged|tracking|been logging)\b/,
    // "3 days without log", "didn't log"
    /\b(days? )?(without|didn'?t) log\b/,
    // "my logs", "my data", "my progress"
    /\bmy (log|logs|data|tracking|progress|results)\b/,
    // "how am I doing"
    /\bhow am i doing\b/,
    // "review my week", "review my progress"
    /\breview my (week|progress|logs)\b/,
    // "this week" ... "eat/workout/sleep" (words can be in either order)
    /\bthis week\b.*\b(eat|ate|workout|sleep|log|progress|doing)\b/,
    /\b(eat|ate|workout|sleep|log).*\bthis week\b/,
    // "on track", "off track"
    /\b(on track|off track)\b/,
    // weight / muscle plateau language
    /\bplateau\b/,
    /\bnot losing\b/,
    /\bnot gaining\b/,
    /\bstalled\b/,
    // "am I eating enough", "am I overeating", "am I undereating"
    /\bam i eating enough\b/,
    /\bam i overeating\b/,
    /\bam i undereating\b/,
    // "how's my sleep", "how's my nutrition"
    /\bhow'?s my (sleep|recovery|nutrition|diet)\b/,
    // "based on my [logs/data]"
    /\bbased on my\b/,
    // "looking at my log", "looking at my week"
    /\blooking at my (log|data|week)\b/,
    // "from my log", "from my data" — user pointing at their own records
    /\bfrom my (log|data)\b/,
    // "what did I eat", "what did I log"
    /\bwhat did i (eat|log)\b/,
    // "what food was logged", "what meals are in my log"
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
    // delete/remove food — need log context
    /\b(delete|remove|clear|undo|unlog)\b.*\b(food|meal|log|nutrition|logged)\b/,
    /\b(delete|remove|clear)\b.*\b(chicken|rice|pizza|protein|breakfast|lunch|dinner|snack|shake|burger|eggs)\b/,
    // "did I eat enough", "did I hit protein"
    /\bdid i (eat|log|hit)\b/,
    // "my streak", "my consistency"
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
    // progress photo habit
    /\btaking progress\b/,
    /\bnot taking progress\b/,
  ];

  // If ANY personal pattern matches, we need their real log data in the prompt
  if (personalPatterns.some((p) => p.test(t))) return true;

  // Phrases that imply they want to change or log something tied to their profile
  const actionPatterns = [
    // "log my lunch", "log the meal"
    /\blog (my|the|a|some)\b/,
    // "adjust my macros", "raise my protein", "change my calorie target"
    /\b(set|change|adjust|update|bump|lower|raise) my (calor|macro|protein|carb|fat|target|goal)\b/,
    // "my calorie target", "my macro target"
    /\bmy (calorie|macro) target/,
    // "rate my workout", "rate my energy"
    /\brate (my )?(workout|energy|mood)\b/,
    // "log sleep", "track water", "track mood"
    /\b(log|track) (sleep|water|steps|mood|energy)\b/,
  ];

  if (actionPatterns.some((p) => p.test(t))) return true;

  // Generic coaching question with no personal-data signal → don't load weekly context
  return false;
}
