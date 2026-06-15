/**
 * firestoreSanitize
 *
 * Purpose: Strip undefined values from objects before writing to Firestore.
 * Why it matters: Firestore rejects `undefined` anywhere in nested objects/arrays — this
 *   utility prevents silent write failures by recursively removing undefined-valued keys.
 * Area: src/shared/utils
 * Key exports: stripUndefinedForFirestore
 *
 * @file-header
 */

/**
 * Recursively strip `undefined` values from an object (or array) so it is safe to write to Firestore.
 *
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
  const out = {};
  for (const [key, val] of Object.entries(input)) {
    if (val === undefined) continue;
    const next = stripUndefinedForFirestore(val);
    if (next === undefined) continue;
    out[key] = next;
  }
  return out;
}
