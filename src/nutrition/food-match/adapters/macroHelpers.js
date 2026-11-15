// Shared macro packing for Candidate adapters.
// Flow: source numbers → per100 and/or servings → completeness score.
// Used only by scraper adapters. Does not tidy names.
// Ensures consistent parsing of nutrition numbers across data sources.

// ===== NAMED CONSTANTS =====

const MAIN_MACRO_KEYS = Object.freeze(['kcal', 'protein', 'carbs', 'fat']);
const DEFAULT_SERVING_LABEL = '1 serving';
const DEFAULT_SERVING_ORIGIN = 'derived';
const DEFAULT_BASIS_GRAMS = 'g';

// ===== HELPER FUNCTIONS =====

/**
 * Returns a finite number or null if value is missing/empty/invalid.
 * @param {any} value
 * @returns {number|null}
 */
function finiteOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number;
}

/**
 * Count how complete the four main macros are (0..1).
 * @param {{ kcal?: number|null, protein?: number|null, carbs?: number|null, fat?: number|null }} macros
 * @returns {number}
 */
function completenessFromMacros(macros) {
  let presentCount = 0;
  for (const macroKey of MAIN_MACRO_KEYS) {
    if (macros?.[macroKey] != null && Number.isFinite(Number(macros[macroKey]))) {
      presentCount += 1;
    }
  }
  return presentCount / MAIN_MACRO_KEYS.length;
}

/**
 * Build a per-100 block when the source already speaks in 100 g / 100 ml.
 * @param {object} macros
 * @param {'g'|'ml'} basis
 * @returns {object|null}
 */
function per100FromMacros(macros, basis = DEFAULT_BASIS_GRAMS) {
  if (!macros) return null;
  const kcal = finiteOrNull(macros.kcal ?? macros.calories);
  const protein = finiteOrNull(macros.protein ?? macros.protein_g);
  const carbs = finiteOrNull(macros.carbs ?? macros.carbs_g);
  const fat = finiteOrNull(macros.fat ?? macros.fat_g);
  if (kcal == null && protein == null && carbs == null && fat == null) return null;
  return { kcal, protein, carbs, fat, basis };
}

// ===== MAIN FUNCTION =====

/**
 * Build one serving option from label + macros.
 * @param {object} options
 * @returns {object}
 */
function servingFromMacros(options = {}) {
  return {
    label: String(options.label || DEFAULT_SERVING_LABEL),
    grams: finiteOrNull(options.grams),
    kcal: finiteOrNull(options.kcal ?? options.calories),
    protein: finiteOrNull(options.protein ?? options.protein_g),
    carbs: finiteOrNull(options.carbs ?? options.carbs_g),
    fat: finiteOrNull(options.fat ?? options.fat_g),
    origin: options.origin || DEFAULT_SERVING_ORIGIN,
  };
}

module.exports = {
  finiteOrNull,
  completenessFromMacros,
  per100FromMacros,
  servingFromMacros,
};
