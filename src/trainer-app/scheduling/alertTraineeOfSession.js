// Sends the “your coach scheduled a session” push from the trainer’s device.
// Flow: resolve trainer name → build title/body → try Expo direct → if recoverable fail, try our API.
// Used by: trainer scheduling screens. Direct-first so this works with no Node server deployed.
// Read order: constants → format helpers → channels → main → PLUMBING token checks.

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import { getApiBase } from '../../for-both/online-connection/whereToConnect';
import { getApiAuthHeaders } from '../../for-both/online-connection/attachLoginProof';
import {
  randomSessionScheduledTitle,
  randomSessionScheduledDetailBody,
} from '../../notifications/writeAlertText';

// ===== NAMED CONSTANTS =====

// vocab: Expo’s hosted push relay. POST a token + message; Expo forwards to APNs / FCM.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const USERS_COLLECTION = 'users';
// Manipulate here: what the client sees when the trainer profile has no display name.
const FALLBACK_TRAINER_NAME = 'Your trainer';
// Manipulate here: local-noon anchor so "2026-03-14" does not slip to the previous day in UTC.
const NOON_ANCHOR = 'T12:00:00';
const HOURS_PER_HALF_DAY = 12;
const NOON_HOUR = 12;
const MINUTE_PAD_LENGTH = 2;
const NOTIFICATION_TYPE_SESSION = 'session_scheduled';
// Manipulate here: weekday/month style in the notification body.
const DATE_FORMAT = { weekday: 'short', month: 'short', day: 'numeric' };
const EXPO_TOKEN_PREFIX_A = 'ExponentPushToken[';
const EXPO_TOKEN_PREFIX_B = 'ExpoPushToken[';

// ===== HELPER FUNCTIONS =====

/**
 * "14:30" → "2:30 PM".
 * Sessions store 24-hour strings; notification copy reads better in 12-hour form.
 * @param {string} hourMinuteText
 * @returns {string}
 */
function formatTime12(hourMinuteText) {
  if (!hourMinuteText || typeof hourMinuteText !== 'string') return '';

  const [hourText, minuteText] = hourMinuteText.split(':');
  const hour24 = parseInt(hourText, 10);
  const minuteValue = parseInt(minuteText || '0', 10);
  if (Number.isNaN(hour24)) return hourMinuteText;

  const meridiem = hour24 >= NOON_HOUR ? 'PM' : 'AM';
  // ((hour + 11) % 12) + 1 maps 0→12, 13→1, 12→12. Plain hour % 12 would turn noon into 0.
  const hour12 = ((hour24 + 11) % HOURS_PER_HALF_DAY) + 1;
  const safeMinute = Number.isNaN(minuteValue) ? 0 : minuteValue;
  const minutePadded = String(safeMinute).padStart(MINUTE_PAD_LENGTH, '0');
  return `${hour12}:${minutePadded} ${meridiem}`;
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
  return dateAtNoon.toLocaleDateString('en-US', DATE_FORMAT);
}

/**
 * Use the caller's trainer name if present (saves a read), else fetch users/{trainerUid}.
 * @param {string|undefined} trainerNameArg
 * @param {string} trainerUid
 * @returns {Promise<string>}
 */
