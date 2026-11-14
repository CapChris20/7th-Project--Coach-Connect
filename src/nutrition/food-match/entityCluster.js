// Group Candidates that are the same real-world food entity.
// Flow: key by GTIN or brand+name → split incompatible macros → list clusters.
// Used by consensus (server) and decide margin helpers. Consensus never crosses clusters.

const { CLUSTER_MACRO_TOLERANCE } = require('./config/weights');
const { entityKey } = require('./decide');

/**
 * Stable cluster key for one candidate (GTIN preferred, else brand|name).
 * Empty name → singleton so blank titles never falsely merge.
 * @param {object} candidate
 * @returns {string}
 */
function clusterKey(candidate) {
  if (candidate?.gtin) {
    const digits = String(candidate.gtin).replace(/\D/g, '');
    if (digits) return `gtin:${digits.padStart(14, '0').slice(-14)}`;
  }

  const brand = normalizeText(candidate?.brand);
  const name = normalizeText(candidate?.name);
  if (!name) {
    return `singleton:${candidate?.id || candidate?.source || 'unknown'}`;
  }
  return `name:${brand}|${name}`;
}

/**
 * True when two candidates' kcal sit within CLUSTER_MACRO_TOLERANCE.
 * Prefer per100 kcal; else first serving kcal.
 * @param {object} left
 * @param {object} right
 * @returns {boolean}
 */
function macrosCompatible(left, right) {
  const leftKcal = representativeKcal(left);
  const rightKcal = representativeKcal(right);
  if (leftKcal == null || rightKcal == null) return true;
  if (!(leftKcal > 0) || !(rightKcal > 0)) return leftKcal === rightKcal;

  const gap = Math.abs(leftKcal - rightKcal) / Math.max(leftKcal, rightKcal);
  // Manipulate here: CLUSTER_MACRO_TOLERANCE in config/weights.js
  return gap <= CLUSTER_MACRO_TOLERANCE;
}

/**
 * Bucket candidates into entity clusters. Never merges different brand+name keys.
 * @param {object[]} candidates
 * @returns {{ key: string, members: object[] }[]}
 */
function clusterCandidates(candidates) {
  const list = Array.isArray(candidates) ? candidates.filter(Boolean) : [];

  // 1. First pass: group by identity key (GTIN or brand+name).
  const byKey = new Map();
  for (const candidate of list) {
    const key = clusterKey(candidate);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(candidate);
  }

  // 2. Second pass: inside one key, split rows whose macros fight each other.
  const clusters = [];
  for (const [key, members] of byKey.entries()) {
    const subClusters = splitByCompatibleMacros(members);
    for (let index = 0; index < subClusters.length; index += 1) {
      const suffix = subClusters.length === 1 ? '' : `#${index}`;
      clusters.push({
        key: `${key}${suffix}`,
        members: subClusters[index],
      });
    }
  }

  return clusters;
}

/**
 * Pick the cluster best suited for consensus (most members, then lowest tier sum).
 * @param {{ key: string, members: object[] }[]} clusters
 * @returns {{ key: string, members: object[] }|null}
 */
function pickBestConsensusCluster(clusters) {
  const usable = (Array.isArray(clusters) ? clusters : []).filter(
    (cluster) => cluster.members && cluster.members.length >= 2,
  );
  if (usable.length === 0) return null;

  usable.sort((left, right) => {
    if (right.members.length !== left.members.length) {
      return right.members.length - left.members.length;
    }
    return tierSum(left.members) - tierSum(right.members);
  });
  return usable[0];
}

module.exports = {
  clusterKey,
  macrosCompatible,
  clusterCandidates,
  pickBestConsensusCluster,
  // Re-export decide's entityKey so callers share one identity helper.
  entityKey,
};

// ===== PLUMBING — skip unless debugging =====

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function representativeKcal(candidate) {
  if (candidate?.per100?.kcal != null && Number.isFinite(Number(candidate.per100.kcal))) {
    return Number(candidate.per100.kcal);
  }
  const servings = Array.isArray(candidate?.servings) ? candidate.servings : [];
  for (const row of servings) {
    if (row?.kcal != null && Number.isFinite(Number(row.kcal))) return Number(row.kcal);
  }
  return null;
}

function splitByCompatibleMacros(members) {
  const groups = [];
  for (const member of members) {
    let placed = false;
    for (const group of groups) {
      if (macrosCompatible(group[0], member)) {
        group.push(member);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([member]);
  }
  return groups;
}

function tierSum(members) {
  let sum = 0;
  for (const member of members) {
    sum += Number(member.sourceTier) || 3;
  }
  return sum;
}
