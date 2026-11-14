// Decides when the coach should search the public web instead of answering from logs alone.
// Flow: explicit "google it" wins → personal "look up my sleep" stays local →
//       follow-ups about the last answer are not a new search → the wait-plan picks a label.
// Used by the coach conversation screen and sendMessageToCoach.
// Keep in sync with server/lib/coachWebSearch.js.
// Read order: constants → exported gates → PLUMBING at the bottom.

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
// Manipulate here: shortest quoted phrase that counts as a public lookup (characters inside the quotes).
const QUOTED_LOOKUP_MIN_CHARS = 6;

const WAIT_PLAN_VISION = 'vision';
const WAIT_PLAN_WEB = 'web';
const WAIT_PLAN_DATA = 'data';
const WAIT_PLAN_THINKING = 'thinking';
const WAIT_PLAN_DRAFTING = 'drafting';

const ROLE_USER = 'user';
const ROLE_ASSISTANT = 'assistant';
const ROLE_AI = 'ai';

// ===== MAIN FUNCTION =====
// Exported gates read top-to-bottom like a checklist — regex detail lives in PLUMBING.

/**
 * True when the user clearly asked to search the public internet.
 * @param {string} userText
 * @returns {boolean}
 */
export function hasExplicitWebIntent(userText) {
  // 1. Normalize — empty drafts never count as an internet ask.
  const lowerText = lowerCaseTrimmedText(userText);
  if (!lowerText) return false;

  // 2. Hard phrase list (google, near me, cite sources, …).
  if (lowerTextMatchesExplicitWebPhrase(lowerText)) return true;

  // 3. Regex combos like "check … online" or "look up … on the web".
  return lowerTextMatchesExplicitWebRegex(lowerText);
}

/**
 * True when they want their own CoachConnect logs, not a public web page.
 * @param {string} userText
 * @returns {boolean}
 */
export function isPersonalDataLookup(userText) {
  // 1. Normalize — blank text is not a personal lookup.
  const lowerText = lowerCaseTrimmedText(userText);
  if (!lowerText) return false;

  // 2. Explicit public-web phrasing wins over personal-log detection.
  if (hasExplicitWebIntent(lowerText)) return false;

  // 3. "Log my sleep" is a dashboard write — keep it OFF the public web.
  if (messageIsExplicitPersonalLogWrite(lowerText)) return true;

  // 4. "Look up my sleep / check my logs" reads account data, not Serper.
  return messageAsksToReadPersonalLogs(lowerText);
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

  // 1. Blank drafts never auto-route to the web.
  if (!lowerText.trim()) return false;

  // 2. Hard phrases and regex combos win first.
  if (hasExplicitWebIntent(lowerText)) return true;

  // 3. Personal log reads never auto-route to Serper.
  if (isPersonalDataLookup(lowerText)) return false;

  // 4. Generic "look up" without "my/logs" still counts as public web.
  if (messageIsGenericPublicLookUp(lowerText)) return true;

  // 5. Long + numbered, or a quoted phrase, also counts as a lookup.
  return messageLooksLikeLongNumberedOrQuotedLookup(originalText, lowerText);
}

/**
 * Follow-up about the prior answer or its sources. That is never a fresh web search.
 * @param {string} userText
 * @param {Array|null} [messages]
 * @returns {boolean}
 */
