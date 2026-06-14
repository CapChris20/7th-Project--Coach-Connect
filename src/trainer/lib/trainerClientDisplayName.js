/**
 * Trainer roster: CRM `trainer_clients/.../clients` rows often store placeholder
 * `name: "Client"` while the real label lives on `users/{uid}` (and may use many
 * field shapes across signup, onboarding, OAuth, and profile edits).
 */

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

export function isGenericClientDisplayName(value) {
  const t = String(value ?? '')
    .trim()
    .toLowerCase();
  return GENERIC_DISPLAY.has(t);
}

/** Too short to be a real name (e.g. email local "cc", handle "ab"). */
export function isWeakClientDisplayName(value) {
  const t = String(value ?? '').trim();
  if (!t) return true;
  if (t.length <= 2) return true;
  return false;
}

function isUsableDisplayName(value) {
  const t = String(value ?? '').trim();
  if (!t) return false;
  if (isGenericClientDisplayName(t)) return false;
  if (isWeakClientDisplayName(t)) return false;
  return true;
}

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

function firstUsableName(candidates) {
  for (const raw of candidates) {
    const t = String(raw ?? '').trim();
    if (isUsableDisplayName(t)) return t;
  }
  return '';
}

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

function humanizeEmailLocal(local) {
  const raw = String(local ?? '').trim();
  if (!raw) return '';
  if (raw.includes('.') || raw.includes('_') || raw.includes('-')) {
    return raw
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

/**
 * @param {Record<string, unknown>} crmRow — doc from trainer_clients/.../clients/{id}
 * @param {Record<string, unknown>} userData — users/{id} data (optional)
 */
export function resolveTrainerClientDisplayName(crmRow = {}, userData = {}) {
  const ud = userData || {};
  const crm = crmRow || {};

  const fromUser = firstUsableName(nameCandidatesFromRecord(ud));
  if (fromUser) return fromUser;

  const fromCrm = firstUsableName(nameCandidatesFromRecord(crm));
  if (fromCrm) return fromCrm;

  for (const local of emailLocalParts(ud.email, ud.userEmail, ud.primaryEmail, crm.email)) {
    const humanized = humanizeEmailLocal(local);
    if (isUsableDisplayName(humanized)) return humanized;
  }

  return 'Client';
}
