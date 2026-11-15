// Hard rejection gates for food-match v2.
// Flow: explain tokens → G1 rare coverage → G2 brand → G3 family → G4 plausibility → G5 junk.
// Used by food-match candidate ranking pipeline to reject impossible or mismatched foods early.
// Pure CommonJS. Roles come from evidence (IDF / taxonomy), not brand lists.

const {
  TAU1_UNEXPLAINED_IDF_SHARE,
  STRUCTURAL_JUNK_DOMAINS,
} = require('./config/weights');
const { tokenExplainedByFuzzy, brandLexiconOneEditMatch } = require('./fuzzyToken');
const { checkPlausibility } = require('./plausibility');
const { normalizeQueryText, tokenize } = require('./queryFrame');

// ===== NAMED CONSTANTS =====

const REASON_BRAND_ABSENT = 'brand_absent_from_query';
const REASON_BRAND_CONFLICT = 'brand_conflict_rare_unexplained';
const REASON_FAMILY_CONFLICT = 'family_head_unexplained';

// ===== HELPER FUNCTIONS =====

function checkLexiconBrandMatch(token, brandLexicon, candidateBrand) {
  const matchesLexicon = brandLexiconOneEditMatch(token, brandLexicon);
  if (!matchesLexicon) return false;
  const brandTokens = tokenize(candidateBrand || '');
  return brandTokens.includes(token) || tokenExplainedByFuzzy(token, brandTokens, { allowFuzzy: true });
}

/**
 * Tokenize candidate name + brand + category path for matching.
 * @param {object} candidate
 * @returns {string[]}
 */
function candidateTokens(candidate) {
  const parts = [
    candidate?.name || '',
    candidate?.brand || '',
    ...(candidate?.categoryPath || []),
  ];
  const tokens = [];
  for (const part of parts) {
    tokens.push(...tokenize(String(part).replace(/-/g, ' ')));
  }
  return tokens;
}

/**
 * Mark each query token explained / unexplained against a candidate.
 * @param {object} queryFrame
 * @param {object} candidate
 * @returns {{ explained: object[], unexplained: object[] }}
 */
function explainQueryTokens(queryFrame, candidate) {
  const hayTokens = candidateTokens(candidate);
  const haySet = new Set(hayTokens);
  const explained = [];
  const unexplained = [];

  for (const info of queryFrame.tokens || []) {
    let tokenIsExplained = haySet.has(info.token);
    if (!tokenIsExplained && info.rare) {
      tokenIsExplained = tokenExplainedByFuzzy(info.token, hayTokens, { allowFuzzy: true });
    }
    if (!tokenIsExplained && info.rare) {
      tokenIsExplained = checkLexiconBrandMatch(info.token, queryFrame.brandLexicon, candidate.brand);
    }
    if (tokenIsExplained) {
      explained.push(info);
    } else {
      unexplained.push(info);
    }
  }
  return { explained, unexplained };
}

/**
 * G1 — IDF-weighted unexplained share must be <= tau1.
 * @param {object} queryFrame
 * @param {object[]} unexplained
 * @returns {{ ok: boolean, share: number }}
 */
function gateRareTokenCoverage(queryFrame, unexplained) {
  const tokens = queryFrame.tokens || [];
  if (!tokens.length) return { ok: true, share: 0 };
  let totalIdf = 0;
  let unexplainedIdf = 0;
  for (const info of tokens) totalIdf += info.idf;
  for (const info of unexplained) unexplainedIdf += info.idf;
  const share = totalIdf > 0 ? unexplainedIdf / totalIdf : 0;
  return { ok: share <= TAU1_UNEXPLAINED_IDF_SHARE, share };
}

/**
 * G2 — branded candidate + unexplained rare query token + brand not in query → reject.
 * @param {object} queryFrame
 * @param {object} candidate
 * @param {object[]} unexplained
 * @returns {{ ok: boolean, reason: string|null }}
 */
