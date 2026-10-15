// Decides when the coach should search the public web instead of answering from logs.
// Flow: explicit "google it" wins → personal "look up my sleep" stays local →
//       follow-ups about the last answer are not a new search → the wait-plan picks a label.
// Used by the coach conversation screen and sendMessageToCoach.
// Keep in sync with server/lib/coachWebSearch.js.

import { shouldRouteToPerplexity } from './internetLookupRules';
import { shouldIncludeWeeklyContextInCoachPrompt } from '../coach-knowledge/decideWhatCoachShouldKnow';

// ===== NAMED CONSTANTS =====

// Manipulate here: phrases that mean "search the public internet," not the user's own logs.
const EXPLICIT_WEB_PHRASES = [
  'google',
  'go online',
  'on the web',
  'on the internet',
  'search the web',
  'search online',
  'search for',
  'look up online',
  'look this up',
  'find online',
  'browse the',
  'browse for',
  'latest research',
  'latest study',
  'latest studies',
  'recent research',
  'recent study',
  'recent studies',
  'meta-analysis',
  'what does the research say',
  'what do studies say',
  'cite sources',
  'with sources',
  'any sources',
  'got sources',
  'show sources',
  'pull up sources',
  'pull sources',
  'nutrition facts for',
  'calories in a',
  'calories in the',
  'near me',
  'restaurant menu',
  'check the web',
  'check online',
  'check the internet',
  'verify online',
  'verify on the web',
  'double check online',
  'look it up online',
];

const WEB_MODE_OFF = 'off';
const WEB_MODE_ON = 'on';

// Manipulate here: how far back we look for a real assistant reply before treating this as a follow-up.
const RECENT_ASSISTANT_LOOKBACK = 8;
// Manipulate here: shorter assistant bubbles are typing noise, not an answer worth following up on.
const ASSISTANT_REPLY_MIN_CHARS = 30;
// Manipulate here: a long message that also contains a number is treated as a lookup, not coaching chat.
const LONG_LOOKUP_MIN_CHARS = 120;
// Manipulate here: the fitness question left after stripping "go on the web" must be at least this long.
const FITNESS_TOPIC_MIN_CHARS = 12;
const QUOTE_FOLLOW_UP_MAX_CHARS = 160;
const CLARIFY_FOLLOW_UP_MAX_CHARS = 200;
const META_SOURCE_MAX_CHARS = 300;
const SOURCE_LIST_MAX_CHARS = 280;
const SHORT_SOURCE_ASK_MAX_CHARS = 80;
const RESEARCH_FOLLOW_UP_MAX_CHARS = 140;
const RECENT_USER_MESSAGE_COUNT = 6;

const WAIT_PLAN_VISION = 'vision';
const WAIT_PLAN_WEB = 'web';
const WAIT_PLAN_DATA = 'data';
const WAIT_PLAN_THINKING = 'thinking';
const WAIT_PLAN_DRAFTING = 'drafting';

// ===== MAIN FUNCTION =====

/**
 * True when the user clearly asked to search the public internet.
 * @param {string} userText
 * @returns {boolean}
 */
export function hasExplicitWebIntent(userText) {
  const lowerText = String(userText || '').toLowerCase().trim();
  if (!lowerText) return false;
  for (let phraseIndex = 0; phraseIndex < EXPLICIT_WEB_PHRASES.length; phraseIndex += 1) {
    const phrase = EXPLICIT_WEB_PHRASES[phraseIndex];
    if (lowerText.includes(phrase)) return true;
  }
  if (/\b(check|verify|confirm)\b.*\b(the web|online|internet|google)\b/.test(lowerText)) return true;
  if (/\b(the web|online|internet)\b.*\b(check|verify|confirm|search|look)\b/.test(lowerText)) return true;
  if (/\bverify\b.*\b(web|online|internet|research|sources?|studies)\b/.test(lowerText)) return true;
  if (/\b(search|lookup|look up|check)\b/.test(lowerText) && /\b(web|online|internet|google|sources?)\b/.test(lowerText)) {
    return true;
  }
  if (/\blook up\b/.test(lowerText) && /\b(on the web|online|internet|google)\b/.test(lowerText)) return true;
  return false;
}

/**
 * True when they want their own CoachConnect logs, not a public web page.
 * @param {string} userText
 * @returns {boolean}
 */
