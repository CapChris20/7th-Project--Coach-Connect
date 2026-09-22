// Auto-fit sizing for spreadsheet columns and rows, using estimated (not measured) text size.
// Flow: measureText/measureRowHeight estimate one string → calcColWidth/calcRowHeight scan a
// column/row for its widest/tallest cell → setColWidth/setRowHeight store the result sparsely.
// Used after typing, pasting, clearing, or double-tapping a header to auto-size.
import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, MAX_COL_WIDTH } from './types';

/** Approximate text width for auto-sizing columns (RN has no canvas measureText). */
// Why an estimate: on the web you'd ask a canvas for the real pixel width of a string, but React
// Native has no synchronous text measurement. So we multiply character count by an average glyph
// width. It's wrong for very narrow ('i') or wide ('W') text, but it's instant and good enough.
export function measureText(text, bold = false) {
  // Multi-line cells: only the LONGEST line decides the column width, so fold the lines down to
  // that one. reduce keeps whichever string is longer as it walks the array.
  const longest = String(text || '')
    .split('\n')
    .reduce((a, b) => (a.length > b.length ? a : b), '');
  // Manipulate here: average character width in points. Bold is wider, hence the larger number.
  // If auto-fit consistently clips text, raise these; if columns come out too roomy, lower them.
  const charW = bold ? 8.5 : 7.5;
  // Manipulate here: +24 is the horizontal padding budget (cell padding on both sides plus a
  // little slack so the last character never touches the gridline).
  return Math.ceil(longest.length * charW) + 24;
}

// Row height is driven purely by line COUNT — no wrapping estimate, because cells don't soft-wrap;
// they only grow when the content contains explicit newlines.
export function measureRowHeight(text) {
  const lines = String(text || '').split('\n').length;
  // Manipulate here: 22 is per-line height and +6 is vertical padding. Math.max keeps a row from
  // ever shrinking below the standard row height.
  return Math.max(DEFAULT_ROW_HEIGHT, lines * 22 + 6);
}

/**
 * Widest content in column c across all cells.
 * @param {{ r: number, c: number, text: string, bold?: boolean } | null} draft - live edit overlay
 */
export function calcColWidth(c, cells, draft = null) {
  // Start at the default so auto-fit can only ever WIDEN a column past standard, never below it.
  let maxW = DEFAULT_COL_WIDTH;

  // `draft` is the text currently being typed, which isn't committed into `cells` yet. Measuring
  // it here is what makes the column grow live as you type instead of only after you hit enter.
  if (draft?.c === c) {
    // vocab/symbol: ?? '' = use '' only if draft.text is null/undefined (an empty string is kept)
    maxW = Math.max(maxW, measureText(draft.text ?? '', draft.bold));
  }

  // Scan every stored cell and keep only the ones in this column. We iterate all cells rather than
  // indexing by column because storage is a flat "r,c" map — but it's sparse, so this only visits
  // cells the user actually filled in.
  for (const [k, cell] of Object.entries(cells || {})) {
    const [r, col] = k.split(',').map(Number);
    if (col !== c) continue;
    // Skip the committed value of the cell being edited — the draft above is the newer truth, and
    // counting both would size the column to whichever happened to be longer.
    if (draft?.r === r && draft?.c === c) continue;
    const raw = cell?.raw ?? '';
    if (!raw) continue;
    maxW = Math.max(maxW, measureText(raw, cell?.style?.bold));
  }

  // Clamp into [DEFAULT, MAX]. The upper bound matters: one cell with a paragraph in it would
  // otherwise make a single column wider than the screen.
  return Math.min(Math.max(maxW, DEFAULT_COL_WIDTH), MAX_COL_WIDTH);
}

/**
 * Tallest content in row r across all cells.
 * @param {{ r: number, c: number, text: string } | null} draft - live edit overlay
 */
export function calcRowHeight(r, cells, draft = null) {
  let maxH = DEFAULT_ROW_HEIGHT;

  // Same live-draft logic as calcColWidth, so a row grows as you add newlines mid-edit.
  if (draft?.r === r) {
    maxH = Math.max(maxH, measureRowHeight(draft.text ?? ''));
  }

  for (const [k, cell] of Object.entries(cells || {})) {
    const [row] = k.split(',').map(Number);
    if (row !== r) continue;
    // Skip the edited cell's committed value in favor of the draft. The column index is re-parsed
    // from the key here (rather than destructured above) since only the row was needed for filtering.
    if (draft?.r === r && draft?.c === parseInt(k.split(',')[1], 10)) continue;
    const raw = cell?.raw ?? '';
    if (!raw) continue;
    maxH = Math.max(maxH, measureRowHeight(raw));
  }

  // No upper clamp here (unlike width) — a tall row is scrollable, whereas a too-wide column
  // breaks the horizontal layout.
  return maxH;
}

// Writes a computed width into the widths map. The delete is the important part: only
// non-default widths are stored, so a sheet's saved data stays small and "reset to default"
// is simply the absence of a key.
// vocab/symbol: { ...colWidths } = shallow copy, so we return a NEW object instead of mutating
// state in place (React needs a new reference to notice the change).
export function setColWidth(colWidths, c, cells, draft = null) {
  const w = calcColWidth(c, cells, draft);
  const next = { ...colWidths };
  if (w <= DEFAULT_COL_WIDTH) delete next[c];
  else next[c] = w;
  return next;
}

// Row-height twin of setColWidth, with the same "don't store defaults" rule.
export function setRowHeight(rowHeights, r, cells, draft = null) {
  const h = calcRowHeight(r, cells, draft);
  const next = { ...rowHeights };
  if (h <= DEFAULT_ROW_HEIGHT) delete next[r];
  else next[r] = h;
  return next;
}

/** Recalc column + row size for one cell (optionally using in-progress draft text). */
// The common case: the user edited one cell, so exactly one column and one row can have changed.
export function syncCellDims(cells, r, c, colWidths, rowHeights, draft = null) {
  return {
    colWidths: setColWidth(colWidths, c, cells, draft),
    rowHeights: setRowHeight(rowHeights, r, cells, draft),
  };
}

/** Recalc after bulk changes (clear, paste, etc.). */
// Re-measures every column and row the operation touched. The accumulators are reassigned each
// pass because setColWidth/setRowHeight return new objects rather than mutating — so `cw` and `rh`
// carry the running result through the loops.
// Note: no `draft` here, since a bulk change means editing has already been committed.
export function syncDimsForRange(cells, colWidths, rowHeights, r1, r2, c1, c2) {
  let cw = { ...colWidths };
  let rh = { ...rowHeights };
  for (let c = c1; c <= c2; c++) cw = setColWidth(cw, c, cells);
  for (let r = r1; r <= r2; r++) rh = setRowHeight(rh, r, cells);
  return { colWidths: cw, rowHeights: rh };
}
