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

function ignoreUnusedProfile(userProfile) {
  void userProfile;
}

function textOrEmpty(value) {
  if (value == null) {
    return '';
  }
  return String(value);
}

function optionsWithStrippedReply(options, displayText) {
  const heuristicOptions = {};
  const optionKeys = Object.keys(options || {});
  for (let keyIndex = 0; keyIndex < optionKeys.length; keyIndex += 1) {
    const key = optionKeys[keyIndex];
    heuristicOptions[key] = options[key];
  }
  heuristicOptions.assistantReply = displayText;
  return heuristicOptions;
}

function collectPromptCandidates({
  searchedWeb,
  userAsk,
  sectionTitles,
  replyBullets,
  topicText,
}) {
  const promptCandidates = [];
  appendAll(promptCandidates, followUpsFromUserAsk(searchedWeb, userAsk));
  appendAll(promptCandidates, followUpsFromSectionTitles(sectionTitles));
  appendAll(promptCandidates, followUpFromFirstBullet(replyBullets));
  appendAll(promptCandidates, followUpsAskingAboutEvidence(searchedWeb));
  appendAll(promptCandidates, followUpsFromThreadTopics(topicText, searchedWeb));
  appendAll(promptCandidates, CLOSING_FOLLOW_UP_PROMPTS);
  return promptCandidates;
}

function dropGenericProfilePrompts(prompts) {
  const kept = [];
  for (let promptIndex = 0; promptIndex < prompts.length; promptIndex += 1) {
    const prompt = prompts[promptIndex];
    if (isGenericProfilePrompt(prompt)) {
      continue;
    }
    kept.push(prompt);
  }
  return kept;
}

function appendAll(targetList, items) {
  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    targetList.push(items[itemIndex]);
  }
}

function lineLooksLikeFollowUpQuestion(line) {
  const isLongEnough = line.length > FOLLOW_UP_QUESTION_MINIMUM_LENGTH;
  const endsWithQuestionMark = line.endsWith('?');
  return isLongEnough && endsWithQuestionMark;
}

function promptsFromFollowUpBlock(block) {
  const rawLines = textOrEmpty(block).split('\n');
  const prompts = [];
  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex += 1) {
    const cleanedLine = rawLines[lineIndex]
      .replace(LEADING_LIST_MARKER_PATTERN, '')
      .trim();
    if (!lineLooksLikeFollowUpQuestion(cleanedLine)) {
      continue;
    }
    prompts.push(cleanedLine);
  }
  return prompts;
}

function topicTextFromParts(firstPart, secondPart) {
  // One lowercase blob so the topic tests below can stay case-sensitive on the blob.
  const joined = `${firstPart || ''} ${secondPart || ''}`;
  return joined.toLowerCase();
}

function keepFirstUniquePrompts(prompts, maximumCount = MAXIMUM_FOLLOW_UP_PROMPTS) {
  const seenPrompts = new Set();
  const uniquePrompts = [];
  for (let promptIndex = 0; promptIndex < prompts.length; promptIndex += 1) {
    const prompt = textOrEmpty(prompts[promptIndex]).trim();
    if (!prompt) {
      continue;
    }
    if (seenPrompts.has(prompt)) {
      continue;
    }
    seenPrompts.add(prompt);
    uniquePrompts.push(prompt);
    if (uniquePrompts.length >= maximumCount) {
      break;
    }
  }
  return uniquePrompts;
}

function clipPhrase(phrase, maximumLength = CLIP_PHRASE_DEFAULT_LENGTH) {
  let cleaned = textOrEmpty(phrase);
  cleaned = cleaned.replace(/\*\*/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return '';
  }
  if (cleaned.length <= maximumLength) {
    return cleaned;
  }

  const cut = cleaned.slice(0, maximumLength);
  const lastSpaceIndex = cut.lastIndexOf(' ');
  // Don't cut the first word in half. If the last space is very early, keep the hard cut.
  let clipped = cut;
  if (lastSpaceIndex > WORD_BREAK_MINIMUM_INDEX) {
    clipped = cut.slice(0, lastSpaceIndex);
  }
  return `${clipped.trim()}…`;
}

function cleanUserAsk(message) {
  let cleaned = textOrEmpty(message);
  cleaned = cleaned.replace(WEB_SEARCH_PREFIX, '');
  cleaned = cleaned.replace(MENTION_PREFIX, '');
  return cleaned.trim();
}

function isSuggestedFollowUpHeading(title) {
  return SUGGESTED_FOLLOW_UP_HEADING.test(title);
}

