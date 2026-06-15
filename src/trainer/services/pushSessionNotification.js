/**
 * push Session Notification
 *
 * Purpose: Data/service layer: push Session Notification. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: sendSessionScheduledPushToClient
 *
 * @file-header
 */
/**
 * Send a session-scheduled push to the client from the trainer app.
 * Does not require the Node server or Cloud Functions (reads client pushToken from users/{clientId}).
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../app/config';
import { getApiBase } from '../../shared/services/baseUrl';
import { getApiAuthHeaders } from '../../shared/api/getAuthHeaders';
import {
  randomSessionScheduledTitle,
  randomSessionScheduledDetailBody,
} from '../../shared/notifications/pushNotificationText';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function formatTime12(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return '';
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  if (Number.isNaN(h)) return hhmm;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(Number.isNaN(m) ? 0 : m).padStart(2, '0')} ${ampm}`;
}

function formatDateShort(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Try server endpoint first (if API is up). Falls back to direct Expo push from device.
 * @returns {{ ok: boolean, channel?: string, reason?: string }}
 */
export async function sendSessionScheduledPushToClient({
  clientId,
  trainerUid,
  date,
  time,
  sessionId,
  trainerName: trainerNameArg,
}) {
  if (!clientId || !trainerUid) {
    return { ok: false, reason: 'missing_ids' };
  }

  const trainerName =
    trainerNameArg ||
    (await (async () => {
      try {
        const t = await getDoc(doc(db, 'users', trainerUid));
        const d = t.data();
        return d?.displayName || d?.name || d?.firstName || 'Your coach';
      } catch {
        return 'Your coach';
      }
    })());

  const dateLabel = formatDateShort(String(date || ''));
  const timeLabel = formatTime12(String(time || ''));
  const bits = [dateLabel, timeLabel].filter(Boolean);
  const messageText =
    bits.length > 0
      ? `Session scheduled: ${bits.join(' at ')}`
      : 'You have a new scheduled session.';

  const title = randomSessionScheduledTitle(trainerName);
  const body = randomSessionScheduledDetailBody(trainerName, messageText);
  const direct = await sendExpoDirect({
    clientId,
    trainerUid,
    sessionId,
    title,
    body,
  });
  if (direct.ok) return direct;
  if (direct.reason === 'no_push_token' || direct.reason === 'no_user_doc') {
    return direct;
  }

  const apiOk = await tryServerNotify({
    recipientId: clientId,
    senderName: trainerName,
    messageText,
    senderId: trainerUid,
    notificationType: 'session_scheduled',
  });
  if (apiOk) return { ok: true, channel: 'server' };

  return direct;
}

async function tryServerNotify({ recipientId, senderName, messageText, senderId, notificationType }) {
  try {
    const base = String(getApiBase() || '').replace(/\/$/, '');
    if (!base) return false;
    const headers = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
    if (!headers.Authorization) return false;

    const res = await fetch(`${base}/api/notifications/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        recipientId,
        senderName,
        messageText,
        senderId: senderId || '',
        notificationType: notificationType || 'session_scheduled',
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (json?.success === true) return true;
  } catch {
    // fall through to direct Expo
  }
  return false;
}

async function sendExpoDirect({ clientId, trainerUid, sessionId, title, body }) {
  try {
    const snap = await getDoc(doc(db, 'users', clientId));
    if (!snap.exists) {
      console.warn('[session push] Client user doc missing', clientId);
      return { ok: false, reason: 'no_user_doc' };
    }
    const expoPushToken = snap.data()?.expoPushToken || snap.data()?.pushToken;
    if (!expoPushToken || typeof expoPushToken !== 'string') {
      console.warn('[session push] No Expo push token on client — open client app once & allow notifications');
      return { ok: false, reason: 'no_push_token' };
    }
    if (!expoPushToken.startsWith('ExponentPushToken[') && !expoPushToken.startsWith('ExpoPushToken[')) {
      console.warn('[session push] Unsupported token format');
      return { ok: false, reason: 'bad_token_format' };
    }

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: expoPushToken,
        title,
        body,
        sound: 'default',
        priority: 'high',
        channelId: 'default',
        interruptionLevel: 'active',
        data: {
          type: 'session_scheduled',
          clientId,
          trainerId: trainerUid || '',
          sessionId: sessionId || '',
        },
      }),
    });

    const json = await res.json().catch(() => ({}));
    const ticket = json?.data?.[0];
    if (ticket?.status === 'ok') {
      console.log('[session push] Expo delivered');
      return { ok: true, channel: 'expo_direct' };
    }
    console.warn('[session push] Expo ticket', ticket);
    return { ok: false, reason: ticket?.message || 'expo_error' };
  } catch (e) {
    console.warn('[session push] failed', e?.message || e);
    return { ok: false, reason: 'exception' };
  }
}