function gateBrandConflict(queryFrame, candidate, unexplained) {
  const brand = String(candidate.brand || '').trim();
  if (!brand) return { ok: true, reason: null };

  const brandTokens = tokenize(brand);
  if (!brandTokens.length) return { ok: true, reason: null };

  const queryHasBrand = brandTokens.some((token) => (
    queryFrame.tokenStrings.includes(token)
    || tokenExplainedByFuzzy(token, queryFrame.tokenStrings, { allowFuzzy: true })
  ));
  if (queryHasBrand) return { ok: true, reason: null };

  const rareUnexplained = unexplained.filter((info) => info.rare);
  if (rareUnexplained.length > 0) {
    return { ok: false, reason: REASON_BRAND_CONFLICT };
  }
  // No rare tokens in the unexplained set → allowed with soft penalty later.
  return { ok: true, reason: REASON_BRAND_ABSENT };
}

/**
 * G3 — family conflict via source taxonomy / head noun evidence.
 * @param {object} queryFrame
 * @param {object} candidate
 * @returns {{ ok: boolean, reason: string|null }}
 */
function gateFamilyConflict(queryFrame, candidate) {
  const head = queryFrame.head;
  if (!head || !head.rare) return { ok: true, reason: null };

  const hay = candidateTokens(candidate);
  if (hay.includes(head.token)) return { ok: true, reason: null };
  if (tokenExplainedByFuzzy(head.token, hay, { allowFuzzy: true })) {
    return { ok: true, reason: null };
  }

  // Head is rare and never appears in name/brand/categoryPath → family miss.
  return { ok: false, reason: REASON_FAMILY_CONFLICT };
}

/**
 * G5 — structural junk by title scaffolding or tracker domain.
 * @param {object} candidate
 * @param {object} queryFrame
 * @returns {{ ok: boolean, reason: string|null }}
 */
function gateStructuralJunk(candidate, queryFrame) {
  const name = normalizeQueryText(candidate.name || '');
  const url = String(candidate.provenance?.url || '').toLowerCase();

  // 1. Tracker domains by host, not brand.
  for (const domain of STRUCTURAL_JUNK_DOMAINS) {
    if (url.includes(domain)) return { ok: false, reason: 'tracker_domain' };
  }

  // 2. Nutrition-facts scaffolding titles.
  if (/\bnutrition facts\b/.test(name) && !queryFrame.normalized.includes('nutrition facts')) {
    return { ok: false, reason: 'nutrition_facts_scaffold' };
  }
  if (/^product \d+$/.test(name)) return { ok: false, reason: 'product_number_placeholder' };

  // 3. Exact query-echo page titles that are only the query + "calories".
  const echo = `${queryFrame.normalized} calories`;
  if (name === echo || name === `${queryFrame.normalized} nutrition`) {
    return { ok: false, reason: 'query_echo_title' };
  }

  return { ok: true, reason: null };
}

// ===== MAIN FUNCTION =====

/**
 * Run all hard gates. First failure rejects.
 * @param {object} queryFrame
 * @param {object} candidate
 * @returns {{ pass: boolean, reasons: string[], unexplained: object[], brandAbsent: boolean }}
 */
function runGates(queryFrame, candidate) {
  const reasons = [];
  const { unexplained } = explainQueryTokens(queryFrame, candidate);

  const coverageGateResult = gateRareTokenCoverage(queryFrame, unexplained);
  if (!coverageGateResult.ok) reasons.push('g1_rare_token_coverage');

  const brandGateResult = gateBrandConflict(queryFrame, candidate, unexplained);
  if (!brandGateResult.ok) reasons.push('g2_brand_conflict');

  const familyGateResult = gateFamilyConflict(queryFrame, candidate);
  if (!familyGateResult.ok) reasons.push('g3_family_conflict');

  const plausibilityGateResult = checkPlausibility(candidate, {
    categoryKcalBands: queryFrame.categoryKcalBands,
  });
  if (!plausibilityGateResult.ok) {
    reasons.push(...plausibilityGateResult.reasons.map((reason) => `g4_${reason}`));
  }

  const junkGateResult = gateStructuralJunk(candidate, queryFrame);
  if (!junkGateResult.ok) reasons.push(`g5_${junkGateResult.reason}`);

  return {
    pass: reasons.length === 0,
    reasons,
    unexplained,
    brandAbsent: brandGateResult.reason === REASON_BRAND_ABSENT,
  };
}

module.exports = {
  candidateTokens,
  explainQueryTokens,
  gateRareTokenCoverage,
  gateBrandConflict,
  gateFamilyConflict,
  gateStructuralJunk,
  runGates,
};