export function isPersonalDataLookup(userText) {
  const lowerText = String(userText || '').toLowerCase().trim();
  if (!lowerText) return false;
  if (hasExplicitWebIntent(lowerText)) return false;
  return (
    /\blook up\b.*\b(my|log|logs|data|food|nutrition|meal|sleep|slept|water|steps|weight|workout|dashboard|history)\b/.test(
      lowerText,
    ) ||
    /\blook up\b.*\b(my )?calories\b/.test(lowerText) ||
    /\b(check|look at|see|show|pull up)\b.*\b(my )?(sleep|slept|logs|data|history|dashboard|food log|nutrition)\b/.test(
      lowerText,
    ) ||
    /\b(how long|how much)\b.*\b(sleep|slept|water|steps|weight)\b/.test(lowerText) ||
    /\b(how long|how much)\b.*\b(did i|have i)\b.*\b(sleep|slept|water|steps)\b/.test(lowerText) ||
    /\b(sleep|slept)\b.*\b(last night|yesterday|before|this week|recently|ago)\b/.test(lowerText)
  );
}

/**
 * Explicit internet search. Routine coaching ("this week", sleep, streak) stays off the web.
 * A long numbered sentence, or a quoted phrase, also counts.
 * @param {string} userText
 * @returns {boolean}
 */
export function shouldUseWebAuto(userText) {
  const originalText = String(userText || '');
  const lowerText = originalText.toLowerCase();
  if (!lowerText.trim()) return false;

  if (hasExplicitWebIntent(lowerText)) return true;
  if (isPersonalDataLookup(lowerText)) return false;

  if (/\b(look up|lookup|look this up|google)\b/.test(lowerText) && !/\b(my|log|logs|dashboard|history|data)\b/.test(lowerText)) {
    return true;
  }

  const hasNumbers = /\d/.test(lowerText);
  const isLongMessage = lowerText.length >= LONG_LOOKUP_MIN_CHARS;
  // Quoted text is checked on the original so the quote marks are still there.
  // Manipulate here: the 6 is the shortest quoted phrase that counts as a lookup.
  const hasQuotedPhrase = /"[^"]{6,}"/.test(originalText);
  return (isLongMessage && hasNumbers) || hasQuotedPhrase;
}

/**
 * Follow-up about the prior answer or its sources. That is never a fresh web search.
 * @param {string} userText
 * @param {Array|null} [messages]
 * @returns {boolean}
 */
export function isWebAnswerFollowUp(userText, messages = null) {
  if (messageAsksForPublicWeb(userText)) return false;
  if (isWebThreadClarifyFollowUp(userText)) return true;
  if (isWebSourceQuoteFollowUp(userText, messages)) return true;
  if (isMetaSourceFollowUp(userText)) return true;
  if (isSourceListFollowUp(userText, messages)) return true;
  if (hasSubstantiveFitnessTopic(userText)) return false;
  if (!hasRecentAssistantReply(messages)) return false;
  const lowerText = String(userText || '').toLowerCase().trim();
  if (!lowerText || lowerText.length > SOURCE_LIST_MAX_CHARS) return false;
  if (/\bwhat does the research say\b/.test(lowerText) && lowerText.length < RESEARCH_FOLLOW_UP_MAX_CHARS) return true;
  if (/\b(sources?|studies|research)\b/.test(lowerText) && /\b(say|said|show|found|exactly)\b/.test(lowerText)) return true;
  return false;
}

/**
 * True if any recent user text in the thread asks for web verification.
 * Once an assistant reply exists, only the latest user line counts. Otherwise the
 * last few user lines are joined, and that latest line is appended again.
 * @param {Array} messages
 * @param {string} [lastUserMsg]
 * @returns {boolean}
 */
export function messagesRequestWebSearch(messages, lastUserMsg = '') {
  // 1. Latest user line — explicit arg wins, else last bubble in the thread.
  let lastUserText = String(lastUserMsg || '').trim();
  if (!lastUserText) {
    const allUserLines = userMessageTexts(messages);
    lastUserText = allUserLines[allUserLines.length - 1] || '';
  }

  // 2. Quote-the-sources follow-ups are not a fresh search.
  if (isWebAnswerFollowUp(lastUserText, messages)) return false;

  // 3. After a real assistant answer, only the newest user line can trigger web.
  if (hasRecentAssistantReply(messages)) {
    return messageAsksForPublicWeb(lastUserText);
  }

  // 4. Early thread: scan recent user lines plus the joined block.
  const recentUserLines = userMessageTexts(messages).slice(-RECENT_USER_MESSAGE_COUNT);
  if (lastUserText) recentUserLines.push(lastUserText);
  const joinedUserText = recentUserLines.join(' ');
  if (messageAsksForPublicWeb(joinedUserText)) return true;
  for (let lineIndex = 0; lineIndex < recentUserLines.length; lineIndex += 1) {
    if (messageAsksForPublicWeb(recentUserLines[lineIndex])) return true;
  }
  return false;
}

