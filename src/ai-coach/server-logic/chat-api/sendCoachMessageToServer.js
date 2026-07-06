/**
 * deepseek Service
 *
 * Purpose: Data/service layer: deepseek Service. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/ai
 * Key exports: resetAiCoachDailyUsage, sendCoachMessage, sendCoachMessageWithRetry, sendToAI, sendToAIWithWebMode, sendToDeeepSeek
 *
 * @file-header
 */
/**
 * AI Coach chat — proxies to Express /api/ai-coach (DeepSeek on server).
 * Do NOT put DEEPSEEK_API_KEY in the React Native bundle; keys stay in server .env / Cloud Run.
 */
import { auth } from '../../../app-start/config';
import { getAICoachApiBases, isCloudHostedApiBase, PRODUCTION_API_BASE_URL } from '../../../shared/api/baseUrl';
import { buildContextSystemBlock } from '../context/loadCoachPersonalContext';
import { normalizeToolCall } from '../tools/runCoachAction';
import {
  parseCoachToolCalls,
  stripCoachToolJsonFromReply,
} from '../../tools/parseCoachToolCalls';
import { shouldIncludeWeeklyContextInCoachPrompt } from '../context/buildCoachPromptData';
import { prepareCoachAttachmentsForApi } from '../../chat-ui/lib/prepareCoachAttachments';
import {
  messagesRequestWebSearch,
  shouldForceDedicatedWebSearchRoute,
  shouldInvokeWebSearch,
} from './shouldUseWebSearch';

const TIMEOUT_MS = 20000;
const TIMEOUT_MS_WEB = 45000;
const TIMEOUT_MS_VISION = 120000;

function lastUserTextFromPayload(payload) {
  const msgs = Array.isArray(payload?.messages) ? payload.messages : [];
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i];
    if (m?.role === 'user') return String(m.content || m.text || '').trim();
  }
  return '';
}

function payloadWantsWebSearch(payload) {
  const webMode = payload?.options?.web;
  if (webMode === 'off' || payload?.attachments?.length) return false;
  if (webMode === 'on') return true;
  const lastUser = lastUserTextFromPayload(payload);
  return (
    shouldInvokeWebSearch(lastUser, webMode, payload?.messages) ||
    messagesRequestWebSearch(payload?.messages, lastUser)
  );
}

/** Local dev servers often lack Serper/Perplexity — retry Cloud Run instead of accepting failure. */
function shouldRetryWebSearchOnNextBase(payload, json, base) {
  if (!payloadWantsWebSearch(payload)) return false;
  if (json?.searchedWeb === true || json?.route === 'web-search') return false;
  if (json?.route === 'web-search-ask-topic' || json?.route === 'web-search-off-topic') return false;
  if (isCloudHostedApiBase(base)) return false;
  return json?.route === 'web-search-failed' || json?.searchedWeb !== true;
}

function aiCoachPathForPayload(payload) {
  const lastUser = lastUserTextFromPayload(payload);
  if (payload?.options?.web === 'on' && shouldForceDedicatedWebSearchRoute(lastUser)) {
    return '/api/ai-coach/web-search';
  }
  return '/api/ai-coach';
}

/** Clear today's AI Coach usage counter (dev / test suite). */
export async function resetAiCoachDailyUsage() {
  const bases = getAICoachApiBases();
  const idToken = await auth?.currentUser?.getIdToken?.();
  if (!idToken) return { ok: false, error: 'Not signed in' };

  for (const base of bases) {
    const url = `${String(base).replace(/\/$/, '')}/api/ai-coach/reset-usage`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'X-AI-Coach-Test-Suite': '1',
        },
      });
      if (res.ok) return { ok: true, url };
    } catch (_) {
      continue;
    }
  }
  return { ok: false, error: 'Could not reach local server' };
}

