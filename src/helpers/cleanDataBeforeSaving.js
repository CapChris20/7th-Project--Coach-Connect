// Drops undefined fields so a Firestore write does not throw.
// Flow: walk arrays and objects → skip undefined → return a new copy.
// Null stays, because null means the field was cleared on purpose.
// Used by: every save built from optional form fields.

// ===== NAMED CONSTANTS =====

// (no tweakable knobs — this file only removes undefined)

// ===== HELPER FUNCTIONS =====

/**
 * Copy one plain object, dropping undefined at this level and below.
 * @param {object} input
 * @returns {object}
 */
function stripUndefinedFromObject(input) {
  const cleanedObject = {};
  // vocab: Object.entries turns { a: 1 } into [['a', 1]].
  for (const [fieldName, fieldValue] of Object.entries(input)) {
    if (fieldValue === undefined) continue;
    const cleanedValue = stripUndefinedForFirestore(fieldValue);
    if (cleanedValue === undefined) continue;
    cleanedObject[fieldName] = cleanedValue;
  }
  return cleanedObject;
}

/**
 * Copy one array, dropping undefined slots after nested cleanup.
 * @param {Array} items
 * @returns {Array}
 */
function stripUndefinedFromArray(items) {
  const cleanedItems = [];
  for (const item of items) {
    const cleanedItem = stripUndefinedForFirestore(item);
    if (cleanedItem === undefined) continue;
    cleanedItems.push(cleanedItem);
  }
  return cleanedItems;
}

function isPlainObject(input) {
  if (input === null) return false;
  if (typeof input !== 'object') return false;
  if (Array.isArray(input)) return false;
  return true;
}

// ===== MAIN FUNCTION =====

/**
 * Recursively remove undefined so Firestore accepts the payload.
 * @template T
 * @param {T} input
 * @returns {T}
 */
export function stripUndefinedForFirestore(input) {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (Array.isArray(input)) return stripUndefinedFromArray(input);
  if (isPlainObject(input)) return stripUndefinedFromObject(input);
  return input;
}
