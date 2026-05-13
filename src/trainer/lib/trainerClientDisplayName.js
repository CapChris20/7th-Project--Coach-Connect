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

function trimJoin(...parts) {
  return parts
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

/**
 * Ordered list of human-readable name candidates from a Firestore user or CRM row.
 */
function nameCandidatesFromRecord(row) {
  if (!row || typeof row !== 'object') return [];
  const r = row;
  return [
    r.name,
    r.displayName,
    r.fullName,
    r.full_name,
    r.preferredName,
    r.preferred_name,
    r.nickname,
    r.userName,
    r.username,
    r.clientName,
    r.profileName,
    r.legalName,
    r.Name,
    r.DisplayName,
    trimJoin(r.firstName, r.lastName),
    trimJoin(r.givenName, r.familyName),
    r.firstName,
    r.givenName,
  ];
}

function firstNonGeneric(candidates) {
  for (const raw of candidates) {
    const t = String(raw ?? '').trim();
    if (t && !isGenericClientDisplayName(t)) return t;
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

/**
 * @param {Record<string, unknown>} crmRow — doc from trainer_clients/.../clients/{id}
 * @param {Record<string, unknown>} userData — users/{id} data (optional)
 */
export function resolveTrainerClientDisplayName(crmRow = {}, userData = {}) {
  const ud = userData || {};
  const crm = crmRow || {};

  const fromUser = firstNonGeneric(nameCandidatesFromRecord(ud));
  if (fromUser) return fromUser;

  const fromCrm = firstNonGeneric(nameCandidatesFromRecord(crm));
  if (fromCrm) return fromCrm;

  const fromEmails = firstNonGeneric(
    emailLocalParts(ud.email, ud.userEmail, ud.primaryEmail, crm.email)
  );
  if (fromEmails) return fromEmails;

  return 'Client';
}
