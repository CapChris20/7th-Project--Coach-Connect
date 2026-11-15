// One food-search candidate shape for every nutrition source.
// Flow: raw source fields → createCandidate → validateCandidate.
// Used by scraper adapters, gates, and candidate ranking.
// Pure CommonJS — no network calls.

// ===== NAMED CONSTANTS =====

const SOURCE_TIERS = Object.freeze({
  fatSecret: 1,
  usdaFdc: 1,
  openFoodFacts: 1,
  calorieKing: 2,
  menuStat: 2,
  fastFoodNutrition: 2,
  foodFacto: 2,
  serper: 3,
  yazio: 3,
  cronometer: 3,
  myFitnessPal: 3,
});

const CHANNELS = Object.freeze(['packaged', 'restaurant', 'generic', 'unknown']);
const PER100_BASES = Object.freeze(['g', 'ml']);
const SERVING_ORIGINS = Object.freeze(['label', 'menu', 'derived']);
const DEFAULT_SERVING_LABEL = '1 serving';
const DEFAULT_SERVING_ORIGIN = 'derived';
const DEFAULT_BASIS_GRAMS = 'g';
const DEFAULT_CHANNEL = 'unknown';

// ===== HELPER FUNCTIONS =====

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildFallbackId(source, name, brand) {
  const joined = `${source}|${brand}|${name}`.toLowerCase().replace(/\s+/g, ' ').trim();
  return `candidate:${joined || 'empty'}`;
}

function resolveChannel(channel) {
  if (CHANNELS.includes(channel)) return channel;
  return DEFAULT_CHANNEL;
}

function normalizeCategoryPath(path) {
  if (!Array.isArray(path)) return [];
  const normalizedParts = [];
  for (const part of path) {
    if (part == null) continue;
    normalizedParts.push(String(part));
  }
  return normalizedParts;
}

function finiteOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number;
}

function normalizePer100(per100) {
  if (!per100 || typeof per100 !== 'object') return null;
  const basis = PER100_BASES.includes(per100.basis) ? per100.basis : DEFAULT_BASIS_GRAMS;
  return {
    kcal: finiteOrNull(per100.kcal),
    protein: finiteOrNull(per100.protein),
    carbs: finiteOrNull(per100.carbs),
    fat: finiteOrNull(per100.fat),
    basis,
  };
}

function normalizeServings(servings) {
  if (!Array.isArray(servings)) return [];
  const normalizedServings = [];
  for (const row of servings) {
    if (!row || typeof row !== 'object') continue;
    const origin = SERVING_ORIGINS.includes(row.origin) ? row.origin : DEFAULT_SERVING_ORIGIN;
    normalizedServings.push({
      label: String(row.label || DEFAULT_SERVING_LABEL),
      grams: finiteOrNull(row.grams),
      kcal: finiteOrNull(row.kcal),
      protein: finiteOrNull(row.protein),
      carbs: finiteOrNull(row.carbs),
      fat: finiteOrNull(row.fat),
      origin,
    });
  }
  return normalizedServings;
}

function normalizeQuality(quality) {
  const input = quality && typeof quality === 'object' ? quality : {};
  let completeness = Number(input.completeness);
  if (!Number.isFinite(completeness)) completeness = 0;
  if (completeness < 0) completeness = 0;
  if (completeness > 1) completeness = 1;
  const sourceFlags = Array.isArray(input.sourceFlags)
    ? input.sourceFlags.map((flag) => String(flag))
    : [];
  return { completeness, sourceFlags };
}

function normalizeProvenance(provenance) {
  const input = provenance && typeof provenance === 'object' ? provenance : {};
  return {
    url: input.url == null || input.url === '' ? null : String(input.url),
    fetchedAt: input.fetchedAt == null || input.fetchedAt === '' ? null : String(input.fetchedAt),
  };
}

function pushPer100Errors(per100, errors) {
  if (per100 == null) return;
  if (typeof per100 !== 'object') {
    errors.push('per100_not_object');
    return;
  }
  if (!PER100_BASES.includes(per100.basis)) errors.push('per100_basis_invalid');
  for (const macroKey of ['kcal', 'protein', 'carbs', 'fat']) {
    if (per100[macroKey] != null && !Number.isFinite(Number(per100[macroKey]))) {
      errors.push(`per100_${macroKey}_invalid`);
    }
  }
}

function pushServingsErrors(servings, errors) {
  if (!Array.isArray(servings)) {
    errors.push('servings_not_array');
    return;
  }
  for (let index = 0; index < servings.length; index += 1) {
    const row = servings[index];
    if (!row || typeof row !== 'object') {
      errors.push(`servings_${index}_not_object`);
      continue;
    }
    if (typeof row.label !== 'string') errors.push(`servings_${index}_label_invalid`);
    if (!SERVING_ORIGINS.includes(row.origin)) errors.push(`servings_${index}_origin_invalid`);
  }
}