export function isWebAnswerFollowUp(userText, messages = null) {
  // 1. A brand-new public-web ask is not a follow-up.
  if (messageAsksForPublicWeb(userText)) return false;

  // 2. Short clarifications / quote-the-sources asks stay on-thread.
  if (isWebThreadClarifyFollowUp(userText)) return true;
  if (isWebSourceQuoteFollowUp(userText, messages)) return true;
  if (isMetaSourceFollowUp(userText)) return true;
  if (isSourceListFollowUp(userText, messages)) return true;

  // 3. A real fitness question after stripping meta phrases needs a new answer.
  if (hasSubstantiveFitnessTopic(userText)) return false;

  // 4. Without a recent assistant reply there is nothing to follow up on.
  if (!hasRecentAssistantReply(messages)) return false;

  // 5. Short "what does the research say" / "sources said …" about the last answer.
  return lowerTextLooksLikeResearchFollowUp(userText);
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
  const lastUserText = resolveLatestUserText(messages, lastUserMsg);

  // 2. Quote-the-sources follow-ups are not a fresh search.
  if (isWebAnswerFollowUp(lastUserText, messages)) return false;

  // 3. After a real assistant answer, only the newest user line can trigger web.
  if (hasRecentAssistantReply(messages)) {
    return messageAsksForPublicWeb(lastUserText);
  }

  // 4. Early thread: scan recent user lines plus the joined block.
  return recentUserLinesAskForPublicWeb(messages, lastUserText);
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
  if (webMode === WEB_MODE_ON) {
    const isFollowUpAboutPriorSources = isWebAnswerFollowUp(userText, messages);
    return !isFollowUpAboutPriorSources;
  }

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
  // 1. This message alone asks for public web.
  if (messageAsksForPublicWeb(userText)) return true;

  // 2. Or the recent thread already asked to verify online.
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
  const trimmedUserText = String(userText || '').trim();

  // 1. Photos → vision first, then drafting.
  if (hasImageAttachments) {
    return { initial: WAIT_PLAN_VISION, followUp: WAIT_PLAN_DRAFTING };
  }

  // 2. Web mode on, or this message / thread wants the public web.
  const turnWantsPublicWeb = turnShouldShowWebWait(trimmedUserText, webMode, messages);
  if (turnWantsPublicWeb) {
    return { initial: WAIT_PLAN_WEB, followUp: WAIT_PLAN_DRAFTING };
  }

  // 3. Personal weekly / log context → data wait, then drafting.
  if (shouldIncludeWeeklyContextInCoachPrompt(trimmedUserText)) {
    return { initial: WAIT_PLAN_DATA, followUp: WAIT_PLAN_DRAFTING };
  }

  // 4. Default coaching think → draft.
  return { initial: WAIT_PLAN_THINKING, followUp: WAIT_PLAN_DRAFTING };
}

/**
 * Dedicated /web-search endpoint. Only when the user clearly asks to search the web.
 * @param {string} userText
 * @returns {boolean}
 */
