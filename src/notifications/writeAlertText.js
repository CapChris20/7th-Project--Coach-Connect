// Human-readable push notification copy with randomized phrasing per alert type.
// Flow: load variant lists from pushNotificationCopy.json → pick one at random → fill {{placeholders}} → return.
// Used by: session alerts, client-request alerts, notes-shared alerts. Variants live in JSON, not here.
// Manipulate here: add phrasing in config/pushNotificationCopy.json — this file only picks and substitutes.

import COPY from '../../config/pushNotificationCopy.json';

// ===== NAMED CONSTANTS =====

const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;
const DEFAULT_TRAINER_NAME = 'Your coach';
const DEFAULT_CLIENT_NAME = 'Client';
const SESSION_ACCEPTED = 'accepted';
const SESSION_DECLINED = 'declined';
const SESSION_UPDATED = 'updated';
const SESSION_UPDATED_FALLBACK = 'Your session was updated.';
const SESSION_CANCELLED_FALLBACK = 'A scheduled session was cancelled.';
const SESSION_RESPONSE_TEMPLATE = '{{clientName}} updated a session.';
const NOTES_SHARED_FALLBACK = 'Shared something new in Notes & Files.';
const CLIENT_REQUEST_TITLE_FALLBACK = 'New client request';
const SESSION_SCHEDULED_TITLE_FALLBACK = 'Session scheduled';
// Manipulate here: em dash between flavor line and factual session detail in scheduled bodies
const FLAVOR_AND_DETAIL_SEPARATOR = ' — ';

// ===== HELPER FUNCTIONS =====
// Placeholder fill / display-name helpers sit under PLUMBING. Exported recipes follow.

// ===== MAIN FUNCTION =====

/**
 * Uniform random pick. Returns '' for empty lists so callers can use `chosen ? … : fallback`.
 * @param {Array} copyList
 * @returns {string}
 */
export function pickRandom(copyList) {
  const listIsMissing = !Array.isArray(copyList);
  if (listIsMissing) return '';
  const listIsEmpty = !copyList.length;
  if (listIsEmpty) return '';
  const randomIndex = Math.floor(Math.random() * copyList.length);
  return copyList[randomIndex];
}

/**
 * @param {string} trainerName
 * @returns {string}
 */
export function randomTrainerMessageTitle(trainerName) {
  // 1. Pick a title variant from JSON.
  const titleVariants = COPY.trainerMessageTitles || [];
  const pickedTitle = pickRandom(titleVariants);

  // 2. No variant → show the trainer name alone.
  if (!pickedTitle) return trainerName || DEFAULT_TRAINER_NAME;

  // 3. Fill {{trainerName}} and return.
  return fillPlaceholders(pickedTitle, {
    trainerName: displayNameForTrainer(trainerName),
  });
}

/**
 * @param {string} clientName
 * @returns {string}
 */
export function randomClientRequestTitle(clientName) {
  // 1. Pick a trainer-facing title for a new client request.
  const titleVariants = COPY.clientRequestTrainerTitles || [];
  const pickedTitle = pickRandom(titleVariants);

  // 2. No variant → fixed fallback.
  if (!pickedTitle) return CLIENT_REQUEST_TITLE_FALLBACK;

  // 3. Fill {{clientName}} and return.
  return fillPlaceholders(pickedTitle, {
    clientName: displayNameForClient(clientName),
  });
}

/**
 * @returns {string}
 */
export function randomSessionUpdateClientBody() {
  const bodyVariants = COPY.sessionUpdateClientBodies || [SESSION_UPDATED_FALLBACK];
  return pickRandom(bodyVariants);
}

/**
 * @returns {string}
 */
export function randomSessionCancelledClientBody() {
  const bodyVariants = COPY.sessionCancelledClientBodies || [SESSION_CANCELLED_FALLBACK];
  return pickRandom(bodyVariants);
}

/**
 * Trainer copy must mention accept or decline when that is the session outcome.
 * @param {string} clientName
 * @param {string} status
 * @returns {string}
 */
export function randomSessionResponseTrainerMessage(clientName, status) {
  // 1. Pick a body and normalize the verb (accepted / declined / updated).
  const bodyVariants = COPY.sessionResponseTrainerBodies || [SESSION_RESPONSE_TEMPLATE];
  const pickedBody = pickRandom(bodyVariants);
  const responseVerb = sessionResponseVerbFromStatus(status);
  const clientLabel = displayNameForClient(clientName);

  // 2. Fill placeholders, or build a plain sentence if the list was empty.
  let filledBody;
  if (pickedBody) {
    filledBody = fillPlaceholders(pickedBody, { clientName: clientLabel });
  } else {
    filledBody = `${clientName} ${responseVerb} a session.`;
  }

  // 3. If the flavor line already says accept/decline, keep it; otherwise force the verb in.
  const bodyAlreadyNamesOutcome = bodyMentionsAcceptOrDecline(filledBody);
  if (bodyAlreadyNamesOutcome) return filledBody;
  return `${clientName} ${responseVerb} a session.`;
}

