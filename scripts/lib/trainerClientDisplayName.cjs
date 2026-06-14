/**
 * CJS mirror of src/trainer/lib/trainerClientDisplayName.js for Node scripts.
 * Keep in sync when changing app resolver logic.
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

function isGenericClientDisplayName(value) {
  const t = String(value ?? '')
    .trim()
    .toLowerCase();
  return GENERIC_DISPLAY.has(t);
}

function isWeakClientDisplayName(value) {
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

function resolveTrainerClientDisplayName(crmRow = {}, userData = {}) {
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

/** Which field won in the resolver (for debugging). */
function explainTrainerClientDisplayName(crmRow = {}, userData = {}) {
  const ud = userData || {};
  const crm = crmRow || {};
  const fields = [
    ['users.name', ud.name],
    ['users.displayName', ud.displayName],
    ['users.fullName', ud.fullName],
    ['users.firstName+lastName', trimJoin(ud.firstName, ud.lastName)],
    ['users.firstName', ud.firstName],
    ['users.userName', ud.userName],
    ['users.username', ud.username],
    ['crm.name', crm.name],
    ['users.email local', emailLocalParts(ud.email, ud.userEmail, ud.primaryEmail, crm.email)[0]],
  ];

  const evaluations = fields.map(([key, val]) => {
    const t = String(val ?? '').trim();
    return {
      key,
      raw: t || null,
      generic: t ? isGenericClientDisplayName(t) : true,
      weak: t ? isWeakClientDisplayName(t) : true,
      usable: isUsableDisplayName(t),
    };
  });

  const winner = evaluations.find((e) => e.usable);
  return {
    resolved: resolveTrainerClientDisplayName(crm, ud),
    winner: winner ? winner.key : 'fallback:Client',
    winnerValue: winner ? winner.raw : null,
    evaluations,
  };
}

module.exports = {
  isGenericClientDisplayName,
  isWeakClientDisplayName,
  resolveTrainerClientDisplayName,
  explainTrainerClientDisplayName,
};
