// Posts a coach chat turn to the Express /api/ai-coach server (DeepSeek stays on the server).
// Flow: greet from the phone clock → attach photos → pick web or vision → POST each API base → parse tools.
// Used by: CoachConversationScreen and CoachSelfTest. Do not put DEEPSEEK_API_KEY in the app bundle.
// Read order: constants → mains (reset / send / retry / sendToAI) → PLUMBING HTTP + history helpers.

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

  // 1. Need a signed-in Firebase JWT before the server will reset usage.
  const idToken = await readSignedInUserIdToken();
  if (!idToken) {
    return { ok: false, error: SIGN_IN_ERROR };
  }

  // 2. Try each configured coach API until one reset succeeds.
  for (let baseIndex = 0; baseIndex < bases.length; baseIndex += 1) {
    const base = bases[baseIndex];
    const result = await tryOneUsageReset(base, idToken);
    if (result.ok) {
      return { ok: true, url: result.url };
    }
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
    const callerPassedAttachments = (attachments || []).length > 0;
    if (callerPassedAttachments && !hasImages) {
      return unreadPhotoFailureResult();
    }

    let effectiveMessage = trimmedMessage;
    if (!effectiveMessage && hasImages) {
      effectiveMessage = PHOTO_ONLY_USER_MESSAGE;
    }

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
    const lookupTextForWeeklyContext = trimmedMessage || effectiveMessage;
    const coachPostBody = buildCoachPostBody({
      userId,
      enrichedProfile,
      coachContext,
      web,
      hasImages,
      wantsWeb,
      imageAttachments,
      historyForApi,
      lookupTextForWeeklyContext,
    });
    const coachPostOptions = {
      testSuite: __DEV__,
      timeoutMs: timeoutForCoachRequest(hasImages, wantsWeb),
    };
    const data = await postAICoach(coachPostBody, coachPostOptions);

    // 5. Pull tool JSON out of the reply. An empty toolCalls array still means "we looked."
    return coachReplyFromServerData(data);
  } catch (caughtError) {
    const errorMessage = errorMessageFromCaught(caughtError);
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

  if (lastResult) {
    return lastResult;
  }
  return {
    message: RETRY_FALLBACK_MESSAGE,
    success: false,
    toolCall: null,
  };
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
    // 1. One user line plus coachContext snapshot for legacy callers (self-test, older screens).
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

    return successResultFromLegacySendToAi(data);
  } catch (error) {
    return failureResultFromLegacySendToAi(error);
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
// PLUMBING — skip unless debugging. HTTP failover, history shaping, greeting helpers, reply parsing.

// vocab: getIdToken = Firebase Auth JWT the server checks before spending a DeepSeek call.
async function readSignedInUserIdToken() {
  const currentUser = auth && auth.currentUser;
  if (!currentUser) {
    return null;
  }
  if (typeof currentUser.getIdToken !== 'function') {
    return null;
  }
  const idToken = await currentUser.getIdToken();
  return idToken || null;
}

function buildCoachPostBody({
  userId,
  enrichedProfile,
  coachContext,
  web,
  hasImages,
  wantsWeb,
  imageAttachments,
  historyForApi,
  lookupTextForWeeklyContext,
}) {
  let attachmentsForPost;
  if (hasImages) {
    attachmentsForPost = imageAttachments;
  }

  return {
    userId,
    userProfile: enrichedProfile,
    options: {
      web: webModeForCoachRequest(hasImages, wantsWeb, web),
      clientContext: coachContext,
      testSuite: __DEV__,
      includePersonalData: shouldIncludeWeeklyContextInCoachPrompt(
        lookupTextForWeeklyContext,
        historyForApi,
      ),
      conversationMessages: historyForApi,
    },
    attachments: attachmentsForPost,
    messages: historyForApi,
  };
}

// --- Greeting and profile ---

function greetingPeriodFromHour(hour) {
  if (hour >= MORNING_START_HOUR && hour < AFTERNOON_START_HOUR) {
    return 'morning';
  }
  if (hour >= AFTERNOON_START_HOUR && hour < EVENING_START_HOUR) {
    return 'afternoon';
  }
  if (hour >= EVENING_START_HOUR && hour < NIGHT_START_HOUR) {
    return 'evening';
  }
  return 'night';
}

function enrichedProfileForCoach(userProfile, coachContext, greetingPeriod, greetingPhrase, hour) {
  const profile = {
    ...userProfile,
    greetingPeriod,
    greetingPhrase,
    localHour: hour,
    localTimeISO: new Date().toISOString(),
  };

  // Goal / training level only exist when weekly coachContext was loaded.
  if (coachContext) {
    profile.primaryGoal = coachContext.goal;
    profile.fitnessLevel = coachContext.trainingLevel;
  }

  return profile;
}

// --- Chat history → API message list ---

function webSourcesForHistoryMessage(message) {
  let sourceList = [];
  if (Array.isArray(message.webSources)) {
    sourceList = message.webSources;
  }
  const readySources = [];

  for (let sourceIndex = 0; sourceIndex < sourceList.length; sourceIndex += 1) {
    const source = sourceList[sourceIndex];
    if (!source) {
      continue;
    }
    if (!(source.url || source.title)) {
      continue;
    }
    readySources.push({
      title: String(source.title || '').trim(),
      url: String(source.url || source.link || '').trim(),
      snippet: String(source.snippet || '').trim(),
    });
    if (readySources.length >= MAX_HISTORY_WEB_SOURCES) {
      break;
    }
  }

  return readySources;
}

function historyMessageFromChatTurn(message) {
  let role = 'user';
  if (message.role === 'ai' || message.role === 'assistant') {
    role = 'assistant';
  }

  let content = '';
  if (typeof message.text === 'string') {
    content = message.text;
  } else {
    content = message.content || '';
  }

  const historyTurn = { role, content };

  const hasWebSources =
    role === 'assistant' &&
    Array.isArray(message.webSources) &&
    message.webSources.length > 0;
  if (hasWebSources) {
    historyTurn.webSources = webSourcesForHistoryMessage(message);
  }

  if (role === 'assistant' && message.searchedWeb === true) {
    historyTurn.searchedWeb = true;
  }

  return historyTurn;
}

function trimmedContentOrEmpty(content) {
  if (!content) {
    return '';
  }
  return content.trim();
}

function conversationHistoryForApi(messages) {
  const history = [];
  const messageList = messages || [];
  for (let messageIndex = 0; messageIndex < messageList.length; messageIndex += 1) {
    const mapped = historyMessageFromChatTurn(messageList[messageIndex]);
    const trimmedContent = trimmedContentOrEmpty(mapped.content);
    if (trimmedContent) {
      history.push(mapped);
    }
  }
  return history;
}

function historyWithCurrentUserTurn(history, effectiveMessage) {
  const historyForApi = [];
  for (let turnIndex = 0; turnIndex < history.length; turnIndex += 1) {
    const turn = history[turnIndex];
    const trimmedContent = trimmedContentOrEmpty(turn.content);
    if (trimmedContent) {
      historyForApi.push(turn);
    }
  }

  const lastTurn = historyForApi[historyForApi.length - 1];
  let lastText = '';
  if (lastTurn && lastTurn.content) {
    lastText = String(lastTurn.content).trim();
  }
  const currentText = String(effectiveMessage || '').trim();
  const alreadyHasThisUserTurn = Boolean(
    lastTurn && lastTurn.role === 'user' && lastText === currentText,
  );

  if (!alreadyHasThisUserTurn) {
    historyForApi.push({ role: 'user', content: effectiveMessage });
  }

  return historyForApi;
}

// --- Parse server reply and web/vision flags ---

function parseToolCallFromReply(text) {
  const raw = String(text || '');
  const calls = readActionsFromReply(raw);
  const message = stripCoachToolJsonFromReply(raw);
  const toolCall = calls[0] || null;
  return { message: message || raw.trim(), toolCall };
}

/**
 * Keep EVERY tool call, normalized — a reply can ask for two logs at once
 * ("log 8h sleep and 20oz water"). Picking only [0] silently dropped the rest.
 */
function normalizeToolCallsList(rawToolCalls) {
  if (!Array.isArray(rawToolCalls)) {
    return null;
  }
  const normalizedList = [];
  for (const call of rawToolCalls) {
    const normalized = normalizeToolCall(call);
    if (normalized) {
      normalizedList.push(normalized);
    }
  }
  return normalizedList;
}

function firstToolCallFromLists(toolCalls, parsedTool) {
  if (toolCalls && toolCalls.length > 0) {
    return toolCalls[0];
  }
  return normalizeToolCall(parsedTool);
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
  if (hasImages) {
    return WEB_MODE_OFF;
  }
  if (wantsWeb) {
    return WEB_MODE_ON;
  }
  return web;
}

function timeoutForCoachRequest(hasImages, wantsWeb) {
  if (hasImages) {
    return TIMEOUT_MS_VISION;
  }
  if (wantsWeb) {
    return TIMEOUT_MS_WEB;
  }
  return TIMEOUT_MS;
}

function messageWantsWebSearch(hasImages, web, trimmedMessage, effectiveMessage, historyForApi) {
  if (hasImages) {
    return false;
  }
  const lookupText = trimmedMessage || effectiveMessage;
  if (web === WEB_MODE_ON) {
    return true;
  }
  if (shouldInvokeWebSearch(lookupText, web, historyForApi)) {
    return true;
  }
  if (messagesRequestWebSearch(historyForApi, lookupText)) {
    return true;
  }
  return false;
}

function webSourcesListFromServerData(data) {
  if (Array.isArray(data.webSources)) {
    return data.webSources;
  }
  return [];
}

function coachReplyFromServerData(data) {
  const replyRaw = (data && data.reply) || '';
  const parsed = parseToolCallFromReply(replyRaw);
  const message = parsed.message;
  const parsedTool = parsed.toolCall;
  const toolCalls = normalizeToolCallsList(data.toolCalls);
  const toolCall = firstToolCallFromLists(toolCalls, parsedTool);

  let visibleMessage = stripCoachToolJsonFromReply(message);
  if (!visibleMessage) {
    visibleMessage = message;
  }
  if (!visibleMessage) {
    visibleMessage = EMPTY_REPLY_FALLBACK;
  }

  let analyzedImages = 0;
  if (data.analyzedImages) {
    analyzedImages = data.analyzedImages;
  }

  return {
    message: visibleMessage,
    toolCall,
    toolCalls,
    success: true,
    source: data.source,
    usedWeeklyContext: data.usedWeeklyContext,
    analyzedImages,
    searchedWeb: data.searchedWeb === true,
    webProvider: data.webProvider || null,
    route: data.route || null,
    webSources: webSourcesListFromServerData(data),
  };
}

function successResultFromLegacySendToAi(data) {
  const replyRaw = (data && data.reply) || '';
  const parsed = parseToolCallFromReply(replyRaw);
  const message = parsed.message;
  const parsedTool = parsed.toolCall;
  const toolCalls = normalizeToolCallsList(data.toolCalls);
  const toolCall = firstToolCallFromLists(toolCalls, parsedTool);

  let visibleMessage = stripCoachToolJsonFromReply(message);
  if (!visibleMessage) {
    visibleMessage = message;
  }
  if (!visibleMessage) {
    visibleMessage = replyRaw;
  }
  if (!visibleMessage) {
    visibleMessage = '';
  }

  return {
    message: visibleMessage,
    toolCall,
    toolCalls,
    success: true,
    source: data.source,
    usedWeeklyContext: data.usedWeeklyContext,
    searchedWeb: data.searchedWeb,
    raw: data,
    apiUrl: data._apiUrl,
  };
}

function failureResultFromLegacySendToAi(error) {
  let errorMessage = REQUEST_FAILED_MESSAGE;
  if (error && error.message) {
    errorMessage = error.message;
  }

  let errorDetail = String(error);
  if (error && error.message) {
    errorDetail = error.message;
  }

  let apiUrl;
  if (error && error._apiUrl) {
    apiUrl = error._apiUrl;
  }

  return {
    message: errorMessage,
    toolCall: null,
    success: false,
    error: errorDetail,
    apiUrl,
  };
}

// --- User-facing errors ---

function errorMessageFromCaught(error) {
  try {
    const message = error && error.message;
    if (message && typeof message === 'string') {
      return message;
    }
    return UNKNOWN_ERROR_MESSAGE;
  } catch (_ignored) {
    return UNKNOWN_ERROR_MESSAGE;
  }
}

function logCoachErrorSafely(errorMessage) {
  if (errorMessage === UNKNOWN_ERROR_MESSAGE) {
    return;
  }
  try {
    console.error('AI Coach: ' + errorMessage);
  } catch (_ignored) {
    console.error('AI Coach error (could not serialize)');
  }
}

function userFacingCoachErrorMessage(errorMessage) {
  if (/firebase admin not initialized/i.test(errorMessage)) {
    return FIREBASE_ADMIN_USER_MESSAGE;
  }
  if (errorMessage.includes('Daily AI Coach limit')) {
    return errorMessage;
  }
  if (errorMessage.includes('Could not reach')) {
    return errorMessage;
  }
  const trimmed = errorMessage.trim();
  if (trimmed) {
    return errorMessage;
  }
  return GENERIC_REACH_USER_MESSAGE;
}

// --- POST /api/ai-coach across configured bases ---

function webModeFromPayload(payload) {
  if (!payload) {
    return undefined;
  }
  if (!payload.options) {
    return undefined;
  }
  return payload.options.web;
}

function httpPathForCoachPayload(payload) {
  const lastUserText = newestUserLineInMessages(payload);
  // Dedicated web-search route when the user clearly asked to search the web
  // (web mode on from the caller, or auto mode that already decided this turn wants web).
  const webMode = webModeFromPayload(payload);
  const userAskedForWeb = shouldForceDedicatedWebSearchRoute(lastUserText);
  const webIsNotOff = webMode !== WEB_MODE_OFF;
  const webIsOnOrAutoWantsIt =
    webMode === WEB_MODE_ON || requestPayloadWantsWebSearch(payload);
  const forceDedicatedWebRoute =
    userAskedForWeb && webIsNotOff && webIsOnOrAutoWantsIt;

  if (forceDedicatedWebRoute) {
    return COACH_WEB_SEARCH_PATH;
  }
  return COACH_PATH;
}

function fetchHitTimeoutOrNetwork(error) {
  const isTimeout = error && error.name === 'AbortError';
  const rawMessage = String((error && error.message) || '').toLowerCase();
  const isNetwork =
    (error && error.name === 'TypeError') ||
    rawMessage.includes('network request failed');
  return isTimeout || isNetwork;
}

async function errorDetailFromFailedResponse(response) {
  try {
    const errorJson = await response.json();
    let detail = '';
    if (errorJson) {
      detail = errorJson.error || errorJson.message || '';
    }
    let hint = '';
    if (errorJson && errorJson.hint) {
      hint = errorJson.hint;
    }
    return { detail, hint };
  } catch (_jsonFailed) {
    return errorDetailFromResponseText(response);
  }
}

async function errorDetailFromResponseText(response) {
  try {
    const errorText = (await response.text()) || '';
    return { detail: errorText, hint: '' };
  } catch (_textFailed) {
    return { detail: '', hint: '' };
  }
}

function routeHintFromCoachOptions(options) {
  if (options && options.attachments) {
    return 'vision';
  }
  return null;
}

async function buildHttpErrorFromCoachResponse(response, url, options) {
  const detailParts = await errorDetailFromFailedResponse(response);
  const detail = detailParts.detail;
  const hint = detailParts.hint;

  if (response.status === HTTP_UNAUTHORIZED || response.status === HTTP_FORBIDDEN) {
    throw new Error(detail || NOT_AUTHORIZED_MESSAGE);
  }

  const messageText = detail || `AI Coach request failed (${response.status}).`;
  let fullMessage = messageText;
  if (hint) {
    fullMessage = `${messageText} — ${hint}`;
  }

  const error = new Error(fullMessage);
  error._apiUrl = url;
  error._status = response.status;
  error._route = routeHintFromCoachOptions(options);

  if (__DEV__) {
    console.debug(`AI Coach ${response.status} at ${url}:`, messageText);
  }

  return error;
}

function authHeadersForCoachPost(idToken, options) {
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }
  if (options.testSuite || __DEV__) {
    headers[TEST_SUITE_HEADER] = '1';
  }
  return headers;
}