async function postAICoach(payload, options = {}) {
  const bases = getAICoachApiBases();
  const wantsWeb = payloadWantsWebSearch(payload);
  const coachPath = aiCoachPathForPayload(payload);
  let lastNetworkError = null;
  let lastHttpError = null;
  let lastWebFallback = null;

  const headers = { 'Content-Type': 'application/json' };
  const idToken = await auth?.currentUser?.getIdToken?.();
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  if (options.testSuite || __DEV__) {
    headers['X-AI-Coach-Test-Suite'] = '1';
  }

  for (const base of bases) {
    const url = `${String(base).replace(/\/$/, '')}${coachPath}`;
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs || TIMEOUT_MS;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errDetail = '';
        let errHint = '';
        try {
          const errJson = await response.json();
          errDetail = errJson?.error || errJson?.message || '';
          errHint = errJson?.hint || '';
        } catch (_) {
          try {
            errDetail = (await response.text()) || '';
          } catch (__) {
            /* ignore */
          }
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error(errDetail || 'Not authorized. Please sign in again.');
        }
        const msg = errDetail || `AI Coach request failed (${response.status}).`;
        const err = new Error(errHint ? `${msg} — ${errHint}` : msg);
        err._apiUrl = url;
        err._status = response.status;
        err._route = options?.attachments ? 'vision' : null;
        lastHttpError = err;
        if (__DEV__) {
          console.debug(`AI Coach ${response.status} at ${url}:`, msg);
        }
        continue;
      }

      const json = await response.json();
      if (options.testSuite || __DEV__) {
        json._apiUrl = url;
      }
      if (shouldRetryWebSearchOnNextBase(payload, json, base)) {
        lastWebFallback = { json, url };
        if (__DEV__) {
          console.debug(`AI Coach web search failed at ${url} — trying next API base`);
        }
        continue;
      }
      if (__DEV__) console.debug('✅ AI Coach response', url);
      return json;
    } catch (error) {
      const isTimeout = error?.name === 'AbortError';
      const isNetwork =
        error?.name === 'TypeError' ||
        String(error?.message || '')
          .toLowerCase()
          .includes('network request failed');

      if (isTimeout || isNetwork) {
        lastNetworkError = error;
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastHttpError) throw lastHttpError;

  if (lastWebFallback?.json && wantsWeb) {
    const prodBase = PRODUCTION_API_BASE_URL.replace(/\/$/, '');
    if (!bases.some((b) => String(b).replace(/\/$/, '') === prodBase)) {
      const prodUrl = `${prodBase}${coachPath}`;
      const controller = new AbortController();
      const timeoutMs = options.timeoutMs || (wantsWeb ? TIMEOUT_MS_WEB : TIMEOUT_MS);
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(prodUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (response.ok) {
          const json = await response.json();
          if (options.testSuite || __DEV__) json._apiUrl = prodUrl;
          if (!shouldRetryWebSearchOnNextBase(payload, json, prodBase)) {
            return json;
          }
        }
      } catch (_) {
        /* fall through to lastWebFallback */
      } finally {
        clearTimeout(timeoutId);
      }
    }
    return lastWebFallback.json;
  }

  throw new Error(
    'Could not reach your Coach Connect API. Check EXPO_PUBLIC_API_BASE_URL in .env (your Cloud Run URL) and that the service is deployed.',
  );
}

function parseToolCallFromReply(text) {
  const raw = String(text || '');
  const calls = parseCoachToolCalls(raw);
  const message = stripCoachToolJsonFromReply(raw);
  const toolCall = calls[0] || null;
  return { message: message || raw.trim(), toolCall };
}

/**
 * Send a user message with 7-day context to AI Coach (DeepSeek via server).
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.userMessage
 * @param {Array<{role:string,content:string}>} params.messages - prior turns
 * @param {object} [params.userProfile]
 * @param {object} [params.coachContext] - from loadCoachContext()
 */
