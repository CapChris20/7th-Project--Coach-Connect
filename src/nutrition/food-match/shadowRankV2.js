// Shadow-mode helper: run food-match v2 beside the live response.
// Flow: rows → Candidates → matchCandidatesV2 → compact rankV2 + disagreement log.
// Used by server routes when FOOD_MATCH_V2_SHADOW=1.
// Does not change what the client displays. Pure CommonJS.

const { matchCandidatesV2 } = require('./matchFoodsV2');
const { rowToCandidate } = require('./rowToCandidate');

// ===== NAMED CONSTANTS =====

const SHADOW_ENABLED_ENV_VALUE = '1';
const STATUS_NONE = 'none';

// ===== HELPER FUNCTIONS =====

/**
 * Checks whether food-match v2 shadow evaluation is enabled in the environment.
 * @param {object} [environment]
 * @returns {boolean}
 */
function shadowEnabled(environment = process.env) {
  return String(environment.FOOD_MATCH_V2_SHADOW || '') === SHADOW_ENABLED_ENV_VALUE;
}

// ===== MAIN FUNCTION =====

/**
 * Build a compact rankV2 payload + optional disagreement note vs the old top id.
 * @param {string} query
 * @param {object[]} rows
 * @param {{ oldTopId?: string|null }} [options]
 * @returns {{ rankV2: object, disagreement: object|null }}
 */
function buildShadowRankV2(query, rows, options = {}) {
  const candidates = [];
  for (const row of rows || []) {
    const candidate = rowToCandidate(row);
    if (candidate) candidates.push(candidate);
  }

  const decision = matchCandidatesV2(query, candidates);
  const rankV2 = {
    status: decision.status,
    reasons: decision.reasons || [],
    results: (decision.results || []).map((row) => ({
      id: row.id,
      score: row.score,
      name: row.candidate?.name || null,
      brand: row.candidate?.brand || null,
      source: row.candidate?.source || null,
    })),
  };

  const v2TopId = rankV2.results[0]?.id || null;
  const oldTopId = options.oldTopId || null;
  let disagreement = null;
  if (oldTopId && v2TopId && oldTopId !== v2TopId) {
    disagreement = {
      query: String(query || ''),
      oldTopId,
      v2TopId,
      v2Status: rankV2.status,
    };
  } else if (oldTopId && !v2TopId && rankV2.status === STATUS_NONE) {
    disagreement = {
      query: String(query || ''),
      oldTopId,
      v2TopId: null,
      v2Status: STATUS_NONE,
    };
  }

  return { rankV2, disagreement };
}

module.exports = {
  shadowEnabled,
  buildShadowRankV2,
};
