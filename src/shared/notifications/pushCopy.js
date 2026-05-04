import COPY from '../../../config/pushNotificationCopy.json';

export function pickRandom(arr) {
  if (!Array.isArray(arr) || !arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

function sub(str, map) {
  return String(str || '').replace(/\{\{(\w+)\}\}/g, (_, k) =>
    map[k] != null && map[k] !== '' ? String(map[k]) : ''
  );
}

export function randomTrainerMessageTitle(trainerName) {
  const t = pickRandom(COPY.trainerMessageTitles || []);
  return t ? sub(t, { trainerName: trainerName || 'Your coach' }) : trainerName || 'Your coach';
}

export function randomClientRequestTitle(clientName) {
  const t = pickRandom(COPY.clientRequestTrainerTitles || []);
  return t ? sub(t, { clientName: clientName || 'Client' }) : 'New client request';
}

export function randomSessionUpdateClientBody() {
  return pickRandom(COPY.sessionUpdateClientBodies || ['Your session was updated.']);
}

export function randomSessionCancelledClientBody() {
  return pickRandom(COPY.sessionCancelledClientBodies || ['A scheduled session was cancelled.']);
}

export function randomSessionResponseTrainerMessage(clientName, status) {
  const t = pickRandom(COPY.sessionResponseTrainerBodies || ['{{clientName}} updated a session.']);
  const verb =
    status === 'accepted' ? 'accepted' : status === 'declined' ? 'declined' : 'updated';
  const base = t ? sub(t, { clientName: clientName || 'Client' }) : `${clientName} ${verb} a session.`;
  if (base.includes('accepted') || base.includes('declined')) return base;
  return `${clientName} ${verb} a session.`;
}

export function randomNotesSharedBody() {
  return pickRandom(COPY.notesSharedBodies || ['Shared something new in Notes & Files.']);
}

export function randomSessionScheduledTitle(trainerName) {
  const t = pickRandom(COPY.sessionBookingTitles || []);
  return t ? sub(t, { trainerName: trainerName || 'Your coach' }) : 'Session scheduled';
}

/** detailLine e.g. "Session scheduled: Mon at 3:00 PM" */
export function randomSessionScheduledDetailBody(trainerName, detailLine) {
  const b = pickRandom(COPY.sessionBookingBodies || []);
  const line = b ? sub(b, { trainerName: trainerName || 'Your coach' }) : '';
  if (line && detailLine) return `${line} — ${detailLine}`;
  return `${trainerName || 'Your coach'} — ${detailLine}`;
}
