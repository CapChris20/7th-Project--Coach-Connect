// Normalize one Candidate's per-100 and serving options so they agree.
// Flow: copy → restaurant keep published portion → cross-check grams ↔ per100 → default serving.
// Used by matchFoodsV2 before gates/score. Never invents macro numbers.

const {
  SERVING_CROSSCHECK_TOLERANCE,
} = require('./config/weights');

const FLAG_SERVING_INCONSISTENT = 'serving_inconsistent';
const FLAG_DO_NOT_AUTOFILL = 'do_not_autofill';
const DEFAULT_PER100_LABEL = '100 g';

/**
 * Return a Candidate with consistent servings / per100 and quality flags.
 * Does not tidy names. Does not invent kcal/macros.
 * @param {object} candidate
 * @returns {object}
 */
function normalizeCandidateServings(candidate) {
  // 1. Nothing usable → return as-is.
  if (!candidate || typeof candidate !== 'object') return candidate;

  // 2. Shallow-copy nutrition blocks so we never mutate the caller's object.
  const next = {
    ...candidate,
    per100: candidate.per100 ? { ...candidate.per100 } : null,
    servings: Array.isArray(candidate.servings)
      ? candidate.servings.map((row) => ({ ...row }))
      : [],
    quality: {
      completeness: candidate.quality?.completeness ?? 0,
      sourceFlags: Array.isArray(candidate.quality?.sourceFlags)
        ? [...candidate.quality.sourceFlags]
        : [],
    },
  };

  // 3. Restaurant channel: keep the published portion; never invent grams.
  if (next.channel === 'restaurant') {
    return ensureRestaurantPortions(next);
  }

  // 4. Cross-check every serving that has grams against per100.
  applyServingPer100CrossCheck(next);

  // 5. If we only have per100, offer an explicit "100 g" default (no guessed macros).
  ensureDefaultHundredGramServing(next);

  // 6. If we only have a labeled serving with grams, derive per100 from it.
  derivePer100FromLabeledServing(next);

  return next;
}

/**
 * Pick the serving row the UI / autofill should default to.
 * @param {object} candidate
 * @returns {object|null}
 */
function pickDefaultServing(candidate) {
  const servings = Array.isArray(candidate?.servings) ? candidate.servings : [];

  // 1. Prefer label/menu rows that already carry grams or an explicit unit in the label.
  for (const origin of ['label', 'menu']) {
    for (const row of servings) {
      if (row.origin !== origin) continue;
      if (rowHasGramsOrExplicitUnit(row)) return row;
    }
  }

  // 2. Any remaining label/menu row (restaurant published portion).
  for (const origin of ['label', 'menu']) {
    for (const row of servings) {
      if (row.origin === origin) return row;
    }
  }

  // 3. Explicit 100 g derived from per100 — never a silent guess of macros.
  for (const row of servings) {
    if (row.label === DEFAULT_PER100_LABEL && row.origin === 'derived') return row;
  }

  return servings[0] || null;
}

/**
 * True when this candidate must not auto-fill (serving vs per100 fight).
 * @param {object} candidate
 * @returns {boolean}
 */
function candidateBlocksAutofill(candidate) {
  const flags = candidate?.quality?.sourceFlags;
  if (!Array.isArray(flags)) return false;
  return flags.includes(FLAG_DO_NOT_AUTOFILL) || flags.includes(FLAG_SERVING_INCONSISTENT);
}

module.exports = {
  normalizeCandidateServings,
  pickDefaultServing,
  candidateBlocksAutofill,
  FLAG_SERVING_INCONSISTENT,
  FLAG_DO_NOT_AUTOFILL,
  DEFAULT_PER100_LABEL,
};

// ===== PLUMBING — skip unless debugging =====

function ensureRestaurantPortions(candidate) {
  // Restaurant items stay on the published portion string ("1 sandwich", "10 pc").
  // We never convert them to grams here.
  if (candidate.servings.length === 0) {
    candidate.servings.push({
      label: '1 serving',
      grams: null,
      kcal: null,
      protein: null,
      carbs: null,
      fat: null,
      origin: 'menu',
    });
  }
  for (const row of candidate.servings) {
    if (row.origin === 'derived' && row.grams != null) {
      row.grams = null;
    }
  }
  return candidate;
}

function applyServingPer100CrossCheck(candidate) {
  const per100 = candidate.per100;
  if (!per100 || per100.kcal == null || !(per100.kcal > 0)) return;

  const kept = [];
  for (const row of candidate.servings) {
    if (row.grams == null || !(row.grams > 0) || row.kcal == null) {
      kept.push(row);
      continue;
    }

    const impliedPer100 = (row.kcal / row.grams) * 100;
    const relativeGap = Math.abs(impliedPer100 - per100.kcal) / per100.kcal;
    // Manipulate here: gap vs SERVING_CROSSCHECK_TOLERANCE in weights.js
    if (relativeGap <= SERVING_CROSSCHECK_TOLERANCE) {
      kept.push(row);
      continue;
    }

    // Disagreement: drop lower-confidence (derived) side; label/menu marks the whole row.
    if (row.origin === 'derived') {
      continue;
    }

    markInconsistent(candidate);
    kept.push(row);
  }
  candidate.servings = kept;
}

function ensureDefaultHundredGramServing(candidate) {
  const per100 = candidate.per100;
  if (!per100 || per100.kcal == null) return;

  const alreadyHasHundred = candidate.servings.some(
    (row) => row.label === DEFAULT_PER100_LABEL,
  );
  if (alreadyHasHundred) return;

  const hasUsableLabelServing = candidate.servings.some(
    (row) => (row.origin === 'label' || row.origin === 'menu') && rowHasGramsOrExplicitUnit(row),
  );
  if (hasUsableLabelServing) return;

  candidate.servings.push({
    label: DEFAULT_PER100_LABEL,
    grams: 100,
    kcal: per100.kcal,
    protein: per100.protein,
    carbs: per100.carbs,
    fat: per100.fat,
    origin: 'derived',
  });
}

function derivePer100FromLabeledServing(candidate) {
  if (candidate.per100 && candidate.per100.kcal != null) return;

  let sourceRow = null;
  for (const row of candidate.servings) {
    if (row.origin !== 'label' && row.origin !== 'menu') continue;
    if (row.grams == null || !(row.grams > 0)) continue;
    if (row.kcal == null) continue;
    sourceRow = row;
    break;
  }
  if (!sourceRow) return;

  const scale = 100 / sourceRow.grams;
  candidate.per100 = {
    kcal: sourceRow.kcal * scale,
    protein: sourceRow.protein == null ? null : sourceRow.protein * scale,
    carbs: sourceRow.carbs == null ? null : sourceRow.carbs * scale,
    fat: sourceRow.fat == null ? null : sourceRow.fat * scale,
    basis: 'g',
  };
}

function rowHasGramsOrExplicitUnit(row) {
  if (row.grams != null && row.grams > 0) return true;
  const label = String(row.label || '').toLowerCase();
  // vocab: explicit unit = grams/ml/oz/cup/etc. already written on the label string
  return /\d/.test(label) && /(g|gram|ml|oz|cup|tbsp|tsp|fl\s*oz|piece|pc|slice)\b/.test(label);
}

function markInconsistent(candidate) {
  const flags = candidate.quality.sourceFlags;
  if (!flags.includes(FLAG_SERVING_INCONSISTENT)) flags.push(FLAG_SERVING_INCONSISTENT);
  if (!flags.includes(FLAG_DO_NOT_AUTOFILL)) flags.push(FLAG_DO_NOT_AUTOFILL);
}
