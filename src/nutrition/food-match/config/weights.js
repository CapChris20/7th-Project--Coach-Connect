// All numeric weights and thresholds for food-match v2.
// Flow: gates read tau* → features use FEATURE_WEIGHTS → decide uses theta/delta.
// Manipulate here only — no magic numbers in scoring modules.

// ===== GATES =====

// Manipulate here: IDF-weighted share of UNEXPLAINED query tokens allowed through G1
const TAU1_UNEXPLAINED_IDF_SHARE = 0.22;

// Manipulate here: brand conflict (G2) — small soft penalty when query has no rare tokens
const BRAND_ABSENT_PENALTY = 0.08;

// Manipulate here: Atwater kcal vs 4P+4C+9F relative tolerance
const ATWATER_TOLERANCE = 0.2;

// Manipulate here: absolute kcal/100g ceiling
const MAX_KCAL_PER_100 = 900;

// Manipulate here: fiber/alcohol kcal allowance inside Atwater (kcal)
const ATWATER_FIBER_ALCOHOL_ALLOWANCE = 40;

// ===== SCORE FEATURES (must sum conceptually; source tier capped separately) =====

const FEATURE_WEIGHTS = Object.freeze({
  // Manipulate here: primary signal — IDF-weighted token coverage
  idfCoverage: 0.42,
  // Prefer plain items over over-specific variants
  specificity: 0.14,
  // Bigram / phrase order
  phraseOrder: 0.12,
  // Brand agreement when the query names a brand-like rare token
  brandAgreement: 0.1,
  // Quantity / size / count numeric agreement
  quantityAgreement: 0.08,
  // Soft channel prior
  channelPrior: 0.04,
  // Completeness + plausibility soft credit
  quality: 0.05,
  // Source-tier prior — HARD CAP ~10% of max score (R2)
  sourceTier: 0.05,
});

// Source tier → [0,1] prior before the sourceTier weight is applied
const SOURCE_TIER_PRIOR = Object.freeze({
  1: 1,
  2: 0.55,
  3: 0.15,
});

// Channel soft prior when the query gives no channel signal
const CHANNEL_PRIOR = Object.freeze({
  packaged: 0.55,
  restaurant: 0.55,
  generic: 0.6,
  unknown: 0.4,
});

// ===== DECISION =====

// Manipulate here: calibrated on the P0 eval set (see docs later in P6)
const THETA_HI = 0.58;
const MARGIN_DELTA = 0.08;
const AMBIGUOUS_MAX_RESULTS = 5;

// ===== TOKEN / FUZZY =====

const RARE_TOKEN_IDF_MIN = 2.2;
const FUZZY_MIN_TOKEN_LENGTH = 5;
const FUZZY_MAX_EDIT_DISTANCE = 1;
const BRAND_LEXICON_FUZZY_ONLY = true;

// Tracker / aggregator domains for G5 (domains, not brand names)
const STRUCTURAL_JUNK_DOMAINS = Object.freeze([
  'nutritionix.com',
  'barcodelookup.com',
  'dietagram.com',
  'gs1.org',
  'gs1us.org',
]);

// ===== SERVING / CLUSTER =====

// Manipulate here: perServing/grams*100 vs per100 must agree within this relative gap
const SERVING_CROSSCHECK_TOLERANCE = 0.15;

// Manipulate here: same brand+name rows need kcal this close to share one cluster
const CLUSTER_MACRO_TOLERANCE = 0.15;

module.exports = {
  TAU1_UNEXPLAINED_IDF_SHARE,
  BRAND_ABSENT_PENALTY,
  ATWATER_TOLERANCE,
  MAX_KCAL_PER_100,
  ATWATER_FIBER_ALCOHOL_ALLOWANCE,
  FEATURE_WEIGHTS,
  SOURCE_TIER_PRIOR,
  CHANNEL_PRIOR,
  THETA_HI,
  MARGIN_DELTA,
  AMBIGUOUS_MAX_RESULTS,
  RARE_TOKEN_IDF_MIN,
  FUZZY_MIN_TOKEN_LENGTH,
  FUZZY_MAX_EDIT_DISTANCE,
  BRAND_LEXICON_FUZZY_ONLY,
  STRUCTURAL_JUNK_DOMAINS,
  SERVING_CROSSCHECK_TOLERANCE,
  CLUSTER_MACRO_TOLERANCE,
};
