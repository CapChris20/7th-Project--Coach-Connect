// Turns a coach chat's first message into a short title for the history list.
// Flow: throw away junk replies → try a question pattern → try a known topic →
//       otherwise title-case a cleaned snippet. A local creative title is the backup
//       when the title API is down.
// Used by makeChatTitle, the history list, and the coach conversation screen.

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

// ===== MAIN FUNCTION =====

/**
 * Lowercase, strip punctuation, collapse spaces. Used to compare a title to the raw message.
 * @param {string} text
 * @returns {string}
 */
export function normalizeTitleKey(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True for disclaimers, raw tool JSON, and the old bland "Protein Chat" leftovers.
 * Those must never stay as the history title.
 * @param {string} title
 * @returns {boolean}
 */
export function isJunkChatTitle(title) {
  const titleText = String(title || '').trim();
  if (!titleText) return true;
  return JUNK_TITLE_PATTERNS.some((pattern) => pattern.test(titleText));
}

/**
 * A readable title from the first user message. Empty input becomes the fallback.
 * @param {string} firstUserText
 * @returns {string}
 */
export function deriveChatTitle(firstUserText) {
  const originalText = String(firstUserText || '').trim();
  if (!originalText) return FALLBACK_TITLE;

  const questionTitle = titleFromQuestionLead(originalText);
  if (questionTitle) return questionTitle;

  const topicTitle = titleFromTopicKeyword(originalText.toLowerCase());
  if (topicTitle) return topicTitle;

  const cleaned = cleanedSnippetTitle(originalText);
  return cleaned ? toTitleCase(cleaned) : FALLBACK_TITLE;
}

/**
 * True when the stored title still looks like a raw first message, not a written title.
 * @param {string} title
 * @param {string} [firstUserText]
 * @returns {boolean}
 */
export function needsCreativeTitle(title, firstUserText = '') {
  const titleText = String(title || '').trim();
  if (isJunkChatTitle(titleText)) return true;

  const userText = String(firstUserText || '').trim();
  if (titleLooksLikeRawMessage(titleText, userText)) return true;

  if (/^(can u|can you|what do u|what do you|hey |please |log i|log that|check the)\b/i.test(titleText)) {
    return true;
  }
  if (titleText.length > RAW_MESSAGE_TITLE_MIN_LENGTH && /\b(for|that i|you don|walked|slept)\b/i.test(titleText)) {
    return true;
  }

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

  const keywordTitle = firstMatchingTitle(CREATIVE_KEYWORD_TITLES, lowerText);
  if (keywordTitle) return keywordTitle;

  const stepTitle = titleFromStepCount(originalText);
  if (stepTitle) return stepTitle;

  const sleepTitle = titleFromSleepHours(originalText, lowerText);
  if (sleepTitle) return sleepTitle;

  const logTitle = titleFromLogRequest(originalText);
  if (logTitle) return logTitle;

  const trainingTitle = titleFromTrainingTopic(originalText);
  if (trainingTitle) return trainingTitle;

  const wordCount = originalText.split(/\s+/).length;
  if (originalText.length <= SHORT_TITLE_MAX_LENGTH && !/\?/.test(originalText) && wordCount <= SHORT_TITLE_MAX_WORDS) {
    return toTitleCase(originalText);
  }

  const assistantTitle = titleFromAssistantReply(originalText, assistantText);
  if (assistantTitle) return assistantTitle;

  return null;
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function toTitleCase(text) {
  return String(text || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function cleanedQuestionTopic(topic) {
  return topic
    .replace(/^go on the web and\s+/i, '')
    .replace(/^google\s+/i, '')
    .replace(/^(about|for)\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/["'.!?]+$/g, '')
    .slice(0, TITLE_TOPIC_MAX_LENGTH);
}

function titleIfQuestionPatternMatches(originalText, pattern) {
  const match = originalText.match(pattern);
  if (!match || !(match[2] || match[1])) return null;
  const topic = (match[2] || match[1] || '').trim();
  const cleaned = cleanedQuestionTopic(topic);
  if (!cleaned) return null;
  return toTitleCase(cleaned);
}

function titleFromQuestionLead(originalText) {
  for (const pattern of QUESTION_LEAD_PATTERNS) {
    const questionTitle = titleIfQuestionPatternMatches(originalText, pattern);
    if (questionTitle) return questionTitle;
  }
  return null;
}

function titleFromTopicKeyword(lowerText) {
  for (const topic of TOPIC_TITLES) {
    if (lowerText.includes(topic.key)) return topic.title;
  }
  return null;
}

function firstMatchingTitle(rows, text) {
  for (const row of rows) {
    if (row.pattern.test(text)) return row.title;
  }
  return null;
}

function stepCountLabel(stepCount) {
  if (stepCount >= STEP_COUNT_THOUSANDS) {
    return `${Math.round(stepCount / STEPS_PER_THOUSAND)}K`;
  }
  return stepCount.toLocaleString();
}

function titleFromStepCount(originalText) {
  const stepsMatch = originalText.match(/(\d[\d,]*)\s*steps?/i);
  const mentionsLoggingSteps =
    stepsMatch || (/\b(log|track|record)\b/i.test(originalText) && /\bsteps?\b/i.test(originalText));
  if (!mentionsLoggingSteps) return null;
  const stepCount = stepsMatch ? Number(stepsMatch[1].replace(/,/g, '')) : null;
  if (stepCount && stepCount >= STEP_COUNT_MIN) {
    return `${stepCountLabel(stepCount)}-Step Day`;
  }
  return 'Step Streak Check';
}

function titleFromSleepHours(originalText, lowerText) {
  const sleepMatch = originalText.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (!(sleepMatch && /\b(sleep|slept|log|nap)\b/i.test(lowerText))) return null;
  const hoursLabel = sleepMatch[1].replace(/\.0$/, '');
  return `${hoursLabel}h Sleep Debrief`;
}

function titleFromLogRequest(originalText) {
  if (!/\b(log|track|record)\b/i.test(originalText)) return null;
  return firstMatchingTitle(LOG_REQUEST_TITLES, originalText) || 'Daily Metrics Drop';
}

function titleFromTrainingTopic(originalText) {
  return firstMatchingTitle(TRAINING_TOPIC_TITLES, originalText);
}

function titleFromAssistantReply(originalText, assistantText) {
  const assistant = String(assistantText || '').trim();
  if (!assistant || isJunkChatTitle(assistant) || originalText.length >= ASSISTANT_TOPIC_USER_MAX_LENGTH) {
    return null;
  }
  const topicMatch = assistant.match(
    /\b(protein|macros|calories|sleep|recovery|workout|hypertrophy|cutting|bulking|recomp|steps|cardio|creatine|ashwagandha)\b/i,
  );
  if (!topicMatch) return null;
  const topicWord = topicMatch[0].toLowerCase();
  return ASSISTANT_TOPIC_TITLES[topicWord] || `${toTitleCase(topicMatch[0])} Focus`;
}

function cleanedSnippetTitle(originalText) {
  return originalText
    .replace(/[^\w\s%-]/g, ' ')
    .replace(/\b(please|pls|hey|hi|hello|ok|okay|so|like|just|really|actually|basically|google|web|search)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TITLE_TOPIC_MAX_LENGTH);
}

function titleLooksLikeRawMessage(titleText, userText) {
  if (!userText) return false;
  if (normalizeTitleKey(titleText) === normalizeTitleKey(userText)) return true;
  if (normalizeTitleKey(titleText) === normalizeTitleKey(deriveChatTitle(userText))) return true;
  if (normalizeTitleKey(titleText) === normalizeTitleKey(userText.slice(0, TITLE_TOPIC_MAX_LENGTH))) return true;
  return false;
}
