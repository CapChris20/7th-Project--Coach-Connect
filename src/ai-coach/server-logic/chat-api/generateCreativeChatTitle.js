/**
 * Generate a short creative chat title from the first few messages via the coach API.
 */
import { auth } from '../../../app-start/config';
import { getAICoachApiBases } from '../../../shared/api/baseUrl';
import { buildCreativeTitleLocal, deriveChatTitle, isJunkChatTitle } from './chatTitleUtils';

const TITLE_PROMPT = `Based on this fitness coaching conversation, generate ONE creative, catchy chat title (3-5 words, can include one emoji). Make it feel natural and conversational — like a playlist name, not a status message. Examples: "Sleep Recovery Tactics", "Macro Math Breakdown", "Late Night Gains 🌙", "Recomp Roadmap", "Creatine Clarity".

Never use bland titles like "Calories Chat" or "Fitness Log". Never quote coach disclaimers like "Live search wasn't available".

Reply with ONLY the title text — no quotes, no explanation.`;

function excerptFromMessages(messages = []) {
  return messages
    .slice(0, 4)
    .map((m) => {
      const role = m?.role === 'ai' || m?.role === 'assistant' ? 'Coach' : 'User';
      let text = String(m?.content || m?.text || '').trim();
      // Don't let disclaimer prefixes poison title generation
      text = text.replace(/^Live search wasn't available this turn[^.]*\.\s*/i, '').trim();
      return text ? `${role}: ${text}` : '';
    })
    .filter(Boolean)
    .join('\n')
    .slice(0, 500);
}

function cleanTitle(raw) {
  let s = String(raw || '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 56);
  if (!s || isJunkChatTitle(s)) return null;
  // If model echoed a long sentence, keep first clause
  if (s.length > 40 && /[.!—]/.test(s)) {
    s = s.split(/[.!—]/)[0].trim().slice(0, 56);
  }
  if (!s || isJunkChatTitle(s)) return null;
  return s;
}

async function requestTitleFromDedicatedRoute(excerpt, idToken) {
  const payload = {
    message: `${TITLE_PROMPT}\n\nConversation:\n${excerpt}`,
    skipTools: true,
    maxTokens: 60,
  };

  for (const base of getAICoachApiBases()) {
    const url = `${String(base).replace(/\/$/, '')}/api/ai-coach/chat-title`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.status === 404) return null;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) continue;
      const title = cleanTitle(data?.title || data?.text || data?.reply);
      if (title) return title;
    } catch (_) {
      /* try next base */
    }
  }
  return null;
}

/** Fallback when /chat-title is not deployed — uses the main coach route on Cloud Run. */
async function requestTitleFromMainCoach(excerpt, idToken, userId) {
  const payload = {
    userId,
    messages: [{ role: 'user', content: `${TITLE_PROMPT}\n\nConversation:\n${excerpt}` }],
    userProfile: {},
    options: { web: 'off', includePersonalData: false },
  };

  for (const base of getAICoachApiBases()) {
    const url = `${String(base).replace(/\/$/, '')}/api/ai-coach`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) continue;
      const title = cleanTitle(data?.reply || data?.message || data?.title);
      if (title) return title;
    } catch (_) {
      /* try next base */
    }
  }
  return null;
}

/**
 * @param {Array<{role?: string, content?: string, text?: string}>} messages
 * @param {string} [fallback]
 * @param {string} [userId]
 * @param {{ allowMainCoachFallback?: boolean }} [options]
 * @returns {Promise<string>}
 */
export async function generateCreativeChatTitle(
  messages,
  fallback = 'Chat',
  userId,
  { allowMainCoachFallback = true } = {},
) {
  const excerpt = excerptFromMessages(messages);
  if (!excerpt) return fallback;

  const firstUser = messages.find((m) => m.role === 'user')?.content || messages.find((m) => m.role === 'user')?.text || '';
  const firstAi =
    [...messages].reverse().find((m) => m.role === 'ai' || m.role === 'assistant')?.content ||
    [...messages].reverse().find((m) => m.role === 'ai' || m.role === 'assistant')?.text ||
    '';

  const localFallback =
    buildCreativeTitleLocal(firstUser, firstAi) || fallback || deriveChatTitle(firstUser);

  const idToken = await auth?.currentUser?.getIdToken?.();
  const uid = userId || auth?.currentUser?.uid;
  if (!idToken || !uid) return localFallback;

  const dedicated = await requestTitleFromDedicatedRoute(excerpt, idToken);
  if (dedicated) return dedicated;

  if (allowMainCoachFallback) {
    const fromMain = await requestTitleFromMainCoach(excerpt, idToken, uid);
    if (fromMain) return fromMain;
  }

  return localFallback;
}
