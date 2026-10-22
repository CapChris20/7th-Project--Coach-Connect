// Posts a coach chat turn to the Express /api/ai-coach server (DeepSeek stays on the server).
// Flow: greet from the phone clock → attach photos → pick web or vision → POST each API base → parse tools.
// Used by CoachConversationScreen and CoachSelfTest. Do not put DEEPSEEK_API_KEY in the app bundle.

import { auth } from '../../app-start/cloudConnection';
import { getAICoachApiBases, isCloudHostedApiBase, PRODUCTION_API_BASE_URL } from '../../for-both/online-connection/whereToConnect';
import { buildContextSystemBlock } from '../coach-knowledge/loadYourWeekForCoach';
import { normalizeToolCall } from '../coach-actions/carryOutAction';
import {
  readActionsFromReply,
  stripCoachToolJsonFromReply,
} from '../coach-actions/readActionsFromReply';
import { shouldIncludeWeeklyContextInCoachPrompt } from '../coach-knowledge/decideWhatCoachShouldKnow';
import { preparePhotosToSendForApi } from './preparePhotosToSend';
import {
  messagesRequestWebSearch,
  shouldForceDedicatedWebSearchRoute,
  shouldInvokeWebSearch,
} from '../internet-lookup/shouldLookUpOnInternet';

// ===== NAMED CONSTANTS =====

// Manipulate here: raise these if Cloud Run is slow; vision is longest because the photo upload is large.
const TIMEOUT_MS = 20000;
const TIMEOUT_MS_WEB = 45000;
const TIMEOUT_MS_VISION = 120000;
const MS_PER_SECOND = 1000;

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

const MORNING_START_HOUR = 5;
const AFTERNOON_START_HOUR = 12;
const EVENING_START_HOUR = 17;
const NIGHT_START_HOUR = 23;

const MAX_HISTORY_WEB_SOURCES = 12;
const COACH_PATH = '/api/ai-coach';
const COACH_WEB_SEARCH_PATH = '/api/ai-coach/web-search';
const RESET_USAGE_PATH = '/api/ai-coach/reset-usage';
const TEST_SUITE_HEADER = 'X-AI-Coach-Test-Suite';

const WEB_MODE_OFF = 'off';
const WEB_MODE_ON = 'on';
const DEFAULT_WEB_MODE = 'auto';

const EMPTY_PHOTO_MESSAGE =
  'I could not read that photo. Try attaching it again, or pick a smaller image.';
const PHOTO_ONLY_USER_MESSAGE =
  'Please analyze the attached photo(s) and give coaching feedback.';
const EMPTY_REPLY_FALLBACK = 'Sorry, I could not get a response. Please try again.';
const REACH_API_ERROR =
  'Could not reach your Coach Connect API. Check EXPO_PUBLIC_API_BASE_URL in .env (your Cloud Run URL) and that the service is deployed.';
const RETRY_FALLBACK_MESSAGE = 'Could not reach AI Coach. Please try again.';
const SIGN_IN_ERROR = 'Not signed in';
const RESET_UNREACHABLE_ERROR = 'Could not reach local server';
const NOT_AUTHORIZED_MESSAGE = 'Not authorized. Please sign in again.';
const UNKNOWN_ERROR_MESSAGE = 'Unknown error';
const FIREBASE_ADMIN_USER_MESSAGE =
  'AI Coach API is missing Firebase Admin on the server. Set FIREBASE_SERVICE_ACCOUNT on Cloud Run (see server/deploy.sh).';
const GENERIC_REACH_USER_MESSAGE =
  'Could not reach the server. Check your connection and try again.';
const REQUEST_FAILED_MESSAGE = 'Request failed';

// ===== MAIN FUNCTION =====

/**
 * Clear today's AI Coach usage counter (dev / test suite).
 * Flow: 1. need a signed-in token  2. POST each API base  3. first 200 wins
 * @returns {Promise<{ ok: boolean, url?: string, error?: string }>}
 */