export function shouldForceDedicatedWebSearchRoute(userText) {
  // 1. Normalize — blank drafts never force the dedicated /web-search route.
  const lowerText = lowerCaseTrimmedText(userText);
  if (!lowerText) return false;

  // 2. Hard search/google + web phrases only.
  return lowerTextForcesDedicatedWebRoute(lowerText);
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function lowerCaseTrimmedText(userText) {
  // vocab: String(x || '') avoids throws when the draft is undefined.
  return String(userText || '').toLowerCase().trim();
}

function messageAsksForPublicWeb(text) {
  const wantsAutoWeb = shouldUseWebAuto(text);
  if (wantsAutoWeb) return true;

  const wantsPerplexityRoute = shouldRouteToPerplexity(text);
  if (wantsPerplexityRoute) return true;

  return false;
}

function userMessageTexts(messages) {
  const messageList = Array.isArray(messages) ? messages : [];
  const userLines = [];

  for (let index = 0; index < messageList.length; index += 1) {
    const message = messageList[index];
    if (!message) continue;

    const isUserBubble = message.role === ROLE_USER || !message.role;
    if (!isUserBubble) continue;

    const lineText = String(message.content || message.text || '').trim();
    if (lineText) userLines.push(lineText);
  }

  return userLines;
}

function resolveLatestUserText(messages, lastUserMsg) {
  const explicitLastLine = String(lastUserMsg || '').trim();
  if (explicitLastLine) return explicitLastLine;

  const allUserLines = userMessageTexts(messages);
  return allUserLines[allUserLines.length - 1] || '';
}

function recentUserLinesAskForPublicWeb(messages, lastUserText) {
  const recentUserLines = userMessageTexts(messages).slice(-RECENT_USER_MESSAGE_COUNT);
  if (lastUserText) recentUserLines.push(lastUserText);

  const joinedUserText = recentUserLines.join(' ');
  if (messageAsksForPublicWeb(joinedUserText)) return true;

  for (let lineIndex = 0; lineIndex < recentUserLines.length; lineIndex += 1) {
    if (messageAsksForPublicWeb(recentUserLines[lineIndex])) return true;
  }
  return false;
}

function turnShouldShowWebWait(trimmedUserText, webMode, messages) {
  if (webMode === WEB_MODE_ON) return true;

  const thisMessageWantsWeb = shouldInvokeWebSearch(trimmedUserText, webMode, messages);
  if (thisMessageWantsWeb) return true;

  if (!messages) return false;
  return messagesRequestWebSearch(messages, trimmedUserText);
}

function hasRecentAssistantReply(messages) {
  const messageList = Array.isArray(messages) ? messages : [];
  const oldestIndex = messageList.length - RECENT_ASSISTANT_LOOKBACK;

  for (let index = messageList.length - 1; index >= 0 && index >= oldestIndex; index -= 1) {
    const message = messageList[index];
    if (!message) continue;

    const messageRole = message.role;
    const isAssistant = messageRole === ROLE_ASSISTANT || messageRole === ROLE_AI;
    const replyText = String(message.content || message.text || '').trim();
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

  for (let patternIndex = 0; patternIndex < metaChunks.length; patternIndex += 1) {
    cleaned = cleaned.replace(metaChunks[patternIndex], ' ');
  }

  return tidyStrippedWebMetaText(cleaned);
}

function tidyStrippedWebMetaText(cleaned) {
  let tidy = cleaned;
  tidy = tidy.replace(/^[\s•\-–—*]+/g, '');
  tidy = tidy.replace(/[^\S\n]{2,}/g, ' ');
  tidy = tidy.replace(/\s+([,.!?])/g, '$1');
  tidy = tidy.replace(/\b(and|or|also|please|pls)\s*$/i, '');
  tidy = tidy.replace(/^[,\s]+|[,\s.]+$/g, '');
  return tidy.trim();
}

function hasSubstantiveFitnessTopic(userText) {
  const cleaned = stripWebMetaInstructions(String(userText || ''));
  if (!cleaned || cleaned.length < FITNESS_TOPIC_MIN_CHARS) return false;

  const isOnlyMetaWord = /^(research|sources?|studies|citations?|quotes?|evidence)$/i.test(cleaned);
  if (isOnlyMetaWord) return false;

  // vocab: \b = word boundary so "lift" does not match inside unrelated words.
  return /\b(workout|gym|training|lift|lifting|exercise|protein|creatine|macro|macros|calorie|calories|sleep|supplement|muscle|cardio|hypertrophy|nutrition|squat|deadlift|bench)\b/i.test(
    cleaned,
  );
}

function isWebSourceQuoteFollowUp(userText, messages = null) {
  const lowerText = lowerCaseTrimmedText(userText);
  if (!lowerText) return false;
  if (hasSubstantiveFitnessTopic(userText)) return false;
  if (!looksLikeQuoteFromSourcesAsk(lowerText)) return false;

  if (messages == null) return true;
  if (hasRecentAssistantReply(messages)) return true;
  if (lowerText.length >= QUOTE_FOLLOW_UP_MAX_CHARS) return true;
  return false;
}

function looksLikeQuoteFromSourcesAsk(lowerText) {
  const wantsQuotes = /\b(quote|quotes|quoting|excerpt|verbatim|direct quote|pull a quote|cite|cit(?:e|ing)|snippet|passage)\b/.test(
    lowerText,
  );
  const aboutSources = /\b(source|sources|article|articles|study|studies|research|paper|papers|web|link|citation)\b/.test(
    lowerText,
  );

  if (wantsQuotes && aboutSources) return true;
  if (/\bfrom the sources?\b/.test(lowerText)) return true;
  if (/\bquote from\b/.test(lowerText)) return true;
  if (/\b(what did|what do)\b.*\b(sources?|studies)\b.*\b(say|state)\b/.test(lowerText)) return true;
  return false;
}

function isWebThreadClarifyFollowUp(userText) {
  const lowerText = lowerCaseTrimmedText(userText);
  if (!lowerText) return false;

  const referencesPrior =
    /\b(you found|what you found|you said|your answer|your reply|about your answer)\b/.test(lowerText);
  if (referencesPrior) return true;

  const wantsSpecifics =
    /\b(be more specific|more specific|don't be vague|do not be vague|specifically about)\b/.test(lowerText);
  if (wantsSpecifics && lowerText.length < CLARIFY_FOLLOW_UP_MAX_CHARS) return true;

  return false;
}

function isMetaSourceFollowUp(userText) {
  const lowerText = lowerCaseTrimmedText(userText);
  if (!lowerText || lowerText.length > META_SOURCE_MAX_CHARS) return false;

  const aboutPrior =
    /\b(about that|about this|your answer|you said|what you just|that answer|previous answer)\b/.test(lowerText);
  const asksSources = /\b(sources?|studies|research|links?)\b/.test(lowerText);
  return aboutPrior && asksSources;
}

function isSourceListFollowUp(userText, messages = null) {
  if (!hasRecentAssistantReply(messages)) return false;

  const lowerText = lowerCaseTrimmedText(userText);
  if (!lowerText) return false;
  if (lowerText.length > SOURCE_LIST_MAX_CHARS) return false;

  const aboutSources = /\b(sources?|citations?|references?|links?|articles?|search results)\b/.test(lowerText);
  if (!aboutSources) return false;

  const asksToListSources = /\b(where are|what are|pull up|give me|show me|list|any sources|your sources)\b/.test(
    lowerText,
  );
  if (asksToListSources) return true;
  if (lowerText.length < SHORT_SOURCE_ASK_MAX_CHARS) return true;
  return false;
}

function lowerTextLooksLikeResearchFollowUp(userText) {
  const lowerText = lowerCaseTrimmedText(userText);
  if (!lowerText) return false;
  if (lowerText.length > SOURCE_LIST_MAX_CHARS) return false;

  const asksWhatResearchSays = /\bwhat does the research say\b/.test(lowerText);
  if (asksWhatResearchSays && lowerText.length < RESEARCH_FOLLOW_UP_MAX_CHARS) return true;

  const mentionsSources = /\b(sources?|studies|research)\b/.test(lowerText);
  if (!mentionsSources) return false;

  const mentionsWhatTheySaid = /\b(say|said|show|found|exactly)\b/.test(lowerText);
  return mentionsWhatTheySaid;
}

function lowerTextMatchesExplicitWebPhrase(lowerText) {
  for (let phraseIndex = 0; phraseIndex < EXPLICIT_WEB_PHRASES.length; phraseIndex += 1) {
    const phrase = EXPLICIT_WEB_PHRASES[phraseIndex];
    if (lowerText.includes(phrase)) return true;
  }
  return false;
}

function lowerTextMatchesExplicitWebRegex(lowerText) {
  if (/\b(check|verify|confirm)\b.*\b(the web|online|internet|google)\b/.test(lowerText)) return true;
  if (/\b(the web|online|internet)\b.*\b(check|verify|confirm|search|look)\b/.test(lowerText)) return true;
  if (/\bverify\b.*\b(web|online|internet|research|sources?|studies)\b/.test(lowerText)) return true;

  const hasSearchVerb = /\b(search|lookup|look up|check)\b/.test(lowerText);
  const hasWebNoun = /\b(web|online|internet|google|sources?)\b/.test(lowerText);
  if (hasSearchVerb && hasWebNoun) return true;

  if (/\blook up\b/.test(lowerText) && /\b(on the web|online|internet|google)\b/.test(lowerText)) return true;
  return false;
}

function messageIsExplicitPersonalLogWrite(lowerText) {
  const hasLogVerb = /\b(log|track|record|add|save|enter|put|mark)\b/i.test(lowerText);
  const hasPersonalMetric =
    /\b(sleep|slept|water|steps|energy|mood|food|meal|nutrition|workout|rest)\b/i.test(lowerText);
  return hasLogVerb && hasPersonalMetric;
}

function messageAsksToReadPersonalLogs(lowerText) {
  if (/\blook up\b.*\b(my|log|logs|data|food|nutrition|meal|sleep|slept|water|steps|weight|workout|dashboard|history)\b/.test(lowerText)) {
    return true;
  }
  if (/\blook up\b.*\b(my )?calories\b/.test(lowerText)) return true;
  if (/\b(check|look at|see|show|pull up)\b.*\b(my )?(sleep|slept|logs|data|history|dashboard|food log|nutrition)\b/.test(lowerText)) {
    return true;
  }
  if (/\b(how long|how much)\b.*\b(sleep|slept|water|steps|weight)\b/.test(lowerText)) return true;
  if (/\b(how long|how much)\b.*\b(did i|have i)\b.*\b(sleep|slept|water|steps)\b/.test(lowerText)) return true;
  if (/\b(sleep|slept)\b.*\b(last night|yesterday|before|this week|recently|ago)\b/.test(lowerText)) return true;
  return false;
}

function messageIsGenericPublicLookUp(lowerText) {
  const hasLookUpVerb = /\b(look up|lookup|look this up|google)\b/.test(lowerText);
  const mentionsPersonalScope = /\b(my|log|logs|dashboard|history|data)\b/.test(lowerText);
  return hasLookUpVerb && !mentionsPersonalScope;
}

function messageLooksLikeLongNumberedOrQuotedLookup(originalText, lowerText) {
  const hasNumbers = /\d/.test(lowerText);
  const isLongMessage = lowerText.length >= LONG_LOOKUP_MIN_CHARS;
  if (isLongMessage && hasNumbers) return true;

  // Quoted text is checked on the original so the quote marks are still there.
  const quotedPattern = new RegExp(`"[^"]{${QUOTED_LOOKUP_MIN_CHARS},}"`);
  const hasQuotedPhrase = quotedPattern.test(originalText);
  return hasQuotedPhrase;
}

function lowerTextForcesDedicatedWebRoute(lowerText) {
  if (/\b(search the web|search online|google it|look it up online|browse the web)\b/.test(lowerText)) {
    return true;
  }
  const hasSearchOrGoogle = /\b(search|google)\b/.test(lowerText);
  if (!hasSearchOrGoogle) return false;

  const hasWebNoun = /\b(web|online|internet)\b/.test(lowerText);
  return hasWebNoun;
}
