// Converts dislike-picker state ↔ the comma string on the trainee profile.
// Flow: serialize = catalog names first, then custom names; parse splits back into ids + custom text.
// Used by: DislikedExercisesPicker.

import { EXERCISE_DISLIKE_BY_ID, EXERCISE_DISLIKE_CATALOG } from './dislikableExercises';

// ===== NAMED CONSTANTS =====

// Manipulate here: delimiter between stored exercise names (profile field is one string)
const DISLIKE_NAME_DELIMITER = ',';
const DISLIKE_NAME_JOIN = ', ';

// vocab: LOWERCASE_NAME_TO_CATALOG_ID = lowercase catalog label → stable dislike id (built once at load)
const LOWERCASE_NAME_TO_CATALOG_ID = Object.fromEntries(
  EXERCISE_DISLIKE_CATALOG.map((catalogRow) => [
    catalogRow.name.toLowerCase(),
    catalogRow.id,
  ]),
);

// ===== HELPER FUNCTIONS =====

/**
 * Look up a catalog id from a typed / stored exercise name (case-insensitive).
 * @param {string} exerciseName
 * @returns {string|undefined}
 */
function catalogIdForExerciseName(exerciseName) {
  const loweredName = String(exerciseName || '').toLowerCase();
  return LOWERCASE_NAME_TO_CATALOG_ID[loweredName];
}

/**
 * True when the name list already has this exercise (ignore letter case).
 * @param {string[]} names
 * @param {string} exerciseName
 * @returns {boolean}
 */
function nameListAlreadyIncludes(names, exerciseName) {
  const loweredTarget = exerciseName.toLowerCase();
  for (const existingName of names) {
    if (existingName.toLowerCase() === loweredTarget) return true;
  }
  return false;
}

/**
 * Split a stored profile string into trimmed name pieces. Empty pieces are dropped.
 * @param {string} storedText
 * @returns {string[]}
 */
function splitTrimmedCommaList(storedText) {
  const rawPieces = String(storedText || '').split(DISLIKE_NAME_DELIMITER);
  const trimmedPieces = [];
  for (const piece of rawPieces) {
    const trimmed = piece.trim();
    if (trimmed) trimmedPieces.push(trimmed);
  }
  return trimmedPieces;
}

/**
 * Catalog id → display name for the profile string (unknown ids become null).
 * @param {string} catalogId
 * @returns {string|null}
 */
function displayNameForCatalogId(catalogId) {
  const catalogRow = EXERCISE_DISLIKE_BY_ID[catalogId];
  if (!catalogRow) {
    return null;
  }
  if (!catalogRow.name) {
    return null;
  }
  return catalogRow.name;
}

/**
 * True when this custom name is already covered by a selected catalog chip.
 * @param {string} customName
 * @param {string[]} selectedIds
 * @returns {boolean}
 */
function customNameDuplicatesSelectedCatalog(customName, selectedIds) {
  const matchingCatalogId = catalogIdForExerciseName(customName);
  if (!matchingCatalogId) return false;
  return selectedIds.includes(matchingCatalogId);
}

// ===== MAIN FUNCTION =====

/**
 * Picker selections + free-text customs → one profile string (comma-separated names).
 * @param {string[]} selectedIds
 * @param {string} customText
 * @returns {string}
 */
export function serializeExerciseDislikes(selectedIds = [], customText = '') {
  const safeSelectedIds = selectedIds || [];

  // 1. Turn every selected catalog id into its display name (drop unknown ids).
  const namesFromCatalog = [];
  for (const catalogId of safeSelectedIds) {
    const displayName = displayNameForCatalogId(catalogId);
    if (displayName) namesFromCatalog.push(displayName);
  }

  // 2. Walk custom comma pieces; skip duplicates and customs that repeat a selected catalog exercise.
  const mergedNames = [...namesFromCatalog];
  for (const customName of splitTrimmedCommaList(customText)) {
    if (customNameDuplicatesSelectedCatalog(customName, safeSelectedIds)) continue;
    if (nameListAlreadyIncludes(mergedNames, customName)) continue;
    mergedNames.push(customName);
  }

  // 3. Join for Firestore / profile field storage.
  return mergedNames.join(DISLIKE_NAME_JOIN);
}

/**
 * Stored profile string → catalog ids + leftover custom text for the picker UI.
 * @param {string} stored
 * @returns {{ selectedIds: string[], customText: string }}
 */
export function parseExerciseDislikes(stored = '') {
  const selectedIds = [];
  const customNameParts = [];

  // 1. Each comma piece is either a catalog name (→ id) or free-text custom.
  for (const piece of splitTrimmedCommaList(stored)) {
    const catalogId = catalogIdForExerciseName(piece);
    if (!catalogId) {
      customNameParts.push(piece);
      continue;
    }
    if (!selectedIds.includes(catalogId)) {
      selectedIds.push(catalogId);
    }
  }

  // 2. Hand the picker chips + leftover “Other” text.
  return {
    selectedIds,
    customText: customNameParts.join(DISLIKE_NAME_JOIN),
  };
}
