// The names a client is allowed to give a workout day.
// Flow: trim and lowercase the label → reject a blank → accept it only if it is on the list.
// Used by the dashboard and the coach so a day name stays a real split, not free text.

// ===== NAMED CONSTANTS =====

const WHITESPACE_PATTERN = /\s+/g;

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

const WORKOUT_DAY_EXAMPLES_SHORT =
  'Chest Day, Pull Day, Leg Day, Full Body, Rest Day, Push Day, Arm Day';

// ===== HELPER FUNCTIONS =====

/**
 * Both lists are stored lowercase. The check uses this same cleaning so "  Chest   Day " matches.
 * vocab: \s+ collapses any run of spaces into one space.
 * @param {string} rawLabel
 * @returns {string}
 */
export const normalizeWorkoutDayLabel = (rawLabel) =>
  String(rawLabel ?? '')
    .trim()
    .toLowerCase()
    .replace(WHITESPACE_PATTERN, ' ');

const ALLOWED_WORKOUT_DAY_LABELS = new Set([
  ...MULTI_WORD_OR_PHRASE.map((phrase) => phrase.toLowerCase()),
  ...SINGLE_WORD,
]);

// ===== MAIN FUNCTION =====

/**
 * @param {string} rawLabel
 * @returns {boolean}
 */
export function isAllowedClientWorkoutDayLabel(rawLabel) {
  const normalizedLabel = normalizeWorkoutDayLabel(rawLabel);
  if (!normalizedLabel) return false;
  return ALLOWED_WORKOUT_DAY_LABELS.has(normalizedLabel);
}

export { WORKOUT_DAY_EXAMPLES_SHORT };
