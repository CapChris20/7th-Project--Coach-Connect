// Sends the "your coach scheduled a session" push notification straight from the trainer's device.
// Flow: resolve the trainer's name → build title/body copy → try a DIRECT Expo push first → if that
// fails for a non-fatal reason, fall back to our own API endpoint.
// Why direct-first: this path works with no Node server and no Cloud Functions deployed, so a
// trainer can schedule a session and the client still gets notified.

/**
 * Send a session-scheduled push to the client from the trainer app.
 * Does not require the Node server or Cloud Functions (reads client pushToken from users/{clientId}).
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import { getApiBase } from '../../for-both/online-connection/whereToConnect';
import { getApiAuthHeaders } from '../../for-both/online-connection/attachLoginProof';
import {
  randomSessionScheduledTitle,
  randomSessionScheduledDetailBody,
} from '../../notifications/writeAlertText';

// vocab: Expo's hosted push relay. You POST a token + message here and Expo forwards it to
// Apple's APNs or Google's FCM, which is why the app never touches those services directly.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// "14:30" → "2:30 PM". Sessions are stored as 24-hour strings; notification copy reads better in
// 12-hour form.
function formatTime12(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return '';
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  // `mStr || '0'` covers a bare "14" with no minutes.
  const m = parseInt(mStr || '0', 10);
  // Unparseable hour → return the original string rather than showing "NaN:00" in a push.
  if (Number.isNaN(h)) return hhmm;
  const ampm = h >= 12 ? 'PM' : 'AM';
  // The ((h + 11) % 12) + 1 trick maps 0→12, 13→1, 12→12 in one expression — the plain h % 12
  // would wrongly turn both midnight and noon into "0".
  const h12 = ((h + 11) % 12) + 1;
  // padStart keeps "2:5 PM" from happening — minutes are always two digits.
  return `${h12}:${String(Number.isNaN(m) ? 0 : m).padStart(2, '0')} ${ampm}`;
}

// "2026-03-14" → "Sat, Mar 14".
function formatDateShort(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '';
  // slice(0,10) tolerates a full ISO timestamp being passed in, and the 'T12:00:00' anchor at local
  // noon prevents the classic off-by-one-day bug (a bare date parses as UTC midnight, which is the
  // previous day in western timezones).
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  // Manipulate here: the date format used in the notification body.
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Try server endpoint first (if API is up). Falls back to direct Expo push from device.
 * @returns {{ ok: boolean, channel?: string, reason?: string }}
 */
// Returns a result object instead of throwing, because the caller (a scheduling screen) needs to
// know WHY delivery failed to decide whether to warn the trainer — and a failed notification must
// never roll back a successfully saved session.
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

  // Use the caller's trainer name if it has one (saves a read), otherwise fetch it. The immediately
  // -invoked async function is what lets a try/catch live inside this single expression.
  // Manipulate here: 'Your coach' is the fallback name, used both when the fetch fails and when the
  // trainer's profile has no name field at all.
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

  // Build the detail line from whichever parts we have. filter(Boolean) then join(' at ') is what
  // produces "Sat, Mar 14 at 2:30 PM", or just the date if the time is missing — never a dangling
  // " at " with nothing after it.
  const dateLabel = formatDateShort(String(date || ''));
  const timeLabel = formatTime12(String(time || ''));
  const bits = [dateLabel, timeLabel].filter(Boolean);
  // Manipulate here: these two strings are the notification's detail line.
  const messageText =
    bits.length > 0
      ? `Session scheduled: ${bits.join(' at ')}`
      : 'You have a new scheduled session.';

  // Title and body are randomized from a copy pool so repeat notifications don't read identically.
  const title = randomSessionScheduledTitle(trainerName);
  const body = randomSessionScheduledDetailBody(trainerName, messageText);

  // ATTEMPT 1 — direct to Expo. Tried first because it needs no backend of ours to be running.
  const direct = await sendExpoDirect({
    clientId,
    trainerUid,
    sessionId,
    title,
    body,
  });
  if (direct.ok) return direct;

  // These two failures are TERMINAL, not transport problems: the client has no push token (never
  // opened the app or denied notifications) or has no user doc. Our server can't fix either, so
  // returning early avoids a pointless network call and preserves the specific reason for the UI.
  if (direct.reason === 'no_push_token' || direct.reason === 'no_user_doc') {
    return direct;
  }

  // ATTEMPT 2 — our API. Reached only when the direct send failed for some OTHER reason (Expo
  // rejected it, network hiccup), where a server with different credentials might still succeed.
  const apiOk = await tryServerNotify({
    recipientId: clientId,
    senderName: trainerName,
    messageText,
    senderId: trainerUid,
    notificationType: 'session_scheduled',
  });
  if (apiOk) return { ok: true, channel: 'server' };

  // Both failed — return the DIRECT result, since its reason is the more specific diagnostic.
  return direct;
}

