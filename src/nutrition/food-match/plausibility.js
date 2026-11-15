// Macro plausibility checks for candidates (Atwater, bounds, category bands).
// Flow: negatives → all-zero → kcal/100 cap → Atwater → category percentile band.
// Used by food-match gates to filter physiologically impossible foods.
// Pure CommonJS. Category bands come from generated USDA/OFF stats, not hand lists.

const {
  ATWATER_TOLERANCE,
  MAX_KCAL_PER_100,
  ATWATER_FIBER_ALCOHOL_ALLOWANCE,
} = require('./config/weights');

// ===== NAMED CONSTANTS =====

const KCAL_PER_PROTEIN_GRAM = 4;
const KCAL_PER_CARB_GRAM = 4;
const KCAL_PER_FAT_GRAM = 9;
const MIN_CATEGORY_PAD_KCAL = 30;
const CATEGORY_BAND_SPREAD_MULTIPLIER = 0.25;
const ZERO_MACRO_ALLOWED_CATEGORIES = Object.freeze(['water', 'beverage', 'drink', 'sweetener', 'soda']);
const CORE_MACRO_KEYS = Object.freeze(['kcal', 'protein', 'carbs', 'fat']);

// ===== HELPER FUNCTIONS =====

function finiteOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number;
}

/**
 * Pick kcal/protein/carbs/fat from per100 or the first serving.
 * @param {object} candidate
 * @returns {{ kcal: number|null, protein: number|null, carbs: number|null, fat: number|null, basis: string|null }}
 */
function macrosFromCandidate(candidate) {
  if (candidate?.per100) {
    return {
      kcal: finiteOrNull(candidate.per100.kcal),
      protein: finiteOrNull(candidate.per100.protein),
      carbs: finiteOrNull(candidate.per100.carbs),
      fat: finiteOrNull(candidate.per100.fat),
      basis: candidate.per100.basis || 'g',
    };
  }
  const serving = Array.isArray(candidate?.servings) ? candidate.servings[0] : null;
  if (serving) {
    return {
      kcal: finiteOrNull(serving.kcal),
      protein: finiteOrNull(serving.protein),
      carbs: finiteOrNull(serving.carbs),
      fat: finiteOrNull(serving.fat),
      basis: 'serving',
    };
  }
  return { kcal: null, protein: null, carbs: null, fat: null, basis: null };
}

/**
 * True when categoryPath suggests beverage / water / sweetener (all-zero allowed).
 * Uses source taxonomy tags only — no brand lists.
 * @param {string[]} categoryPath
 * @returns {boolean}
 */
function categoryAllowsAllZero(categoryPath) {
  const joined = (categoryPath || []).join(' ').toLowerCase();
  if (!joined) return false;
  return ZERO_MACRO_ALLOWED_CATEGORIES.some((allowedWord) => joined.includes(allowedWord));
}

/**
 * Atwater check: 4P + 4C + 9F within tolerance of kcal.
 * @param {{ kcal: number|null, protein: number|null, carbs: number|null, fat: number|null }} macros
 * @returns {boolean}
 */
function passesAtwater(macros) {
  const kcal = macros.kcal;
  const protein = macros.protein;
  const carbs = macros.carbs;
  const fat = macros.fat;
  if (kcal == null) return true;
  if (protein == null && carbs == null && fat == null) return true;
  const proteinGrams = protein || 0;
  const carbsGrams = carbs || 0;
  const fatGrams = fat || 0;
  const expectedKcal = KCAL_PER_PROTEIN_GRAM * proteinGrams + KCAL_PER_CARB_GRAM * carbsGrams + KCAL_PER_FAT_GRAM * fatGrams;
  const difference = Math.abs(expectedKcal - kcal);
  const allowance = Math.max(ATWATER_TOLERANCE * Math.max(kcal, expectedKcal), ATWATER_FIBER_ALCOHOL_ALLOWANCE);
  return difference <= allowance;
}

/**
 * Category kcal/100g band check when we have per100 macros + a matching band.
 * @param {object} candidate
 * @param {object} categoryKcalBands
 * @returns {boolean}
 */
function passesCategoryBand(candidate, categoryKcalBands) {
  const kcal = candidate?.per100?.kcal;
  if (kcal == null) return true;
  const bands = categoryKcalBands || {};
  const path = candidate.categoryPath || [];
  for (const tag of path) {
    const band = bands[tag];
    if (!band) continue;
    // Soft outer fence: slightly outside p05..p95 still ok; far outside fails.
    const lowPercentile = Number(band.p05);
    const highPercentile = Number(band.p95);
    if (!Number.isFinite(lowPercentile) || !Number.isFinite(highPercentile)) continue;
    const padding = Math.max(MIN_CATEGORY_PAD_KCAL, (highPercentile - lowPercentile) * CATEGORY_BAND_SPREAD_MULTIPLIER);
    if (kcal < lowPercentile - padding) return false;
    if (kcal > highPercentile + padding) return false;
    return true;
  }
  return true;
}

// ===== MAIN FUNCTION =====

/**
 * Full plausibility report for gate G4.
 * @param {object} candidate
 * @param {{ categoryKcalBands?: object }} [options]
 * @returns {{ ok: boolean, reasons: string[] }}
 */
function checkPlausibility(candidate, options = {}) {
  const reasons = [];
  const macros = macrosFromCandidate(candidate);

  // 1. No negatives.
  for (const macroKey of CORE_MACRO_KEYS) {
    if (macros[macroKey] != null && macros[macroKey] < 0) {
      reasons.push(`negative_${macroKey}`);
    }
  }

  // 2. All-zero outside beverage/water/sweetener.
  const allZero =
    (macros.kcal == null || macros.kcal === 0)
    && (macros.protein == null || macros.protein === 0)
    && (macros.carbs == null || macros.carbs === 0)
    && (macros.fat == null || macros.fat === 0);
  if (allZero && macros.kcal === 0) {
    if (!categoryAllowsAllZero(candidate.categoryPath)) {
      reasons.push('all_zero_macros');
    }
  }

  // 3. kcal/100g ceiling when basis is per100.
  if (candidate.per100 && macros.kcal != null && macros.kcal > MAX_KCAL_PER_100) {
    reasons.push('kcal_per_100_too_high');
  }

  // 4. Atwater.
  if (!passesAtwater(macros)) {
    reasons.push('atwater_violation');
  }

  // 5. Category percentile band.
  if (!passesCategoryBand(candidate, options.categoryKcalBands)) {
    reasons.push('category_kcal_band');
  }

  return { ok: reasons.length === 0, reasons };
}

module.exports = {
  macrosFromCandidate,
  categoryAllowsAllZero,
  passesAtwater,
  passesCategoryBand,
  checkPlausibility,
};
