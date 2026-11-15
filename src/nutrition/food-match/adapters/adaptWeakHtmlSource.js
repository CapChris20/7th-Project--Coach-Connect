// Shared Candidate adapter for weak HTML scrapers (Yazio / Cronometer / MyFitnessPal).
// Flow: raw name + macros → Candidate with sourceTier 3.
// Used by scraper modules to normalize unstructured HTML search results.
// Pure CommonJS. Keeps name/brand raw without altering titles.

const { createCandidate, assertCandidate } = require('../candidate');
const { completenessFromMacros, servingFromMacros } = require('./macroHelpers');

// ===== NAMED CONSTANTS =====

const DEFAULT_SERVING_LABEL = '1 serving';
const DEFAULT_CHANNEL = 'unknown';
const DEFAULT_SERVING_ORIGIN = 'derived';
const SOURCE_FLAG_HTML = 'html';

// ===== HELPER FUNCTIONS =====
// (No helper functions in this adapter)

// ===== MAIN FUNCTION =====

/**
 * Normalizes raw scraped HTML nutrition objects into a validated Candidate.
 * @param {string} source
 * @param {object} raw
 * @param {{ fetchedAt?: string|null }} [options]
 * @returns {object|null}
 */
function adaptWeakHtmlSource(source, raw, options = {}) {
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
    channel: DEFAULT_CHANNEL,
    gtin: null,
    per100: null,
    servings: [
      servingFromMacros({
        label: raw.servingLabel || DEFAULT_SERVING_LABEL,
        kcal: macros.kcal,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        origin: DEFAULT_SERVING_ORIGIN,
      }),
    ],
    quality: { completeness: completenessFromMacros(macros), sourceFlags: [SOURCE_FLAG_HTML] },
    provenance: { url: raw.url || null, fetchedAt: options.fetchedAt || null },
  });
  return assertCandidate(candidate);
}

module.exports = { adaptWeakHtmlSource };
