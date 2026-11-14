// Allowed labels for a client's workout day name (not free text).
// Flow: clean the typed label → reject blank → accept only if it is on the whitelist.
// Used on dashboard and coach flows so day names stay real splits (Chest Day, Pull Day, …).

// ===== NAMED CONSTANTS =====

// vocab: \s+ = one or more whitespace characters (space, tab, newline)
const WHITESPACE_PATTERN = /\s+/g;

// Manipulate here: add multi-word splits clients may type; keep lowercase phrases
const MULTI_WORD_OR_PHRASE = [
  'rest day',
  'chest day',
  'back day',
  'leg day',
  'legs day',
  'arm day',
  'arms day',
  'shoulder day',
  'shoulders day',
  'bicep day',
  'tricep day',
  'push day',
  'pull day',
  'full body',
  'upper body',
  'lower body',
  'total body',
  'core day',
  'abs day',
  'cardio',
  'hiit',
  'conditioning',
  'glute day',
  'glutes day',
  'active recovery',
  'mobility',
  'stretch',
  'yoga',
  'plyo day',
  'olympic day',
  'power day',
];

// Manipulate here: single-word shortcuts that also count as allowed day names
const SINGLE_WORD = [
  'rest',
  'chest',
  'back',
  'legs',
  'leg',
  'arm',
  'arms',
  'shoulder',
  'shoulders',
  'push',
  'pull',
  'core',
  'cardio',
  'hiit',
];

// Short hint string for empty-state / error copy elsewhere in the app
const WORKOUT_DAY_EXAMPLES_SHORT =
  'Chest Day, Pull Day, Leg Day, Full Body, Rest Day, Push Day, Arm Day';

// ===== HELPER FUNCTIONS =====

/**
 * Build the Set used by the allow-check.
 * Why a Set: O(1) lookup instead of scanning both lists every keystroke.
 */
function buildAllowedLabelSet() {
  const allowedLabels = new Set();

  for (const phrase of MULTI_WORD_OR_PHRASE) {
    allowedLabels.add(phrase.toLowerCase());
  }

  for (const word of SINGLE_WORD) {
    allowedLabels.add(word);
  }

  return allowedLabels;
}

// Built once at module load — whitelist does not change at runtime
const ALLOWED_WORKOUT_DAY_LABELS = buildAllowedLabelSet();

// ===== MAIN FUNCTION =====

/**
 * Trim, lowercase, and collapse spaces so "  Chest   Day " matches the whitelist.
 * @param {string} rawLabel - whatever the user typed or a stored day name
 * @returns {string} cleaned lowercase label (may be empty)
 */
export function normalizeWorkoutDayLabel(rawLabel) {
  // 1. Coerce to string — null/undefined become ""
  // vocab/symbol: ?? = if left is null/undefined, use the right side
  const asText = String(rawLabel ?? '');

  // 2. Trim edges, lowercase, collapse interior whitespace to one space
  const trimmedLower = asText.trim().toLowerCase();
  const spacesCollapsed = trimmedLower.replace(WHITESPACE_PATTERN, ' ');
  return spacesCollapsed;
}

/**
 * True when the normalized label is on the allowed workout-day list.
 * @param {string} rawLabel
 * @returns {boolean}
 */
export function isAllowedClientWorkoutDayLabel(rawLabel) {
  // 1. Same cleaning the whitelist uses
  const normalizedLabel = normalizeWorkoutDayLabel(rawLabel);

  // 2. Blank is never allowed
  if (!normalizedLabel) return false;

  // 3. Must be on the built-in set
  // vocab: Set.has = true when the string is already in the whitelist
  return ALLOWED_WORKOUT_DAY_LABELS.has(normalizedLabel);
}

export { WORKOUT_DAY_EXAMPLES_SHORT };
