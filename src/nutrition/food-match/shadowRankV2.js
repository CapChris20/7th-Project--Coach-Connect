// Shadow-mode helper: run food-match v2 beside the live response.
// Flow: rows → Candidates → matchCandidatesV2 → compact rankV2 + disagreement log.
// Used by server routes when FOOD_MATCH_V2_SHADOW=1. Does not change what the client shows.

const { matchCandidatesV2 } = require('./matchFoodsV2');
const { rowToCandidate } = require('./rowToCandidate');

function shadowEnabled(env = process.env) {
  return String(env.FOOD_MATCH_V2_SHADOW || '') === '1';
}

/**
 * Build a compact rankV2 payload + optional disagreement note vs the old top id.
 * @param {string} query
 * @param {object[]} rows
 * @param {{ oldTopId?: string|null }} [opts]
 * @returns {{ rankV2: object, disagreement: object|null }}
 */
function buildShadowRankV2(query, rows, opts = {}) {
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
  const oldTopId = opts.oldTopId || null;
  let disagreement = null;
  if (oldTopId && v2TopId && oldTopId !== v2TopId) {
    disagreement = {
      query: String(query || ''),
      oldTopId,
      v2TopId,
      v2Status: rankV2.status,
    };
  } else if (oldTopId && !v2TopId && rankV2.status === 'none') {
    disagreement = {
      query: String(query || ''),
      oldTopId,
      v2TopId: null,
      v2Status: 'none',
    };
  }

  return { rankV2, disagreement };
}

module.exports = {
  shadowEnabled,
  buildShadowRankV2,
};
