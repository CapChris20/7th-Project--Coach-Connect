/** IQR-based consensus filter for multi-source nutrition macros. */
const { NUTRIENT_KEYS, SOURCE_DISPLAY_NAMES } = require('./constants');

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function removeOutliersIqr(values) {
  if (values.length <= 2) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const filtered = values.filter((v) => v >= lower && v <= upper);
  return filtered.length ? filtered : values;
}

function formatVariancePct(mean, min, max) {
  if (!Number.isFinite(mean) || mean <= 0) return '0%';
  const pct = ((max - min) / mean) * 100;
  return `${pct.toFixed(1)}%`;
}

function buildNutrientConsensus(values) {
  const nums = values.filter((v) => v != null && Number.isFinite(Number(v))).map(Number);
  if (nums.length === 0) return null;
  if (nums.length === 1) return null;

  const filtered = removeOutliersIqr(nums);
  if (filtered.length === 0) return null;
  if (filtered.length === 1) return null;

  const min = Math.min(...filtered);
  const max = Math.max(...filtered);
  const mean = filtered.reduce((a, b) => a + b, 0) / filtered.length;
  const varianceStr = formatVariancePct(mean, min, max);
  const variancePct = mean > 0 ? ((max - min) / mean) * 100 : 0;

  if (variancePct > 20) return null;

  const result = {
    value: Math.round(mean),
    sources_agreeing: filtered.length,
    range: [Math.round(min), Math.round(max)],
    variance: varianceStr,
  };

  if (variancePct >= 10) {
    result.warning = 'verify_manually';
  }

  return result;
}

function macroFieldsOnly(macros) {
  const out = {};
  for (const key of NUTRIENT_KEYS) {
    if (macros?.[key] != null) out[key] = macros[key];
  }
  return out;
}

function buildSourceResultRow(sourceKey, macros) {
  return {
    source: SOURCE_DISPLAY_NAMES[sourceKey] || sourceKey,
    sourceKey,
    calories: macros.calories ?? null,
    protein_g: macros.protein_g ?? null,
    carbs_g: macros.carbs_g ?? null,
    fat_g: macros.fat_g ?? null,
    fiber_g: macros.fiber_g ?? null,
    sodium_mg: macros.sodium_mg ?? null,
    url: macros.url || null,
    servingLabel: macros.servingLabel || null,
    displayName: macros.displayName || null,
    servingBasis: macros.servingBasis || 'per_serving',
  };
}

function classifyCalorieSources(rawResults = {}) {
  const entries = [];
  const excludedSources = [];

  for (const [sourceKey, macros] of Object.entries(rawResults)) {
    if (!macros) continue;
    if (macros.servingBasis === 'per_100g') {
      if (macros.calories != null) {
        excludedSources.push({
          source: SOURCE_DISPLAY_NAMES[sourceKey] || sourceKey,
          sourceKey,
          calories: macros.calories,
          reason: 'wrong_serving_basis',
        });
      }
      continue;
    }
    if (macros.calories == null) continue;
    entries.push({ sourceKey, value: Number(macros.calories), macros });
  }

  if (entries.length <= 1) {
    const inlierKeys = new Set(entries.map((e) => e.sourceKey));
    return { inlierKeys, excludedSources };
  }

  const values = entries.map((e) => e.value);
  const filtered = removeOutliersIqr(values);
  const mean = filtered.reduce((a, b) => a + b, 0) / filtered.length;
  const inlierKeys = new Set();

  for (const entry of entries) {
    if (filtered.some((v) => Math.abs(v - entry.value) < 0.5)) {
      inlierKeys.add(entry.sourceKey);
    } else {
      excludedSources.push({
        source: SOURCE_DISPLAY_NAMES[entry.sourceKey] || entry.sourceKey,
        sourceKey: entry.sourceKey,
        calories: entry.value,
        reason: 'outlier',
        variancePct:
          mean > 0 ? Number((((entry.value - mean) / mean) * 100).toFixed(1)) : null,
      });
    }
  }

  return { inlierKeys, excludedSources };
}

/**
 * Process raw scraper results into consensus nutrients + per-source rows.
 * @param {Record<string, object|null>} rawResults keyed by source id
 */
function getFoodNutritionConsensus(rawResults = {}) {
  const { inlierKeys, excludedSources } = classifyCalorieSources(rawResults);
  const validatedKeys = Object.keys(rawResults).filter((k) => rawResults[k] != null);

  const consensusInput = {};
  if (inlierKeys.size >= 2) {
    for (const key of inlierKeys) {
      consensusInput[key] = macroFieldsOnly(rawResults[key]);
    }
  }

  const consensus = {};
  const nutrientLogs = [];

  for (const nutrient of NUTRIENT_KEYS) {
    const entries = [];
    for (const [sourceKey, macros] of Object.entries(consensusInput)) {
      if (!macros || macros[nutrient] == null) continue;
      entries.push({ sourceKey, value: Number(macros[nutrient]) });
    }

    const values = entries.map((e) => e.value);
    const nutrientConsensus = buildNutrientConsensus(values);

    nutrientLogs.push({
      nutrient,
      rawValues: entries,
      variance: nutrientConsensus?.variance || null,
      included: nutrientConsensus != null,
    });

    if (nutrientConsensus) {
      consensus[nutrient] = nutrientConsensus;
    }
  }

  const sourceResultKeys = new Set();
  if (inlierKeys.size >= 2) {
    inlierKeys.forEach((k) => sourceResultKeys.add(k));
  } else {
    validatedKeys.forEach((k) => {
      const m = rawResults[k];
      if (m && m.servingBasis !== 'per_100g') sourceResultKeys.add(k);
    });
  }

  const sourceResults = [...sourceResultKeys].map((k) =>
    buildSourceResultRow(k, rawResults[k]),
  );

  const sources_used = validatedKeys.map((key) => SOURCE_DISPLAY_NAMES[key] || key);

  return {
    consensus,
    sources_used,
    nutrientLogs,
    sourceResults,
    excludedSources,
  };
}

module.exports = {
  getFoodNutritionConsensus,
  removeOutliersIqr,
  buildNutrientConsensus,
  formatVariancePct,
  classifyCalorieSources,
  buildSourceResultRow,
};