async function resolveTrainerDisplayName(trainerNameArg, trainerUid) {
  if (trainerNameArg) return trainerNameArg;

  try {
    // vocab: getDoc = one-shot Firestore read (not a live listener).
    const trainerSnap = await getDoc(doc(db, USERS_COLLECTION, trainerUid));
    const trainerData = trainerSnap.data();
    const nameFromProfile =
      trainerData?.displayName || trainerData?.name || trainerData?.firstName;
    if (nameFromProfile) return nameFromProfile;
    return FALLBACK_TRAINER_NAME;
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
  const labelParts = [dateLabel, timeLabel].filter(Boolean);
  if (labelParts.length > 0) {
    return `Session scheduled: ${labelParts.join(' at ')}`;
  }
  return 'You have a new scheduled session.';
}

/**
 * Server relay path. Plain boolean — every failure here is treated the same: fall back / give up.
 * @param {{ recipientId: string, senderName: string, messageText: string, senderId: string, notificationType: string }} args
 * @returns {Promise<boolean>}
 */
async function tryServerNotify({
  recipientId,
  senderName,
  messageText,
  senderId,
  notificationType,
}) {
  try {
    const apiBaseUrl = String(getApiBase() || '').replace(/\/$/, '');
    if (!apiBaseUrl) return false;

    const headers = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
    if (!headers.Authorization) return false;

    const response = await fetch(`${apiBaseUrl}/api/notifications/send`, {
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
    const responseJson = await response.json().catch(() => ({}));
    if (responseJson?.success === true) return true;
  } catch {
    // Fall through — caller will treat false as “try the other channel / give up”.
  }
  return false;
}

/**
 * True when the token is one of the two Expo formats we can send to exp.host.
 * @param {string} expoPushToken
 * @returns {boolean}
 */
function isSupportedExpoToken(expoPushToken) {
  const startsWithKnownPrefix =
    expoPushToken.startsWith(EXPO_TOKEN_PREFIX_A) ||
    expoPushToken.startsWith(EXPO_TOKEN_PREFIX_B);
  return startsWithKnownPrefix;
}

/**
 * Read the Expo push token from a users/{clientId} doc (either field name the app has used).
 * @param {object|undefined} userData
 * @returns {string|null}
 */
function pushTokenFromUserData(userData) {
  const tokenCandidate = userData?.expoPushToken || userData?.pushToken;
  if (!tokenCandidate || typeof tokenCandidate !== 'string') return null;
  return tokenCandidate;
}

/**
 * Build the Expo push payload for a session_scheduled alert.
 * Field letters in `data` stay frozen for the client notification handler.
 * @param {{ expoPushToken: string, title: string, body: string, clientId: string, trainerUid: string, sessionId: string }} args
 * @returns {object}
 */
function buildExpoPushPayload({
  expoPushToken,
  title,
  body,
  clientId,
  trainerUid,
  sessionId,
}) {
  return {
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
  };
}

/**
 * Direct-to-Expo path. Every early return names a distinct reason so the caller can tell
 * “can’t ever work” from “try the other channel”.
 * @param {{ clientId: string, trainerUid: string, sessionId: string, title: string, body: string }} args
 * @returns {Promise<{ ok: boolean, channel?: string, reason?: string }>}
 */
async function sendExpoDirect({ clientId, trainerUid, sessionId, title, body }) {
  try {
    const clientSnap = await getDoc(doc(db, USERS_COLLECTION, clientId));
    // Keep `.exists` property check — same behavior as before (modular snap).
    if (!clientSnap.exists) {
      console.warn('[session push] Client user doc missing', clientId);
      return { ok: false, reason: 'no_user_doc' };
    }

    const expoPushToken = pushTokenFromUserData(clientSnap.data());
    if (!expoPushToken) {
      console.warn(
        '[session push] No Expo push token on client — open client app once & allow notifications',
      );
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
      body: JSON.stringify(
        buildExpoPushPayload({
          expoPushToken,
          title,
          body,
          clientId,
          trainerUid,
          sessionId,
        }),
      ),
    });

    const responseJson = await response.json().catch(() => ({}));
    // vocab: ticket = Expo’s per-message receipt. status 'ok' means Expo ACCEPTED it, not that the phone showed it.
    const expoTicket = responseJson?.data?.[0];
    if (expoTicket?.status === 'ok') {
      console.log('[session push] Expo delivered');
      return { ok: true, channel: 'expo_direct' };
    }
    console.warn('[session push] Expo ticket', expoTicket);
    return { ok: false, reason: expoTicket?.message || 'expo_error' };
  } catch (error) {
    console.warn('[session push] failed', error?.message || error);
    return { ok: false, reason: 'exception' };
  }
}

/**
 * Fatal direct failures the server cannot fix — skip the extra network call and keep the reason.
 * @param {string} reason
 * @returns {boolean}
 */
function isTerminalPushFailure(reason) {
  return reason === 'no_push_token' || reason === 'no_user_doc';
}

// ===== MAIN FUNCTION =====

/**
 * Send a session-scheduled push to the client from the trainer app.
 * Returns a result object instead of throwing: a failed notification must never roll back a saved session.
 * @param {{ clientId: string, trainerUid: string, date: string, time: string, sessionId?: string, trainerName?: string }} args
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
  // 1. Bail before any network if we cannot address the recipient or sender.
  if (!clientId || !trainerUid) {
    return { ok: false, reason: 'missing_ids' };
  }

  // 2. Build human-readable copy (random title/body templates live in writeAlertText.js).
  const trainerName = await resolveTrainerDisplayName(trainerNameArg, trainerUid);
  const messageText = sessionDetailLine(date, time);
  const title = randomSessionScheduledTitle(trainerName);
  const body = randomSessionScheduledDetailBody(trainerName, messageText);

  // 3. Prefer direct Expo from the device — no Node server required.
  const directResult = await sendExpoDirect({
    clientId,
    trainerUid,
    sessionId,
    title,
    body,
  });
  if (directResult.ok) return directResult;
  if (isTerminalPushFailure(directResult.reason)) return directResult;

  // 4. Fall back to our API relay when direct failed for a recoverable reason.
  const serverSucceeded = await tryServerNotify({
    recipientId: clientId,
    senderName: trainerName,
    messageText,
    senderId: trainerUid,
    notificationType: NOTIFICATION_TYPE_SESSION,
  });
  if (serverSucceeded) {
    return { ok: true, channel: 'server' };
  }

  // 5. Return the direct failure so the UI can log or toast without throwing.
  return directResult;
}
