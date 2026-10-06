// Sends a phone push by POSTing /api/notifications/send. The server talks to Expo.
// Flow: require recipient and sender → strip emoji → fill an empty body → try each API base.
// Used by chat, session changes, notes, and the AI coach. Returns { ok: false } instead of throwing.
// A 500 tries the next base. Any other HTTP error stops immediately.

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

function fallbackAlertText(notificationType) {
  const isChatMessage = String(notificationType || DEFAULT_NOTIFICATION_TYPE) === DEFAULT_NOTIFICATION_TYPE;
  if (isChatMessage) return CHAT_MESSAGE_FALLBACK;
  return OTHER_ALERT_FALLBACK;
}

// Emoji in a push title gets dropped by some Android builds, so both fields are cleaned first.
// An empty body still needs words, or the lock screen shows a blank banner.
function cleanedAlertFields(senderName, messageText, notificationType) {
  const cleanSenderName = removeEmojiFromAlerts(senderName) || DEFAULT_SENDER_NAME;
  let cleanMessageText = removeEmojiFromAlerts(String(messageText || ''));
  const hasMessageText = Boolean(cleanMessageText.trim());
  if (!hasMessageText) {
    cleanMessageText = fallbackAlertText(notificationType);
  }
  return { cleanSenderName, cleanMessageText };
}

async function signedInJsonHeaders() {
  try {
    const authHeaders = await getApiAuthHeaders({ 'Content-Type': JSON_CONTENT_TYPE });
    const isSignedIn = Boolean(authHeaders.Authorization);
    if (!isSignedIn) return null;
    return authHeaders;
  } catch (_) {
    return null;
  }
}

// res.json() throws on an empty body. Read text first so a bare 200 still counts as success.
async function readJsonBody(response) {
  let responseJson = {};
  try {
    const responseText = await response.text();
    if (responseText) responseJson = JSON.parse(responseText);
  } catch (_) {
    responseJson = {};
  }
  return responseJson;
}

// shouldTryNextBase is only for 5xx. A 4xx, or success: false, is final.
function pushResultFromResponse(response, responseJson) {
  if (!response.ok) {
    const reason = `HTTP ${response.status}`;
    if (response.status >= SERVER_ERROR_STATUS) {
      return { shouldTryNextBase: true, reason };
    }
    return { ok: false, reason };
  }

  // Only an explicit false is a rejection. A body with no `success` field is still a win.
  if (responseJson.success === false) {
    return {
      ok: false,
      reason: responseJson.message || responseJson.error || REASON_SERVER_REJECTED,
    };
  }

  return { ok: true };
}

// ===== MAIN FUNCTION =====

/**
 * Send a remote push notification.
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

  const hasRequiredFields = Boolean(recipientId && senderName);
  if (!hasRequiredFields) {
    return { ok: false, reason: REASON_MISSING_FIELDS };
  }

  const { cleanSenderName, cleanMessageText } = cleanedAlertFields(
    senderName,
    messageText,
    notificationType,
  );
  const requestBody = JSON.stringify({
    recipientId,
    senderName: cleanSenderName,
    senderId,
    conversationId,
    messageId,
    messageText: cleanMessageText.slice(0, MESSAGE_TEXT_MAX_LENGTH),
    notificationType,
  });

  const apiBases = getApiBaseCandidates();
  const authHeaders = await signedInJsonHeaders();
  if (!authHeaders) {
    return { ok: false, reason: REASON_NOT_SIGNED_IN };
  }

  let lastFailure = '';
  for (const apiBase of apiBases) {
    try {
      const response = await fetch(`${apiBase}${SEND_NOTIFICATION_PATH}`, {
        method: 'POST',
        headers: authHeaders,
        body: requestBody,
      });
      const responseJson = await readJsonBody(response);
      const result = pushResultFromResponse(response, responseJson);
      if (result.shouldTryNextBase) {
        lastFailure = result.reason;
        continue;
      }
      return result;
    } catch (error) {
      lastFailure = error?.message || String(error);
    }
  }

  return { ok: false, reason: lastFailure || REASON_UNREACHABLE };
}
