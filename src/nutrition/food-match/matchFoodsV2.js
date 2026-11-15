// Orchestrate food-match v2: query frame → normalize servings → gates/score → decide.
// Flow: buildQueryFrame → normalizeCandidateServings → scoreCandidates → decide.
// Used by server shadow mode and the eval harness.
// Pure CommonJS for a given stats table.

const { buildQueryFrame } = require('./queryFrame');
const { scoreCandidates } = require('./scoreCandidates');
const { decide } = require('./decide');
const { rowToCandidate } = require('./rowToCandidate');
const { normalizeCandidateServings } = require('./servingNormalizer');

// ===== NAMED CONSTANTS =====
// (No named constants in this orchestration module)

// ===== HELPER FUNCTIONS =====
// (No helper functions in this orchestration module)

// ===== MAIN FUNCTION =====

/**
 * Rank Candidate objects for a typed query.
 * @param {string} query
 * @param {object[]} candidates
 * @param {{ stats?: object }} [options]
 * @returns {{ status: string, results: object[], reasons: string[], rejected: object[], queryFrame: object }}
 */
function matchCandidatesV2(query, candidates, options = {}) {
  // 1. Frame the query.
  const queryFrame = buildQueryFrame(query, { stats: options.stats });

  // 2. Normalize servings / per100 before gates (marks inconsistent; never invents macros).
  const candidateList = Array.isArray(candidates) ? candidates : [];
  const normalizedCandidates = [];
  for (const candidate of candidateList) {
    normalizedCandidates.push(normalizeCandidateServings(candidate));
  }

  // 3. Gate + score (rejected rows stay rejected).
  const scored = scoreCandidates(queryFrame, normalizedCandidates);

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
 * @param {{ stats?: object }} [options]
 * @returns {object}
 */
function matchRowsV2(query, rows, options = {}) {
  const candidates = [];
  const rowList = Array.isArray(rows) ? rows : [];
  for (const row of rowList) {
    const candidate = rowToCandidate(row);
    if (candidate) candidates.push(candidate);
  }
  return matchCandidatesV2(query, candidates, options);
}

module.exports = {
  matchCandidatesV2,
  matchRowsV2,
};
