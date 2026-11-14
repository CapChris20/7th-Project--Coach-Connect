// Turn scored survivors into confident / ambiguous / none.
// Flow: empty → none → margin vs next different entity → status + capped results.
// Pure. Thresholds from config/weights.js.

const {
  THETA_HI,
  MARGIN_DELTA,
  AMBIGUOUS_MAX_RESULTS,
} = require('./config/weights');

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

/**
 * @param {{ survivors: object[], rejected?: object[] }} scored
 * @returns {{ status: 'confident'|'ambiguous'|'none', results: object[], reasons: string[] }}
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

  const top = survivors[0];
  const topEntity = entityKey(top.candidate);

  // 2. Find the next DIFFERENT entity for margin.
  let nextDifferent = null;
  for (let index = 1; index < survivors.length; index += 1) {
    if (entityKey(survivors[index].candidate) !== topEntity) {
      nextDifferent = survivors[index];
      break;
    }
  }
  const margin = nextDifferent ? top.score - nextDifferent.score : top.score;

  // 3. Web / tier-3 only rows may never be confident (invariant 7).
  const topIsWeakSource = Number(top.candidate.sourceTier) === 3
    || String(top.candidate.source || '').toLowerCase() === 'serper';

  // 4. Branded row whose brand never appeared in the query may not be confident.
  //    Keeps drop-brand from promoting a different brand (invariant 1).
  const topBrandAbsent = Boolean(top.brandAbsent);

  // 5. Confident only when score and margin both clear — and source is not web-only.
  if (
    !topIsWeakSource
    && !topBrandAbsent
    && top.score >= THETA_HI
    && margin >= MARGIN_DELTA
  ) {
    reasons.push('top_above_theta_hi');
    reasons.push('margin_above_delta');
    return {
      status: 'confident',
      results: [toResult(top)],
      reasons,
      topScore: top.score,
      margin,
    };
  }
  if (topIsWeakSource) reasons.push('weak_source_not_confident');
  if (topBrandAbsent) reasons.push('brand_absent_not_confident');

  // 4. Otherwise show a short pick list.
  reasons.push(top.score < THETA_HI ? 'top_below_theta_hi' : 'margin_below_delta');
  const capped = survivors.slice(0, AMBIGUOUS_MAX_RESULTS).map(toResult);
  return {
    status: 'ambiguous',
    results: capped,
    reasons,
    topScore: top.score,
    margin,
  };
}

function toResult(scoredRow) {
  return {
    id: scoredRow.candidate.id,
    score: scoredRow.score,
    features: scoredRow.features,
    candidate: scoredRow.candidate,
  };
}

module.exports = {
  decide,
  entityKey,
};