function extractReplySections(text) {
  const titles = [];
  const replyText = textOrEmpty(text);
  // Built inside the function on purpose. The g flag remembers lastIndex, so a shared
  // regex would skip headings the next time a reply is prepared.
  // vocab: RegExp.exec with /g = returns next match and advances lastIndex until null
  const headingPattern = /^##\s+(.+?)\s*$/gm;
  let headingMatch = headingPattern.exec(replyText);
  while (headingMatch !== null) {
    const title = headingMatch[1].replace(/\*\*/g, '').trim();
    if (!isSuggestedFollowUpHeading(title)) {
      titles.push(title);
    }
    headingMatch = headingPattern.exec(replyText);
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
  const rawLines = textOrEmpty(text).split('\n');
  const bullets = [];
  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex += 1) {
    let cleanedLine = rawLines[lineIndex].replace(LEADING_LIST_MARKER_PATTERN, '');
    cleanedLine = cleanedLine.replace(/\*\*/g, '').trim();
    if (!isConcreteReplyBullet(cleanedLine)) {
      continue;
    }
    bullets.push(cleanedLine);
    if (bullets.length >= maximumCount) {
      break;
    }
  }
  return bullets;
}

function isGenericProfilePrompt(prompt) {
  return GENERIC_PROFILE_PROMPT_PATTERN.test(textOrEmpty(prompt));
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
    return [
      `What’s the practical takeaway from your answer about ${clipPhrase(userAsk, TAKEAWAY_CLIP_LENGTH)}?`,
    ];
  }
  return [];
}

function followUpsFromSectionTitles(sectionTitles) {
  const prompts = [];
  for (let titleIndex = 0; titleIndex < sectionTitles.length; titleIndex += 1) {
    const title = sectionTitles[titleIndex];
    if (!SECTION_WORTH_EXPANDING.test(title)) {
      continue;
    }
    prompts.push(
      `Can you expand on “${clipPhrase(title, SECTION_TITLE_CLIP_LENGTH)}” from your reply?`,
    );
  }
  return prompts;
}

function followUpFromFirstBullet(replyBullets) {
  const firstBullet = replyBullets[0];
  if (!firstBullet) {
    return [];
  }
  return [
    `You mentioned “${clipPhrase(firstBullet, BULLET_CLIP_LENGTH)}” — can you make that more concrete?`,
  ];
}

function followUpsAskingAboutEvidence(searchedWeb) {
  if (!searchedWeb) {
    return [];
  }
  return [
    'Which finding had the weakest evidence behind it?',
    'Can you rank your key points by how confident you are in them?',
  ];
}

function nutritionTopicPrompts(topicText) {
  if (!NUTRITION_TOPIC.test(topicText)) {
    return [];
  }

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

  // Deficit and surplus are alternatives — only one of these two chips.
  if (DEFICIT_TOPIC.test(topicText)) {
    prompts.push('How would you adjust this advice if I’m in a calorie deficit?');
    return prompts;
  }
  if (SURPLUS_TOPIC.test(topicText)) {
    prompts.push('How would you adjust this advice if I’m trying to gain muscle?');
  }
  return prompts;
}

function supplementTopicPrompts(topicText, searchedWeb) {
  if (!SUPPLEMENT_TOPIC.test(topicText)) {
    return [];
  }
  const prompts = [
    'Is this worth it for my situation, or is there a better option?',
    'What dose and timing would you recommend from what you shared?',
  ];
  if (searchedWeb) {
    prompts.push('Search the web: are there cleaner or better-rated alternatives?');
  }
  return prompts;
}

function appendWorkoutInjuryProgressSleepPrompts(topicPrompts, topicText) {
  if (WORKOUT_TOPIC.test(topicText)) {
    topicPrompts.push(
      'How should I adjust my training based on what you just said?',
      'What would you prioritize if I only have 3 sessions this week?',
    );
  }

  if (INJURY_TOPIC.test(topicText)) {
    topicPrompts.push(
      'Which movements should I modify or avoid based on this?',
      'When should I see a physio vs work around this?',
    );
  }

  if (PROGRESS_TOPIC.test(topicText)) {
    topicPrompts.push(
      'What in my recent logs might explain this?',
      'Walk me through my progress cycle since I joined',
    );
  }

  if (SLEEP_TOPIC.test(topicText)) {
    topicPrompts.push(
      'What sleep habit from your answer should I try first this week?',
      'How does this connect to recovery from my training?',
    );
  }
}

