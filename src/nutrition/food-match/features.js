// Soft scoring features for food-match v2. Each feature is in [0, 1].
// Flow: coverage → specificity → phrase → brand → quantity → channel → quality → source.
// Pure. Weights live in config/weights.js.

const {
  FEATURE_WEIGHTS,
  SOURCE_TIER_PRIOR,
  CHANNEL_PRIOR,
  BRAND_ABSENT_PENALTY,
} = require('./config/weights');
const { explainQueryTokens, candidateTokens } = require('./gates');
const { tokenize } = require('./queryFrame');
const { checkPlausibility } = require('./plausibility');
const { tokenExplainedByFuzzy } = require('./fuzzyToken');
const { RARE_TOKEN_IDF_MIN } = require('./config/weights');

/**
 * IDF-weighted share of query tokens explained by the candidate.
 * @param {object} queryFrame
 * @param {object} candidate
 * @returns {number}
 */
function featureIdfCoverage(queryFrame, candidate) {
  const tokens = queryFrame.tokens || [];
  if (!tokens.length) return 0;
  const { explained } = explainQueryTokens(queryFrame, candidate);
  let total = 0;
  let hit = 0;
  for (const info of tokens) total += info.idf;
  for (const info of explained) hit += info.idf;
  if (total <= 0) return 0;
  return clamp01(hit / total);
}

/**
 * Prefer candidates that do not pile on extra high-IDF name tokens the query lacks.
 * @param {object} queryFrame
 * @param {object} candidate
 * @returns {number}
 */
function featureSpecificity(queryFrame, candidate) {
  const queryTokens = queryFrame.tokenStrings || [];
  const nameTokens = tokenize(candidate.name || '');
  if (!nameTokens.length) return 1;

  let extraWeight = 0;
  let totalWeight = 0;
  for (const token of nameTokens) {
    const idf = idfLookup(token, queryFrame);
    totalWeight += idf;
    // A name token is not "extra" when the query has it exactly or as a rare near-spelling.
    const explainedByQuery = queryTokens.includes(token)
      || (
        idf >= RARE_TOKEN_IDF_MIN
        && tokenExplainedByFuzzy(token, queryTokens, { allowFuzzy: true })
      )
      || queryTokens.some((queryToken) => (
        queryToken.length >= token.length - 1
        && tokenExplainedByFuzzy(queryToken, [token], { allowFuzzy: true })
      ));
    if (!explainedByQuery) extraWeight += idf;
  }
  if (totalWeight <= 0) return 1;
  // 1 = no extras; 0 = name is all unexplained extras
  return clamp01(1 - extraWeight / totalWeight);
}

/**
 * Adjacent query bigrams that also appear adjacent in the candidate name.
 * @param {object} queryFrame
 * @param {object} candidate
 * @returns {number}
 */
function featurePhraseOrder(queryFrame, candidate) {
  const queryTokens = queryFrame.tokenStrings || [];
  if (queryTokens.length < 2) return 1;
  const hay = candidateTokens(candidate);
  let need = 0;
  let hit = 0;
  for (let index = 0; index < queryTokens.length - 1; index += 1) {
    need += 1;
    const left = queryTokens[index];
    const right = queryTokens[index + 1];
    if (hayHasBigram(hay, left, right)) hit += 1;
  }
  return need ? clamp01(hit / need) : 1;
}

/**
 * Brand agreement: matched / absent / conflict (conflict already gated).
 * @param {object} queryFrame
 * @param {object} candidate
 * @param {{ brandAbsent?: boolean }} gateMeta
 * @returns {number}
 */
function featureBrandAgreement(queryFrame, candidate, gateMeta = {}) {
  const brand = String(candidate.brand || '').trim();
  if (!brand) return 0.5;
  const brandTokens = tokenize(brand);
  const matched = brandTokens.some((token) => queryFrame.tokenStrings.includes(token));
  if (matched) return 1;
  if (gateMeta.brandAbsent) return clamp01(0.5 - BRAND_ABSENT_PENALTY);
  return 0.5;
}

/**
 * Numeric quantity / size / count agreement.
 * @param {object} queryFrame
 * @param {object} candidate
 * @returns {number}
 */
