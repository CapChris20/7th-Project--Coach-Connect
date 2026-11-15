// Gate + score a candidate list for food-match v2.
// Flow: runGates → computeFeatures → sort by score then stable id.
// Used by matchFoodsV2 to filter out rejected candidates and rank survivors.
// Pure CommonJS and deterministic. No Date / random / network calls.

const { runGates } = require('./gates');
const { computeFeatures } = require('./features');

// ===== NAMED CONSTANTS =====

const EQUAL_SORT_ORDER = 0;
const LEFT_FIRST_SORT_ORDER = -1;
const RIGHT_FIRST_SORT_ORDER = 1;

// ===== HELPER FUNCTIONS =====

/**
 * Comparator for scored candidates: higher score first, stable tiebreaker by candidate id.
 * @param {object} left
 * @param {object} right
 * @returns {number}
 */
function compareScored(left, right) {
  if (right.score !== left.score) return right.score - left.score;
  const leftId = String(left.candidate?.id || '');
  const rightId = String(right.candidate?.id || '');
  if (leftId < rightId) return LEFT_FIRST_SORT_ORDER;
  if (leftId > rightId) return RIGHT_FIRST_SORT_ORDER;
  return EQUAL_SORT_ORDER;
}

// ===== MAIN FUNCTION =====

/**
 * Score survivors. Rejected rows are dropped (never reinserted).
 * @param {object} queryFrame
 * @param {object[]} candidates
 * @returns {{ survivors: object[], rejected: object[] }}
 */
function scoreCandidates(queryFrame, candidates) {
  const survivors = [];
  const rejected = [];
  const list = Array.isArray(candidates) ? candidates : [];

  for (const candidate of list) {
    if (!candidate || typeof candidate !== 'object') continue;
    const gateResult = runGates(queryFrame, candidate);
    if (!gateResult.pass) {
      rejected.push({
        id: candidate.id,
        reasons: gateResult.reasons,
      });
      continue;
    }
    const { score, features } = computeFeatures(queryFrame, candidate, {
      brandAbsent: gateResult.brandAbsent,
    });
    survivors.push({
      candidate,
      score,
      features,
      gateReasons: gateResult.reasons,
      brandAbsent: Boolean(gateResult.brandAbsent),
    });
  }

  survivors.sort(compareScored);
  return { survivors, rejected };
}

module.exports = {
  scoreCandidates,
  compareScored,
};
