// Shared Candidate adapter for weak HTML scrapers (Yazio / Cronometer / MyFitnessPal).
// Flow: raw name + macros → Candidate with sourceTier 3.
// Used by those scraper modules. Keeps name/brand RAW.

const { createCandidate, assertCandidate } = require('../candidate');
const { completenessFromMacros, servingFromMacros } = require('./macroHelpers');

/**
 * @param {string} source
 * @param {object} raw
 * @param {{ fetchedAt?: string|null }} [opts]
 * @returns {object|null}
 */
function adaptWeakHtmlSource(source, raw, opts = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || raw.displayName || '').trim();
  if (!name) return null;
  const brand = String(raw.brand || '').trim();
  const macros = {
    kcal: raw.calories ?? raw.kcal ?? null,
    protein: raw.protein_g ?? raw.protein ?? null,
    carbs: raw.carbs_g ?? raw.carbs ?? null,
    fat: raw.fat_g ?? raw.fat ?? null,
  };
  const candidate = createCandidate({
    id: raw.id ? String(raw.id) : `${source}:${name}`,
    source,
    name,
    brand,
    categoryPath: [],
    channel: 'unknown',
    gtin: null,
    per100: null,
    servings: [
      servingFromMacros({
        label: raw.servingLabel || '1 serving',
        kcal: macros.kcal,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        origin: 'derived',
      }),
    ],
    quality: { completeness: completenessFromMacros(macros), sourceFlags: ['html'] },
    provenance: { url: raw.url || null, fetchedAt: opts.fetchedAt || null },
  });
  return assertCandidate(candidate);
}

module.exports = { adaptWeakHtmlSource };
