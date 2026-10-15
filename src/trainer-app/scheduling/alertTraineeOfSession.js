// Sends the "your coach scheduled a session" push notification straight from the trainer's device.
// Flow: resolve the trainer's name → build title/body → try Expo direct → if that fails non-fatally, try our API.
// Used by: the trainer scheduling screen. Direct-first so this works with no Node server deployed.

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import { getApiBase } from '../../for-both/online-connection/whereToConnect';
import { getApiAuthHeaders } from '../../for-both/online-connection/attachLoginProof';
import {
  randomSessionScheduledTitle,
  randomSessionScheduledDetailBody,
} from '../../notifications/writeAlertText';

// ===== NAMED CONSTANTS =====

// vocab: Expo's hosted push relay. You POST a token + message here and Expo forwards it to APNs / FCM.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const USERS_COLLECTION = 'users';
const FALLBACK_TRAINER_NAME = 'Your coach';
const NOON_ANCHOR = 'T12:00:00';
const HOURS_PER_HALF_DAY = 12;
const NOON_HOUR = 12;
const MINUTE_PAD_LENGTH = 2;
const NOTIFICATION_TYPE_SESSION = 'session_scheduled';
const DATE_FORMAT = { weekday: 'short', month: 'short', day: 'numeric' };
const EXPO_TOKEN_PREFIX_A = 'ExponentPushToken[';
const EXPO_TOKEN_PREFIX_B = 'ExpoPushToken[';

// ===== HELPER FUNCTIONS =====

/**
 * "14:30" → "2:30 PM". Sessions are stored as 24-hour strings; notification copy reads better in 12-hour form.
 * @param {string} hhmm
 * @returns {string}
 */
function formatTime12(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return '';
  const [hourText, minuteText] = hhmm.split(':');
  const hour24 = parseInt(hourText, 10);
  const minuteValue = parseInt(minuteText || '0', 10);
  if (Number.isNaN(hour24)) return hhmm;
  const meridiem = hour24 >= NOON_HOUR ? 'PM' : 'AM';
  // ((hour + 11) % 12) + 1 maps 0→12, 13→1, 12→12. Plain hour % 12 would turn noon into 0.
  const hour12 = ((hour24 + 11) % HOURS_PER_HALF_DAY) + 1;
  const safeMinute = Number.isNaN(minuteValue) ? 0 : minuteValue;
  return `${hour12}:${String(safeMinute).padStart(MINUTE_PAD_LENGTH, '0')} ${meridiem}`;
}

/**
 * "2026-03-14" → "Sat, Mar 14".
 * The T12:00:00 anchor at local noon prevents a UTC-midnight parse from becoming the previous day.
 * @param {string} isoDate
 * @returns {string}
 */
function formatDateShort(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const dateAtNoon = new Date(`${isoDate.slice(0, 10)}${NOON_ANCHOR}`);
  if (Number.isNaN(dateAtNoon.getTime())) return isoDate;
  // Manipulate here: the date format used in the notification body.
  return dateAtNoon.toLocaleDateString('en-US', DATE_FORMAT);
}

/**
 * Use the caller's trainer name if it has one (saves a read), otherwise fetch users/{trainerUid}.
 * Manipulate here: FALLBACK_TRAINER_NAME is what the client sees when the profile has no name.
 * @param {string} [trainerNameArg]
 * @param {string} trainerUid
 * @returns {Promise<string>}
 */
async function resolveTrainerDisplayName(trainerNameArg, trainerUid) {
  if (trainerNameArg) return trainerNameArg;
  try {
    const trainerSnap = await getDoc(doc(db, USERS_COLLECTION, trainerUid));
    const trainerData = trainerSnap.data();
    return trainerData?.displayName || trainerData?.name || trainerData?.firstName || FALLBACK_TRAINER_NAME;
  } catch {
    return FALLBACK_TRAINER_NAME;
  }
}

/**
 * "Sat, Mar 14 at 2:30 PM", or just the date, or a generic line when both parts are missing.
 * @param {string} date
 * @param {string} time
 * @returns {string}
 */
function sessionDetailLine(date, time) {
  const dateLabel = formatDateShort(String(date || ''));
  const timeLabel = formatTime12(String(time || ''));
  const parts = [dateLabel, timeLabel].filter(Boolean);
  if (parts.length > 0) return `Session scheduled: ${parts.join(' at ')}`;
  return 'You have a new scheduled session.';
}

