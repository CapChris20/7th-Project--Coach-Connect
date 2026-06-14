/**
 * Remote push via Express POST /api/notifications/send (Expo path on server).
 * Uses the same candidate bases as messaging so physical devices reach the API.
 */
import { getApiBaseCandidates } from './baseUrl';
import { getApiAuthHeaders } from './apiAuthHeaders';
import { stripNotificationEmoji } from '../notifications/stripNotificationEmoji';

/**
 * @param {object} p
 * @param {string} p.recipientId - Firebase uid to receive the push
 * @param {string} p.senderName - Shown as notification title
 * @param {string} [p.messageText] - Body (truncated server-side)
 * @param {string} [p.senderId] - Coalescing key for chat-like types; use stable id for system types
 * @param {string} [p.conversationId]
 * @param {string} [p.messageId]
 * @param {string} [p.notificationType] - default 'message'; other values skip chat burst coalescing
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function postRemotePushNotify(p) {
  const {
    recipientId,
    senderName,
    messageText = '',
    senderId = '',
    conversationId = '',
    messageId = '',
    notificationType = 'message',
  } = p || {};

  if (!recipientId || !senderName) {
    return { ok: false, reason: 'missing_fields' };
  }

  const cleanSender = stripNotificationEmoji(senderName) || 'CoachConnect';
  let cleanMessage = stripNotificationEmoji(String(messageText || ''));
  if (!cleanMessage.trim()) {
    cleanMessage =
      String(notificationType || 'message') === 'message' ? 'You have a new message' : 'Open CoachConnect';
  }

  const body = JSON.stringify({
    recipientId,
    senderName: cleanSender,
    senderId,
    conversationId,
    messageId,
    messageText: cleanMessage.slice(0, 180),
    notificationType,
  });

  const bases = getApiBaseCandidates();
  let lastFailure = '';

  let authHeaders = {};
  try {
    authHeaders = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
  } catch (_) {
    return { ok: false, reason: 'not_signed_in' };
  }
  if (!authHeaders.Authorization) {
    return { ok: false, reason: 'not_signed_in' };
  }

  for (const API_BASE_URL of bases) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/send`, {
        method: 'POST',
        headers: authHeaders,
        body,
      });

      let json = {};
      try {
        const text = await res.text();
        if (text) json = JSON.parse(text);
      } catch (_) {}

      if (!res.ok) {
        lastFailure = `HTTP ${res.status}`;
        if (res.status >= 500) continue;
        return { ok: false, reason: lastFailure };
      }

      if (json.success === false) {
        return { ok: false, reason: json.message || json.error || 'server_rejected' };
      }

      return { ok: true };
    } catch (e) {
      lastFailure = e?.message || String(e);
    }
  }

  return { ok: false, reason: lastFailure || 'unreachable' };
}
