// Shared constants + tiny pure helpers for the spreadsheet editor (grid size, A1 labels, keys).
// Flow: every spreadsheet module imports from here so the grid, formulaCalculator engine, and renderer
// all agree on how big the sheet is and how a cell is addressed.
// Why it exists: these values are referenced in layout math AND storage keys — one source only.

// Sheet dimensions and chrome sizing, in "cells" and device-independent pixels.
// Manipulate here:
//   ROWS/COLS grow the sheet (ROWS * COLS is the worst-case cell count — raising these makes
//     scrolling and full-sheet recalculation more expensive).
//   DEFAULT_COL_WIDTH / DEFAULT_ROW_HEIGHT are the starting size of an un-resized cell.
//   HEADER_W / HEADER_H are the row-number gutter and column-letter strip.
//   MAX_COL_WIDTH caps how far a drag-resize can go.
//   TOUCH_MIN is the 44pt minimum tap target from Apple's guidelines — don't lower it or
//     small controls become genuinely hard to hit.
export const ROWS = 200;
export const COLS = 26;
export const DEFAULT_COL_WIDTH = 100;
export const DEFAULT_ROW_HEIGHT = 26;
export const HEADER_W = 46;
export const HEADER_H = 26;
export const MAX_COL_WIDTH = 500;
export const TOUCH_MIN = 44;

// Column index → spreadsheet letter: 0→A, 25→Z, 26→AA, 27→AB.
// It's base-26 built right-to-left, with the twist that there's no "zero digit" in this
// system (A is both the first digit and the value 0), which is why the carry subtracts 1.
// vocab: String.fromCharCode(65) = 'A' — 65 is the character code for capital A
export const colLabel = (c) => {
  let s = '';
  let n = c;
  while (true) {
    // Prepend the letter for the current position, then shift right one "digit".
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
    // n < 0 means we've consumed the last digit. Checking AFTER the shift is what makes
    // single-letter columns (0–25) emit exactly one character.
    if (n < 0) break;
  }
  return s;
};

// The inverse of colLabel: 'A'→0, 'AA'→26. Used when parsing formulaCalculators like "=SUM(A1:B4)".
// Builds up left-to-right (n * 26 + digit), then subtracts 1 to get back to 0-based indexing.
// vocab: charCodeAt(0) - 64 = 'A'→1, 'B'→2 … the 1-based digit value this loop needs
export const labelToCol = (s) => {
  let n = 0;
  for (const ch of s.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
};

// The canonical cell address used as an object/Map key everywhere in the spreadsheet.
// Keep every module going through this helper — if the cellFormatting ever changes, saved sheets
// would silently stop resolving, so there must be exactly one place that decides it.
export const keyOf = (r, c) => `${r},${c}`;

// Factory for a blank tab. Cells/widths/heights start empty because the sheet is stored
// sparsely — only cells the user touched exist, which is what keeps a 200×26 grid cheap.
// vocab: Math.random().toString(36).slice(2, 7) = 5 random base-36 chars (0-9a-z), suffixed to
// the index so two tabs created in the same session can never collide on id.
// Manipulate here: `Sheet ${i}` is the default tab name shown on the tab strip.
export const newSheet = (i) => ({
  id: `s${i}-${Math.random().toString(36).slice(2, 7)}`,
  name: `Sheet ${i}`,
  cells: {},
  colWidths: {},
  rowHeights: {},
});

// Selections are stored as anchor (where the drag started) + focus (where it is now), so
// dragging up/left produces "backwards" coordinates. This flattens that into a plain
// top-left→bottom-right rectangle that loops and range math can trust.
export function normalizeSel(sel) {
  return {
    r1: Math.min(sel.anchor.r, sel.focus.r),
    r2: Math.max(sel.anchor.r, sel.focus.r),
    c1: Math.min(sel.anchor.c, sel.focus.c),
    c2: Math.max(sel.anchor.c, sel.focus.c),
  };
}
