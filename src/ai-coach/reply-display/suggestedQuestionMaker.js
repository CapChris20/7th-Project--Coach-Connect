// Follow-up question chips shown under a coach reply.
// Flow: pull a "## Suggested follow-ups" section if the model wrote one →
// otherwise build up to three questions from this thread → drop generic profile prompts.
// Used by the coach conversation after each reply.

// ===== NAMED CONSTANTS =====

const FOLLOW_UP_SECTION_PATTERN =
  /##\s*Suggested follow-ups?\s*\n([\s\S]*?)(?=\n##\s+|$)/i;

const LEADING_LIST_MARKER_PATTERN = /^[-*•\d.)]+\s*/;
const SUGGESTED_FOLLOW_UP_HEADING = /suggested follow-up/i;
const GENERIC_PROFILE_PROMPT_PATTERN =
  /what i have been logging|my meals this week|based on my goal|based on my logs|fit my goal/i;

const SECTION_WORTH_EXPANDING =
  /key finding|what it is|practical|what this means|next step|evidence|research/i;
const NUTRITION_TOPIC = /protein|macro|carb|fat|calorie|nutrition|meal|deficit|surplus/;
const PROTEIN_TOPIC = /protein/;
const CARB_TOPIC = /carb/;
const FAT_TOPIC = /fat/;
const DEFICIT_TOPIC = /deficit|cut|fat loss|lose weight/;
const SURPLUS_TOPIC = /surplus|bulk|gain/;
const SUPPLEMENT_TOPIC = /supplement|creatine|vitamin|fiber|ashwagandha|omega/;
const WORKOUT_TOPIC = /workout|hypertrophy|strength|volume|program|split|lift|train/;
const INJURY_TOPIC = /injury|pain|shoulder|knee|back|mobility/;
const PROGRESS_TOPIC = /progress|plateau|stalled|journey|since i started|cycle/;
const SLEEP_TOPIC = /sleep|insomnia|rest|recovery/;

// Manipulate here: chip row length, and how long a line has to be before it counts as a question.
const MAXIMUM_FOLLOW_UP_PROMPTS = 3;
const MINIMUM_MODEL_FOLLOW_UPS = 2;
const FOLLOW_UP_QUESTION_MINIMUM_LENGTH = 8;
const DEFAULT_REPLY_BULLET_COUNT = 4;
const SHORTEST_REPLY_BULLET_LENGTH = 14;
const LONGEST_REPLY_BULLET_LENGTH = 140;

const CLIP_PHRASE_DEFAULT_LENGTH = 72;
const WORD_BREAK_MINIMUM_INDEX = 20;
const SOURCE_TOPIC_CLIP_LENGTH = 52;
const DEEPER_QUESTION_CLIP_LENGTH = 64;
const TAKEAWAY_CLIP_LENGTH = 48;
const SECTION_TITLE_CLIP_LENGTH = 44;
const BULLET_CLIP_LENGTH = 56;

const MINIMUM_ASK_LENGTH_FOR_SOURCES = 6;
const MINIMUM_ASK_LENGTH_FOR_DEEPER = 12;
const MINIMUM_ASK_LENGTH_FOR_TAKEAWAY = 10;

const WEB_SEARCH_PREFIX = /^search the web:\s*/i;
const MENTION_PREFIX = /^@\w+\s*/;

// Always offered last, so they fill whatever slots the topic prompts didn't take.
const CLOSING_FOLLOW_UP_PROMPTS = [
  'Can you boil that down to 3 concrete actions?',
  'What part of that answer matters most if I only remember one thing?',
  'Can you simplify that in plain language?',
];

// ===== HELPER FUNCTIONS =====

function isFollowUpQuestion(line) {
  return line.length > FOLLOW_UP_QUESTION_MINIMUM_LENGTH && line.endsWith('?');
}

function promptsFromFollowUpBlock(block) {
  return String(block || '')
    .split('\n')
    .map((line) => line.replace(LEADING_LIST_MARKER_PATTERN, '').trim())
    .filter(isFollowUpQuestion);
}

function topicTextFromParts(...parts) {
  // One lowercase blob so the topic tests below can stay case-sensitive.
  return parts.join(' ').toLowerCase();
}

function pickUnique(prompts, maximumCount = MAXIMUM_FOLLOW_UP_PROMPTS) {
  const seenPrompts = new Set();
  const uniquePrompts = [];
  for (const item of prompts) {
    const prompt = String(item || '').trim();
    if (!prompt || seenPrompts.has(prompt)) continue;
    seenPrompts.add(prompt);
    uniquePrompts.push(prompt);
    if (uniquePrompts.length >= maximumCount) break;
  }
  return uniquePrompts;
}