export async function resetAiCoachDailyUsage() {
  const bases = getAICoachApiBases();
  const idToken = await auth?.currentUser?.getIdToken?.();
  if (!idToken) return { ok: false, error: SIGN_IN_ERROR };

  // 1. Try each configured coach API until one reset succeeds.
  for (const base of bases) {
    const result = await tryOneUsageReset(base, idToken);
    if (result.ok) return { ok: true, url: result.url };
  }
  return { ok: false, error: RESET_UNREACHABLE_ERROR };
}

/**
 * Send a user message with weekly context to AI Coach (DeepSeek via the server).
 * Flow: 1. greeting  2. photos  3. history + web  4. POST  5. parse tools
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.userMessage
 * @param {Array<{role:string,content:string}>} params.messages
 * @param {object} [params.userProfile]
 * @param {object} [params.coachContext]
 * @param {string} [params.web]
 * @param {Array} [params.attachments]
 * @returns {Promise<object>}
 */
export async function sendCoachMessage({
  userId,
  userMessage,
  messages = [],
  userProfile = {},
  coachContext = null,
  web = DEFAULT_WEB_MODE,
  attachments = [],
}) {
  try {
    // 1. Phone clock so "Good morning" matches the user's hour, not the server's.
    const hour = new Date().getHours();
    const greetingPeriod = greetingPeriodFromHour(hour);
    const greetingPhrase = `Good ${greetingPeriod}`;
    const enrichedProfile = enrichedProfileForCoach(
      userProfile,
      coachContext,
      greetingPeriod,
      greetingPhrase,
      hour,
    );

    // 2. Prior turns, then photos. Unreadable photos stop here so we do not POST an empty vision body.
    const history = conversationHistoryForApi(messages);
    const trimmedMessage = String(userMessage || '').trim();
    const imageAttachments = await preparePhotosToSendForApi(attachments);
    const hasImages = imageAttachments.length > 0;
    if ((attachments || []).length > 0 && !hasImages) {
      return unreadPhotoFailureResult();
    }
    const effectiveMessage =
      trimmedMessage ||
      (hasImages ? PHOTO_ONLY_USER_MESSAGE : '');

    // 3. Append this user turn if the last bubble is not already the same text, then decide web vs vision.
    const historyForApi = historyWithCurrentUserTurn(history, effectiveMessage);
    const wantsWeb = messageWantsWebSearch(
      hasImages,
      web,
      trimmedMessage,
      effectiveMessage,
      historyForApi,
    );

    // 4. POST the coach API. Vision and web get longer timeouts than a plain chat turn.
    const data = await postAICoach(
      {
        userId,
        userProfile: enrichedProfile,
        options: {
          web: webModeForCoachRequest(hasImages, wantsWeb, web),
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
        timeoutMs: timeoutForCoachRequest(hasImages, wantsWeb),
      },
    );

    // 5. Pull tool JSON out of the reply. An empty toolCalls array still means "we looked."
    return coachReplyFromServerData(data);
  } catch (error) {
    const errorMessage = errorMessageFromCaught(error);
    logCoachErrorSafely(errorMessage);
    return failedCoachResult(errorMessage);
  }
}

/**
 * Retry coach chat on transient failures (network / empty success).
 * Flow: 1. send  2. return on success  3. wait then try again
 * @param {object} params
 * @param {number} [retries]
 * @returns {Promise<object>}
 */
export async function sendCoachMessageWithRetry(params, retries = 2) {
  let lastResult = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    // 1. One send. A thrown error on the last attempt leaves this function.
    const attemptResult = await tryOneCoachSend(params);
    if (shouldRethrowCoachSend(attemptResult, attempt, retries)) {
      throw attemptResult.error;
    }
    if (!attemptResult.didThrow) {
      lastResult = attemptResult.response;
    }
    if (isSuccessfulCoachSend(attemptResult)) {
      return attemptResult.response;
    }
    // 2. Pause longer after each miss (1s, then 2s) before the next try.
    await waitMs(MS_PER_SECOND * attempt);
  }
  return (
    lastResult || {
      message: RETRY_FALLBACK_MESSAGE,
      success: false,
      toolCall: null,
    }
  );
}

