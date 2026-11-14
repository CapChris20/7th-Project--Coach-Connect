// Ask the coach API for a short chat title, then fall back to a local title.
// Flow: excerpt first messages → dedicated title route → optional main coach route → local fallback.
// Used by the coach conversation when a chat is saved, and by fixOldChatTitles.

import { auth } from '../../app-start/cloudConnection';
import { getAICoachApiBases } from '../../for-both/online-connection/whereToConnect';
import { buildCreativeTitleLocal, deriveChatTitle, isJunkChatTitle } from './chatTitles';

// ===== NAMED CONSTANTS =====

const DEFAULT_CHAT_TITLE = 'Chat';
const COACH_ROLE_AI = 'ai';
const COACH_ROLE_ASSISTANT = 'assistant';
const USER_ROLE = 'user';

// Manipulate here: how much of the thread the model sees, and how long a title may be.
const EXCERPT_MESSAGE_LIMIT = 4;
const EXCERPT_CHARACTER_LIMIT = 500;
const TITLE_CHARACTER_LIMIT = 56;
const LONG_TITLE_CUTOFF = 40;
const TITLE_MAX_TOKENS = 60;

const DEDICATED_TITLE_PATH = '/api/ai-coach/chat-title';
const MAIN_COACH_PATH = '/api/ai-coach';
const NOT_FOUND_STATUS = 404;

// The model sometimes echoes the "live search" disclaimer as the title. Cut that prefix before we ask.
const LIVE_SEARCH_DISCLAIMER_PREFIX = /^Live search wasn't available this turn[^.]*\.\s*/i;

const TITLE_QUOTE_PATTERN = /^["'`]+|["'`]+$/g;
const TITLE_WHITESPACE_PATTERN = /\s+/g;
// Period, exclamation, or em dash — a title that long is a sentence; keep the first clause.
const TITLE_SENTENCE_BREAK_PATTERN = /[.!—]/;

const TITLE_PROMPT = `Based on this fitness coaching conversation, generate ONE creative, catchy chat title (3-5 words, can include one emoji). Make it feel natural and conversational — like a playlist name, not a status message. Examples: "Sleep Recovery Tactics", "Macro Math Breakdown", "Late Night Gains 🌙", "Recomp Roadmap", "Creatine Clarity".

Never use bland titles like "Calories Chat" or "Fitness Log". Never quote coach disclaimers like "Live search wasn't available".

Reply with ONLY the title text — no quotes, no explanation.`;

// ===== MAIN FUNCTION =====

/**
 * Build a short creative title for a coach chat.
 * @param {Array<{role?: string, content?: string, text?: string}>} messages
 * @param {string} [fallback]
 * @param {string} [userId]
 * @param {{ allowMainCoachFallback?: boolean }} [options]
 * @returns {Promise<string>}
 */
export async function makeChatTitle(
  messages,
  fallback = DEFAULT_CHAT_TITLE,
  userId,
  { allowMainCoachFallback = true } = {},
) {
  // 1. Build a short transcript the model can title. Empty thread → caller fallback.
  const conversationExcerpt = excerptFromMessages(messages);
  if (!conversationExcerpt) return fallback;

  const localFallbackTitle = pickLocalTitleFallback(messages, fallback);

  // 2. Need a Firebase ID token + uid before hitting any coach API.
  const signedInProof = await readSignedInTitleAuth(userId);
  if (!signedInProof) return localFallbackTitle;

  // 3. Dedicated lightweight title endpoint (preferred).
  const dedicatedTitle = await requestTitleFromDedicatedRoute(
    conversationExcerpt,
    signedInProof.idToken,
  );
  if (dedicatedTitle) return dedicatedTitle;

  // 4. Full coach route when allowed (heavier).
  if (allowMainCoachFallback) {
    const mainCoachTitle = await requestTitleFromMainCoach(
      conversationExcerpt,
      signedInProof.idToken,
      signedInProof.uid,
    );
    if (mainCoachTitle) return mainCoachTitle;
  }

  // 5. On-device rules + deriveChatTitle.
  return localFallbackTitle;
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

async function readSignedInTitleAuth(userId) {
  if (!auth) return null;
  if (!auth.currentUser) return null;

  const currentUser = auth.currentUser;
  if (typeof currentUser.getIdToken !== 'function') return null;

  const idToken = await currentUser.getIdToken();
  const uid = userId || currentUser.uid;
  if (!idToken || !uid) return null;
  return { idToken, uid };
}

function isCoachRole(role) {
  if (role === COACH_ROLE_AI) return true;
  if (role === COACH_ROLE_ASSISTANT) return true;
  return false;
}

function coachEndpointUrl(baseUrl, path) {
  const baseWithoutTrailingSlash = String(baseUrl).replace(/\/$/, '');
  return `${baseWithoutTrailingSlash}${path}`;
}

function speakerLabel(role) {
  if (isCoachRole(role)) return 'Coach';
  return 'User';
}

function messageTextForExcerpt(message) {
  if (!message) return '';

  let text = message.content || message.text || '';
  text = String(text).trim();
  text = text.replace(LIVE_SEARCH_DISCLAIMER_PREFIX, '').trim();
  return text;
}

function excerptFromMessages(messages = []) {
  const firstMessages = messages.slice(0, EXCERPT_MESSAGE_LIMIT);
  const lines = [];

  for (let index = 0; index < firstMessages.length; index += 1) {
    const message = firstMessages[index];
    const text = messageTextForExcerpt(message);
    if (!text) continue;
    const roleLabel = speakerLabel(message.role);
    lines.push(`${roleLabel}: ${text}`);
  }

  const joined = lines.join('\n');
  return joined.slice(0, EXCERPT_CHARACTER_LIMIT);
}

function textOfFirstUserMessage(messages) {
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role !== USER_ROLE) continue;
    return message.content || message.text || '';
  }
  return '';
}

