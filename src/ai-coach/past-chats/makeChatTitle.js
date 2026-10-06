// Ask the coach API for a short chat title, then fall back to a local title.
// Flow: excerpt the first messages → try the dedicated title route →
// optionally try the main coach route → otherwise use the local title.
// Used by the coach conversation when a chat is saved, and by fixOldChatTitles.

import { auth } from '../../app-start/cloudConnection';
import { getAICoachApiBases } from '../../for-both/online-connection/whereToConnect';
import { buildCreativeTitleLocal, deriveChatTitle, isJunkChatTitle } from './chatTitles';

// ===== NAMED CONSTANTS =====

const DEFAULT_CHAT_TITLE = 'Chat';

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

// ===== HELPER FUNCTIONS =====

function isCoachRole(role) {
  return role === 'ai' || role === 'assistant';
}

function coachEndpointUrl(baseUrl, path) {
  return `${String(baseUrl).replace(/\/$/, '')}${path}`;
}

// Four short lines, labeled User or Coach, capped so the title call stays cheap.
function excerptFromMessages(messages = []) {
  return messages
    .slice(0, EXCERPT_MESSAGE_LIMIT)
    .map((message) => {
      const speaker = isCoachRole(message?.role) ? 'Coach' : 'User';
      let text = String(message?.content || message?.text || '').trim();
      text = text.replace(LIVE_SEARCH_DISCLAIMER_PREFIX, '').trim();
      return text ? `${speaker}: ${text}` : '';
    })
    .filter(Boolean)
    .join('\n')
    .slice(0, EXCERPT_CHARACTER_LIMIT);
}

function textOfFirstUserMessage(messages) {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  return firstUserMessage?.content || firstUserMessage?.text || '';
}

function textOfLastCoachMessage(messages) {
  const lastCoachMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'ai' || message.role === 'assistant');
  return lastCoachMessage?.content || lastCoachMessage?.text || '';
}

// Strip quotes and extra spaces. A long sentence is cut at the first break so the
// history row stays a title. Junk (disclaimers, "Chat", "Calories Chat") becomes null.
function cleanTitle(rawTitle) {
  let title = String(rawTitle || '')
    .replace(TITLE_QUOTE_PATTERN, '')
    .replace(TITLE_WHITESPACE_PATTERN, ' ')
    .trim()
    .slice(0, TITLE_CHARACTER_LIMIT);
  if (!title || isJunkChatTitle(title)) return null;

  const isRunOnSentence = title.length > LONG_TITLE_CUTOFF && TITLE_SENTENCE_BREAK_PATTERN.test(title);
  if (isRunOnSentence) {
    title = title.split(TITLE_SENTENCE_BREAK_PATTERN)[0].trim().slice(0, TITLE_CHARACTER_LIMIT);
  }
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

// 404 means this host doesn't have the title route. Stop immediately — the next
// base usually 404s too, and the caller decides whether to try the main coach route.
async function requestTitleFromDedicatedRoute(excerpt, idToken) {
  const payload = {
    message: `${TITLE_PROMPT}\n\nConversation:\n${excerpt}`,
    skipTools: true,
    maxTokens: TITLE_MAX_TOKENS,
  };

  for (const baseUrl of getAICoachApiBases()) {
    const url = coachEndpointUrl(baseUrl, DEDICATED_TITLE_PATH);
    try {
      const response = await postJson(url, idToken, payload);
      if (response.status === NOT_FOUND_STATUS) return null;
      const data = await response.json().catch(() => ({}));
      if (!response.ok) continue;
      const title = cleanTitle(data?.title || data?.text || data?.reply);
      if (title) return title;
    } catch (_error) {
      // This base failed. Try the next one.
    }
  }
  return null;
}

// Used only when the dedicated route isn't deployed. Same prompt, main coach endpoint.
async function requestTitleFromMainCoach(excerpt, idToken, userId) {
  const payload = {
    userId,
    messages: [{ role: 'user', content: `${TITLE_PROMPT}\n\nConversation:\n${excerpt}` }],
    userProfile: {},
    options: { web: 'off', includePersonalData: false },
  };

  for (const baseUrl of getAICoachApiBases()) {
    const url = coachEndpointUrl(baseUrl, MAIN_COACH_PATH);
    try {
      const response = await postJson(url, idToken, payload);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) continue;
      const title = cleanTitle(data?.reply || data?.message || data?.title);
      if (title) return title;
    } catch (_error) {
      // This base failed. Try the next one.
    }
  }
  return null;
}

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

  const firstUserText = textOfFirstUserMessage(messages);
  const firstCoachText = textOfLastCoachMessage(messages);
  const localFallback =
    buildCreativeTitleLocal(firstUserText, firstCoachText) || fallback || deriveChatTitle(firstUserText);

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