export async function sendCoachMessage({
  userId,
  userMessage,
  messages = [],
  userProfile = {},
  coachContext = null,
  web = 'auto',
  attachments = [],
}) {
  try {
    // Server builds the real weekly prompt from Firestore — avoid duplicate/misleading client summary.
    const enrichedProfile = {
      ...userProfile,
      ...(coachContext
        ? {
            primaryGoal: coachContext.goal,
            fitnessLevel: coachContext.trainingLevel,
          }
        : {}),
    };

    const history = (messages || [])
      .map((m) => {
        const role = m.role === 'ai' || m.role === 'assistant' ? 'assistant' : 'user';
        const content = typeof m.text === 'string' ? m.text : m.content || '';
        const out = { role, content };
        if (role === 'assistant' && Array.isArray(m.webSources) && m.webSources.length > 0) {
          out.webSources = m.webSources
            .filter((s) => s && (s.url || s.title))
            .slice(0, 12)
            .map((s) => ({
              title: String(s.title || '').trim(),
              url: String(s.url || s.link || '').trim(),
              snippet: String(s.snippet || '').trim(),
            }));
        }
        if (role === 'assistant' && m.searchedWeb === true) out.searchedWeb = true;
        return out;
      })
      .filter((m) => m.content?.trim());

    const trimmedMessage = String(userMessage || '').trim();
    const imageAttachments = await prepareCoachAttachmentsForApi(attachments);
    const hasImages = imageAttachments.length > 0;
    if ((attachments || []).length > 0 && !hasImages) {
      return {
        success: false,
        message:
          'I could not read that photo. Try attaching it again, or pick a smaller image.',
        source: 'client',
        toolCall: null,
        toolCalls: null,
        searchedWeb: false,
        webProvider: null,
        route: 'vision',
      };
    }
    const effectiveMessage =
      trimmedMessage ||
      (hasImages ? 'Please analyze the attached photo(s) and give coaching feedback.' : '');

    const historyForApi = [...history.filter((m) => m.content?.trim())];
    const lastHist = historyForApi[historyForApi.length - 1];
    if (
      !lastHist ||
      lastHist.role !== 'user' ||
      String(lastHist.content || '').trim() !== String(effectiveMessage || '').trim()
    ) {
      historyForApi.push({ role: 'user', content: effectiveMessage });
    }

    const wantsWeb =
      !hasImages &&
      (web === 'on' ||
        shouldInvokeWebSearch(trimmedMessage || effectiveMessage, web, historyForApi) ||
        messagesRequestWebSearch(historyForApi, trimmedMessage || effectiveMessage));

    const data = await postAICoach(
      {
        userId,
        userProfile: enrichedProfile,
        options: {
          web: hasImages ? 'off' : wantsWeb ? 'on' : web,
          clientContext: coachContext,
          testSuite: __DEV__,
          includePersonalData: shouldIncludeWeeklyContextInCoachPrompt(
            trimmedMessage || effectiveMessage,
            historyForApi,
          ),
          conversationMessages: historyForApi,
        },
        attachments: hasImages ? imageAttachments : undefined,
        messages: historyForApi,
      },
      {
        testSuite: __DEV__,
        timeoutMs: hasImages ? TIMEOUT_MS_VISION : wantsWeb ? TIMEOUT_MS_WEB : TIMEOUT_MS,
      },
    );

    const replyRaw = (data && data.reply) || '';
    const { message, toolCall: parsedTool } = parseToolCallFromReply(replyRaw);
    // FIXED: Don't convert empty array to null — even empty means we checked for tools
    const toolCalls = Array.isArray(data.toolCalls) ? data.toolCalls : null;
    const toolCall = normalizeToolCall(toolCalls?.[0] || parsedTool);

    return {
      message:
        stripCoachToolJsonFromReply(message) ||
        message ||
        'Sorry, I could not get a response. Please try again.',
      toolCall,
      toolCalls,
      success: true,
      source: data.source,
      usedWeeklyContext: data.usedWeeklyContext,
      analyzedImages: data.analyzedImages || 0,
      searchedWeb: data.searchedWeb === true,
      webProvider: data.webProvider || null,
      route: data.route || null,
      webSources: Array.isArray(data.webSources) ? data.webSources : [],
    };
  } catch (error) {
    let errMsg = 'Unknown error';
    try {
      // Extract message without any serialization
      const message = error?.message;
      if (message && typeof message === 'string') {
        errMsg = message;
      } else {
        errMsg = 'Unknown error';
      }
    } catch (e) {
      errMsg = 'Unknown error';
    }
    
    // Log safely - just the string
    if (errMsg !== 'Unknown error') {
      try {
        console.error('AI Coach: ' + errMsg);
      } catch (_) {
        console.error('AI Coach error (could not serialize)');
      }
    }
    
    const userFacing = /firebase admin not initialized/i.test(errMsg)
      ? 'AI Coach API is missing Firebase Admin on the server. Set FIREBASE_SERVICE_ACCOUNT on Cloud Run (see server/deploy.sh).'
      : errMsg.includes('Daily AI Coach limit')
        ? errMsg
        : errMsg.includes('Could not reach')
          ? errMsg
          : errMsg.trim() || 'Could not reach the server. Check your connection and try again.';

    return {
      message: userFacing,
      toolCall: null,
      success: false,
      error: errMsg,
    };
  }
}

