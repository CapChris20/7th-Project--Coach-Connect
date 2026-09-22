// Turns the sheet's stored cell data into ready-to-render display strings, once per change.
// Flow: cells object → for each populated cell decide checkbox / formula / plain value →
// Map keyed by "row,col" → the grid reads from it with lookupDisplay() while scrolling.
// Why it exists: the grid re-renders constantly; doing formula math inside render would
// re-evaluate the whole 200×26 sheet every frame. This caches that work up front.
import { evaluateCell } from './formula';
import { formatValue } from './format';
import { keyOf } from './types';

// One shared object for "nothing here" so empty cells don't allocate a new object per lookup.
const EMPTY = { text: '', rawValue: null };

/** Precompute display strings only for populated cells (avoids 5200 formula evals per frame). */
export function buildDisplayCache(cells) {
  // vocab: Map = key→value store with fast lookups; we key by "r,c" strings (see keyOf)
  const cache = new Map();
  if (!cells) return cache;

  // Only iterate keys that actually exist in storage. Blank cells are absent from `cells`
  // entirely, which is exactly why this loop is cheap compared to walking every grid slot.
  // vocab: Object.entries = turn { "0,0": cell } into [["0,0", cell], …] so we get key + value
  for (const [k, cell] of Object.entries(cells)) {
    if (!cell) continue;

    // Checkbox cells: the stored raw value can be a real boolean, the string "true", or "1"
    // depending on how it was written. Normalize all of those to one boolean, then render a
    // glyph instead of text.
    // Manipulate here: '☑' / '☐' are the checked/unchecked characters shown in the grid.
    if (cell.format === 'checkbox') {
      const v = String(cell.raw).toLowerCase() === 'true' || cell.raw === '1';
      cache.set(k, { text: v ? '☑' : '☐', rawValue: v });
      continue;
    }

    // Formula cells: a leading '=' is the spreadsheet convention for "compute me".
    // The `new Set()` is the cycle guard — evaluateCell adds each visited cell to it so
    // A1 = B1 = A1 is caught as a circular reference instead of recursing forever.
    if (String(cell.raw).startsWith('=')) {
      const res = evaluateCell(cell.raw, cells, new Set(), k);
      // Manipulate here: '#ERR' is the text shown in-cell for a bad formula. We keep the real
      // error alongside it so the UI can surface details (tooltip / formula bar) if wanted.
      if (res.error) cache.set(k, { text: '#ERR', error: res.error, rawValue: null });
      else cache.set(k, { text: formatValue(res.value, cell), rawValue: res.value });
      continue;
    }

    // Plain value cells. We try to coerce to a number so downstream math (SUM, sorting) sees
    // numbers instead of strings — but only when it really is numeric. Empty string and
    // non-numeric text stay as-is so "N/A" doesn't silently become NaN.
    // vocab: Number.isNaN = "is this the not-a-number value" (safer than the global isNaN)
    const n = Number(cell.raw);
    const rawValue = cell.raw !== '' && !Number.isNaN(n) ? n : cell.raw;
    // Note the asymmetry: `text` formats the ORIGINAL raw (so formatting rules see what the
    // user typed), while `rawValue` carries the coerced value for calculations.
    cache.set(k, { text: formatValue(cell.raw, cell), rawValue });
  }

  return cache;
}

// Grid cells call this on every render, so it stays a single Map hit plus a fallback.
// vocab/symbol: ?? EMPTY = if this cell isn't in the cache, hand back the shared blank object
export function lookupDisplay(cache, r, c) {
  return cache.get(keyOf(r, c)) ?? EMPTY;
}