function textOfLastCoachMessage(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isCoachRole(message.role)) continue;
    return message.content || message.text || '';
  }
  return '';
}

function cutRunOnSentence(title) {
  const isLongEnough = title.length > LONG_TITLE_CUTOFF;
  const hasSentenceBreak = TITLE_SENTENCE_BREAK_PATTERN.test(title);
  if (!isLongEnough || !hasSentenceBreak) return title;

  const firstClause = title.split(TITLE_SENTENCE_BREAK_PATTERN)[0].trim();
  return firstClause.slice(0, TITLE_CHARACTER_LIMIT);
}

function cleanTitle(rawTitle) {
  let title = String(rawTitle || '');
  title = title.replace(TITLE_QUOTE_PATTERN, '');
  title = title.replace(TITLE_WHITESPACE_PATTERN, ' ');
  title = title.trim();
  title = title.slice(0, TITLE_CHARACTER_LIMIT);

  if (!title) return null;
  if (isJunkChatTitle(title)) return null;

  title = cutRunOnSentence(title);
  if (!title) return null;
  if (isJunkChatTitle(title)) return null;
  return title;
}

async function postJson(url, idToken, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });
  return response;
}

function dedicatedTitlePayload(excerpt) {
  return {
    message: `${TITLE_PROMPT}\n\nConversation:\n${excerpt}`,
    skipTools: true,
    maxTokens: TITLE_MAX_TOKENS,
  };
}

function mainCoachTitlePayload(excerpt, userId) {
  return {
    userId,
    messages: [{ role: USER_ROLE, content: `${TITLE_PROMPT}\n\nConversation:\n${excerpt}` }],
    userProfile: {},
    options: { web: 'off', includePersonalData: false },
  };
}

function rawTitleFromDedicatedData(data) {
  if (!data) return null;
  if (data.title) return data.title;
  if (data.text) return data.text;
  if (data.reply) return data.reply;
  return null;
}

function rawTitleFromMainCoachData(data) {
  if (!data) return null;
  if (data.reply) return data.reply;
  if (data.message) return data.message;
  if (data.title) return data.title;
  return null;
}

async function tryDedicatedTitleOnBase(baseUrl, idToken, payload) {
  try {
    const url = coachEndpointUrl(baseUrl, DEDICATED_TITLE_PATH);
    const response = await postJson(url, idToken, payload);

    // 404 means this host has no dedicated title route — stop trying other bases.
    if (response.status === NOT_FOUND_STATUS) {
      return { shouldStopTryingBases: true, cleanedTitle: null };
    }

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      return { shouldStopTryingBases: false, cleanedTitle: null };
    }

    const rawTitle = rawTitleFromDedicatedData(data);
    return { shouldStopTryingBases: false, cleanedTitle: cleanTitle(rawTitle) };
  } catch (_error) {
    return { shouldStopTryingBases: false, cleanedTitle: null };
  }
}

async function requestTitleFromDedicatedRoute(excerpt, idToken) {
  const payload = dedicatedTitlePayload(excerpt);
  const apiBases = getAICoachApiBases();

  for (let index = 0; index < apiBases.length; index += 1) {
    const baseUrl = apiBases[index];
    const result = await tryDedicatedTitleOnBase(baseUrl, idToken, payload);
    if (result.shouldStopTryingBases) return null;
    if (result.cleanedTitle) return result.cleanedTitle;
  }
  return null;
}

async function tryMainCoachTitleOnBase(baseUrl, idToken, payload) {
  try {
    const url = coachEndpointUrl(baseUrl, MAIN_COACH_PATH);
    const response = await postJson(url, idToken, payload);

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) return null;

    const rawTitle = rawTitleFromMainCoachData(data);
    return cleanTitle(rawTitle);
  } catch (_error) {
    return null;
  }
}

async function requestTitleFromMainCoach(excerpt, idToken, userId) {
  const payload = mainCoachTitlePayload(excerpt, userId);
  const apiBases = getAICoachApiBases();

  for (let index = 0; index < apiBases.length; index += 1) {
    const baseUrl = apiBases[index];
    const title = await tryMainCoachTitleOnBase(baseUrl, idToken, payload);
    if (title) return title;
  }
  return null;
}

function pickLocalTitleFallback(messages, fallback) {
  const firstUserText = textOfFirstUserMessage(messages);
  const lastCoachText = textOfLastCoachMessage(messages);
  const creativeLocal = buildCreativeTitleLocal(firstUserText, lastCoachText);
  if (creativeLocal) return creativeLocal;
  if (fallback) return fallback;
  return deriveChatTitle(firstUserText);
}