/**
 * @returns {string}
 */
export function randomNotesSharedBody() {
  const bodyVariants = COPY.notesSharedBodies || [NOTES_SHARED_FALLBACK];
  return pickRandom(bodyVariants);
}

/**
 * @param {string} trainerName
 * @returns {string}
 */
export function randomClientRequestAcceptedTitle(trainerName) {
  // 1. Pick an accepted-request title.
  const titleVariants = COPY.clientRequestAcceptedTitles || [];
  const pickedTitle = pickRandom(titleVariants);
  const trainerLabel = displayNameForTrainer(trainerName);

  // 2. No variant → plain sentence with the trainer name.
  if (!pickedTitle) return `${trainerLabel} accepted your request`;

  // 3. Fill {{trainerName}} and return.
  return fillPlaceholders(pickedTitle, { trainerName: trainerLabel });
}

/**
 * @param {string} trainerName
 * @returns {string}
 */
export function randomClientRequestAcceptedBody(trainerName) {
  // 1. Pick an accepted-request body.
  const bodyVariants = COPY.clientRequestAcceptedBodies || [];
  const pickedBody = pickRandom(bodyVariants);
  const trainerLabel = displayNameForTrainer(trainerName);

  // 2. No variant → plain sentence.
  if (!pickedBody) return `${trainerLabel} added you as a client.`;

  // 3. Fill {{trainerName}} and return.
  return fillPlaceholders(pickedBody, { trainerName: trainerLabel });
}

/**
 * @param {string} trainerName
 * @returns {string}
 */
export function randomSessionScheduledTitle(trainerName) {
  // 1. Pick a scheduled-session title.
  const titleVariants = COPY.sessionBookingTitles || [];
  const pickedTitle = pickRandom(titleVariants);

  // 2. No variant → fixed fallback.
  if (!pickedTitle) return SESSION_SCHEDULED_TITLE_FALLBACK;

  // 3. Fill {{trainerName}} and return.
  return fillPlaceholders(pickedTitle, {
    trainerName: displayNameForTrainer(trainerName),
  });
}

/**
 * Two-part body: random flavor plus caller's factual detail line (detail is always kept).
 * @param {string} trainerName
 * @param {string} detailLine
 * @returns {string}
 */
export function randomSessionScheduledDetailBody(trainerName, detailLine) {
  // 1. Pick flavor copy and fill the trainer name.
  const bodyVariants = COPY.sessionBookingBodies || [];
  const pickedBody = pickRandom(bodyVariants);
  const trainerLabel = displayNameForTrainer(trainerName);

  let flavorLine = '';
  if (pickedBody) {
    flavorLine = fillPlaceholders(pickedBody, { trainerName: trainerLabel });
  }

  // 2. Join flavor + detail when both exist; otherwise trainer label + detail.
  const hasFlavor = Boolean(flavorLine);
  const hasDetail = Boolean(detailLine);
  if (hasFlavor && hasDetail) {
    return `${flavorLine}${FLAVOR_AND_DETAIL_SEPARATOR}${detailLine}`;
  }
  return `${trainerLabel}${FLAVOR_AND_DETAIL_SEPARATOR}${detailLine}`;
}

// ===== PLUMBING — skip unless debugging =====

/**
 * Replaces {{name}} tokens; missing values become '' not the string "undefined".
 * @param {*} template
 * @param {object} placeholderValues
 * @returns {string}
 */
function fillPlaceholders(template, placeholderValues) {
  const templateText = String(template || '');
  return templateText.replace(PLACEHOLDER_PATTERN, (_fullMatch, placeholderName) => {
    const replacement = placeholderValues[placeholderName];
    const replacementIsUsable = replacement != null && replacement !== '';
    if (replacementIsUsable) return String(replacement);
    return '';
  });
}

/**
 * @param {string} trainerName
 * @returns {string}
 */
function displayNameForTrainer(trainerName) {
  return trainerName || DEFAULT_TRAINER_NAME;
}

/**
 * @param {string} clientName
 * @returns {string}
 */
function displayNameForClient(clientName) {
  return clientName || DEFAULT_CLIENT_NAME;
}

/**
 * Anything outside accepted/declined reads as neutral "updated".
 * @param {string} status
 * @returns {string}
 */
function sessionResponseVerbFromStatus(status) {
  if (status === SESSION_ACCEPTED) return SESSION_ACCEPTED;
  if (status === SESSION_DECLINED) return SESSION_DECLINED;
  return SESSION_UPDATED;
}

/**
 * @param {string} bodyText
 * @returns {boolean}
 */
function bodyMentionsAcceptOrDecline(bodyText) {
  const mentionsAccepted = bodyText.includes(SESSION_ACCEPTED);
  if (mentionsAccepted) return true;
  const mentionsDeclined = bodyText.includes(SESSION_DECLINED);
  return mentionsDeclined;
}
