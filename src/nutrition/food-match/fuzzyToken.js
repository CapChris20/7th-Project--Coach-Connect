// Near-spelling helpers for rare query tokens.
// Flow: edit distance → optional brand-lexicon one-edit credit.
// Pure. No brand classification — lexicon is spelling credit only.

const {
  FUZZY_MIN_TOKEN_LENGTH,
  FUZZY_MAX_EDIT_DISTANCE,
} = require('./config/weights');

/**
 * Levenshtein edit distance. Deterministic.
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function editDistance(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = new Array(b.length + 1);
  const current = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
}

/**
 * True when the query token is explained by a candidate token at distance <= 1.
 * Only for rare-ish tokens with length >= FUZZY_MIN_TOKEN_LENGTH.
 * @param {string} queryToken
 * @param {string[]} candidateTokens
 * @param {{ allowFuzzy: boolean }} opts
 * @returns {boolean}
 */
function tokenExplainedByFuzzy(queryToken, candidateTokens, opts = {}) {
  const token = String(queryToken || '');
  if (!opts.allowFuzzy) return false;
  if (token.length < FUZZY_MIN_TOKEN_LENGTH) return false;
  for (const candidateToken of candidateTokens || []) {
    if (editDistance(token, candidateToken) <= FUZZY_MAX_EDIT_DISTANCE) return true;
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
    if (editDistance(token, brandToken) <= FUZZY_MAX_EDIT_DISTANCE) return true;
    const parts = brandToken.split(/\s+/);
    for (const part of parts) {
      if (part.length < FUZZY_MIN_TOKEN_LENGTH) continue;
      if (editDistance(token, part) <= FUZZY_MAX_EDIT_DISTANCE) return true;
    }
  }
  return false;
}

module.exports = {
  editDistance,
  tokenExplainedByFuzzy,
  brandLexiconOneEditMatch,
};