/**
 * Retry coach chat on transient failures (network / empty success).
 */
export async function sendCoachMessageWithRetry(params, retries = 2) {
  let lastResult = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await sendCoachMessage(params);
      lastResult = response;
      if (response?.success) return response;
    } catch (error) {
      if (attempt === retries) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
  }
  return (
    lastResult || {
      message: 'Could not reach AI Coach. Please try again.',
      success: false,
      toolCall: null,
    }
  );
}

/**
 * Test-suite / legacy helper — sends one message with coach context.
 */
export async function sendToAI(userMessage, coachContext, userId, userProfile = {}, options = {}) {
  const testSuite = options.testSuite === true;
  try {
    const trimmedMessage = String(userMessage || '').trim();
    const enrichedProfile = {
      ...userProfile,
      coachContextSnapshot: coachContext,
      coachContextSummary: buildContextSystemBlock(coachContext),
    };
    const webMode = options.web || 'auto';

    const data = await postAICoach(
      {
        userId,
        userProfile: enrichedProfile,
        options: {
          web: webMode,
          clientContext: coachContext,
          testSuite,
          includePersonalData: Boolean(userId),
        },
        messages: [{ role: 'user', content: trimmedMessage }],
      },
      { testSuite }
    );
    const replyRaw = (data && data.reply) || '';
    const { message, toolCall: parsedTool } = parseToolCallFromReply(replyRaw);
    const toolCalls = Array.isArray(data.toolCalls) ? data.toolCalls : null;
    const toolCall = normalizeToolCall(toolCalls?.[0] || parsedTool);
    return {
      message:
        stripCoachToolJsonFromReply(message) ||
        message ||
        replyRaw ||
        '',
      toolCall,
      toolCalls,
      success: true,
      source: data.source,
      usedWeeklyContext: data.usedWeeklyContext,
      searchedWeb: data.searchedWeb,
      raw: data,
      apiUrl: data._apiUrl,
    };
  } catch (error) {
    return {
      message: error?.message || 'Request failed',
      toolCall: null,
      success: false,
      error: error?.message || String(error),
      apiUrl: error?._apiUrl,
    };
  }
}

/** @deprecated use options.web on sendToAI */
export function sendToAIWithWebMode(userMessage, coachContext, userId, userProfile, webMode) {
  return sendToAI(userMessage, coachContext, userId, userProfile, { web: webMode });
}

/** @deprecated typo alias — use sendCoachMessage */
export const sendToDeeepSeek = sendCoachMessage;

/** @deprecated typo alias — use loadCoachContextEnhanced from contextAggregation */
export { loadCoachContextEnhanced, calculateDataQuality } from '../context/loadCoachPersonalContext';
