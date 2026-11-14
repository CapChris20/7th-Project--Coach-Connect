// Sends a phone push by POSTing /api/notifications/send. The server talks to Expo.
// Flow: require recipient and sender → strip emoji → fill an empty body → try each API base.
// Used by: chat, session changes, notes, and the AI coach. Returns { ok: false } instead of throwing.

import { getApiBaseCandidates } from './whereToConnect';
import { getApiAuthHeaders } from './attachLoginProof';
import { removeEmojiFromAlerts } from '../../notifications/removeEmojiFromAlerts';

// ===== NAMED CONSTANTS =====

const SEND_NOTIFICATION_PATH = '/api/notifications/send';
const DEFAULT_NOTIFICATION_TYPE = 'message';
const DEFAULT_SENDER_NAME = 'CoachConnect';
const CHAT_MESSAGE_FALLBACK = 'You have a new message';
const OTHER_ALERT_FALLBACK = 'Open CoachConnect';
// Manipulate here: the server also truncates, but we cap first so a huge note never leaves the phone.
const MESSAGE_TEXT_MAX_LENGTH = 180;
// Manipulate here: 500 and above means "this server is sick, try another base". 4xx is the caller's fault.
const SERVER_ERROR_STATUS = 500;
const JSON_CONTENT_TYPE = 'application/json';

const REASON_MISSING_FIELDS = 'missing_fields';
const REASON_NOT_SIGNED_IN = 'not_signed_in';
const REASON_SERVER_REJECTED = 'server_rejected';
const REASON_UNREACHABLE = 'unreachable';

// ===== HELPER FUNCTIONS =====

function lockScreenFallbackWords(notificationType) {
  const typeText = String(notificationType || DEFAULT_NOTIFICATION_TYPE);
  const isChatMessage = typeText === DEFAULT_NOTIFICATION_TYPE;
  if (isChatMessage) return CHAT_MESSAGE_FALLBACK;
  return OTHER_ALERT_FALLBACK;
}

function buildCleanPushCopy(senderName, messageText, notificationType) {
  // vocab: removeEmojiFromAlerts = strips emoji so Android lock screens do not drop the title
  const cleanSenderName = removeEmojiFromAlerts(senderName) || DEFAULT_SENDER_NAME;
  let cleanMessageText = removeEmojiFromAlerts(String(messageText || ''));
  const hasMessageText = Boolean(cleanMessageText.trim());
  if (!hasMessageText) {
    cleanMessageText = lockScreenFallbackWords(notificationType);
  }
  return { cleanSenderName, cleanMessageText };
}

async function loadSignedInJsonHeadersOrNull() {
  try {
    const authHeaders = await getApiAuthHeaders({ 'Content-Type': JSON_CONTENT_TYPE });
    const userHasBearerToken = Boolean(authHeaders.Authorization);
    if (!userHasBearerToken) return null;
    return authHeaders;
  } catch (_authLookupFailed) {
    return null;
  }
}

// res.json() throws on an empty body. Read text first so a bare 200 still counts as success.
async function readJsonBodySafely(response) {
  let responseJson = {};
  try {
    const responseText = await response.text();
    if (responseText) {
      responseJson = JSON.parse(responseText);
    }
  } catch (_parseFailed) {
    responseJson = {};
  }
  return responseJson;
}

// shouldTryNextBase is only for 5xx. A 4xx, or success: false, is final.
// Only an explicit false is a rejection. A body with no `success` field is still a win.
function outcomeFromPushResponse(response, responseJson) {
  if (!response.ok) {
    const reason = `HTTP ${response.status}`;
    const isServerSideFault = response.status >= SERVER_ERROR_STATUS;
    if (isServerSideFault) {
      return { shouldTryNextBase: true, reason };
    }
    return { ok: false, reason };
  }

  const serverSaidFailure = responseJson.success === false;
  if (serverSaidFailure) {
    return {
      ok: false,
      reason: responseJson.message || responseJson.error || REASON_SERVER_REJECTED,
    };
  }

  return { ok: true };
}

async function postPushToOneBase(apiBase, authHeaders, requestBodyText) {
  try {
    const response = await fetch(`${apiBase}${SEND_NOTIFICATION_PATH}`, {
      method: 'POST',
      headers: authHeaders,
      body: requestBodyText,
    });
    const responseJson = await readJsonBodySafely(response);
    const result = outcomeFromPushResponse(response, responseJson);
    if (result.shouldTryNextBase) {
      return { shouldTryNextBase: true, reason: result.reason };
    }
    return { result };
  } catch (networkError) {
    return {
      shouldTryNextBase: true,
      reason: networkError?.message || String(networkError),
    };
  }
}

async function walkApiBasesUntilPushSettles(apiBaseList, authHeaders, requestBodyText) {
  let lastFailureReason = '';

  for (const apiBase of apiBaseList) {
    const attempt = await postPushToOneBase(apiBase, authHeaders, requestBodyText);
    if (attempt.shouldTryNextBase) {
      lastFailureReason = attempt.reason;
      continue;
    }
    return attempt.result;
  }

  return { ok: false, reason: lastFailureReason || REASON_UNREACHABLE };
}

// ===== MAIN FUNCTION =====

/**
 * Send a remote push notification.
 * A 500 tries the next base. Any other HTTP error stops immediately.
 * @param {object} pushRequest
 * @param {string} pushRequest.recipientId Firebase uid that should receive the push
 * @param {string} pushRequest.senderName Shown as the notification title
 * @param {string} [pushRequest.messageText] Body (also truncated on the server)
 * @param {string} [pushRequest.senderId] Coalescing key for chat-like types
 * @param {string} [pushRequest.conversationId]
 * @param {string} [pushRequest.messageId]
 * @param {string} [pushRequest.notificationType] Default 'message'. Other values skip chat burst coalescing.
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function postRemotePushNotify(pushRequest) {
  const {
    recipientId,
    senderName,
    messageText = '',
    senderId = '',
    conversationId = '',
    messageId = '',
    notificationType = DEFAULT_NOTIFICATION_TYPE,
  } = pushRequest || {};

  // 1. Hard stop when the server cannot route a push without both ids.
  const hasRecipientAndSender = Boolean(recipientId && senderName);
  if (!hasRecipientAndSender) {
    return { ok: false, reason: REASON_MISSING_FIELDS };
  }

  // 2. Clean title/body for Android lock screens; never ship a blank banner.
  const cleanedCopy = buildCleanPushCopy(senderName, messageText, notificationType);
  const truncatedMessageText = cleanedCopy.cleanMessageText.slice(0, MESSAGE_TEXT_MAX_LENGTH);
  const requestBodyText = JSON.stringify({
    recipientId,
    senderName: cleanedCopy.cleanSenderName,
    senderId,
    conversationId,
    messageId,
    messageText: truncatedMessageText,
    notificationType,
  });

  // 3. Must be signed in — the API expects a Firebase ID token on every POST.
  const signedInHeaders = await loadSignedInJsonHeadersOrNull();
  if (!signedInHeaders) {
    return { ok: false, reason: REASON_NOT_SIGNED_IN };
  }

  // 4. Walk bases in order; only 5xx (or network faults) try the next host.
  const apiBaseList = getApiBaseCandidates();
  return walkApiBasesUntilPushSettles(apiBaseList, signedInHeaders, requestBodyText);
}
