// Orchestrate food-match v2: query frame → normalize servings → gates/score → decide.
// Flow: buildQueryFrame → normalizeCandidateServings → scoreCandidates → decide.
// Used by server shadow mode and the eval harness. Pure for a given stats table.

const { buildQueryFrame } = require('./queryFrame');
const { scoreCandidates } = require('./scoreCandidates');
const { decide } = require('./decide');
const { rowToCandidate } = require('./rowToCandidate');
const { normalizeCandidateServings } = require('./servingNormalizer');

/**
 * Rank Candidate objects for a typed query.
 * @param {string} query
 * @param {object[]} candidates
 * @param {{ stats?: object }} [opts]
 * @returns {{ status: string, results: object[], reasons: string[], rejected: object[], queryFrame: object }}
 */
function matchCandidatesV2(query, candidates, opts = {}) {
  // 1. Frame the query.
  const queryFrame = buildQueryFrame(query, { stats: opts.stats });

  // 2. Normalize servings / per100 before gates (marks inconsistent; never invents macros).
  const list = Array.isArray(candidates) ? candidates : [];
  const normalized = [];
  for (const candidate of list) {
    normalized.push(normalizeCandidateServings(candidate));
  }

  // 3. Gate + score (rejected rows stay rejected).
  const scored = scoreCandidates(queryFrame, normalized);

  // 4. Decide status.
  const decision = decide(scored);
  return {
    ...decision,
    rejected: scored.rejected,
    queryFrame: {
      normalized: queryFrame.normalized,
      tokenCount: queryFrame.tokens.length,
    },
  };
}

/**
 * Convenience: legacy rows → Candidates → v2 decision.
 * @param {string} query
 * @param {object[]} rows
 * @param {{ stats?: object }} [opts]
 * @returns {object}
 */
function matchRowsV2(query, rows, opts = {}) {
  const candidates = [];
  const list = Array.isArray(rows) ? rows : [];
  for (const row of list) {
    const candidate = rowToCandidate(row);
    if (candidate) candidates.push(candidate);
  }
  return matchCandidatesV2(query, candidates, opts);
}

module.exports = {
  matchCandidatesV2,
  matchRowsV2,
};
