import { EXERCISE_DISLIKE_BY_ID, EXERCISE_DISLIKE_CATALOG } from './exerciseDislikeCatalog';

const NAME_TO_ID = Object.fromEntries(
  EXERCISE_DISLIKE_CATALOG.map((ex) => [ex.name.toLowerCase(), ex.id]),
);

/** Selected catalog IDs + optional custom names → stored profile string. */
export function serializeExerciseDislikes(selectedIds = [], customText = '') {
  const names = (selectedIds || [])
    .map((id) => EXERCISE_DISLIKE_BY_ID[id]?.name)
    .filter(Boolean);

  const customParts = String(customText || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const merged = [...names];
  for (const part of customParts) {
    const knownId = NAME_TO_ID[part.toLowerCase()];
    if (knownId && selectedIds.includes(knownId)) continue;
    if (!merged.some((n) => n.toLowerCase() === part.toLowerCase())) {
      merged.push(part);
    }
  }

  return merged.join(', ');
}

/** Parse stored string back into catalog IDs + leftover custom text. */
export function parseExerciseDislikes(stored = '') {
  const parts = String(stored || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const selectedIds = [];
  const customParts = [];

  for (const part of parts) {
    const id = NAME_TO_ID[part.toLowerCase()];
    if (id) {
      if (!selectedIds.includes(id)) selectedIds.push(id);
    } else {
      customParts.push(part);
    }
  }

  return {
    selectedIds,
    customText: customParts.join(', '),
  };
}
