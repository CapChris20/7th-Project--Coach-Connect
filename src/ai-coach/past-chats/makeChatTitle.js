// Ask the coach API for a short chat title, then fall back to a local title.
// Flow: excerpt the first messages → try the dedicated title route → optionally try the main coach route → otherwise use the local title.
// Used by: the coach conversation when a chat is saved, and by fixOldChatTitles.

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

// The model sometimes echoes the "live search" disclaimer as the title. Cut that prefix
// before we ask, or the title comes back as the disclaimer.
const LIVE_SEARCH_DISCLAIMER_PREFIX = /^Live search wasn't available this turn[^.]*\.\s*/i;

const TITLE_QUOTE_PATTERN = /^["'`]+|["'`]+$/g;
const TITLE_WHITESPACE_PATTERN = /\s+/g;
// Period, exclamation, or em dash — a title that long is a sentence, and we keep the first clause.
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
  const excerpt = excerptFromMessages(messages);
  if (!excerpt) return fallback;

  const localFallback = localTitleFallback(messages, fallback);

  // vocab: getIdToken() is the Firebase ID token the API expects in Authorization.
  const idToken = await auth?.currentUser?.getIdToken?.();
  const uid = userId || auth?.currentUser?.uid;
  if (!idToken || !uid) return localFallback;

  const dedicatedTitle = await requestTitleFromDedicatedRoute(excerpt, idToken);
  if (dedicatedTitle) return dedicatedTitle;

  if (allowMainCoachFallback) {
    const mainCoachTitle = await requestTitleFromMainCoach(excerpt, idToken, uid);
    if (mainCoachTitle) return mainCoachTitle;
  }

  return localFallback;
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function isCoachRole(role) {
  return role === COACH_ROLE_AI || role === COACH_ROLE_ASSISTANT;
}

function coachEndpointUrl(baseUrl, path) {
  return `${String(baseUrl).replace(/\/$/, '')}${path}`;
}

function speakerLabel(role) {
  if (isCoachRole(role)) return 'Coach';
  return 'User';
}

function messageTextForExcerpt(message) {
  let text = String(message?.content || message?.text || '').trim();
  text = text.replace(LIVE_SEARCH_DISCLAIMER_PREFIX, '').trim();
  return text;
}

function excerptFromMessages(messages = []) {
  return messages
    .slice(0, EXCERPT_MESSAGE_LIMIT)
    .map((message) => {
      const text = messageTextForExcerpt(message);
      if (!text) return '';
      return `${speakerLabel(message?.role)}: ${text}`;
    })
    .filter(Boolean)
    .join('\n')
    .slice(0, EXCERPT_CHARACTER_LIMIT);
}

function textOfFirstUserMessage(messages) {
  const firstUserMessage = messages.find((message) => message.role === USER_ROLE);
  return firstUserMessage?.content || firstUserMessage?.text || '';
}

function textOfLastCoachMessage(messages) {
  const lastCoachMessage = [...messages]
    .reverse()
    .find((message) => isCoachRole(message.role));
  return lastCoachMessage?.content || lastCoachMessage?.text || '';
}

function cutRunOnSentence(title) {
  const isRunOnSentence = title.length > LONG_TITLE_CUTOFF && TITLE_SENTENCE_BREAK_PATTERN.test(title);
  if (!isRunOnSentence) return title;
  return title.split(TITLE_SENTENCE_BREAK_PATTERN)[0].trim().slice(0, TITLE_CHARACTER_LIMIT);
}

function cleanTitle(rawTitle) {
  let title = String(rawTitle || '')
    .replace(TITLE_QUOTE_PATTERN, '')
    .replace(TITLE_WHITESPACE_PATTERN, ' ')
    .trim()
    .slice(0, TITLE_CHARACTER_LIMIT);
  if (!title || isJunkChatTitle(title)) return null;

  title = cutRunOnSentence(title);
  if (!title || isJunkChatTitle(title)) return null;
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

async function tryDedicatedTitleOnBase(baseUrl, idToken, payload) {
  try {
    const response = await postJson(coachEndpointUrl(baseUrl, DEDICATED_TITLE_PATH), idToken, payload);
    if (response.status === NOT_FOUND_STATUS) {
      return { shouldStop: true, title: null };
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { shouldStop: false, title: null };
    return { shouldStop: false, title: cleanTitle(data?.title || data?.text || data?.reply) };
  } catch (_error) {
    return { shouldStop: false, title: null };
  }
}

async function requestTitleFromDedicatedRoute(excerpt, idToken) {
  const payload = dedicatedTitlePayload(excerpt);
  for (const baseUrl of getAICoachApiBases()) {
    const result = await tryDedicatedTitleOnBase(baseUrl, idToken, payload);
    if (result.shouldStop) return null;
    if (result.title) return result.title;
  }
  return null;
}

async function tryMainCoachTitleOnBase(baseUrl, idToken, payload) {
  try {
    const response = await postJson(coachEndpointUrl(baseUrl, MAIN_COACH_PATH), idToken, payload);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return null;
    return cleanTitle(data?.reply || data?.message || data?.title);
  } catch (_error) {
    return null;
  }
}

async function requestTitleFromMainCoach(excerpt, idToken, userId) {
  const payload = mainCoachTitlePayload(excerpt, userId);
  for (const baseUrl of getAICoachApiBases()) {
    const title = await tryMainCoachTitleOnBase(baseUrl, idToken, payload);
    if (title) return title;
  }
  return null;
}

function localTitleFallback(messages, fallback) {
  const firstUserText = textOfFirstUserMessage(messages);
  const firstCoachText = textOfLastCoachMessage(messages);
  return buildCreativeTitleLocal(firstUserText, firstCoachText) || fallback || deriveChatTitle(firstUserText);
}