/**
 * Whether this turn should call web search.
 * @param {string} userText
 * @param {'auto'|'on'|'off'} [webMode]
 * @param {Array|null} [messages]
 * @returns {boolean}
 */
export function shouldInvokeWebSearch(userText, webMode = 'auto', messages = null) {
  // 1. Hard off — never call Serper for this turn.
  if (webMode === WEB_MODE_OFF) return false;
  // 2. Hard on — unless this is clearly about the prior answer's sources.
  if (webMode === WEB_MODE_ON) return !isWebAnswerFollowUp(userText, messages);
  // 3. Auto — phrase list + Perplexity keywords on this message only.
  return messageAsksForPublicWeb(userText);
}

/**
 * UI hint: show "Searching the web…". Slightly broader than the server auto-route.
 * @param {string} userText
 * @param {Array|null} [messages]
 * @returns {boolean}
 */
export function shouldShowWebSearchUI(userText, messages = null) {
  if (messageAsksForPublicWeb(userText)) return true;
  if (messages && messagesRequestWebSearch(messages, userText)) return true;
  return false;
}

/**
 * Typing-indicator phase from the user's message (photo, web, logs, or general).
 * @param {string} userText
 * @param {{ hasImageAttachments?: boolean, webMode?: string, messages?: Array|null }} [options]
 * @returns {{ initial: string, followUp: string }}
 */
export function inferCoachWaitPlan(userText, { hasImageAttachments = false, webMode = 'auto', messages = null } = {}) {
  const text = String(userText || '').trim();
  if (hasImageAttachments) return { initial: WAIT_PLAN_VISION, followUp: WAIT_PLAN_DRAFTING };
  const wantsWeb =
    webMode === WEB_MODE_ON ||
    shouldInvokeWebSearch(text, webMode, messages) ||
    (messages && messagesRequestWebSearch(messages, text));
  if (wantsWeb) return { initial: WAIT_PLAN_WEB, followUp: WAIT_PLAN_DRAFTING };
  if (shouldIncludeWeeklyContextInCoachPrompt(text)) return { initial: WAIT_PLAN_DATA, followUp: WAIT_PLAN_DRAFTING };
  return { initial: WAIT_PLAN_THINKING, followUp: WAIT_PLAN_DRAFTING };
}

/**
 * Dedicated /web-search endpoint. Only when the user clearly asks to search the web.
 * @param {string} userText
 * @returns {boolean}
 */
export function shouldForceDedicatedWebSearchRoute(userText) {
  const lowerText = String(userText || '').toLowerCase();
  if (!lowerText.trim()) return false;
  return (
    /\b(search the web|search online|google it|look it up online|browse the web)\b/.test(lowerText) ||
    (/\b(search|google)\b/.test(lowerText) && /\b(web|online|internet)\b/.test(lowerText))
  );
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function messageAsksForPublicWeb(text) {
  if (shouldUseWebAuto(text)) return true;
  if (shouldRouteToPerplexity(text)) return true;
  return false;
}

function userMessageTexts(messages) {
  const messageList = Array.isArray(messages) ? messages : [];
  const userLines = [];
  for (let index = 0; index < messageList.length; index += 1) {
    const message = messageList[index];
    if (!message) continue;
    const isUserBubble = message.role === 'user' || !message.role;
    if (!isUserBubble) continue;
    const lineText = String(message.content || message.text || '').trim();
    if (lineText) userLines.push(lineText);
  }
  return userLines;
}

function hasRecentAssistantReply(messages) {
  const messageList = Array.isArray(messages) ? messages : [];
  const oldestIndex = messageList.length - RECENT_ASSISTANT_LOOKBACK;
  for (let index = messageList.length - 1; index >= 0 && index >= oldestIndex; index -= 1) {
    const message = messageList[index];
    const isAssistant = message?.role === 'assistant' || message?.role === 'ai';
    const replyText = String(message?.content || message?.text || '').trim();
    if (isAssistant && replyText.length > ASSISTANT_REPLY_MIN_CHARS) return true;
  }
  return false;
}

function stripWebMetaInstructions(text) {
  let cleaned = String(text || '').trim();
  if (!cleaned) return '';
  const metaChunks = [
    /\bgo on the web\b/gi,
    /\bgo online\b/gi,
    /\bsearch the web\b/gi,
    /\bsearch online\b/gi,
    /\bon the web\b/gi,
    /\bon the internet\b/gi,
    /\blook (?:it|this) up online\b/gi,
    /\bgoogle (?:it|this|that)\b/gi,
    /\bcheck the web\b/gi,
    /\bcheck online\b/gi,
    /\bverify online\b/gi,
    /\bquote the sources?\b/gi,
    /\bquote (?:from )?(?:the )?(?:sources?|studies|research)\b/gi,
    /\bcite (?:the )?(?:sources?|studies|research)\b/gi,
    /\bwith sources\b/gi,
    /\bwith citations?\b/gi,
    /\bpull up sources?\b/gi,
    /\bshow (?:me )?(?:the )?sources?\b/gi,
    /\band quote .+$/gi,
    /\band cite .+$/gi,
  ];
  for (const pattern of metaChunks) cleaned = cleaned.replace(pattern, ' ');
  return cleaned
    .replace(/^[\s•\-–—*]+/g, '')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\b(and|or|also|please|pls)\s*$/i, '')
    .replace(/^[,\s]+|[,\s.]+$/g, '')
    .trim();
}

