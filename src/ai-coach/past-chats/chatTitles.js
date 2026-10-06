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

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} text
 * @returns {string}
 */
function toTitleCase(text) {
  return String(text || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * "What is creatine?" → "Creatine". Null when the sentence is not one of those leads.
 * @param {string} originalText
 * @returns {string|null}
 */
function titleFromQuestionLead(originalText) {
  for (const pattern of QUESTION_LEAD_PATTERNS) {
    const match = originalText.match(pattern);
    if (match && (match[2] || match[1])) {
      const topic = (match[2] || match[1] || '').trim();
      const cleaned = topic
        .replace(/^go on the web and\s+/i, '')
        .replace(/^google\s+/i, '')
        .replace(/^(about|for)\s+/i, '')
        .replace(/\s+/g, ' ')
        .replace(/["'.!?]+$/g, '')
        .slice(0, TITLE_TOPIC_MAX_LENGTH);
      if (cleaned) return toTitleCase(cleaned);
    }
  }
  return null;
}

/**
 * First known topic found in the lowercased message.
 * Order matters: "recomp" is listed before broader words so it wins.
 * @param {string} lowerText
 * @returns {string|null}
 */
function titleFromTopicKeyword(lowerText) {
  for (const topic of TOPIC_TITLES) {
    if (lowerText.includes(topic.key)) return topic.title;
  }
  return null;
}

/**
 * @param {string} originalText
 * @returns {string|null}
 */
function titleFromStepCount(originalText) {
  const stepsMatch = originalText.match(/(\d[\d,]*)\s*steps?/i);
  const mentionsLoggingSteps =
    stepsMatch || (/\b(log|track|record)\b/i.test(originalText) && /\bsteps?\b/i.test(originalText));
  if (!mentionsLoggingSteps) return null;
  const stepCount = stepsMatch ? Number(stepsMatch[1].replace(/,/g, '')) : null;
  if (stepCount && stepCount >= STEP_COUNT_MIN) {
    const label = stepCount >= STEP_COUNT_THOUSANDS
      ? `${Math.round(stepCount / 1000)}K`
      : stepCount.toLocaleString();
    return `${label}-Step Day`;
  }
  return 'Step Streak Check';
}

/**
 * @param {string} originalText
 * @param {string} lowerText
 * @returns {string|null}
 */
function titleFromSleepHours(originalText, lowerText) {
  const sleepMatch = originalText.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (!(sleepMatch && /\b(sleep|slept|log|nap)\b/i.test(lowerText))) return null;
  const hoursLabel = sleepMatch[1].replace(/\.0$/, '');
  return `${hoursLabel}h Sleep Debrief`;
}

/**
 * @param {string} originalText
 * @returns {string|null}
 */
function titleFromLogRequest(originalText) {
  if (!/\b(log|track|record)\b/i.test(originalText)) return null;
  if (/\bprotein\b/i.test(originalText)) return 'Protein Log Drop';
  if (/\bcalorie|calories|kcal\b/i.test(originalText)) return 'Calorie Log Drop';
  if (/\bfood|meal|ate|breakfast|lunch|dinner\b/i.test(originalText)) return 'Meal Log Drop';
  if (/\bwater|hydrat/i.test(originalText)) return 'Hydration Check-In';
  if (/\bweight\b/i.test(originalText)) return 'Scale Check-In';
  return 'Daily Metrics Drop';
}

/**
 * @param {string} originalText
 * @returns {string|null}
 */
function titleFromTrainingTopic(originalText) {
  if (/\bdirty cut\b/i.test(originalText)) return 'Dirty Cut Debate';
  if (/\brecomp|recomposition\b/i.test(originalText)) return 'Recomp Roadmap';
  if (/\bcreatinee?\b/i.test(originalText)) return 'Creatine Clarity';
  if (/\bpre[- ]?workout\b/i.test(originalText)) return 'Pre-Workout Playbook';
  if (/\bsleep\b/i.test(originalText)) return 'Sleep Recovery Tactics';
  if (/\bworkout|training|lift|gym\b/i.test(originalText)) return 'Training Tune-Up';
  if (/\bcut(ting)?\b/i.test(originalText)) return 'Cutting Game Plan';
  if (/\bbulk(ing)?\b/i.test(originalText)) return 'Bulking Blueprint';
  return null;
}

/**
 * When the user message is short, borrow a topic word from the coach reply.
 * @param {string} originalText
 * @param {string} assistantText
 * @returns {string|null}
 */
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
  if (/live search wasn'?t available/i.test(titleText)) return true;
  if (/here'?s what i know from coaching/i.test(titleText)) return true;
  if (/not cited web results/i.test(titleText)) return true;
  if (/^as an ai\b/i.test(titleText)) return true;
  if (/i (can|could) help you with/i.test(titleText)) return true;
  if (/\btool_call\b|```|\{"name":/i.test(titleText)) return true;
  if (/^(new chat|chat|untitled)$/i.test(titleText)) return true;
  if (/^(calories|protein|macro|macros|fitness|sleep|recovery|workout|hypertrophy|cutting|bulking|recomp|steps|cardio)\s+chat$/i.test(titleText)) {
    return true;
  }
  return false;
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

  const cleaned = originalText
    .replace(/[^\w\s%-]/g, ' ')
    .replace(/\b(please|pls|hey|hi|hello|ok|okay|so|like|just|really|actually|basically|google|web|search)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TITLE_TOPIC_MAX_LENGTH);
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
  if (userText) {
    if (normalizeTitleKey(titleText) === normalizeTitleKey(userText)) return true;
    if (normalizeTitleKey(titleText) === normalizeTitleKey(deriveChatTitle(userText))) return true;
    if (normalizeTitleKey(titleText) === normalizeTitleKey(userText.slice(0, TITLE_TOPIC_MAX_LENGTH))) return true;
  }

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

  if (/\bashwagandha\b/i.test(lowerText)) return 'Ashwagandha & Sleep Science';
  if (/\bprotein\b/i.test(lowerText)) return 'Protein Playbook';
  if (/\bcalorie|calories|kcal\b/i.test(lowerText)) return 'Calorie Strategy';
  if (/\bmacro/i.test(lowerText)) return 'Macro Math Night';

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