function clipPhrase(phrase, maximumLength = CLIP_PHRASE_DEFAULT_LENGTH) {
  const cleaned = String(phrase || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length <= maximumLength) return cleaned;
  const cut = cleaned.slice(0, maximumLength);
  const lastSpaceIndex = cut.lastIndexOf(' ');
  // Don't cut the first word in half. If the last space is very early, keep the hard cut.
  const clipped = lastSpaceIndex > WORD_BREAK_MINIMUM_INDEX ? cut.slice(0, lastSpaceIndex) : cut;
  return `${clipped.trim()}…`;
}

function cleanUserAsk(message) {
  return String(message || '')
    .replace(WEB_SEARCH_PREFIX, '')
    .replace(MENTION_PREFIX, '')
    .trim();
}

function isSuggestedFollowUpHeading(title) {
  return SUGGESTED_FOLLOW_UP_HEADING.test(title);
}

function extractReplySections(text) {
  const titles = [];
  // Built inside the function on purpose. The g flag remembers lastIndex, so a shared
  // regex would skip headings the next time a reply is prepared.
  const headingPattern = /^##\s+(.+?)\s*$/gm;
  let headingMatch;
  while ((headingMatch = headingPattern.exec(String(text || ''))) !== null) {
    const title = headingMatch[1].replace(/\*\*/g, '').trim();
    if (!isSuggestedFollowUpHeading(title)) titles.push(title);
  }
  return titles;
}

function isConcreteReplyBullet(line) {
  const isLongEnough = line.length > SHORTEST_REPLY_BULLET_LENGTH;
  const isShortEnough = line.length < LONGEST_REPLY_BULLET_LENGTH;
  const isNotHeading = !line.startsWith('#');
  return isLongEnough && isShortEnough && isNotHeading;
}

function extractReplyBullets(text, maximumCount = DEFAULT_REPLY_BULLET_COUNT) {
  return String(text || '')
    .split('\n')
    .map((line) => line.replace(LEADING_LIST_MARKER_PATTERN, '').replace(/\*\*/g, '').trim())
    .filter(isConcreteReplyBullet)
    .slice(0, maximumCount);
}

function isGenericProfilePrompt(prompt) {
  return GENERIC_PROFILE_PROMPT_PATTERN.test(String(prompt || ''));
}

// Web-search threads ask about sources. A question asks to go deeper. A statement asks for the takeaway.
// Only one of these three runs — they're alternatives, not a pile of extra chips.
function followUpsFromUserAsk(searchedWeb, userAsk) {
  if (searchedWeb && userAsk.length >= MINIMUM_ASK_LENGTH_FOR_SOURCES) {
    const topic = clipPhrase(userAsk, SOURCE_TOPIC_CLIP_LENGTH);
    return [
      `Which of your sources had the strongest take on ${topic}?`,
      `Where do those sources disagree on ${topic}?`,
    ];
  }
  if (userAsk.endsWith('?') && userAsk.length >= MINIMUM_ASK_LENGTH_FOR_DEEPER) {
    return [`Go deeper on your answer to: ${clipPhrase(userAsk, DEEPER_QUESTION_CLIP_LENGTH)}`];
  }
  if (userAsk.length >= MINIMUM_ASK_LENGTH_FOR_TAKEAWAY) {
    return [`What’s the practical takeaway from your answer about ${clipPhrase(userAsk, TAKEAWAY_CLIP_LENGTH)}?`];
  }
  return [];
}

function followUpsFromSectionTitles(sectionTitles) {
  const prompts = [];
  for (const title of sectionTitles) {
    if (SECTION_WORTH_EXPANDING.test(title)) {
      prompts.push(`Can you expand on “${clipPhrase(title, SECTION_TITLE_CLIP_LENGTH)}” from your reply?`);
    }
  }
  return prompts;
}

function followUpFromFirstBullet(replyBullets) {
  if (!replyBullets[0]) return [];
  return [`You mentioned “${clipPhrase(replyBullets[0], BULLET_CLIP_LENGTH)}” — can you make that more concrete?`];
}

function followUpsAskingAboutEvidence(searchedWeb) {
  if (!searchedWeb) return [];
  return [
    'Which finding had the weakest evidence behind it?',
    'Can you rank your key points by how confident you are in them?',
  ];
}

function followUpsFromNutritionTopic(topicText) {
  if (!NUTRITION_TOPIC.test(topicText)) return [];
  const prompts = [];
  if (PROTEIN_TOPIC.test(topicText)) {
    prompts.push('What protein target would you use based on what you just explained?');
  }
  if (CARB_TOPIC.test(topicText)) {
    prompts.push('When should I time carbs around training based on this reply?');
  }
  if (FAT_TOPIC.test(topicText)) {
    prompts.push('How should I set dietary fat given what you recommended?');
  }
  if (DEFICIT_TOPIC.test(topicText)) {
    prompts.push('How would you adjust this advice if I’m in a calorie deficit?');
  } else if (SURPLUS_TOPIC.test(topicText)) {
    prompts.push('How would you adjust this advice if I’m trying to gain muscle?');
  }
  return prompts;
}

