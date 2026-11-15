// Turn scored survivors into confident / ambiguous / none.
// Flow: empty → none → margin vs next different entity → status + capped results.
// Used by food-match pipeline to decide whether a single top match is confident.
// Pure CommonJS. Thresholds from config/weights.js.

const {
  THETA_HI,
  MARGIN_DELTA,
  AMBIGUOUS_MAX_RESULTS,
} = require('./config/weights');

// ===== NAMED CONSTANTS =====

const WEAK_SOURCE_TIER = 3;
const WEAK_SOURCE_NAME = 'serper';

// ===== HELPER FUNCTIONS =====

/**
 * Entity key for margin: prefer GTIN, else brand+name normalized.
 * @param {object} candidate
 * @returns {string}
 */
function entityKey(candidate) {
  if (candidate?.gtin) return `gtin:${candidate.gtin}`;
  const brand = String(candidate?.brand || '').toLowerCase().trim();
  const name = String(candidate?.name || '').toLowerCase().trim();
  return `name:${brand}|${name}`;
}

function toResult(scoredRow) {
  return {
    id: scoredRow.candidate.id,
    score: scoredRow.score,
    features: scoredRow.features,
    candidate: scoredRow.candidate,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Evaluates candidate scores to decide between confident match, ambiguous list, or none.
 * @param {{ survivors: object[], rejected?: object[] }} scored
 * @returns {{ status: 'confident'|'ambiguous'|'none', results: object[], reasons: string[], topScore?: number, margin?: number }}
 */
function decide(scored) {
  const survivors = Array.isArray(scored?.survivors) ? scored.survivors : [];
  const reasons = [];

  // 1. Nobody survived the gates.
  if (!survivors.length) {
    return {
      status: 'none',
      results: [],
      reasons: ['no_survivors'],
    };
  }

  const topScoredCandidate = survivors[0];
  const topEntity = entityKey(topScoredCandidate.candidate);

  // 2. Find the next DIFFERENT entity for margin.
  let nextDifferentEntity = null;
  for (let index = 1; index < survivors.length; index += 1) {
    if (entityKey(survivors[index].candidate) !== topEntity) {
      nextDifferentEntity = survivors[index];
      break;
    }
  }
  const margin = nextDifferentEntity
    ? topScoredCandidate.score - nextDifferentEntity.score
    : topScoredCandidate.score;

  // 3. Web / tier-3 only rows may never be confident (invariant 7).
  const topIsWeakSource = Number(topScoredCandidate.candidate.sourceTier) === WEAK_SOURCE_TIER
    || String(topScoredCandidate.candidate.source || '').toLowerCase() === WEAK_SOURCE_NAME;

  // 4. Branded row whose brand never appeared in the query may not be confident.
  //    Keeps drop-brand from promoting a different brand (invariant 1).
  const topBrandAbsent = Boolean(topScoredCandidate.brandAbsent);

  // 5. Confident only when score and margin both clear — and source is not web-only.
  if (
    !topIsWeakSource
    && !topBrandAbsent
    && topScoredCandidate.score >= THETA_HI
    && margin >= MARGIN_DELTA
  ) {
    reasons.push('top_above_theta_hi');
    reasons.push('margin_above_delta');
    return {
      status: 'confident',
      results: [toResult(topScoredCandidate)],
      reasons,
      topScore: topScoredCandidate.score,
      margin,
    };
  }
  if (topIsWeakSource) reasons.push('weak_source_not_confident');
  if (topBrandAbsent) reasons.push('brand_absent_not_confident');

  // 6. Otherwise show a short pick list.
  reasons.push(topScoredCandidate.score < THETA_HI ? 'top_below_theta_hi' : 'margin_below_delta');
  const capped = survivors.slice(0, AMBIGUOUS_MAX_RESULTS).map(toResult);
  return {
    status: 'ambiguous',
    results: capped,
    reasons,
    topScore: topScoredCandidate.score,
    margin,
  };
}

module.exports = {
  decide,
  entityKey,
};