// vocab: AbortController = cancel a fetch that sat too long. React Native fetch has no timeout option.
async function postJsonWithAbortTimeout(url, headers, payload, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

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

function logWebBaseRetryInDev(url) {
  if (__DEV__) {
    console.debug(`AI Coach web search failed at ${url} — trying next API base`);
  }
}

async function attachDevUrlToCoachJson(response, url, options) {
  const json = await response.json();
  if (options.testSuite || __DEV__) {
    json._apiUrl = url;
  }
  return json;
}

async function tryCoachPostOnApiBase(base, coachPath, headers, payload, options, timeoutMs) {
  const url = `${apiBaseWithoutTrailingSlash(base)}${coachPath}`;

  try {
    const response = await postJsonWithAbortTimeout(url, headers, payload, timeoutMs);

    if (!response.ok) {
      const httpError = await buildHttpErrorFromCoachResponse(response, url, options);
      return { kind: 'http', error: httpError };
    }

    const json = await attachDevUrlToCoachJson(response, url, options);

    if (shouldAdvanceBaseAfterWebMiss(payload, json, base)) {
      logWebBaseRetryInDev(url);
      return { kind: 'web-fallback', json, url };
    }

    if (__DEV__) {
      console.debug('✅ AI Coach response', url);
    }
    return { kind: 'ok', json };
  } catch (error) {
    if (fetchHitTimeoutOrNetwork(error)) {
      return { kind: 'network', error };
    }
    throw error;
  }
}

function apiBasesIncludeProductionUrl(bases) {
  const productionBase = apiBaseWithoutTrailingSlash(PRODUCTION_API_BASE_URL);
  for (const base of bases) {
    if (apiBaseWithoutTrailingSlash(base) === productionBase) {
      return true;
    }
  }
  return false;
}

function timeoutMsForWebAwareRequest(options, wantsWeb) {
  if (options.timeoutMs) {
    return options.timeoutMs;
  }
  if (wantsWeb) {
    return TIMEOUT_MS_WEB;
  }
  return TIMEOUT_MS;
}

async function fetchProductionWebFallback(coachPath, headers, payload, options, wantsWeb) {
  const productionBase = apiBaseWithoutTrailingSlash(PRODUCTION_API_BASE_URL);
  const productionUrl = `${productionBase}${coachPath}`;
  const timeoutMs = timeoutMsForWebAwareRequest(options, wantsWeb);

  try {
    const response = await postJsonWithAbortTimeout(productionUrl, headers, payload, timeoutMs);
    if (!response.ok) {
      return null;
    }
    const json = await response.json();
    if (options.testSuite || __DEV__) {
      json._apiUrl = productionUrl;
    }
    if (shouldAdvanceBaseAfterWebMiss(payload, json, productionBase)) {
      return null;
    }
    return json;
  } catch (_ignored) {
    return null;
  }
}

async function lastResortWebJson(
  bases,
  lastWebFallback,
  wantsWeb,
  coachPath,
  headers,
  payload,
  options,
) {
  const hasWebFallbackJson = Boolean(lastWebFallback && lastWebFallback.json && wantsWeb);
  if (!hasWebFallbackJson) {
    return null;
  }

  if (apiBasesIncludeProductionUrl(bases)) {
    return lastWebFallback.json;
  }

  const productionJson = await fetchProductionWebFallback(
    coachPath,
    headers,
    payload,
    options,
    wantsWeb,
  );
  if (productionJson) {
    return productionJson;
  }

  return lastWebFallback.json;
}

async function postAICoach(payload, options = {}) {
  const bases = getAICoachApiBases();
  const wantsWeb = requestPayloadWantsWebSearch(payload);
  const coachPath = httpPathForCoachPayload(payload);
  let lastNetworkError = null;
  let lastHttpError = null;
  let lastWebFallback = null;

  const idToken = await readSignedInUserIdToken();
  const headers = authHeadersForCoachPost(idToken, options);
  let timeoutMs = TIMEOUT_MS;
  if (options.timeoutMs) {
    timeoutMs = options.timeoutMs;
  }

  for (let baseIndex = 0; baseIndex < bases.length; baseIndex += 1) {
    const base = bases[baseIndex];
    const attempt = await tryCoachPostOnApiBase(
      base,
      coachPath,
      headers,
      payload,
      options,
      timeoutMs,
    );

    if (attempt.kind === 'ok') {
      return attempt.json;
    }
    if (attempt.kind === 'http') {
      lastHttpError = attempt.error;
    }
    if (attempt.kind === 'network') {
      lastNetworkError = attempt.error;
    }
    if (attempt.kind === 'web-fallback') {
      lastWebFallback = { json: attempt.json, url: attempt.url };
    }
  }

  // Prefer a real HTTP error over a network miss when both happened across bases.
  // lastNetworkError is collected in the loop; unused on purpose — same failover as before.
  void lastNetworkError;
  if (lastHttpError) {
    throw lastHttpError;
  }

  const fallbackJson = await lastResortWebJson(
    bases,
    lastWebFallback,
    wantsWeb,
    coachPath,
    headers,
    payload,
    options,
  );
  if (fallbackJson) {
    return fallbackJson;
  }

  throw new Error(REACH_API_ERROR);
}

// --- Retry and dev usage reset ---

function failedCoachResult(errorMessage) {
  return {
    message: userFacingCoachErrorMessage(errorMessage),
    toolCall: null,
    success: false,
    error: errorMessage,
  };
}

async function tryOneUsageReset(base, idToken) {
  const url = `${apiBaseWithoutTrailingSlash(base)}${RESET_USAGE_PATH}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        [TEST_SUITE_HEADER]: '1',
      },
    });
    if (response.ok) {
      return { ok: true, url };
    }
    return { ok: false };
  } catch (_ignored) {
    return { ok: false };
  }
}

async function tryOneCoachSend(params) {
  try {
    const response = await sendCoachMessage(params);
    return { didThrow: false, response, error: null };
  } catch (error) {
    return { didThrow: true, response: null, error };
  }
}

function waitMs(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function shouldRethrowCoachSend(attemptResult, attempt, retries) {
  return attemptResult.didThrow && attempt === retries;
}

function isSuccessfulCoachSend(attemptResult) {
  if (attemptResult.didThrow) {
    return false;
  }
  const response = attemptResult.response;
  return Boolean(response && response.success);
}

// --- Misc ---

function apiBaseWithoutTrailingSlash(base) {
  return String(base).replace(/\/$/, '');
}

function newestUserLineInMessages(payload) {
  const messageList = Array.isArray(payload && payload.messages)
    ? payload.messages
    : [];

  for (let i = messageList.length - 1; i >= 0; i -= 1) {
    const message = messageList[i];
    if (message && message.role === 'user') {
      return String(message.content || message.text || '').trim();
    }
  }
  return '';
}

function requestPayloadWantsWebSearch(payload) {
  const webMode = webModeFromPayload(payload);
  const hasAttachments =
    payload && payload.attachments && payload.attachments.length;

  if (webMode === WEB_MODE_OFF || hasAttachments) {
    return false;
  }
  if (webMode === WEB_MODE_ON) {
    return true;
  }

  const lastUserText = newestUserLineInMessages(payload);
  let messageList;
  if (payload) {
    messageList = payload.messages;
  }
  if (shouldInvokeWebSearch(lastUserText, webMode, messageList)) {
    return true;
  }
  if (messagesRequestWebSearch(messageList, lastUserText)) {
    return true;
  }
  return false;
}

function shouldAdvanceBaseAfterWebMiss(payload, json, base) {
  if (!requestPayloadWantsWebSearch(payload)) {
    return false;
  }
  if (json && json.searchedWeb === true) {
    return false;
  }
  if (json && json.route === 'web-search') {
    return false;
  }
  if (json && json.route === 'web-search-ask-topic') {
    return false;
  }
  if (json && json.route === 'web-search-off-topic') {
    return false;
  }
  if (isCloudHostedApiBase(base)) {
    return false;
  }

  // Match prior nullish semantics: missing json still means "did not search web."
  const routeIsWebSearchFailed = Boolean(json && json.route === 'web-search-failed');
  let searchedWebFlag;
  if (json != null) {
    searchedWebFlag = json.searchedWeb;
  }
  const didNotConfirmWebSearch = searchedWebFlag !== true;
  return routeIsWebSearchFailed || didNotConfirmWebSearch;
}
