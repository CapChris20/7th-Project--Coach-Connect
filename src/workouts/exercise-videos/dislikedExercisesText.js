// Turns the dislike picker into the comma string stored on the trainee profile, and back.
// Flow: catalog names first, then custom names that are not already selected.
// Used by: DislikedExercisesPicker.

import { EXERCISE_DISLIKE_BY_ID, EXERCISE_DISLIKE_CATALOG } from './dislikableExercises';

// ===== NAMED CONSTANTS =====

const NAME_TO_ID = Object.fromEntries(
  EXERCISE_DISLIKE_CATALOG.map((exercise) => [exercise.name.toLowerCase(), exercise.id]),
);

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} exerciseName
 * @returns {string|undefined}
 */
function catalogIdForName(exerciseName) {
  return NAME_TO_ID[String(exerciseName || '').toLowerCase()];
}

/**
 * @param {string[]} names
 * @param {string} exerciseName
 * @returns {boolean}
 */
function listAlreadyHasName(names, exerciseName) {
  const lowered = exerciseName.toLowerCase();
  return names.some((existingName) => existingName.toLowerCase() === lowered);
}

/**
 * Split "Squat, Weird Machine" into trimmed pieces. Empty pieces are dropped.
 * @param {string} storedText
 * @returns {string[]}
 */
function splitCommaList(storedText) {
  return String(storedText || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

// ===== MAIN FUNCTION =====

/**
 * Selected catalog ids plus optional custom names → the string saved on the profile.
 * A custom name that is already a selected catalog exercise is skipped.
 * @param {string[]} selectedIds
 * @param {string} customText
 * @returns {string}
 */
export function serializeExerciseDislikes(selectedIds = [], customText = '') {
  const catalogNames = (selectedIds || [])
    .map((id) => EXERCISE_DISLIKE_BY_ID[id]?.name)
    .filter(Boolean);

  const mergedNames = [...catalogNames];
  for (const customName of splitCommaList(customText)) {
    const knownId = catalogIdForName(customName);
    const alreadySelected = knownId && selectedIds.includes(knownId);
    if (alreadySelected) continue;
    if (listAlreadyHasName(mergedNames, customName)) continue;
    mergedNames.push(customName);
  }

  return mergedNames.join(', ');
}

/**
 * Stored profile string → catalog ids plus leftover custom text.
 * @param {string} stored
 * @returns {{ selectedIds: string[], customText: string }}
 */
export function parseExerciseDislikes(stored = '') {
  const selectedIds = [];
  const customParts = [];

  for (const part of splitCommaList(stored)) {
    const catalogId = catalogIdForName(part);
    if (!catalogId) {
      customParts.push(part);
      continue;
    }
    if (!selectedIds.includes(catalogId)) selectedIds.push(catalogId);
  }

  return {
    selectedIds,
    customText: customParts.join(', '),
  };
}
