// Allow-list for what a client may name a workout day on the dashboard.
// Flow: raw text → normalize (trim, lowercase, collapse spaces) → membership test against a Set.
// Used to keep "today's workout" labels to recognizable split names so the dashboard and
// the AI coach can reason about them, instead of accepting arbitrary free text.

// Phrases with a space or a qualifier. Note the deliberate duplicates ("leg day" AND
// "legs day", "bands" AND "resistance_bands"): clients type both, and both must pass.
// Manipulate here: this is the vocabulary of accepted workout-day names — add a row to
//                  allow a new split. Keep entries lowercase; the Set below is built from these.
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

/** Single-word splits some clients use instead of "X day" */
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

// The one normalizer both the Set and the check use, so "  Chest   Day " and "chest day"
// are treated as the same label. Matching would be brittle without this.
// vocab: /\s+/g → ' ' = collapse any run of whitespace into a single space
export const normalizeWorkoutDayLabel = (raw) =>
  String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

// Both lists flattened into one lookup structure, built once at import time.
// vocab: Set = collection with O(1) `.has()` — far faster than array.includes on every render
// vocab/symbol: [...a, ...b] = spread both arrays into one new array
const ALLOWED = new Set([...MULTI_WORD_OR_PHRASE.map((s) => s.toLowerCase()), ...SINGLE_WORD]);

/**
 * @param {string} raw — workout name from the client (e.g. "Chest Day")
 * @returns {boolean}
 */
// The gate. Normalize, reject empty, then a single Set lookup.
export function isAllowedClientWorkoutDayLabel(raw) {
  const n = normalizeWorkoutDayLabel(raw);
  if (!n) return false;
  return ALLOWED.has(n);
}

// Placeholder/help copy so the UI can show examples without duplicating the lists above.
// Manipulate here: user-facing hint text — keep every example one that actually passes the check
export const WORKOUT_DAY_EXAMPLES_SHORT =
  'Chest Day, Pull Day, Leg Day, Full Body, Rest Day, Push Day, Arm Day';
