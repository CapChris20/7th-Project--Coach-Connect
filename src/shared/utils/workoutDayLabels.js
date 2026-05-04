/**
 * Allowed labels for "today's workout" / workout day on the client dashboard.
 * Normalized matching is case-insensitive; extra spaces are collapsed.
 */

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

export const normalizeWorkoutDayLabel = (raw) =>
  String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const ALLOWED = new Set([...MULTI_WORD_OR_PHRASE.map((s) => s.toLowerCase()), ...SINGLE_WORD]);

/**
 * @param {string} raw — workout name from the client (e.g. "Chest Day")
 * @returns {boolean}
 */
export function isAllowedClientWorkoutDayLabel(raw) {
  const n = normalizeWorkoutDayLabel(raw);
  if (!n) return false;
  return ALLOWED.has(n);
}

export const WORKOUT_DAY_EXAMPLES_SHORT =
  'Chest Day, Pull Day, Leg Day, Full Body, Rest Day, Push Day, Arm Day';