function hasSubstantiveFitnessTopic(userText) {
  const cleaned = stripWebMetaInstructions(String(userText || ''));
  if (!cleaned || cleaned.length < FITNESS_TOPIC_MIN_CHARS) return false;
  if (/^(research|sources?|studies|citations?|quotes?|evidence)$/i.test(cleaned)) return false;
  return /\b(workout|gym|training|lift|lifting|exercise|protein|creatine|macro|macros|calorie|calories|sleep|supplement|muscle|cardio|hypertrophy|nutrition|squat|deadlift|bench)\b/i.test(
    cleaned,
  );
}

function isWebSourceQuoteFollowUp(userText, messages = null) {
  const lowerText = String(userText || '').toLowerCase().trim();
  if (!lowerText) return false;
  if (hasSubstantiveFitnessTopic(userText)) return false;
  const wantsQuotes =
    /\b(quote|quotes|quoting|excerpt|verbatim|direct quote|pull a quote|cite|cit(?:e|ing)|snippet|passage)\b/.test(
      lowerText,
    );
  const aboutSources =
    /\b(source|sources|article|articles|study|studies|research|paper|papers|web|link|citation)\b/.test(lowerText);
  const looksLikeQuoteAsk =
    (wantsQuotes && aboutSources) ||
    /\bfrom the sources?\b/.test(lowerText) ||
    /\bquote from\b/.test(lowerText) ||
    /\b(what did|what do)\b.*\b(sources?|studies)\b.*\b(say|state)\b/.test(lowerText);
  if (!looksLikeQuoteAsk) return false;
  if (messages != null && !hasRecentAssistantReply(messages) && lowerText.length < QUOTE_FOLLOW_UP_MAX_CHARS) {
    return false;
  }
  return true;
}

function isWebThreadClarifyFollowUp(userText) {
  const lowerText = String(userText || '').toLowerCase().trim();
  if (!lowerText) return false;
  const referencesPrior =
    /\b(you found|what you found|you said|your answer|your reply|about your answer)\b/.test(lowerText);
  const wantsSpecifics =
    /\b(be more specific|more specific|don't be vague|do not be vague|specifically about)\b/.test(lowerText);
  return referencesPrior || (wantsSpecifics && lowerText.length < CLARIFY_FOLLOW_UP_MAX_CHARS);
}

function isMetaSourceFollowUp(userText) {
  const lowerText = String(userText || '').toLowerCase().trim();
  if (!lowerText || lowerText.length > META_SOURCE_MAX_CHARS) return false;
  const aboutPrior =
    /\b(about that|about this|your answer|you said|what you just|that answer|previous answer)\b/.test(lowerText);
  const asksSources = /\b(sources?|studies|research|links?)\b/.test(lowerText);
  return aboutPrior && asksSources;
}

function isSourceListFollowUp(userText, messages = null) {
  if (!hasRecentAssistantReply(messages)) return false;
  const lowerText = String(userText || '').toLowerCase().trim();
  if (!lowerText || lowerText.length > SOURCE_LIST_MAX_CHARS) return false;
  const aboutSources =
    /\b(sources?|citations?|references?|links?|articles?|search results)\b/.test(lowerText);
  if (!aboutSources) return false;
  return (
    /\b(where are|what are|pull up|give me|show me|list|any sources|your sources)\b/.test(lowerText) ||
    lowerText.length < SHORT_SOURCE_ASK_MAX_CHARS
  );
}
