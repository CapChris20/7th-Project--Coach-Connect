// Map a legacy search / consensus row into a Candidate without title tidy.
// Flow: raw name/brand fields → createCandidate.
// Used by shadow mode and the offline eval harness.
// Pure CommonJS.

const { createCandidate } = require('./candidate');

// ===== NAMED CONSTANTS =====

const DEFAULT_SERVING_LABEL = '1 serving';
const NUMBER_OF_CORE_MACROS = 4;
const FALLBACK_SOURCE_KEY = 'unknown';
const DEFAULT_CHANNEL_UNKNOWN = 'unknown';
const DEFAULT_CHANNEL_PACKAGED = 'packaged';

// ===== HELPER FUNCTIONS =====

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number;
}

function normalizeSourceKey(source) {
  const lower = String(source || '').toLowerCase();
  if (lower === 'openfoodfacts' || lower === 'off') return 'openFoodFacts';
  if (lower === 'usda' || lower === 'usdafdc') return 'usdaFdc';
  if (lower === 'fatsecret') return 'fatSecret';
  // Consensus / trusted_catalog are not tier-1 structured sources in v2.
  // Unknown keys resolve to sourceTier 3 via resolveSourceTier.
  if (lower === 'nutrition_consensus') return 'nutrition_consensus';
  if (lower === 'trusted_catalog') return 'trusted_catalog';
  return source;
}

// ===== MAIN FUNCTION =====

/**
 * Converts a legacy nutrition search row into a Candidate object.
 * @param {object} row
 * @param {{ fetchedAt?: string|null }} [options]
 * @returns {object|null}
 */
function rowToCandidate(row, options = {}) {
  if (!row || typeof row !== 'object') return null;

  const name = String(row.name || row.food_name || row.displayName || '').trim();
  if (!name) return null;
  const brand = String(row.brand || row.brand_name || row.restaurant || '').trim();
  const source = String(row.source || row.sourceKey || FALLBACK_SOURCE_KEY);
  const id = String(row.id || `${source}:${name}`);

  const kcal = numberOrNull(row.calories ?? row.nf_calories ?? row.kcal);
  const protein = numberOrNull(row.protein ?? row.nf_protein ?? row.protein_g);
  const carbs = numberOrNull(row.carbs ?? row.nf_total_carbohydrate ?? row.carbs_g);
  const fat = numberOrNull(row.fat ?? row.nf_total_fat ?? row.fat_g);

  const basis = String(row.servingBasis || row.dataBasis || '').toLowerCase();
  const per100 = basis.includes('100')
    ? { kcal, protein, carbs, fat, basis: 'g' }
    : null;

  const servings = [{
    label: String(row.serving_label || row.servingLabel || DEFAULT_SERVING_LABEL),
    grams: numberOrNull(row.servingGrams || row.serving_grams),
    kcal,
    protein,
    carbs,
    fat,
    origin: source === 'serper' ? 'derived' : 'label',
  }];

  let channel = DEFAULT_CHANNEL_UNKNOWN;
  if (row.channel) channel = row.channel;
  else if (brand) channel = DEFAULT_CHANNEL_PACKAGED;

  return createCandidate({
    id,
    source: normalizeSourceKey(source),
    name,
    brand,
    categoryPath: Array.isArray(row.categoryPath) ? row.categoryPath : [],
    channel,
    gtin: row.gtin || row.gtinUpc || null,
    per100,
    servings: per100 ? [] : servings,
    quality: {
      completeness: [kcal, protein, carbs, fat].filter((value) => value != null).length / NUMBER_OF_CORE_MACROS,
      sourceFlags: [],
    },
    provenance: {
      url: row.url || null,
      fetchedAt: options.fetchedAt || null,
    },
  });
}

module.exports = {
  rowToCandidate,
};
