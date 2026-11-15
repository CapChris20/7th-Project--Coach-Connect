// Near-spelling helpers for rare query tokens.
// Flow: edit distance → optional brand-lexicon one-edit credit.
// Used by food-match gates and candidate ranking to tolerate minor typos.
// Pure CommonJS. No brand classification — lexicon is spelling credit only.

const {
  FUZZY_MIN_TOKEN_LENGTH,
  FUZZY_MAX_EDIT_DISTANCE,
} = require('./config/weights');

// ===== NAMED CONSTANTS =====

const EXACT_MATCH_COST = 0;
const MISMATCH_COST = 1;

// ===== HELPER FUNCTIONS =====

/**
 * Checks if any word inside a multi-word brand matches the token within edit distance.
 * @param {string} token
 * @param {string} brandToken
 * @returns {boolean}
 */
function brandWordsMatchToken(token, brandToken) {
  const parts = brandToken.split(/\s+/);
  for (const part of parts) {
    if (part.length >= FUZZY_MIN_TOKEN_LENGTH && editDistance(token, part) <= FUZZY_MAX_EDIT_DISTANCE) {
      return true;
    }
  }
  return false;
}

// ===== MAIN FUNCTION =====

/**
 * Levenshtein edit distance. Deterministic.
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function editDistance(left, right) {
  const firstText = String(left || '');
  const secondText = String(right || '');
  if (firstText === secondText) return 0;
  if (!firstText.length) return secondText.length;
  if (!secondText.length) return firstText.length;

  const previousRow = new Array(secondText.length + 1);
  const currentRow = new Array(secondText.length + 1);
  for (let j = 0; j <= secondText.length; j += 1) {
    previousRow[j] = j;
  }

  for (let i = 1; i <= firstText.length; i += 1) {
    currentRow[0] = i;
    for (let j = 1; j <= secondText.length; j += 1) {
      const substitutionCost = firstText[i - 1] === secondText[j - 1] ? EXACT_MATCH_COST : MISMATCH_COST;
      currentRow[j] = Math.min(
        previousRow[j] + 1,
        currentRow[j - 1] + 1,
        previousRow[j - 1] + substitutionCost,
      );
    }
    for (let j = 0; j <= secondText.length; j += 1) {
      previousRow[j] = currentRow[j];
    }
  }
  return previousRow[secondText.length];
}

/**
 * True when the query token is explained by a candidate token at distance <= 1.
 * Only for rare-ish tokens with length >= FUZZY_MIN_TOKEN_LENGTH.
 * @param {string} queryToken
 * @param {string[]} candidateTokens
 * @param {{ allowFuzzy?: boolean }} options
 * @returns {boolean}
 */
function tokenExplainedByFuzzy(queryToken, candidateTokens, options = {}) {
  const token = String(queryToken || '');
  if (!options.allowFuzzy) return false;
  if (token.length < FUZZY_MIN_TOKEN_LENGTH) return false;
  for (const candidateToken of candidateTokens || []) {
    if (editDistance(token, candidateToken) <= FUZZY_MAX_EDIT_DISTANCE) {
      return true;
    }
  }
  return false;
}

/**
 * One-edit match against the generated brand lexicon (spelling credit only).
 * @param {string} queryToken
 * @param {string[]} brandLexicon
 * @returns {boolean}
 */
function brandLexiconOneEditMatch(queryToken, brandLexicon) {
  const token = String(queryToken || '');
  if (token.length < FUZZY_MIN_TOKEN_LENGTH) return false;
  for (const brand of brandLexicon || []) {
    const brandToken = String(brand || '').toLowerCase();
    if (!brandToken) continue;
    // Exact brand string or one-edit on the whole brand phrase/token.
    if (editDistance(token, brandToken) <= FUZZY_MAX_EDIT_DISTANCE) {
      return true;
    }
    if (brandWordsMatchToken(token, brandToken)) {
      return true;
    }
  }
  return false;
}

module.exports = {
  editDistance,
  tokenExplainedByFuzzy,
  brandLexiconOneEditMatch,
};
