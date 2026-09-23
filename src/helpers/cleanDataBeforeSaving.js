// Deep-cleans an object so Firestore will accept it.
// Flow: walk the whole value tree → drop any key whose value is `undefined` (at any depth) → return a fresh copy.
// Call this on every payload built from optional/user fields; Firestore throws on `undefined`,
// and the error points at the write call rather than the field that was actually missing.

/**
 * Recursively strip `undefined` values from an object (or array) so it is safe to write to Firestore.
 *
 * @template T
 * @param {T} input
 * @returns {T}
 */
export function stripUndefinedForFirestore(input) {
  // Signal "nothing here" upward so the caller (array filter / object loop) can drop this slot.
  if (input === undefined) return undefined;
  // `null` is explicitly kept: Firestore accepts null, and it means "field cleared on purpose",
  // which is different from undefined's "field never set". Primitives pass straight through.
  if (input === null || typeof input !== 'object') return input;
  // Arrays get cleaned element-by-element, then compacted. The filter is the important half —
  // leaving a hole would shift into a `null`, quietly changing the stored data.
  if (Array.isArray(input)) {
    return input
      .map((item) => stripUndefinedForFirestore(item))
      .filter((item) => item !== undefined);
  }
  // Plain objects: rebuild into a NEW object rather than deleting keys in place, so the
  // caller's original payload is never mutated.
  const out = {};
  // vocab: Object.entries = turn { a: 1 } into [['a', 1]] so it can be looped
  for (const [key, val] of Object.entries(input)) {
    if (val === undefined) continue;
    // Second check is for nested values that *became* undefined during the recursive clean.
    const next = stripUndefinedForFirestore(val);
    if (next === undefined) continue;
    out[key] = next;
  }
  return out;
}
