// Drops undefined fields so a Firestore write does not throw.
// Flow: classify the value → walk arrays and plain objects → skip undefined → return a fresh copy.
// Null stays, because null means the field was cleared on purpose.
// Used by: every save built from optional form fields.

// ===== NAMED CONSTANTS =====

// (no tweakable knobs — this file only removes undefined)

// ===== MAIN FUNCTION =====

/**
 * Recursively remove undefined so Firestore accepts the payload.
 * @template T
 * @param {T} input
 * @returns {T}
 */
export function stripUndefinedForFirestore(input) {
  // 1. Root undefined stays undefined — callers may be pruning one branch.
  if (input === undefined) return undefined;

  // 2. Null is intentional “cleared” and must survive the walk.
  if (input === null) return null;

  // 3. Pick the shape so we know which copy path to take.
  const valueShape = classifyValueShape(input);

  // 4. Arrays get a new list with undefined slots removed at every level.
  if (valueShape === 'array') {
    return copyArrayWithoutUndefined(input);
  }

  // 5. Plain objects get a new object with each property cleaned recursively.
  if (valueShape === 'plainObject') {
    return copyObjectWithoutUndefined(input);
  }

  // 6. Numbers, strings, Dates, FieldValues, and other Firestore types pass through.
  return input;
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging =====

/**
 * Decide how to walk this value. Anything that is not array/plainObject is a leaf.
 * @param {*} input
 * @returns {'array'|'plainObject'|'leaf'}
 */
function classifyValueShape(input) {
  if (Array.isArray(input)) return 'array';
  if (looksLikePlainObject(input)) return 'plainObject';
  return 'leaf';
}

/**
 * True for `{ ... }` only — not null, arrays, Date, or other special objects we should leave alone.
 * @param {*} input
 * @returns {boolean}
 */
function looksLikePlainObject(input) {
  if (input === null) return false;
  if (typeof input !== 'object') return false;
  if (Array.isArray(input)) return false;
  return true;
}

/**
 * Copy one plain object, dropping undefined at this level and below.
 * @param {object} input
 * @returns {object}
 */
function copyObjectWithoutUndefined(input) {
  const cleanedObject = {};
  // vocab: Object.entries turns { a: 1 } into [['a', 1]] so we can walk each field.
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
function copyArrayWithoutUndefined(items) {
  const cleanedItems = [];
  for (const item of items) {
    const cleanedItem = stripUndefinedForFirestore(item);
    if (cleanedItem === undefined) continue;
    cleanedItems.push(cleanedItem);
  }
  return cleanedItems;
}
