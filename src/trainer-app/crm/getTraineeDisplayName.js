// Works out the best human name to show for a client on the trainer's roster.
// Flow: try every name field on users/{uid} → then the trainer's CRM row → then humanize an email
// local part → finally fall back to "Client".
// Why it's this involved: names arrive from signup, onboarding, Google/Apple OAuth, and profile
// edits, each writing a different field, and CRM rows often hold the placeholder "Client".

/**
 * Trainer roster: CRM `trainer_clients/.../clients` rows often store placeholder
 * `name: "Client"` while the real label lives on `users/{uid}` (and may use many
 * field shapes across signup, onboarding, OAuth, and profile edits).
 */

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

// Also exported and used by the roster loader to decide whether a CRM row's name is worth
// self-healing (overwrite a placeholder, never a name a trainer typed).
export function isGenericClientDisplayName(value) {
  // vocab/symbol: ?? '' handles both null and undefined before String() can turn them into the
  // literal text "null" / "undefined".
  const t = String(value ?? '')
    .trim()
    .toLowerCase();
  return GENERIC_DISPLAY.has(t);
}

/** Too short to be a real name (e.g. email local "cc", handle "ab"). */
// Manipulate here: 2 characters is the cutoff. It's the guard that stops an email like
// cc@example.com from becoming a client named "Cc". Raising it risks rejecting real short names.
export function isWeakClientDisplayName(value) {
  const t = String(value ?? '').trim();
  if (!t) return true;
  if (t.length <= 2) return true;
  return false;
}

// The single gate every candidate passes through: non-empty, not a placeholder, not too short.
function isUsableDisplayName(value) {
  const t = String(value ?? '').trim();
  if (!t) return false;
  if (isGenericClientDisplayName(t)) return false;
  if (isWeakClientDisplayName(t)) return false;
  return true;
}

// Join name parts, skipping the missing ones. Needed because firstName may exist with no lastName —
// a plain `${first} ${last}` would leave a trailing space and a weird-looking name.
// vocab/symbol: ...parts = accept any number of arguments as an array
function trimJoin(...parts) {
  return parts
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

/**
 * Prefer real profile names before handles / usernames (which are often email locals like "cc").
 */
// The ORDER of this array is the entire preference policy — firstUsableName below takes the first
// entry that passes the gate. Manipulate here to change which field wins:
//   1. explicit full-name fields (name, displayName, fullName, full_name)
//   2. composed first+last pairs — tried before bare firstName so we prefer "Jane Doe" over "Jane"
//   3. single given names, then friendly/nickname fields
//   4. capitalized variants (Name, DisplayName) that some legacy writes used
//   5. userName / username LAST, because those are usually handles, not real names
function nameCandidatesFromRecord(row) {
  if (!row || typeof row !== 'object') return [];
  const r = row;
  return [
    r.name,
    r.displayName,
    r.fullName,
    r.full_name,
    trimJoin(r.firstName, r.lastName),
    trimJoin(r.givenName, r.familyName),
    r.firstName,
    r.givenName,
    r.preferredName,
    r.preferred_name,
    r.nickname,
    r.clientName,
    r.profileName,
    r.legalName,
    r.Name,
    r.DisplayName,
    r.userName,
    r.username,
  ];
}

// Walk the candidate list in order and return the first genuinely usable one, else ''.
function firstUsableName(candidates) {
  for (const raw of candidates) {
    const t = String(raw ?? '').trim();
    if (isUsableDisplayName(t)) return t;
  }
  return '';
}

// Pull the part before '@' from any number of email fields. split('@')[0] on a string with no '@'
// safely returns the whole string, so a malformed email doesn't throw here.
function emailLocalParts(...emails) {
  const out = [];
  for (const em of emails) {
    const local = String(em ?? '')
      .split('@')[0]
      .trim();
    if (local) out.push(local);
  }
  return out;
}

// Last-resort name: turn an email local part into something presentable.
// "jane.doe" → "Jane Doe", "janedoe" → "Janedoe".
function humanizeEmailLocal(local) {
  const raw = String(local ?? '').trim();
  if (!raw) return '';
  // Manipulate here: . _ - are treated as word separators. If a separator is present we assume the
  // local part encodes multiple words and title-case each one.
  if (raw.includes('.') || raw.includes('_') || raw.includes('-')) {
    return raw
      .split(/[._-]+/)
      .filter(Boolean)
      // Uppercase the first letter, lowercase the rest — this also normalizes "JANE" to "Jane".
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
  // No separator: we can't guess word boundaries, so just capitalize the whole thing.
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

/**
 * @param {Record<string, unknown>} crmRow — doc from trainer_clients/.../clients/{id}
 * @param {Record<string, unknown>} userData — users/{id} data (optional)
 */
export function resolveTrainerClientDisplayName(crmRow = {}, userData = {}) {
  // Re-defaulted here because a caller can pass an explicit null, which skips parameter defaults.
  const ud = userData || {};
  const crm = crmRow || {};

  // Tier 1 — the client's own profile. Highest priority because the client maintains it, so it's
  // the most likely to be current and correctly spelled.
  const fromUser = firstUsableName(nameCandidatesFromRecord(ud));
  if (fromUser) return fromUser;

  // Tier 2 — the trainer's CRM row. Usually a placeholder (which the gate rejects), but a trainer
  // may have typed a real name here for a client who never filled in their profile.
  const fromCrm = firstUsableName(nameCandidatesFromRecord(crm));
  if (fromCrm) return fromCrm;

  // Tier 3 — derive something from an email address. Still passed through isUsableDisplayName, so a
  // 2-letter local part like "cc" is rejected rather than becoming a name.
  for (const local of emailLocalParts(ud.email, ud.userEmail, ud.primaryEmail, crm.email)) {
    const humanized = humanizeEmailLocal(local);
    if (isUsableDisplayName(humanized)) return humanized;
  }

  // Manipulate here: the final fallback label. Note it's in GENERIC_DISPLAY, which is what lets
  // callers detect "we still don't know this person's name" and retry later.
  return 'Client';
}