/**
 * Test-suite / legacy helper — sends one message with coach context.
 * @param {string} userMessage
 * @param {object} coachContext
 * @param {string} userId
 * @param {object} [userProfile]
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export async function sendToAI(userMessage, coachContext, userId, userProfile = {}, options = {}) {
  const testSuite = options.testSuite === true;
  try {
    // 1. One user line plus a snapshot of this week's context for older callers.
    const trimmedMessage = String(userMessage || '').trim();
    const enrichedProfile = {
      ...userProfile,
      coachContextSnapshot: coachContext,
      coachContextSummary: buildContextSystemBlock(coachContext),
    };
    const webMode = options.web || DEFAULT_WEB_MODE;

    // 2. POST and parse the same way the live chat does.
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
      { testSuite },
    );
    const replyRaw = (data && data.reply) || '';
    const { message, toolCall: parsedTool } = parseToolCallFromReply(replyRaw);
    // Keep EVERY tool call, normalized — a reply can ask for two logs at once
    // ("log 8h sleep and 20oz water"). Picking only [0] silently dropped the rest.
    const toolCalls = Array.isArray(data.toolCalls)
      ? data.toolCalls.map((call) => normalizeToolCall(call)).filter(Boolean)
      : null;
    const toolCall = toolCalls?.[0] || normalizeToolCall(parsedTool);
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
      message: error?.message || REQUEST_FAILED_MESSAGE,
      toolCall: null,
      success: false,
      error: error?.message || String(error),
      apiUrl: error?._apiUrl,
    };
  }
}

/**
 * @deprecated use options.web on sendToAI
 * @param {string} userMessage
 * @param {object} coachContext
 * @param {string} userId
 * @param {object} userProfile
 * @param {string} webMode
 * @returns {Promise<object>}
 */
export function sendToAIWithWebMode(userMessage, coachContext, userId, userProfile, webMode) {
  return sendToAI(userMessage, coachContext, userId, userProfile, { web: webMode });
}

/**
 * @deprecated typo alias — use sendCoachMessage
 */
export const sendToDeeepSeek = sendCoachMessage;

/** @deprecated typo alias — use loadCoachContextEnhanced from contextAggregation */
export { loadCoachContextEnhanced, calculateDataQuality } from '../coach-knowledge/loadYourWeekForCoach';

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function stripTrailingSlash(base) {
  return String(base).replace(/\/$/, '');
}

function lastUserTextFromPayload(payload) {
  const messageList = Array.isArray(payload?.messages) ? payload.messages : [];
  for (let i = messageList.length - 1; i >= 0; i -= 1) {
    const message = messageList[i];
    if (message?.role === 'user') return String(message.content || message.text || '').trim();
  }
  return '';
}

function payloadWantsWebSearch(payload) {
  const webMode = payload?.options?.web;
  if (webMode === WEB_MODE_OFF || payload?.attachments?.length) return false;
  if (webMode === WEB_MODE_ON) return true;
  const lastUserText = lastUserTextFromPayload(payload);
  return (
    shouldInvokeWebSearch(lastUserText, webMode, payload?.messages) ||
    messagesRequestWebSearch(payload?.messages, lastUserText)
  );
}

function shouldRetryWebSearchOnNextBase(payload, json, base) {
  if (!payloadWantsWebSearch(payload)) return false;
  if (json?.searchedWeb === true || json?.route === 'web-search') return false;
  if (json?.route === 'web-search-ask-topic' || json?.route === 'web-search-off-topic') return false;
  if (isCloudHostedApiBase(base)) return false;
  return json?.route === 'web-search-failed' || json?.searchedWeb !== true;
}

function aiCoachPathForPayload(payload) {
  const lastUserText = lastUserTextFromPayload(payload);
  if (payload?.options?.web === WEB_MODE_ON && shouldForceDedicatedWebSearchRoute(lastUserText)) {
    return COACH_WEB_SEARCH_PATH;
  }
  return COACH_PATH;
}

function isTimeoutOrNetworkError(error) {
  const isTimeout = error?.name === 'AbortError';
  const isNetwork =
    error?.name === 'TypeError' ||
    String(error?.message || '')
      .toLowerCase()
      .includes('network request failed');
  return isTimeout || isNetwork;
}

