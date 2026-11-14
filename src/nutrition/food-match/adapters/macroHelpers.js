// Shared macro packing for Candidate adapters.
// Flow: source numbers → per100 and/or servings → completeness score.
// Used only by scraper adapters. Does not tidy names.

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
  const keys = ['kcal', 'protein', 'carbs', 'fat'];
  let present = 0;
  for (const key of keys) {
    if (macros?.[key] != null && Number.isFinite(Number(macros[key]))) present += 1;
  }
  return present / keys.length;
}

/**
 * Build a per-100 block when the source already speaks in 100 g / 100 ml.
 * @param {object} macros
 * @param {'g'|'ml'} basis
 * @returns {object|null}
 */
function per100FromMacros(macros, basis = 'g') {
  if (!macros) return null;
  const kcal = finiteOrNull(macros.kcal ?? macros.calories);
  const protein = finiteOrNull(macros.protein ?? macros.protein_g);
  const carbs = finiteOrNull(macros.carbs ?? macros.carbs_g);
  const fat = finiteOrNull(macros.fat ?? macros.fat_g);
  if (kcal == null && protein == null && carbs == null && fat == null) return null;
  return { kcal, protein, carbs, fat, basis };
}

/**
 * Build one serving option from label + macros.
 * @param {object} opts
 * @returns {object}
 */
function servingFromMacros(opts = {}) {
  return {
    label: String(opts.label || '1 serving'),
    grams: finiteOrNull(opts.grams),
    kcal: finiteOrNull(opts.kcal ?? opts.calories),
    protein: finiteOrNull(opts.protein ?? opts.protein_g),
    carbs: finiteOrNull(opts.carbs ?? opts.carbs_g),
    fat: finiteOrNull(opts.fat ?? opts.fat_g),
    origin: opts.origin || 'derived',
  };
}

module.exports = {
  finiteOrNull,
  completenessFromMacros,
  per100FromMacros,
  servingFromMacros,
};
