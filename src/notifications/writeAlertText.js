// Builds the human copy for push notifications, picking a random phrasing each time.
// Flow: pull a variant list from config/pushNotificationCopy.json → pick one at random →
//       substitute {{trainerName}} / {{clientName}} placeholders → return the finished string.
// Randomizing prevents identical notification text every day. Every function has a hardcoded
// fallback so a missing/typo'd JSON key degrades to plain copy instead of an empty notification.

// Manipulate here: all the phrasing variants live in config/pushNotificationCopy.json,
//                  NOT in this file. Add a string to a list there to add a new variant.
import COPY from '../../config/pushNotificationCopy.json';

// Uniform random pick. Returns '' (never undefined) for an empty/missing list, which is
// what lets every caller below use a simple `t ? ... : fallback` check.
export function pickRandom(arr) {
  if (!Array.isArray(arr) || !arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

// Fills {{placeholders}} in a copy template.
// vocab: /\{\{(\w+)\}\}/g = matches "{{word}}"; the backslashes escape the literal braces
//        and (\w+) captures the name inside so we can look it up in `map`.
// Missing values become '' rather than the literal "undefined" — a slightly awkward
// sentence is far better than a notification reading "undefined sent you a message".
function sub(str, map) {
  return String(str || '').replace(/\{\{(\w+)\}\}/g, (_, k) =>
    map[k] != null && map[k] !== '' ? String(map[k]) : ''
  );
}

// Every function below follows the same three-step shape: pick → substitute → fallback.
// The `|| 'Your coach'` / `|| 'Client'` defaults cover records with no name on file.

export function randomTrainerMessageTitle(trainerName) {
  const t = pickRandom(COPY.trainerMessageTitles || []);
  return t ? sub(t, { trainerName: trainerName || 'Your coach' }) : trainerName || 'Your coach';
}

export function randomClientRequestTitle(clientName) {
  const t = pickRandom(COPY.clientRequestTrainerTitles || []);
  return t ? sub(t, { clientName: clientName || 'Client' }) : 'New client request';
}

// These two need no substitution — the copy is generic, so the fallback can live
// inline as pickRandom's argument.
export function randomSessionUpdateClientBody() {
  return pickRandom(COPY.sessionUpdateClientBodies || ['Your session was updated.']);
}

export function randomSessionCancelledClientBody() {
  return pickRandom(COPY.sessionCancelledClientBodies || ['A scheduled session was cancelled.']);
}

// The one case where correctness beats variety: the trainer must learn whether the client
// accepted or declined. If the randomly chosen variant doesn't already contain that verb,
// we throw it away and use an explicit sentence instead.
export function randomSessionResponseTrainerMessage(clientName, status) {
  const t = pickRandom(COPY.sessionResponseTrainerBodies || ['{{clientName}} updated a session.']);
  // Anything that isn't accepted/declined degrades to the neutral "updated".
  const verb =
    status === 'accepted' ? 'accepted' : status === 'declined' ? 'declined' : 'updated';
  const base = t ? sub(t, { clientName: clientName || 'Client' }) : `${clientName} ${verb} a session.`;
  if (base.includes('accepted') || base.includes('declined')) return base;
  return `${clientName} ${verb} a session.`;
}

export function randomNotesSharedBody() {
  return pickRandom(COPY.notesSharedBodies || ['Shared something new in Notes & Files.']);
}

export function randomClientRequestAcceptedTitle(trainerName) {
  const t = pickRandom(COPY.clientRequestAcceptedTitles || []);
  return t
    ? sub(t, { trainerName: trainerName || 'Your coach' })
    : `${trainerName || 'Your coach'} accepted your request`;
}

export function randomClientRequestAcceptedBody(trainerName) {
  const b = pickRandom(COPY.clientRequestAcceptedBodies || []);
  return b
    ? sub(b, { trainerName: trainerName || 'Your coach' })
    : `${trainerName || 'Your coach'} added you as a client.`;
}

export function randomSessionScheduledTitle(trainerName) {
  const t = pickRandom(COPY.sessionBookingTitles || []);
  return t ? sub(t, { trainerName: trainerName || 'Your coach' }) : 'Session scheduled';
}

/** detailLine e.g. "Session scheduled: Mon at 3:00 PM" */
// The only two-part body: random flavor text plus the caller's factual detail line,
// joined by an em dash. The detail line is always kept — if there's no flavor variant,
// the trainer's name stands in so the notification still reads as a sentence.
export function randomSessionScheduledDetailBody(trainerName, detailLine) {
  const b = pickRandom(COPY.sessionBookingBodies || []);
  const line = b ? sub(b, { trainerName: trainerName || 'Your coach' }) : '';
  // Manipulate here: ' — ' is the separator between flavor copy and the session details
  if (line && detailLine) return `${line} — ${detailLine}`;
  return `${trainerName || 'Your coach'} — ${detailLine}`;
}