function followUpsFromSupplementTopic(topicText, searchedWeb) {
  if (!SUPPLEMENT_TOPIC.test(topicText)) return [];
  const prompts = [
    'Is this worth it for my situation, or is there a better option?',
    'What dose and timing would you recommend from what you shared?',
  ];
  if (searchedWeb) prompts.push('Search the web: are there cleaner or better-rated alternatives?');
  return prompts;
}

function followUpsFromWorkoutTopic(topicText) {
  if (!WORKOUT_TOPIC.test(topicText)) return [];
  return [
    'How should I adjust my training based on what you just said?',
    'What would you prioritize if I only have 3 sessions this week?',
  ];
}

function followUpsFromInjuryTopic(topicText) {
  if (!INJURY_TOPIC.test(topicText)) return [];
  return [
    'Which movements should I modify or avoid based on this?',
    'When should I see a physio vs work around this?',
  ];
}

function followUpsFromProgressTopic(topicText) {
  if (!PROGRESS_TOPIC.test(topicText)) return [];
  return [
    'What in my recent logs might explain this?',
    'Walk me through my progress cycle since I joined',
  ];
}

function followUpsFromSleepTopic(topicText) {
  if (!SLEEP_TOPIC.test(topicText)) return [];
  return [
    'What sleep habit from your answer should I try first this week?',
    'How does this connect to recovery from my training?',
  ];
}

// ===== MAIN FUNCTION =====

/**
 * Pull the model's "## Suggested follow-ups" block out of the reply.
 * @param {string} text
 * @returns {{ displayText: string, prompts: string[] }}
 */
export function extractFollowUpSection(text) {
  const rawText = String(text || '');
  const sectionMatch = rawText.match(FOLLOW_UP_SECTION_PATTERN);
  if (!sectionMatch) return { displayText: rawText.trim(), prompts: [] };

  const prompts = promptsFromFollowUpBlock(sectionMatch[1]);
  const displayText = rawText.replace(FOLLOW_UP_SECTION_PATTERN, '').trim();
  return { displayText, prompts };
}

/**
 * Build follow-up chips from this thread when the model didn't write its own.
 * userProfile is accepted so callers can pass their options object through; these
 * prompts stay anchored to the message, not the profile.
 * @param {{ userMessage?: string, assistantReply?: string, searchedWeb?: boolean, userProfile?: object|null }} [input]
 * @returns {string[]}
 */
export function buildContextualFollowUps({
  userMessage = '',
  assistantReply = '',
  searchedWeb = false,
  userProfile = null,
} = {}) {
  const userAsk = cleanUserAsk(userMessage);
  const replyText = String(assistantReply || '');
  const topicText = topicTextFromParts(userMessage, assistantReply);
  const sectionTitles = extractReplySections(replyText);
  const replyBullets = extractReplyBullets(replyText);

  // Order is the priority. pickUnique keeps the first three, so earlier groups win.
  const prompts = [
    ...followUpsFromUserAsk(searchedWeb, userAsk),
    ...followUpsFromSectionTitles(sectionTitles),
    ...followUpFromFirstBullet(replyBullets),
    ...followUpsAskingAboutEvidence(searchedWeb),
    ...followUpsFromNutritionTopic(topicText),
    ...followUpsFromSupplementTopic(topicText, searchedWeb),
    ...followUpsFromWorkoutTopic(topicText),
    ...followUpsFromInjuryTopic(topicText),
    ...followUpsFromProgressTopic(topicText),
    ...followUpsFromSleepTopic(topicText),
    ...CLOSING_FOLLOW_UP_PROMPTS,
  ];

  return pickUnique(
    prompts.filter((prompt) => !isGenericProfilePrompt(prompt)),
    MAXIMUM_FOLLOW_UP_PROMPTS,
  );
}

/**
 * Text to show, plus up to three follow-up chips.
 * Model chips win when at least two of them are specific. Otherwise the thread heuristics replace them.
 * @param {string} rawText
 * @param {object} [options] Passed through to buildContextualFollowUps. assistantReply is overwritten with the stripped text.
 * @returns {{ displayText: string, followUpPrompts: string[] }}
 */
export function prepareCoachReplyForDisplay(rawText, options = {}) {
  const { displayText: strippedDisplayText, prompts: promptsFromModel } = extractFollowUpSection(rawText);
  const displayText = strippedDisplayText || String(rawText || '').trim();
  let followUpPrompts = promptsFromModel.filter((prompt) => !isGenericProfilePrompt(prompt));

  if (followUpPrompts.length < MINIMUM_MODEL_FOLLOW_UPS) {
    followUpPrompts = buildContextualFollowUps({
      ...options,
      assistantReply: displayText,
    });
  }

  return {
    displayText,
    followUpPrompts: pickUnique(followUpPrompts, MAXIMUM_FOLLOW_UP_PROMPTS),
  };
}
