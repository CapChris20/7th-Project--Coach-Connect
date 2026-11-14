// Map a legacy search / consensus row into a Candidate without title tidy.
// Flow: raw name/brand fields → createCandidate.
// Used by shadow mode and the offline eval harness.

const { createCandidate } = require('./candidate');

/**
 * @param {object} row
 * @param {{ fetchedAt?: string|null }} [opts]
 * @returns {object|null}
 */
function rowToCandidate(row, opts = {}) {
  if (!row || typeof row !== 'object') return null;

  const name = String(row.name || row.food_name || row.displayName || '').trim();
  if (!name) return null;
  const brand = String(row.brand || row.brand_name || row.restaurant || '').trim();
  const source = String(row.source || row.sourceKey || 'unknown');
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
    label: String(row.serving_label || row.servingLabel || '1 serving'),
    grams: numberOrNull(row.servingGrams || row.serving_grams),
    kcal,
    protein,
    carbs,
    fat,
    origin: source === 'serper' ? 'derived' : 'label',
  }];

  let channel = 'unknown';
  if (row.channel) channel = row.channel;
  else if (brand) channel = 'packaged';

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
      completeness: [kcal, protein, carbs, fat].filter((value) => value != null).length / 4,
      sourceFlags: [],
    },
    provenance: {
      url: row.url || null,
      fetchedAt: opts.fetchedAt || null,
    },
  });
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

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number;
}

module.exports = {
  rowToCandidate,
};
