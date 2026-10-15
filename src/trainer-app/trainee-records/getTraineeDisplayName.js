// Works out the best human name to show for a client on the trainer's roster.
// Flow: try every name field on users/{uid} → then the trainer's CRM row → then humanize an email local part → "Client".
// Used by the roster loader. Names arrive from signup, onboarding, Google/Apple OAuth, and profile edits.

// ===== NAMED CONSTANTS =====

// Manipulate here: placeholder values that must never be shown as if they were a real name. All
// lowercase because the check below lowercases its input first. A Set gives O(1) lookups.
const GENERIC_DISPLAY = new Set([
  '',
  'client',
  'no name',
  'unknown',
  'user',
  'n/a',
  'na',
  'none',
  'unnamed',
]);

const FALLBACK_CLIENT_LABEL = 'Client';
const WEAK_NAME_MAX_LENGTH = 2;

// ===== HELPER FUNCTIONS =====

/**
 * The single gate every candidate passes through: non-empty, not a placeholder, not too short.
 * @param {*} value
 * @returns {boolean}
 */
function isUsableDisplayName(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return false;
  if (isGenericClientDisplayName(trimmed)) return false;
  if (isWeakClientDisplayName(trimmed)) return false;
  return true;
}

/**
 * Join name parts, skipping the missing ones so "Jane" + missing last does not become "Jane ".
 * @param {...*} parts
 * @returns {string}
 */
function trimJoin(...parts) {
  return parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

/**
 * Prefer real profile names before handles / usernames (which are often email locals like "cc").
 * The ORDER of this array is the entire preference policy — firstUsableName takes the first that passes.
 * @param {object} record
 * @returns {Array}
 */
function nameCandidatesFromRecord(record) {
  if (!record || typeof record !== 'object') return [];
  return [
    record.name,
    record.displayName,
    record.fullName,
    record.full_name,
    trimJoin(record.firstName, record.lastName),
    trimJoin(record.givenName, record.familyName),
    record.firstName,
    record.givenName,
    record.preferredName,
    record.preferred_name,
    record.nickname,
    record.clientName,
    record.profileName,
    record.legalName,
    record.Name,
    record.DisplayName,
    record.userName,
    record.username,
  ];
}

/**
 * Walk the candidate list in order and return the first genuinely usable one, else ''.
 * @param {Array} candidates
 * @returns {string}
 */
function firstUsableName(candidates) {
  for (const raw of candidates) {
    const trimmed = String(raw ?? '').trim();
    if (isUsableDisplayName(trimmed)) return trimmed;
  }
  return '';
}

/**
 * Pull the part before '@'. split('@')[0] on a string with no '@' returns the whole string.
 * @param {...*} emails
 * @returns {string[]}
 */
function emailLocalParts(...emails) {
  const locals = [];
  for (const email of emails) {
    const local = String(email ?? '')
      .split('@')[0]
      .trim();
    if (local) locals.push(local);
  }
  return locals;
}

/**
 * Last-resort name: "jane.doe" → "Jane Doe", "janedoe" → "Janedoe".
 * @param {string} local
 * @returns {string}
 */
function humanizeEmailLocal(local) {
  const raw = String(local ?? '').trim();
  if (!raw) return '';
  // Manipulate here: . _ - are treated as word separators.
  if (raw.includes('.') || raw.includes('_') || raw.includes('-')) {
    return raw
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

// ===== MAIN FUNCTION =====

/**
 * Also used by the roster loader to decide whether a CRM row's name is worth self-healing.
 * vocab/symbol: ?? '' handles both null and undefined before String() can turn them into "null".
 * @param {*} value
 * @returns {boolean}
 */
export function isGenericClientDisplayName(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return GENERIC_DISPLAY.has(normalized);
}

/**
 * Too short to be a real name (e.g. email local "cc", handle "ab").
 * Manipulate here: 2 characters is the cutoff. Raising it risks rejecting real short names.
 * @param {*} value
 * @returns {boolean}
 */
export function isWeakClientDisplayName(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return true;
  if (trimmed.length <= WEAK_NAME_MAX_LENGTH) return true;
  return false;
}

/**
 * @param {Record<string, unknown>} crmRow — doc from trainer_clients/.../clients/{id}
 * @param {Record<string, unknown>} userData — users/{id} data (optional)
 * @returns {string}
 */
export function resolveTrainerClientDisplayName(crmRow = {}, userData = {}) {
  // Re-defaulted here because a caller can pass an explicit null, which skips parameter defaults.
  const userRecord = userData || {};
  const crmRecord = crmRow || {};

  const fromUser = firstUsableName(nameCandidatesFromRecord(userRecord));
  if (fromUser) return fromUser;

  const fromCrm = firstUsableName(nameCandidatesFromRecord(crmRecord));
  if (fromCrm) return fromCrm;

  for (const local of emailLocalParts(
    userRecord.email,
    userRecord.userEmail,
    userRecord.primaryEmail,
    crmRecord.email,
  )) {
    const humanized = humanizeEmailLocal(local);
    if (isUsableDisplayName(humanized)) return humanized;
  }

  return FALLBACK_CLIENT_LABEL;
}
