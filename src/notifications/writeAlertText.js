// Builds the human copy for push notifications, picking a random phrasing each time.
// Flow: pull a variant list from config/pushNotificationCopy.json → pick one at random →
//       substitute {{trainerName}} / {{clientName}} placeholders → return the finished string.
// Used by: session alerts, client-request alerts, and notes-shared alerts. Randomizing prevents
// identical notification text every day. A missing JSON key falls back to plain copy.

// Manipulate here: all the phrasing variants live in config/pushNotificationCopy.json,
//                  NOT in this file. Add a string to a list there to add a new variant.
import COPY from '../../config/pushNotificationCopy.json';

// ===== NAMED CONSTANTS =====

const COPY_PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;
const DEFAULT_TRAINER_NAME = 'Your coach';
const DEFAULT_CLIENT_NAME = 'Client';
const SESSION_STATUS_ACCEPTED = 'accepted';
const SESSION_STATUS_DECLINED = 'declined';
const SESSION_STATUS_UPDATED = 'updated';
const SESSION_UPDATED_FALLBACK = 'Your session was updated.';
const SESSION_CANCELLED_FALLBACK = 'A scheduled session was cancelled.';
const SESSION_RESPONSE_FALLBACK_TEMPLATE = '{{clientName}} updated a session.';
const NOTES_SHARED_FALLBACK = 'Shared something new in Notes & Files.';
const CLIENT_REQUEST_FALLBACK_TITLE = 'New client request';
const SESSION_SCHEDULED_FALLBACK_TITLE = 'Session scheduled';
// Manipulate here: ' — ' is the separator between flavor copy and the session details
const DETAIL_LINE_SEPARATOR = ' — ';

// ===== HELPER FUNCTIONS =====

/**
 * Fills {{placeholders}} in a copy template.
 * vocab: /\{\{(\w+)\}\}/g = matches "{{word}}"; the backslashes escape the literal braces
 *        and (\w+) captures the name inside so we can look it up in placeholderValues.
 * Missing values become '' rather than the literal "undefined".
 * @param {*} template
 * @param {object} placeholderValues
 * @returns {string}
 */
function fillCopyPlaceholders(template, placeholderValues) {
  return String(template || '').replace(COPY_PLACEHOLDER_PATTERN, (_fullMatch, placeholderName) => {
    const replacement = placeholderValues[placeholderName];
    if (replacement != null && replacement !== '') return String(replacement);
    return '';
  });
}

/**
 * @param {string} trainerName
 * @returns {string}
 */
function trainerNameOrDefault(trainerName) {
  return trainerName || DEFAULT_TRAINER_NAME;
}

/**
 * @param {string} clientName
 * @returns {string}
 */
function clientNameOrDefault(clientName) {
  return clientName || DEFAULT_CLIENT_NAME;
}

/**
 * Anything that isn't accepted/declined degrades to the neutral "updated".
 * @param {string} status
 * @returns {string}
 */
function sessionResponseVerb(status) {
  if (status === SESSION_STATUS_ACCEPTED) return SESSION_STATUS_ACCEPTED;
  if (status === SESSION_STATUS_DECLINED) return SESSION_STATUS_DECLINED;
  return SESSION_STATUS_UPDATED;
}

/**
 * @param {string} bodyText
 * @returns {boolean}
 */
function doesBodyNameAcceptOrDecline(bodyText) {
  return bodyText.includes(SESSION_STATUS_ACCEPTED) || bodyText.includes(SESSION_STATUS_DECLINED);
}

// ===== MAIN FUNCTION =====

/**
 * Uniform random pick. Returns '' (never undefined) for an empty/missing list, which is
 * what lets every caller below use a simple `chosen ? ... : fallback` check.
 * @param {Array} copyList
 * @returns {string}
 */
export function pickRandom(copyList) {
  if (!Array.isArray(copyList) || !copyList.length) return '';
  return copyList[Math.floor(Math.random() * copyList.length)];
}

/**
 * @param {string} trainerName
 * @returns {string}
 */
export function randomTrainerMessageTitle(trainerName) {
  const chosenTitle = pickRandom(COPY.trainerMessageTitles || []);
  return chosenTitle
    ? fillCopyPlaceholders(chosenTitle, { trainerName: trainerNameOrDefault(trainerName) })
    : trainerName || DEFAULT_TRAINER_NAME;
}