function pushQualityErrors(quality, errors) {
  if (!quality || typeof quality !== 'object') {
    errors.push('quality_missing');
    return;
  }
  if (!Number.isFinite(Number(quality.completeness))) errors.push('quality_completeness_invalid');
  if (!Array.isArray(quality.sourceFlags)) errors.push('quality_sourceFlags_invalid');
}

function pushProvenanceErrors(provenance, errors) {
  if (!provenance || typeof provenance !== 'object') {
    errors.push('provenance_missing');
    return;
  }
  if (provenance.url != null && typeof provenance.url !== 'string') {
    errors.push('provenance_url_invalid');
  }
  if (provenance.fetchedAt != null && typeof provenance.fetchedAt !== 'string') {
    errors.push('provenance_fetchedAt_invalid');
  }
}

// ===== MAIN FUNCTION =====

/**
 * Build one Candidate. Does not tidy titles or invent macros.
 * @param {object} fields
 * @returns {object}
 */
function createCandidate(fields) {
  // 1. Require a plain object.
  const input = fields && typeof fields === 'object' ? fields : {};

  // 2. Copy identity and text as raw strings (no display cleanup).
  const source = String(input.source || '').trim();
  const name = String(input.name || '');
  const brand = input.brand == null ? '' : String(input.brand);
  const id = String(input.id || buildFallbackId(source, name, brand));

  // 3. Attach tier / channel / optional GTIN / category path.
  const sourceTier = resolveSourceTier(source, input.sourceTier);
  const channel = resolveChannel(input.channel);
  const categoryPath = normalizeCategoryPath(input.categoryPath);
  const gtin = input.gtin == null || input.gtin === '' ? null : String(input.gtin);

  // 4. Attach nutrition blocks (or null / empty when the source had none).
  const per100 = normalizePer100(input.per100);
  const servings = normalizeServings(input.servings);
  const quality = normalizeQuality(input.quality);
  const provenance = normalizeProvenance(input.provenance);

  return {
    id,
    source,
    sourceTier,
    name,
    brand,
    categoryPath,
    channel,
    gtin,
    per100,
    servings,
    quality,
    provenance,
  };
}

/**
 * Check a Candidate against the schema. Never throws.
 * @param {object} candidate
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validateCandidate(candidate) {
  const errors = [];

  // 1. Must be an object.
  if (!candidate || typeof candidate !== 'object') {
    return { ok: false, errors: ['candidate_not_object'] };
  }

  // 2. Required identity fields.
  if (!isNonEmptyString(candidate.id)) errors.push('id_missing');
  if (!isNonEmptyString(candidate.source)) errors.push('source_missing');
  if (!isNonEmptyString(candidate.name)) errors.push('name_missing');
  if (typeof candidate.brand !== 'string') errors.push('brand_not_string');

  // 3. Tier / channel / category.
  if (![1, 2, 3].includes(candidate.sourceTier)) errors.push('sourceTier_invalid');
  if (!CHANNELS.includes(candidate.channel)) errors.push('channel_invalid');
  if (!Array.isArray(candidate.categoryPath)) errors.push('categoryPath_not_array');
  else if (candidate.categoryPath.some((part) => typeof part !== 'string')) {
    errors.push('categoryPath_entry_not_string');
  }

  // 4. Optional GTIN must be a digit string when present.
  if (candidate.gtin != null) {
    if (typeof candidate.gtin !== 'string' || !/^\d+$/.test(candidate.gtin)) {
      errors.push('gtin_invalid');
    }
  }

  // 5. Nutrition blocks.
  pushPer100Errors(candidate.per100, errors);
  pushServingsErrors(candidate.servings, errors);
  pushQualityErrors(candidate.quality, errors);
  pushProvenanceErrors(candidate.provenance, errors);

  return { ok: errors.length === 0, errors };
}

/**
 * Same as validateCandidate, but throws when invalid.
 * @param {object} candidate
 * @returns {object}
 */
function assertCandidate(candidate) {
  const result = validateCandidate(candidate);
  if (!result.ok) {
    throw new Error(`Invalid Candidate: ${result.errors.join(', ')}`);
  }
  return candidate;
}

/**
 * Source → tier. Unknown sources are tier 3 (weakest prior).
 * @param {string} source
 * @param {number} [override]
 * @returns {1|2|3}
 */
function resolveSourceTier(source, override) {
  if (override === 1 || override === 2 || override === 3) return override;
  const mapped = SOURCE_TIERS[source];
  if (mapped === 1 || mapped === 2 || mapped === 3) return mapped;
  return 3;
}

module.exports = {
  SOURCE_TIERS,
  CHANNELS,
  PER100_BASES,
  SERVING_ORIGINS,
  createCandidate,
  validateCandidate,
  assertCandidate,
  resolveSourceTier,
};