async function readFailedResponseDetail(response) {
  try {
    const errorJson = await response.json();
    return {
      detail: errorJson?.error || errorJson?.message || '',
      hint: errorJson?.hint || '',
    };
  } catch (_) {
    try {
      const errorText = (await response.text()) || '';
      return { detail: errorText, hint: '' };
    } catch (__) {
      return { detail: '', hint: '' };
    }
  }
}

async function httpErrorFromFailedResponse(response, url, options) {
  const { detail, hint } = await readFailedResponseDetail(response);
  if (response.status === HTTP_UNAUTHORIZED || response.status === HTTP_FORBIDDEN) {
    throw new Error(detail || NOT_AUTHORIZED_MESSAGE);
  }
  const messageText = detail || `AI Coach request failed (${response.status}).`;
  const error = new Error(hint ? `${messageText} — ${hint}` : messageText);
  error._apiUrl = url;
  error._status = response.status;
  error._route = options?.attachments ? 'vision' : null;
  if (__DEV__) {
    console.debug(`AI Coach ${response.status} at ${url}:`, messageText);
  }
  return error;
}

function coachRequestHeaders(idToken, options) {
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  if (options.testSuite || __DEV__) {
    headers[TEST_SUITE_HEADER] = '1';
  }
  return headers;
}

