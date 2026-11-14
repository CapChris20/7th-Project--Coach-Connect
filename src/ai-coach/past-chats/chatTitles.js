// Turns a coach chat's first message into a short title for the history list.
// Flow: reject junk → question pattern → known topic → title-cased snippet → fallback label.
// Local creative titles run when the title API is down (buildCreativeTitleLocal).
// Used by makeChatTitle, fixOldChatTitles, chatHistoryList, and the live conversation screen.

// ===== NAMED CONSTANTS =====

const FALLBACK_TITLE = 'Coach Check-In';
// Manipulate here: how much of the first message is allowed to become a title.
const TITLE_TOPIC_MAX_LENGTH = 48;
// Manipulate here: a stored title longer than this, with filler words, still needs a rewrite.
const RAW_MESSAGE_TITLE_MIN_LENGTH = 32;
// Manipulate here: a very short first message is title-cased as-is.
const SHORT_TITLE_MAX_LENGTH = 28;
const SHORT_TITLE_MAX_WORDS = 5;
const ASSISTANT_TOPIC_USER_MAX_LENGTH = 40;
// Manipulate here: step counts at or above this become a "NK-Step Day" or "N-Step Day" title.
const STEP_COUNT_MIN = 1000;
const STEP_COUNT_THOUSANDS = 10000;
const STEPS_PER_THOUSAND = 1000;

// Manipulate here: known topics and the title they should show in history.
const TOPIC_TITLES = [
  { key: 'skinny fat', title: 'Skinny-Fat Fix' },
  { key: 'recomp', title: 'Recomp Roadmap' },
  { key: 'recomposition', title: 'Recomp Roadmap' },
  { key: 'body recomp', title: 'Recomp Roadmap' },
  { key: 'ashwagandha', title: 'Ashwagandha & Sleep' },
  { key: 'zero sugar', title: 'Zero-Sugar Sips' },
  { key: 'diet soda', title: 'Diet Soda Debate' },
  { key: 'energy drink', title: 'Energy Drink Check' },
  { key: 'preworkout', title: 'Pre-Workout Playbook' },
  { key: 'pre-workout', title: 'Pre-Workout Playbook' },
  { key: 'creatine', title: 'Creatine Clarity' },
  { key: 'protein', title: 'Protein Playbook' },
  { key: 'macros', title: 'Macro Math' },
  { key: 'calories', title: 'Calorie Strategy' },
  { key: 'cut', title: 'Cutting Game Plan' },
  { key: 'bulk', title: 'Bulking Blueprint' },
];

const ASSISTANT_TOPIC_TITLES = {
  protein: 'Protein Playbook',
  macros: 'Macro Math Night',
  calories: 'Calorie Strategy',
  sleep: 'Sleep Recovery Tactics',
  recovery: 'Recovery Reset',
  workout: 'Training Tune-Up',
  hypertrophy: 'Hypertrophy Huddle',
  cutting: 'Cutting Game Plan',
  bulking: 'Bulking Blueprint',
  recomp: 'Recomp Roadmap',
  steps: 'Step Streak Check',
  cardio: 'Cardio Strategy',
  creatine: 'Creatine Clarity',
  ashwagandha: 'Ashwagandha & Sleep Science',
};

