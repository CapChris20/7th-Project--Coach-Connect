// Gate + score a candidate list for food-match v2.
// Flow: runGates → computeFeatures → sort by score then stable id.
// Pure and deterministic. No Date / random / network.

const { runGates } = require('./gates');
const { computeFeatures } = require('./features');

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
    const gate = runGates(queryFrame, candidate);
    if (!gate.pass) {
      rejected.push({
        id: candidate.id,
        reasons: gate.reasons,
      });
      continue;
    }
    const { score, features } = computeFeatures(queryFrame, candidate, {
      brandAbsent: gate.brandAbsent,
    });
    survivors.push({
      candidate,
      score,
      features,
      gateReasons: gate.reasons,
      brandAbsent: Boolean(gate.brandAbsent),
    });
  }

  survivors.sort(compareScored);
  return { survivors, rejected };
}

function compareScored(left, right) {
  if (right.score !== left.score) return right.score - left.score;
  const leftId = String(left.candidate?.id || '');
  const rightId = String(right.candidate?.id || '');
  if (leftId < rightId) return -1;
  if (leftId > rightId) return 1;
  return 0;
}

module.exports = {
  scoreCandidates,
  compareScored,
};
