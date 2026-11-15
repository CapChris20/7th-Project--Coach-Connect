// Picks the best human name to show for a client on the trainer roster.
// Flow: users/{uid} name fields → trainer CRM row → humanize email local → "Client".
// Used by the roster loader. Names arrive from signup, onboarding, Google/Apple, and edits.
// Read order: constants → exported gates + resolveTrainerClientDisplayName → PLUMBING.

// ===== NAMED CONSTANTS =====

// Manipulate here: placeholder values that must never look like a real name.
// All lowercase because the check lowercases its input first. Set = O(1) lookup.
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
// Manipulate here: 2 characters is the cutoff. Raising it risks rejecting real short names.
const WEAK_NAME_MAX_LENGTH = 2;

// ===== HELPER FUNCTIONS =====

/**
 * True when the value is empty or a known placeholder (“Client”, “n/a”, …).
 * Also used by the roster loader to decide whether a CRM row’s name is worth self-healing.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isGenericClientDisplayName(value) {
  // vocab/symbol: ?? '' handles both null and undefined before String() can become "null".
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return GENERIC_DISPLAY.has(normalized);
}

/**
 * True when the value is empty or too short to be a real name (e.g. "cc", "ab").
 * @param {unknown} value
 * @returns {boolean}
 */
export function isWeakClientDisplayName(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return true;
  }
  if (trimmed.length <= WEAK_NAME_MAX_LENGTH) {
    return true;
  }
  return false;
}

// Single gate every candidate must pass: non-empty, not a placeholder, not too short.
function isUsableDisplayName(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return false;
  }
  if (isGenericClientDisplayName(trimmed)) {
    return false;
  }
  if (isWeakClientDisplayName(trimmed)) {
    return false;
  }
  return true;
}

// Join name parts, skipping missing ones so "Taylor" + missing last does not become "Taylor ".
function trimJoin(...parts) {
  const keptParts = [];
  for (let index = 0; index < parts.length; index += 1) {
    const trimmedPart = String(parts[index] ?? '').trim();
    if (trimmedPart) {
      keptParts.push(trimmedPart);
    }
  }
  return keptParts.join(' ').trim();
}

// Prefer real profile names before handles / usernames (often email locals like "alex").
// ORDER of this array is the preference policy — firstUsableName takes the first that passes.
function nameCandidatesFromRecord(record) {
  if (!record || typeof record !== 'object') {
    return [];
  }
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

function firstUsableName(candidates) {
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const trimmed = String(candidate ?? '').trim();
    if (isUsableDisplayName(trimmed)) {
      return trimmed;
    }
  }
  return '';
}

// Pull the part before '@'. split('@')[0] on a string with no '@' returns the whole string.
function emailLocalParts(...emails) {
  const locals = [];
  for (let index = 0; index < emails.length; index += 1) {
    const emailValue = emails[index];
    const localPart = String(emailValue ?? '')
      .split('@')[0]
      .trim();
    if (localPart) {
      locals.push(localPart);
    }
  }
  return locals;
}

function titleCaseSeparatedLocal(rawLocal) {
  const pieces = rawLocal.split(/[._-]+/);
  const titledPieces = [];
  for (let index = 0; index < pieces.length; index += 1) {
    const piece = pieces[index];
    if (!piece) {
      continue;
    }
    titledPieces.push(piece.charAt(0).toUpperCase() + piece.slice(1).toLowerCase());
  }
  return titledPieces.join(' ');
}

// Last-resort name: "taylor.brooks" → "Taylor Brooks", "taylorbrooks" → "Taylorbrooks".
function humanizeEmailLocal(local) {
  const rawLocal = String(local ?? '').trim();
  if (!rawLocal) {
    return '';
  }

  // Manipulate here: . _ - are treated as word separators.
  const hasWordSeparators =
    rawLocal.includes('.') || rawLocal.includes('_') || rawLocal.includes('-');

  if (hasWordSeparators) {
    return titleCaseSeparatedLocal(rawLocal);
  }

  return rawLocal.charAt(0).toUpperCase() + rawLocal.slice(1).toLowerCase();
}

// ===== MAIN FUNCTION =====

/**
 * Resolve a display name for one trainee: profile → CRM → email local → "Client".
 * @param {object} [crmRow]
 * @param {object} [userData]
 * @returns {string}
 */
export function resolveTrainerClientDisplayName(crmRow = {}, userData = {}) {
  // Re-default here: an explicit null skips the parameter default and would crash field reads.
  const userRecord = userData || {};
  const crmRecord = crmRow || {};

  // 1. Profile doc on users/{id} — prefer real name fields over handles.
  const nameFromUserProfile = firstUsableName(nameCandidatesFromRecord(userRecord));
  if (nameFromUserProfile) {
    return nameFromUserProfile;
  }

  // 2. Trainer CRM row under trainer_clients/.../clients/{id}.
  const nameFromCrmRow = firstUsableName(nameCandidatesFromRecord(crmRecord));
  if (nameFromCrmRow) {
    return nameFromCrmRow;
  }

  // 3. Humanize email local parts when no real name field passed the gate.
  const emailLocalList = emailLocalParts(
    userRecord.email,
    userRecord.userEmail,
    userRecord.primaryEmail,
    crmRecord.email,
  );
  for (let index = 0; index < emailLocalList.length; index += 1) {
    const localPart = emailLocalList[index];
    const humanizedName = humanizeEmailLocal(localPart);
    if (isUsableDisplayName(humanizedName)) {
      return humanizedName;
    }
  }

  return FALLBACK_CLIENT_LABEL;
}