function featureQuantityAgreement(queryFrame, candidate) {
  const want = queryFrame.quantities || {};
  const hay = `${candidate.name || ''} ${(candidate.servings || []).map((row) => row.label).join(' ')}`.toLowerCase();
  let checks = 0;
  let hits = 0;

  if (want.pieceCount != null) {
    checks += 1;
    if (hayIncludesNumber(hay, want.pieceCount) && /\b(pc|pcs|piece|pieces)\b/.test(hay)) hits += 1;
  }
  if (want.flOz != null) {
    checks += 1;
    if (hayIncludesNumber(hay, want.flOz) && /\b(fl\.?\s*oz|floz|oz)\b/.test(hay)) hits += 1;
  }
  if (want.grams != null) {
    checks += 1;
    const servingGrams = candidate.servings?.[0]?.grams;
    if (servingGrams != null && Math.abs(servingGrams - want.grams) <= 1) hits += 1;
    else if (hayIncludesNumber(hay, want.grams) && /\bg\b/.test(hay)) hits += 1;
  }

  if (!checks) return 0.5;
  return clamp01(hits / checks);
}

function featureChannelPrior(candidate) {
  const channel = candidate.channel || 'unknown';
  return CHANNEL_PRIOR[channel] != null ? CHANNEL_PRIOR[channel] : CHANNEL_PRIOR.unknown;
}

function featureSourceTier(candidate) {
  const tier = candidate.sourceTier;
  return SOURCE_TIER_PRIOR[tier] != null ? SOURCE_TIER_PRIOR[tier] : SOURCE_TIER_PRIOR[3];
}

function featureQuality(queryFrame, candidate) {
  const completeness = Number(candidate.quality?.completeness);
  const complete = Number.isFinite(completeness) ? clamp01(completeness) : 0;
  const plausibility = checkPlausibility(candidate, {
    categoryKcalBands: queryFrame.categoryKcalBands,
  });
  const plaus = plausibility.ok ? 1 : 0.2;
  return clamp01(0.7 * complete + 0.3 * plaus);
}

/**
 * Compute every feature + weighted total. Source-tier weight is already capped in FEATURE_WEIGHTS.
 * @param {object} queryFrame
 * @param {object} candidate
 * @param {{ brandAbsent?: boolean }} [gateMeta]
 * @returns {{ score: number, features: object }}
 */
function computeFeatures(queryFrame, candidate, gateMeta = {}) {
  const features = {
    idfCoverage: featureIdfCoverage(queryFrame, candidate),
    specificity: featureSpecificity(queryFrame, candidate),
    phraseOrder: featurePhraseOrder(queryFrame, candidate),
    brandAgreement: featureBrandAgreement(queryFrame, candidate, gateMeta),
    quantityAgreement: featureQuantityAgreement(queryFrame, candidate),
    channelPrior: featureChannelPrior(candidate),
    quality: featureQuality(queryFrame, candidate),
    sourceTier: featureSourceTier(candidate),
  };

  let score = 0;
  for (const key of Object.keys(FEATURE_WEIGHTS)) {
    score += FEATURE_WEIGHTS[key] * (features[key] || 0);
  }
  return { score: clamp01(score), features };
}

module.exports = {
  featureIdfCoverage,
  featureSpecificity,
  featurePhraseOrder,
  featureBrandAgreement,
  featureQuantityAgreement,
  featureChannelPrior,
  featureSourceTier,
  featureQuality,
  computeFeatures,
  FEATURE_WEIGHTS,
};

// ===== PLUMBING =====

function clamp01(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function idfLookup(token, queryFrame) {
  // Reuse IDF scale from any query token with the same string; else treat as rare-ish.
  for (const info of queryFrame.tokens || []) {
    if (info.token === token) return info.idf;
  }
  return Math.log(((queryFrame.documentCount || 1) + 1) / 1);
}

function hayHasBigram(hayTokens, left, right) {
  for (let index = 0; index < hayTokens.length - 1; index += 1) {
    if (hayTokens[index] === left && hayTokens[index + 1] === right) return true;
  }
  return false;
}

function hayIncludesNumber(hay, number) {
  const asInt = String(Math.round(Number(number)));
  const asFloat = String(Number(number));
  return new RegExp(`(?:^|[^0-9])${escapeRe(asInt)}(?:[^0-9]|$)`).test(hay)
    || new RegExp(`(?:^|[^0-9])${escapeRe(asFloat)}(?:[^0-9]|$)`).test(hay);
}

function escapeRe(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
