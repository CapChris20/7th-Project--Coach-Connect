// Normalize a typed food query into tokens + numeric quantity cues + IDF.
// Flow: clean text → tokenize → parse size/count → attach rarity from tokenStats.
// Pure. Does not classify brands, menus, or families with lists.

const {
  RARE_TOKEN_IDF_MIN,
} = require('./config/weights');

let cachedStats = null;

function loadTokenStats() {
  if (cachedStats) return cachedStats;
  // Generated offline by scripts/buildTokenStats.mjs
  // eslint-disable-next-line import/no-dynamic-require, global-require
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

function normalizeQueryText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9.\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  const normalized = normalizeQueryText(text);
  if (!normalized) return [];
  return normalized.split(' ').filter((token) => token.length > 0);
}

function idfForToken(token, stats) {
  const documentCount = Number(stats.documentCount) || 1;
  const df = Object.prototype.hasOwnProperty.call(stats.tokenDf || {}, token)
    ? Number(stats.tokenDf[token])
    : Number(stats.unknownDf) || 0;
  return Math.log((documentCount + 1) / (df + 1));
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

/**
 * Build the query frame used by gates and scoring.
 * @param {string} rawQuery
 * @param {{ stats?: object }} [opts]
 * @returns {object}
 */
function buildQueryFrame(rawQuery, opts = {}) {
  // 1. Normalize and tokenize.
  const stats = opts.stats || loadTokenStats();
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

// ===== PLUMBING =====

function pickHeadToken(tokenInfos) {
  for (let index = tokenInfos.length - 1; index >= 0; index -= 1) {
    const info = tokenInfos[index];
    if (/^\d+(?:\.\d+)?$/.test(info.token)) continue;
    if (info.token === 'oz' || info.token === 'fl' || info.token === 'g') continue;
    if (info.token === 'pc' || info.token === 'pcs' || info.token === 'piece' || info.token === 'pieces') continue;
    return info;
  }
  return null;
}