/**
 * Server path. Returns a plain boolean because every failure here is treated the same: fall back.
 * @param {object} payload
 * @returns {Promise<boolean>}
 */
async function tryServerNotify({ recipientId, senderName, messageText, senderId, notificationType }) {
  try {
    const base = String(getApiBase() || '').replace(/\/$/, '');
    if (!base) return false;
    const headers = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
    if (!headers.Authorization) return false;

    const response = await fetch(`${base}/api/notifications/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        recipientId,
        senderName,
        messageText,
        senderId: senderId || '',
        notificationType: notificationType || NOTIFICATION_TYPE_SESSION,
      }),
    });
    const json = await response.json().catch(() => ({}));
    if (json?.success === true) return true;
  } catch {
    // fall through to direct Expo
  }
  return false;
}

/**
 * True when the token is one of the two Expo formats we can send to exp.host.
 * @param {string} expoPushToken
 * @returns {boolean}
 */
function isSupportedExpoToken(expoPushToken) {
  return expoPushToken.startsWith(EXPO_TOKEN_PREFIX_A) || expoPushToken.startsWith(EXPO_TOKEN_PREFIX_B);
}

/**
 * Direct-to-Expo path. Every early return names a distinct reason so the caller can tell
 * "can't ever work" from "try the other channel".
 * @param {object} args
 * @returns {Promise<{ ok: boolean, channel?: string, reason?: string }>}
 */
async function sendExpoDirect({ clientId, trainerUid, sessionId, title, body }) {
  try {
    const snap = await getDoc(doc(db, USERS_COLLECTION, clientId));
    if (!snap.exists) {
      console.warn('[session push] Client user doc missing', clientId);
      return { ok: false, reason: 'no_user_doc' };
    }
    const expoPushToken = snap.data()?.expoPushToken || snap.data()?.pushToken;
    if (!expoPushToken || typeof expoPushToken !== 'string') {
      console.warn('[session push] No Expo push token on client — open client app once & allow notifications');
      return { ok: false, reason: 'no_push_token' };
    }
    if (!isSupportedExpoToken(expoPushToken)) {
      console.warn('[session push] Unsupported token format');
      return { ok: false, reason: 'bad_token_format' };
    }

    const response = await fetch(EXPO_PUSH_URL, {
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
          type: NOTIFICATION_TYPE_SESSION,
          clientId,
          trainerId: trainerUid || '',
          sessionId: sessionId || '',
        },
      }),
    });

    const json = await response.json().catch(() => ({}));
    // vocab: ticket = Expo's per-message receipt. status 'ok' means Expo ACCEPTED it, not that the phone showed it.
    const ticket = json?.data?.[0];
    if (ticket?.status === 'ok') {
      console.log('[session push] Expo delivered');
      return { ok: true, channel: 'expo_direct' };
    }
    console.warn('[session push] Expo ticket', ticket);
    return { ok: false, reason: ticket?.message || 'expo_error' };
  } catch (error) {
    console.warn('[session push] failed', error?.message || error);
    return { ok: false, reason: 'exception' };
  }
}

/**
 * Fatal direct failures the server cannot fix — skip the extra network call and keep the specific reason.
 * @param {string} [reason]
 * @returns {boolean}
 */
function isTerminalPushFailure(reason) {
  return reason === 'no_push_token' || reason === 'no_user_doc';
}

// ===== MAIN FUNCTION =====

/**
 * Send a session-scheduled push to the client from the trainer app.
 * Returns a result object instead of throwing: a failed notification must never roll back a saved session.
 * @param {{ clientId: string, trainerUid: string, date: string, time: string, sessionId: string, trainerName?: string }} args
 * @returns {Promise<{ ok: boolean, channel?: string, reason?: string }>}
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

  const trainerName = await resolveTrainerDisplayName(trainerNameArg, trainerUid);
  const messageText = sessionDetailLine(date, time);
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
  if (isTerminalPushFailure(direct.reason)) return direct;

  const apiOk = await tryServerNotify({
    recipientId: clientId,
    senderName: trainerName,
    messageText,
    senderId: trainerUid,
    notificationType: NOTIFICATION_TYPE_SESSION,
  });
  if (apiOk) return { ok: true, channel: 'server' };

  return direct;
}