/**
 * @param {string} clientName
 * @returns {string}
 */
export function randomClientRequestTitle(clientName) {
  const chosenTitle = pickRandom(COPY.clientRequestTrainerTitles || []);
  return chosenTitle
    ? fillCopyPlaceholders(chosenTitle, { clientName: clientNameOrDefault(clientName) })
    : CLIENT_REQUEST_FALLBACK_TITLE;
}

/**
 * Generic session-updated body. No name substitution.
 * @returns {string}
 */
export function randomSessionUpdateClientBody() {
  return pickRandom(COPY.sessionUpdateClientBodies || [SESSION_UPDATED_FALLBACK]);
}

/**
 * Generic session-cancelled body. No name substitution.
 * @returns {string}
 */
export function randomSessionCancelledClientBody() {
  return pickRandom(COPY.sessionCancelledClientBodies || [SESSION_CANCELLED_FALLBACK]);
}

/**
 * The trainer must learn whether the client accepted or declined. If the randomly chosen
 * variant doesn't already contain that verb, we throw it away and use an explicit sentence.
 * @param {string} clientName
 * @param {string} status
 * @returns {string}
 */
export function randomSessionResponseTrainerMessage(clientName, status) {
  const chosenBody = pickRandom(COPY.sessionResponseTrainerBodies || [SESSION_RESPONSE_FALLBACK_TEMPLATE]);
  const verb = sessionResponseVerb(status);
  const filledBody = chosenBody
    ? fillCopyPlaceholders(chosenBody, { clientName: clientNameOrDefault(clientName) })
    : `${clientName} ${verb} a session.`;
  if (doesBodyNameAcceptOrDecline(filledBody)) return filledBody;
  return `${clientName} ${verb} a session.`;
}

/**
 * @returns {string}
 */
export function randomNotesSharedBody() {
  return pickRandom(COPY.notesSharedBodies || [NOTES_SHARED_FALLBACK]);
}

/**
 * @param {string} trainerName
 * @returns {string}
 */
export function randomClientRequestAcceptedTitle(trainerName) {
  const chosenTitle = pickRandom(COPY.clientRequestAcceptedTitles || []);
  return chosenTitle
    ? fillCopyPlaceholders(chosenTitle, { trainerName: trainerNameOrDefault(trainerName) })
    : `${trainerNameOrDefault(trainerName)} accepted your request`;
}

/**
 * @param {string} trainerName
 * @returns {string}
 */
export function randomClientRequestAcceptedBody(trainerName) {
  const chosenBody = pickRandom(COPY.clientRequestAcceptedBodies || []);
  return chosenBody
    ? fillCopyPlaceholders(chosenBody, { trainerName: trainerNameOrDefault(trainerName) })
    : `${trainerNameOrDefault(trainerName)} added you as a client.`;
}

/**
 * @param {string} trainerName
 * @returns {string}
 */
export function randomSessionScheduledTitle(trainerName) {
  const chosenTitle = pickRandom(COPY.sessionBookingTitles || []);
  return chosenTitle
    ? fillCopyPlaceholders(chosenTitle, { trainerName: trainerNameOrDefault(trainerName) })
    : SESSION_SCHEDULED_FALLBACK_TITLE;
}

/**
 * The only two-part body: random flavor text plus the caller's factual detail line,
 * joined by an em dash. The detail line is always kept — if there's no flavor variant,
 * the trainer's name stands in so the notification still reads as a sentence.
 * @param {string} trainerName
 * @param {string} detailLine e.g. "Session scheduled: Mon at 3:00 PM"
 * @returns {string}
 */
export function randomSessionScheduledDetailBody(trainerName, detailLine) {
  const chosenBody = pickRandom(COPY.sessionBookingBodies || []);
  const flavorLine = chosenBody
    ? fillCopyPlaceholders(chosenBody, { trainerName: trainerNameOrDefault(trainerName) })
    : '';
  if (flavorLine && detailLine) return `${flavorLine}${DETAIL_LINE_SEPARATOR}${detailLine}`;
  return `${trainerNameOrDefault(trainerName)}${DETAIL_LINE_SEPARATOR}${detailLine}`;
}
