// Drops undefined fields so a Firestore write does not throw.
// Flow: walk arrays and objects → skip undefined → return a new copy. Null stays, because null means the field was cleared on purpose.
// Used by: every save built from optional form fields.

// ===== NAMED CONSTANTS =====

// ===== HELPER FUNCTIONS =====

/**
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

// ===== MAIN FUNCTION =====

/**
 * @template T
 * @param {T} input
 * @returns {T}
 */
export function stripUndefinedForFirestore(input) {
  if (input === undefined) return undefined;
  if (input === null || typeof input !== 'object') return input;
  if (Array.isArray(input)) {
    return input
      .map((item) => stripUndefinedForFirestore(item))
      .filter((item) => item !== undefined);
  }
  return stripUndefinedFromObject(input);
}