const QUESTION_LEAD_PATTERNS = [
  /^(what is|what's|whats)\s+(.+)\??$/i,
  /^explain\s+(.+)\??$/i,
  /^define\s+(.+)\??$/i,
  /^how do i\s+(.+)\??$/i,
  /^how to\s+(.+)\??$/i,
  /^can i\s+(.+)\??$/i,
  /^should i\s+(.+)\??$/i,
];

const JUNK_TITLE_PATTERNS = [
  /live search wasn'?t available/i,
  /here'?s what i know from coaching/i,
  /not cited web results/i,
  /^as an ai\b/i,
  /i (can|could) help you with/i,
  /\btool_call\b|```|\{"name":/i,
  /^(new chat|chat|untitled)$/i,
  /^(calories|protein|macro|macros|fitness|sleep|recovery|workout|hypertrophy|cutting|bulking|recomp|steps|cardio)\s+chat$/i,
];

const CREATIVE_KEYWORD_TITLES = [
  { pattern: /\bashwagandha\b/i, title: 'Ashwagandha & Sleep Science' },
  { pattern: /\bprotein\b/i, title: 'Protein Playbook' },
  { pattern: /\bcalorie|calories|kcal\b/i, title: 'Calorie Strategy' },
  { pattern: /\bmacro/i, title: 'Macro Math Night' },
];

const LOG_REQUEST_TITLES = [
  { pattern: /\bprotein\b/i, title: 'Protein Log Drop' },
  { pattern: /\bcalorie|calories|kcal\b/i, title: 'Calorie Log Drop' },
  { pattern: /\bfood|meal|ate|breakfast|lunch|dinner\b/i, title: 'Meal Log Drop' },
  { pattern: /\bwater|hydrat/i, title: 'Hydration Check-In' },
  { pattern: /\bweight\b/i, title: 'Scale Check-In' },
];

const TRAINING_TOPIC_TITLES = [
  { pattern: /\bdirty cut\b/i, title: 'Dirty Cut Debate' },
  { pattern: /\brecomp|recomposition\b/i, title: 'Recomp Roadmap' },
  { pattern: /\bcreatinee?\b/i, title: 'Creatine Clarity' },
  { pattern: /\bpre[- ]?workout\b/i, title: 'Pre-Workout Playbook' },
  { pattern: /\bsleep\b/i, title: 'Sleep Recovery Tactics' },
  { pattern: /\bworkout|training|lift|gym\b/i, title: 'Training Tune-Up' },
  { pattern: /\bcut(ting)?\b/i, title: 'Cutting Game Plan' },
  { pattern: /\bbulk(ing)?\b/i, title: 'Bulking Blueprint' },
];

const CASUAL_PROMPT_TITLE_PATTERN =
  /^(can u|can you|what do u|what do you|hey |please |log i|log that|check the)\b/i;
const FILLER_WORD_IN_LONG_TITLE_PATTERN = /\b(for|that i|you don|walked|slept)\b/i;

// ===== MAIN FUNCTION =====

/**
 * Lowercase, strip punctuation, collapse spaces — used to compare a title to the raw message.
 * @param {string} text
 * @returns {string}
 */
export function normalizeTitleKey(text) {
  // 1. Force a string so undefined drafts do not throw.
  const safeText = String(text || '');

  // 2. Drop punctuation, collapse spaces, trim — keys must match across tiny wording diffs.
  const lowercased = safeText.toLowerCase();
  const lettersAndSpacesOnly = lowercased.replace(/[^\w\s]/g, '');
  const collapsedSpaces = lettersAndSpacesOnly.replace(/\s+/g, ' ');
  return collapsedSpaces.trim();
}

/**
 * True for disclaimers, raw tool JSON, and bland "Protein Chat" leftovers that must not stay as the history title.
 * @param {string} title
 * @returns {boolean}
 */
export function isJunkChatTitle(title) {
  // 1. Empty titles always need a rewrite.
  const titleText = String(title || '').trim();
  if (!titleText) return true;

  // 2. Any junk pattern hit (disclaimer, tool JSON, "X Chat") means replace it.
  return titleMatchesAnyJunkPattern(titleText);
}

/**
 * Readable title from the first user message. Empty input becomes the fallback label.
 * @param {string} firstUserText
 * @returns {string}
 */
export function deriveChatTitle(firstUserText) {
  const originalText = String(firstUserText || '').trim();
  if (!originalText) return FALLBACK_TITLE;

  // 1. "What is protein?" style leads become a short topic title.
  const questionTitle = titleFromQuestionLead(originalText);
  if (questionTitle) return questionTitle;

  // 2. Known coaching keywords (recomp, creatine, …) map to fixed sidebar labels.
  const lowerText = originalText.toLowerCase();
  const topicTitle = titleFromTopicKeyword(lowerText);
  if (topicTitle) return topicTitle;

  // 3. Otherwise title-case a cleaned snippet of the message itself.
  const snippetWithoutFiller = cleanedSnippetTitle(originalText);
  if (!snippetWithoutFiller) return FALLBACK_TITLE;
  return toTitleCase(snippetWithoutFiller);
}

/**
 * True when the stored title still looks like a raw first message, not a written title.
 * @param {string} title
 * @param {string} [firstUserText]
 * @returns {boolean}
 */
export function needsCreativeTitle(title, firstUserText = '') {
  const titleText = String(title || '').trim();

  // 1. Junk / disclaimer titles always need a creative rewrite.
  if (isJunkChatTitle(titleText)) return true;

  // 2. Title still equals the opening message (or a derived snippet of it).
  const userText = String(firstUserText || '').trim();
  if (titleLooksLikeRawMessage(titleText, userText)) return true;

  // 3. Casual prompts ("can you…", "hey…") are not finished titles.
  if (CASUAL_PROMPT_TITLE_PATTERN.test(titleText)) return true;

  // 4. Long titles that still contain filler words need a rewrite.
  if (titleIsLongWithFillerWords(titleText)) return true;

  return false;
}

/**
 * Client-side title when the chat-title API is unavailable. Null means "leave the current title."
 * Checks run in this order so a step count beats a generic "log" title.
 * @param {string} [userText]
 * @param {string} [assistantText]
 * @returns {string|null}
 */
export function buildCreativeTitleLocal(userText = '', assistantText = '') {
  const originalText = String(userText || '').trim();
  const lowerText = originalText.toLowerCase();
  if (!originalText) return null;

  // 1. High-signal keywords in the user's message.
  const keywordTitle = firstMatchingTitle(CREATIVE_KEYWORD_TITLES, lowerText);
  if (keywordTitle) return keywordTitle;

  // 2. Step logging ("12,000 steps").
  const stepTitle = titleFromStepCount(originalText);
  if (stepTitle) return stepTitle;

  // 3. Sleep hours in a log-style message.
  const sleepTitle = titleFromSleepHours(originalText, lowerText);
  if (sleepTitle) return sleepTitle;

  // 4. Generic "log my …" requests.
  const logTitle = titleFromLogRequest(originalText);
  if (logTitle) return logTitle;

  // 5. Training / diet topics without an explicit log verb.
  const trainingTitle = titleFromTrainingTopic(originalText);
  if (trainingTitle) return trainingTitle;

  // 6. Very short, non-question opener — title-case as-is.
  if (messageIsShortNonQuestion(originalText)) return toTitleCase(originalText);

  // 7. Last resort: infer a topic word from a short coach reply.
  const assistantTitle = titleFromAssistantReply(originalText, assistantText);
  if (assistantTitle) return assistantTitle;

  return null;
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function titleMatchesAnyJunkPattern(titleText) {
  for (let index = 0; index < JUNK_TITLE_PATTERNS.length; index += 1) {
    const pattern = JUNK_TITLE_PATTERNS[index];
    if (pattern.test(titleText)) return true;
  }
  return false;
}

function titleIsLongWithFillerWords(titleText) {
  if (titleText.length <= RAW_MESSAGE_TITLE_MIN_LENGTH) return false;
  return FILLER_WORD_IN_LONG_TITLE_PATTERN.test(titleText);
}

function messageIsShortNonQuestion(originalText) {
  const wordCount = originalText.split(/\s+/).length;
  if (originalText.length > SHORT_TITLE_MAX_LENGTH) return false;
  if (/\?/.test(originalText)) return false;
  if (wordCount > SHORT_TITLE_MAX_WORDS) return false;
  return true;
}

function toTitleCase(text) {
  const rawWords = String(text || '').split(/\s+/);
  const capitalizedWords = [];

  for (let index = 0; index < rawWords.length; index += 1) {
    const word = rawWords[index];
    if (!word) continue;
    const firstLetter = word.charAt(0).toUpperCase();
    const restOfWord = word.slice(1);
    capitalizedWords.push(firstLetter + restOfWord);
  }

  return capitalizedWords.join(' ');
}

function cleanedQuestionTopic(topic) {
  let cleaned = topic;
  cleaned = cleaned.replace(/^go on the web and\s+/i, '');
  cleaned = cleaned.replace(/^google\s+/i, '');
  cleaned = cleaned.replace(/^(about|for)\s+/i, '');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/["'.!?]+$/g, '');
  return cleaned.slice(0, TITLE_TOPIC_MAX_LENGTH);
}

function titleIfQuestionPatternMatches(originalText, pattern) {
  const match = originalText.match(pattern);
  if (!match) return null;

  // match[2] is the topic for "what is X"; match[1] covers "explain X" patterns.
  let captureGroup = match[1];
  if (match[2]) {
    captureGroup = match[2];
  }
  if (!captureGroup) return null;

  const topic = captureGroup.trim();
  const cleanedTopic = cleanedQuestionTopic(topic);
  if (!cleanedTopic) return null;
  return toTitleCase(cleanedTopic);
}

function titleFromQuestionLead(originalText) {
  for (let index = 0; index < QUESTION_LEAD_PATTERNS.length; index += 1) {
    const pattern = QUESTION_LEAD_PATTERNS[index];
    const questionTitle = titleIfQuestionPatternMatches(originalText, pattern);
    if (questionTitle) return questionTitle;
  }
  return null;
}

function titleFromTopicKeyword(lowerText) {
  for (let index = 0; index < TOPIC_TITLES.length; index += 1) {
    const topicRow = TOPIC_TITLES[index];
    if (lowerText.includes(topicRow.key)) return topicRow.title;
  }
  return null;
}

function firstMatchingTitle(titlePatternRows, text) {
  for (let index = 0; index < titlePatternRows.length; index += 1) {
    const row = titlePatternRows[index];
    if (row.pattern.test(text)) return row.title;
  }
  return null;
}

function stepCountLabel(stepCount) {
  if (stepCount >= STEP_COUNT_THOUSANDS) {
    const thousandsRounded = Math.round(stepCount / STEPS_PER_THOUSAND);
    return `${thousandsRounded}K`;
  }
  return stepCount.toLocaleString();
}

function titleFromStepCount(originalText) {
  const stepsMatch = originalText.match(/(\d[\d,]*)\s*steps?/i);
  const hasLogVerb = /\b(log|track|record)\b/i.test(originalText);
  const hasStepsWord = /\bsteps?\b/i.test(originalText);
  const mentionsLoggingSteps = stepsMatch || (hasLogVerb && hasStepsWord);
  if (!mentionsLoggingSteps) return null;

  let stepCount = null;
  if (stepsMatch) {
    const digitsOnly = stepsMatch[1].replace(/,/g, '');
    stepCount = Number(digitsOnly);
  }

  if (stepCount && stepCount >= STEP_COUNT_MIN) {
    return `${stepCountLabel(stepCount)}-Step Day`;
  }
  return 'Step Streak Check';
}

function titleFromSleepHours(originalText, lowerText) {
  const sleepMatch = originalText.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  const mentionsSleep = /\b(sleep|slept|log|nap)\b/i.test(lowerText);
  if (!sleepMatch) return null;
  if (!mentionsSleep) return null;

  // Manipulate here: ".0" hours drop the trailing zero so "7.0" becomes "7h".
  const hoursLabel = sleepMatch[1].replace(/\.0$/, '');
  return `${hoursLabel}h Sleep Debrief`;
}

function titleFromLogRequest(originalText) {
  const isLogRequest = /\b(log|track|record)\b/i.test(originalText);
  if (!isLogRequest) return null;

  const matchedLogTitle = firstMatchingTitle(LOG_REQUEST_TITLES, originalText);
  if (matchedLogTitle) return matchedLogTitle;
  return 'Daily Metrics Drop';
}

function titleFromTrainingTopic(originalText) {
  return firstMatchingTitle(TRAINING_TOPIC_TITLES, originalText);
}

function titleFromAssistantReply(originalText, assistantText) {
  const assistantReply = String(assistantText || '').trim();
  if (!assistantReply) return null;
  if (isJunkChatTitle(assistantReply)) return null;
  if (originalText.length >= ASSISTANT_TOPIC_USER_MAX_LENGTH) return null;

  const topicMatch = assistantReply.match(
    /\b(protein|macros|calories|sleep|recovery|workout|hypertrophy|cutting|bulking|recomp|steps|cardio|creatine|ashwagandha)\b/i,
  );
  if (!topicMatch) return null;

  const topicWord = topicMatch[0].toLowerCase();
  const mappedTitle = ASSISTANT_TOPIC_TITLES[topicWord];
  if (mappedTitle) return mappedTitle;
  return `${toTitleCase(topicMatch[0])} Focus`;
}

function cleanedSnippetTitle(originalText) {
  let snippet = originalText;
  snippet = snippet.replace(/[^\w\s%-]/g, ' ');
  snippet = snippet.replace(
    /\b(please|pls|hey|hi|hello|ok|okay|so|like|just|really|actually|basically|google|web|search)\b/gi,
    ' ',
  );
  snippet = snippet.replace(/\s+/g, ' ');
  snippet = snippet.trim();
  return snippet.slice(0, TITLE_TOPIC_MAX_LENGTH);
}

function titleLooksLikeRawMessage(titleText, userText) {
  if (!userText) return false;

  const titleKey = normalizeTitleKey(titleText);
  const userKey = normalizeTitleKey(userText);
  if (titleKey === userKey) return true;

  const derivedFromUser = deriveChatTitle(userText);
  if (titleKey === normalizeTitleKey(derivedFromUser)) return true;

  const userPrefix = userText.slice(0, TITLE_TOPIC_MAX_LENGTH);
  if (titleKey === normalizeTitleKey(userPrefix)) return true;

  return false;
}