// Server path. Returns a plain boolean (not a result object) because every failure here is treated
// identically by the caller: fall back.
async function tryServerNotify({ recipientId, senderName, messageText, senderId, notificationType }) {
  try {
    // Strip a trailing slash so the template below can't produce a double slash in the URL.
    const base = String(getApiBase() || '').replace(/\/$/, '');
    // No API configured (common in local/offline builds) — bail before attempting a fetch.
    if (!base) return false;
    const headers = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
    // No auth token means the request would be rejected anyway, so skip the round trip.
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
    // `.catch(() => ({}))` guards against a non-JSON error page (an HTML 502, say) throwing during
    // parse — we'd rather treat that as "not successful" than crash.
    const json = await res.json().catch(() => ({}));
    // Strict === true: only an explicit success flag counts. Note we don't check res.ok, because
    // this endpoint reports application-level outcomes in the body.
    if (json?.success === true) return true;
  } catch {
    // fall through to direct Expo
  }
  return false;
}

// Direct-to-Expo path. Every early return names a distinct reason so the caller can distinguish
// "can't ever work" from "try the other channel".
async function sendExpoDirect({ clientId, trainerUid, sessionId, title, body }) {
  try {
    const snap = await getDoc(doc(db, 'users', clientId));
    if (!snap.exists) {
      console.warn('[session push] Client user doc missing', clientId);
      return { ok: false, reason: 'no_user_doc' };
    }
    // Two field names because the token has been stored under both across app versions.
    const expoPushToken = snap.data()?.expoPushToken || snap.data()?.pushToken;
    if (!expoPushToken || typeof expoPushToken !== 'string') {
      // The log spells out the fix, since this is by far the most common cause of "my client didn't
      // get the notification".
      console.warn('[session push] No Expo push token on client — open client app once & allow notifications');
      return { ok: false, reason: 'no_push_token' };
    }
    // Validate the token shape locally so we don't burn a network call on a token we know Expo will
    // reject. Both prefixes are legitimate Expo formats.
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
        // Manipulate here: the delivery/attention settings.
        //   sound 'default'          = play the standard notification tone (null for silent)
        //   priority 'high'          = wake the device now rather than batching for later
        //   channelId 'default'      = Android notification channel (must exist on the client)
        //   interruptionLevel 'active' = iOS 15+; shows even in some Focus modes
        sound: 'default',
        priority: 'high',
        channelId: 'default',
        interruptionLevel: 'active',
        // `data` is the invisible payload the client app reads on tap to deep-link straight to the
        // session. The `type` string is what the client's notification handler matches on, so it
        // must stay in sync with that handler.
        data: {
          type: 'session_scheduled',
          clientId,
          trainerId: trainerUid || '',
          sessionId: sessionId || '',
        },
      }),
    });

    const json = await res.json().catch(() => ({}));
    // vocab: ticket = Expo's per-message receipt. We send one message, so it's data[0]. status 'ok'
    // means Expo ACCEPTED it for delivery — not that the phone has shown it yet.
    const ticket = json?.data?.[0];
    if (ticket?.status === 'ok') {
      console.log('[session push] Expo delivered');
      return { ok: true, channel: 'expo_direct' };
    }
    console.warn('[session push] Expo ticket', ticket);
    // Prefer Expo's own message (e.g. "DeviceNotRegistered") over a generic label — it's the
    // actionable detail when debugging a delivery failure.
    return { ok: false, reason: ticket?.message || 'expo_error' };
  } catch (e) {
    console.warn('[session push] failed', e?.message || e);
    return { ok: false, reason: 'exception' };
  }
}