// vocab: AbortController = cancel a fetch that sat too long. React Native fetch has no timeout option.
async function postJsonToCoachUrl(url, headers, payload, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function noteWebSearchRetry(url) {
  if (__DEV__) {
    console.debug(`AI Coach web search failed at ${url} — trying next API base`);
  }
}

async function parsedCoachJson(response, url, options) {
  const json = await response.json();
  if (options.testSuite || __DEV__) {
    json._apiUrl = url;
  }
  return json;
}

async function tryOneCoachBase(base, coachPath, headers, payload, options, timeoutMs) {
  const url = `${stripTrailingSlash(base)}${coachPath}`;
  try {
    const response = await postJsonToCoachUrl(url, headers, payload, timeoutMs);
    if (!response.ok) {
      const httpError = await httpErrorFromFailedResponse(response, url, options);
      return { kind: 'http', error: httpError };
    }
    const json = await parsedCoachJson(response, url, options);
    if (shouldRetryWebSearchOnNextBase(payload, json, base)) {
      noteWebSearchRetry(url);
      return { kind: 'web-fallback', json, url };
    }
    if (__DEV__) console.debug('✅ AI Coach response', url);
    return { kind: 'ok', json };
  } catch (error) {
    if (isTimeoutOrNetworkError(error)) {
      return { kind: 'network', error };
    }
    throw error;
  }
}

function doesBaseListIncludeProduction(bases) {
  const productionBase = stripTrailingSlash(PRODUCTION_API_BASE_URL);
  for (const base of bases) {
    if (stripTrailingSlash(base) === productionBase) return true;
  }
  return false;
}

async function tryProductionWebFallback(coachPath, headers, payload, options, wantsWeb) {
  const productionBase = stripTrailingSlash(PRODUCTION_API_BASE_URL);
  const productionUrl = `${productionBase}${coachPath}`;
  const timeoutMs = options.timeoutMs || (wantsWeb ? TIMEOUT_MS_WEB : TIMEOUT_MS);
  try {
    const response = await postJsonToCoachUrl(productionUrl, headers, payload, timeoutMs);
    if (!response.ok) return null;
    const json = await response.json();
    if (options.testSuite || __DEV__) json._apiUrl = productionUrl;
    if (shouldRetryWebSearchOnNextBase(payload, json, productionBase)) return null;
    return json;
  } catch (_) {
    return null;
  }
}

async function jsonFromWebFallbackOrProduction(
  bases,
  lastWebFallback,
  wantsWeb,
  coachPath,
  headers,
  payload,
  options,
) {
  if (!(lastWebFallback?.json && wantsWeb)) return null;
  if (doesBaseListIncludeProduction(bases)) return lastWebFallback.json;
  const productionJson = await tryProductionWebFallback(
    coachPath,
    headers,
    payload,
    options,
    wantsWeb,
  );
  if (productionJson) return productionJson;
  return lastWebFallback.json;
}

async function postAICoach(payload, options = {}) {
  const bases = getAICoachApiBases();
  const wantsWeb = payloadWantsWebSearch(payload);
  const coachPath = aiCoachPathForPayload(payload);
  let lastNetworkError = null;
  let lastHttpError = null;
  let lastWebFallback = null;

  // vocab: getIdToken = Firebase Auth JWT the server checks before spending a DeepSeek call.
  const idToken = await auth?.currentUser?.getIdToken?.();
  const headers = coachRequestHeaders(idToken, options);
  const timeoutMs = options.timeoutMs || TIMEOUT_MS;

  for (const base of bases) {
    const attempt = await tryOneCoachBase(base, coachPath, headers, payload, options, timeoutMs);
    if (attempt.kind === 'ok') return attempt.json;
    if (attempt.kind === 'http') lastHttpError = attempt.error;
    if (attempt.kind === 'network') lastNetworkError = attempt.error;
    if (attempt.kind === 'web-fallback') lastWebFallback = { json: attempt.json, url: attempt.url };
  }

  if (lastHttpError) throw lastHttpError;

  const fallbackJson = await jsonFromWebFallbackOrProduction(
    bases,
    lastWebFallback,
    wantsWeb,
    coachPath,
    headers,
    payload,
    options,
  );
  if (fallbackJson) return fallbackJson;

  throw new Error(REACH_API_ERROR);
}

function parseToolCallFromReply(text) {
  const raw = String(text || '');
  const calls = readActionsFromReply(raw);
  const message = stripCoachToolJsonFromReply(raw);
  const toolCall = calls[0] || null;
  return { message: message || raw.trim(), toolCall };
}

function greetingPeriodFromHour(hour) {
  if (hour >= MORNING_START_HOUR && hour < AFTERNOON_START_HOUR) return 'morning';
  if (hour >= AFTERNOON_START_HOUR && hour < EVENING_START_HOUR) return 'afternoon';
  if (hour >= EVENING_START_HOUR && hour < NIGHT_START_HOUR) return 'evening';
  return 'night';
}

function enrichedProfileForCoach(userProfile, coachContext, greetingPeriod, greetingPhrase, hour) {
  return {
    ...userProfile,
    greetingPeriod,
    greetingPhrase,
    localHour: hour,
    localTimeISO: new Date().toISOString(),
    ...(coachContext
      ? {
          primaryGoal: coachContext.goal,
          fitnessLevel: coachContext.trainingLevel,
        }
      : {}),
  };
}

function webSourcesForHistoryMessage(message) {
  const sourceList = Array.isArray(message.webSources) ? message.webSources : [];
  const readySources = [];
  for (const source of sourceList) {
    if (!source || !(source.url || source.title)) continue;
    readySources.push({
      title: String(source.title || '').trim(),
      url: String(source.url || source.link || '').trim(),
      snippet: String(source.snippet || '').trim(),
    });
    if (readySources.length >= MAX_HISTORY_WEB_SOURCES) break;
  }
  return readySources;
}

function historyMessageFromChatTurn(message) {
  const role = message.role === 'ai' || message.role === 'assistant' ? 'assistant' : 'user';
  const content = typeof message.text === 'string' ? message.text : message.content || '';
  const historyTurn = { role, content };
  if (role === 'assistant' && Array.isArray(message.webSources) && message.webSources.length > 0) {
    historyTurn.webSources = webSourcesForHistoryMessage(message);
  }
  if (role === 'assistant' && message.searchedWeb === true) historyTurn.searchedWeb = true;
  return historyTurn;
}

function conversationHistoryForApi(messages) {
  const history = [];
  for (const message of messages || []) {
    const mapped = historyMessageFromChatTurn(message);
    if (mapped.content?.trim()) history.push(mapped);
  }
  return history;
}

function historyWithCurrentUserTurn(history, effectiveMessage) {
  const historyForApi = [];
  for (const turn of history) {
    if (turn.content?.trim()) historyForApi.push(turn);
  }
  const lastTurn = historyForApi[historyForApi.length - 1];
  const lastText = String(lastTurn?.content || '').trim();
  const currentText = String(effectiveMessage || '').trim();
  const alreadyHasThisUserTurn = !!(lastTurn && lastTurn.role === 'user' && lastText === currentText);
  if (!alreadyHasThisUserTurn) {
    historyForApi.push({ role: 'user', content: effectiveMessage });
  }
  return historyForApi;
}

function unreadPhotoFailureResult() {
  return {
    success: false,
    message: EMPTY_PHOTO_MESSAGE,
    source: 'client',
    toolCall: null,
    toolCalls: null,
    searchedWeb: false,
    webProvider: null,
    route: 'vision',
  };
}

function webModeForCoachRequest(hasImages, wantsWeb, web) {
  if (hasImages) return WEB_MODE_OFF;
  if (wantsWeb) return WEB_MODE_ON;
  return web;
}

function timeoutForCoachRequest(hasImages, wantsWeb) {
  if (hasImages) return TIMEOUT_MS_VISION;
  if (wantsWeb) return TIMEOUT_MS_WEB;
  return TIMEOUT_MS;
}

function messageWantsWebSearch(hasImages, web, trimmedMessage, effectiveMessage, historyForApi) {
  if (hasImages) return false;
  const lookupText = trimmedMessage || effectiveMessage;
  return (
    web === WEB_MODE_ON ||
    shouldInvokeWebSearch(lookupText, web, historyForApi) ||
    messagesRequestWebSearch(historyForApi, lookupText)
  );
}

function coachReplyFromServerData(data) {
  const replyRaw = (data && data.reply) || '';
  const { message, toolCall: parsedTool } = parseToolCallFromReply(replyRaw);
  const toolCalls = Array.isArray(data.toolCalls)
    ? data.toolCalls.map((call) => normalizeToolCall(call)).filter(Boolean)
    : null;
  const toolCall = toolCalls?.[0] || normalizeToolCall(parsedTool);
  return {
    message:
      stripCoachToolJsonFromReply(message) ||
      message ||
      EMPTY_REPLY_FALLBACK,
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
}

function errorMessageFromCaught(error) {
  try {
    const message = error?.message;
    if (message && typeof message === 'string') return message;
    return UNKNOWN_ERROR_MESSAGE;
  } catch (_) {
    return UNKNOWN_ERROR_MESSAGE;
  }
}

function logCoachErrorSafely(errorMessage) {
  if (errorMessage === UNKNOWN_ERROR_MESSAGE) return;
  try {
    console.error('AI Coach: ' + errorMessage);
  } catch (_) {
    console.error('AI Coach error (could not serialize)');
  }
}

function userFacingCoachErrorMessage(errorMessage) {
  if (/firebase admin not initialized/i.test(errorMessage)) {
    return FIREBASE_ADMIN_USER_MESSAGE;
  }
  if (errorMessage.includes('Daily AI Coach limit')) return errorMessage;
  if (errorMessage.includes('Could not reach')) return errorMessage;
  return errorMessage.trim() || GENERIC_REACH_USER_MESSAGE;
}

function failedCoachResult(errorMessage) {
  return {
    message: userFacingCoachErrorMessage(errorMessage),
    toolCall: null,
    success: false,
    error: errorMessage,
  };
}

async function tryOneUsageReset(base, idToken) {
  const url = `${stripTrailingSlash(base)}${RESET_USAGE_PATH}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        [TEST_SUITE_HEADER]: '1',
      },
    });
    if (response.ok) return { ok: true, url };
    return { ok: false };
  } catch (_) {
    return { ok: false };
  }
}

async function tryOneCoachSend(params) {
  try {
    return { didThrow: false, response: await sendCoachMessage(params), error: null };
  } catch (error) {
    return { didThrow: true, response: null, error };
  }
}

function waitMs(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function shouldRethrowCoachSend(attemptResult, attempt, retries) {
  return attemptResult.didThrow && attempt === retries;
}

function isSuccessfulCoachSend(attemptResult) {
  return !attemptResult.didThrow && attemptResult.response?.success;
}