// Single place for “what domain does this thread sound like?” chips — earlier groups in
// buildContextualFollowUps still win when we cap at three.
function followUpsFromThreadTopics(topicText, searchedWeb) {
  const topicPrompts = [];

  appendAll(topicPrompts, nutritionTopicPrompts(topicText));
  appendAll(topicPrompts, supplementTopicPrompts(topicText, searchedWeb));
  appendWorkoutInjuryProgressSleepPrompts(topicPrompts, topicText);

  return topicPrompts;
}

// ===== MAIN FUNCTION =====

/**
 * Pull the model's "## Suggested follow-ups" block out of the reply.
 * Flow: 1. match section  2. parse question lines  3. strip section from display text
 * @param {string} text
 * @returns {{ displayText: string, prompts: string[] }}
 */
export function extractFollowUpSection(text) {
  const rawText = text == null ? '' : String(text);

  // 1. No dedicated follow-up heading → show the whole reply, no model chips.
  const sectionMatch = rawText.match(FOLLOW_UP_SECTION_PATTERN);
  if (!sectionMatch) {
    return { displayText: rawText.trim(), prompts: [] };
  }

  // 2. Lines under that heading that look like real questions become chips.
  const followUpBlock = sectionMatch[1];
  const prompts = promptsFromFollowUpBlock(followUpBlock);

  // 3. Remove the whole ## Suggested follow-ups block from what the bubble shows.
  const displayText = rawText.replace(FOLLOW_UP_SECTION_PATTERN, '').trim();
  return { displayText, prompts };
}

/**
 * Build follow-up chips from this thread when the model didn't write its own.
 * userProfile is accepted so callers can pass their options object through; these
 * prompts stay anchored to the message, not the profile.
 * Flow: 1. clean ask + scan reply  2. stack candidate groups  3. drop generics  4. keep first 3 unique
 * @param {{ userMessage?: string, assistantReply?: string, searchedWeb?: boolean, userProfile?: object|null }} [input]
 * @returns {string[]}
 */
export function buildContextualFollowUps({
  userMessage = '',
  assistantReply = '',
  searchedWeb = false,
  userProfile = null,
} = {}) {
  // Callers may pass userProfile; chips stay message-anchored, so it is unused on purpose.
  ignoreUnusedProfile(userProfile);

  // 1. Clean the ask and scan the reply for titles / bullets / topic words.
  const userAsk = cleanUserAsk(userMessage);
  const replyText = assistantReply == null ? '' : String(assistantReply);
  const topicText = topicTextFromParts(userMessage, assistantReply);
  const sectionTitles = extractReplySections(replyText);
  const replyBullets = extractReplyBullets(replyText);

  // 2. Order is the priority. Earlier groups win when we cap at three.
  const promptCandidates = collectPromptCandidates({
    searchedWeb,
    userAsk,
    sectionTitles,
    replyBullets,
    topicText,
  });

  // 3. Drop vague “based on my logs / goal” chips.
  const withoutGenericProfile = dropGenericProfilePrompts(promptCandidates);

  // 4. Cap and de-dupe for the chip row.
  return keepFirstUniquePrompts(withoutGenericProfile, MAXIMUM_FOLLOW_UP_PROMPTS);
}

/**
 * Text to show, plus up to three follow-up chips.
 * Model chips win when at least two of them are specific. Otherwise the thread heuristics replace them.
 * Flow: 1. strip model section  2. keep model chips if enough  3. else heuristics  4. cap unique
 * @param {string} rawText
 * @param {object} [options] Passed through to buildContextualFollowUps. assistantReply is overwritten with the stripped text.
 * @returns {{ displayText: string, followUpPrompts: string[] }}
 */
export function prepareCoachReplyForDisplay(rawText, options = {}) {
  // 1. Strip any model-authored follow-up section from the visible reply.
  const extracted = extractFollowUpSection(rawText);
  const strippedDisplayText = extracted.displayText;
  const promptsFromModel = extracted.prompts;
  const displayText = strippedDisplayText || textOrEmpty(rawText).trim();

  // 2. Start from model chips when they're specific enough (not generic profile prompts).
  let followUpPrompts = dropGenericProfilePrompts(promptsFromModel);

  // 3. Fall back to thread heuristics when the model gave fewer than two good chips.
  if (followUpPrompts.length < MINIMUM_MODEL_FOLLOW_UPS) {
    const heuristicOptions = optionsWithStrippedReply(options, displayText);
    followUpPrompts = buildContextualFollowUps(heuristicOptions);
  }

  // 4. Cap and de-dupe for the chip row.
  return {
    displayText,
    followUpPrompts: keepFirstUniquePrompts(followUpPrompts, MAXIMUM_FOLLOW_UP_PROMPTS),
  };
}
