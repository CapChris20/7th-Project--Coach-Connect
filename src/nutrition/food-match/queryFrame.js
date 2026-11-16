// Normalize a typed food query into tokens + numeric quantity cues + IDF.
// Flow: clean text → tokenize → parse size/count → attach rarity from tokenStats.
// Used by food-match gates and candidate scoring.
// Pure CommonJS. Does not classify brands, menus, or families with hardcoded lists.

const {
  RARE_TOKEN_IDF_MIN,
} = require('./config/weights');

// ===== NAMED CONSTANTS =====

const FALLBACK_DOCUMENT_COUNT = 1;
const QUANTITY_SUFFIX_TOKENS = Object.freeze(['oz', 'fl', 'g', 'pc', 'pcs', 'piece', 'pieces']);

let cachedStats = null;

// ===== HELPER FUNCTIONS =====

/**
 * Loads token document-frequency statistics from the generated corpus.
 * @returns {object}
 */
function loadTokenStats() {
  if (cachedStats) return cachedStats;
  // Generated offline by scripts/buildTokenStats.mjs
  // eslint-disable-next-line global-require
  cachedStats = require('./generated/tokenStats.json');
  return cachedStats;
}

/**
 * Inject stats in tests without touching the generated file.
 * @param {object|null} stats
 */
function setTokenStatsForTests(stats) {
  cachedStats = stats;
}

/**
 * Cleans punctuation and whitespace from a search query string.
 * @param {string} text
 * @returns {string}
 */
function normalizeQueryText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9.\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits normalized query text into lowercase words.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  const normalized = normalizeQueryText(text);
  if (!normalized) return [];
  return normalized.split(' ').filter((token) => token.length > 0);
}

/**
 * Calculates inverse document frequency (IDF) for a token.
 * @param {string} token
 * @param {object} stats
 * @returns {number}
 */
function idfForToken(token, stats) {
  const documentCount = Number(stats.documentCount) || FALLBACK_DOCUMENT_COUNT;
  const tokenDfMap = stats.tokenDf || {};
  const documentFrequency = Object.prototype.hasOwnProperty.call(tokenDfMap, token)
    ? Number(tokenDfMap[token])
    : Number(stats.unknownDf) || 0;
  return Math.log((documentCount + 1) / (documentFrequency + 1));
}

/**
 * Pull numeric size / count cues without a per-unit regex forest of brands.
 * @param {string} normalized
 * @returns {{ flOz: number|null, pieceCount: number|null, grams: number|null }}
 */
function extractQuantities(normalized) {
  const text = String(normalized || '');
  const flOzMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:fl\.?\s*oz|floz)\b/);
  const pieceMatch = text.match(/\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/);
  const gramMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:g|gram|grams)\b/);
  return {
    flOz: flOzMatch ? Number(flOzMatch[1]) : null,
    pieceCount: pieceMatch ? Number(pieceMatch[1]) : null,
    grams: gramMatch ? Number(gramMatch[1]) : null,
  };
}

function pickHeadToken(tokenInfos) {
  for (let index = tokenInfos.length - 1; index >= 0; index -= 1) {
    const info = tokenInfos[index];
    if (/^\d+(?:\.\d+)?$/.test(info.token)) continue;
    if (QUANTITY_SUFFIX_TOKENS.includes(info.token)) continue;
    return info;
  }
  return null;
}

// ===== MAIN FUNCTION =====

/**
 * Build the query frame used by gates and scoring.
 * @param {string} rawQuery
 * @param {{ stats?: object }} [options]
 * @returns {object}
 */
function buildQueryFrame(rawQuery, options = {}) {
  // 1. Normalize and tokenize.
  const stats = options.stats || loadTokenStats();
  const normalized = normalizeQueryText(rawQuery);
  const tokens = tokenize(normalized);
  const quantities = extractQuantities(normalized);

  // 2. Attach IDF / rarity to every token.
  const tokenInfos = [];
  for (const token of tokens) {
    const idf = idfForToken(token, stats);
    tokenInfos.push({
      token,
      idf,
      rare: idf >= RARE_TOKEN_IDF_MIN,
    });
  }

  // 3. Head noun = last non-quantity-ish token (no family list).
  const head = pickHeadToken(tokenInfos);

  return {
    raw: String(rawQuery || ''),
    normalized,
    tokens: tokenInfos,
    tokenStrings: tokens,
    quantities,
    head,
    brandLexicon: Array.isArray(stats.brands) ? stats.brands : [],
    categoryKcalBands: stats.categoryKcalBands || {},
    documentCount: Number(stats.documentCount) || 0,
  };
}

module.exports = {
  buildQueryFrame,
  normalizeQueryText,
  tokenize,
  idfForToken,
  extractQuantities,
  setTokenStatsForTests,
  loadTokenStats,
};
