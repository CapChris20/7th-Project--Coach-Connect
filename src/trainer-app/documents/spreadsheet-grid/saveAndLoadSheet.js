// Translation layer between how sheets are STORED in Firestore and how the editor works in memory.
// Flow: firestoreToSheets() on load (handles both the modern and the legacy shapes),
// sheetsToFirestore() on save (writes both shapes so older clients can still read the doc).
// Why it exists: the editor wants a sparse { "r,c": cell } map, but the original storage cellFormatting was
// a dense 2D `rows` array plus a separate `cellFormattings` map keyed by "A1". This file bridges the two.
import { colLabel, keyOf, newSheet } from './spreadsheetConstants';

// Legacy `numberFormat` names → the editor's `cellFormatting` names. Note decimal0 and decimal2 both
// collapse to 'number' — the editor tracks decimal places elsewhere, so that detail is lost on
// import (a known, accepted one-way narrowing).
const NF_TO_FORMAT = {
  currency: 'currency',
  percent: 'percent',
  decimal0: 'number',
  decimal2: 'number',
  date: 'date',
};

// Builds one editor cell from a legacy raw value + its legacy cellFormatting entry.
// Returns null for "nothing here", which is how the caller keeps storage sparse — a null result
// simply never gets added to the cells map.
function legacyFormatToCell(raw, fmt = {}) {
  const value = raw == null ? '' : String(raw);
  if (!value && !fmt) return null;
  const cell = { raw: value };
  // Unknown legacy cellFormatting names degrade to 'text' rather than being dropped, so a future cellFormatting we
  // don't recognize still renders as plain content instead of vanishing.
  if (fmt?.numberFormat) cell.cellFormatting = NF_TO_FORMAT[fmt.numberFormat] || 'text';
  if (fmt?.currency) cell.currency = fmt.currency;
  // Style is built up conditionally so absent properties stay absent — an object full of
  // `undefined` would bloat every cell in Firestore.
  const style = {};
  if (fmt?.bold) style.bold = true;
  if (fmt?.italic) style.italic = true;
  if (fmt?.underline) style.underline = true;
  if (fmt?.strike) style.strike = true;
  if (fmt?.color) style.color = fmt.color;
  // Note the rename: legacy `bg` is the editor's `style.fill`.
  if (fmt?.bg) style.fill = fmt.bg;
  if (fmt?.align) style.align = fmt.align;
  // Only attach `style` if something actually landed in it.
  if (Object.keys(style).length) cell.style = style;
  // Final emptiness check: a cell with no text, no cellFormatting, and no style is genuinely blank.
  if (!cell.raw && !cell.cellFormatting && !cell.style) return null;
  return cell;
}

// The exact inverse of legacyFormatToCell's cellFormatting/style handling, used on save.
// Keep these two functions in step — if you add a style property to one, add it to the other or it
// silently won't survive a save/load round trip.
function cellToLegacyFormat(cell) {
  const fmt = {};
  // 'number' always writes back as decimal2, since the legacy decimal0/decimal2 distinction was
  // already lost on import. That's the lossy half of the round trip.
  if (cell.cellFormatting === 'currency') fmt.numberFormat = 'currency';
  else if (cell.cellFormatting === 'percent') fmt.numberFormat = 'percent';
  else if (cell.cellFormatting === 'number') fmt.numberFormat = 'decimal2';
  else if (cell.cellFormatting === 'date') fmt.numberFormat = 'date';
  if (cell.currency) fmt.currency = cell.currency;
  if (cell.style?.bold) fmt.bold = true;
  if (cell.style?.italic) fmt.italic = true;
  if (cell.style?.underline) fmt.underline = true;
  if (cell.style?.strike) fmt.strike = true;
  if (cell.style?.color) fmt.color = cell.style.color;
  if (cell.style?.fill) fmt.bg = cell.style.fill;
  if (cell.style?.align) fmt.align = cell.style.align;
  return fmt;
}

/** Load Firestore rows/cellFormattings into sheet-genius sheet model. */
export function firestoreToSheets({ rows, cellFormattings, colWidths, rowHeights, sheets: storedSheets }) {
  // FAST PATH — the modern cellFormatting. If the doc already has a `sheets` array, it was written by this
  // editor and needs no conversion, just defaults for any missing sub-objects. Checked first so
  // multi-tab documents skip the legacy conversion entirely.
  if (Array.isArray(storedSheets) && storedSheets.length) {
    return storedSheets.map((s, i) => ({
      // Manipulate here: the fallback id/name pattern for a tab saved without them.
      id: s.id || `s${i + 1}`,
      name: s.name || `Sheet ${i + 1}`,
      cells: s.cells || {},
      colWidths: s.colWidths || {},
      rowHeights: s.rowHeights || {},
    }));
  }

  // LEGACY PATH — walk the dense 2D array and convert it into the sparse cells map.
  const cells = {};
  const legacyFormats = cellFormattings && typeof cellFormattings === 'object' ? cellFormattings : {};
  const gridRows = Array.isArray(rows) ? rows : [];

  for (let r = 0; r < gridRows.length; r++) {
    const row = gridRows[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c++) {
      const raw = row[c] ?? '';
      // Two different addressing schemes meet here: legacy cellFormattings are keyed "A1" (letter +
      // 1-based row), while the editor's cells map is keyed "r,c" (both 0-based). Hence colLabel
      // and r + 1 to look up the cellFormatting, and keyOf to store the result.
      const ref = `${colLabel(c)}${r + 1}`;
      const cell = legacyFormatToCell(raw, legacyFormats[ref]);
      if (cell) cells[keyOf(r, c)] = cell;
    }
  }

  // Legacy documents were always single-tab, so they become exactly one sheet.
  return [{
    id: 's1-main',
    name: 'Sheet 1',
    cells,
    colWidths: colWidths && typeof colWidths === 'object' ? colWidths : {},
    rowHeights: rowHeights && typeof rowHeights === 'object' ? rowHeights : {},
  }];
}

/** Serialize sheets back to Firestore-compatible payload (sparse — only populated bounds). */
export function sheetsToFirestore(sheets) {
  // The legacy half of the payload can only represent ONE sheet, so it mirrors the first tab.
  // Additional tabs survive solely in the modern `sheets` array at the bottom.
  const primary = sheets[0] || newSheet(1);
  const cells = primary.cells || {};

  // Find the used bounds so we don't serialize a 200×26 array of empty strings. Start at -1 so an
  // entirely empty sheet yields a count of 0 before the minimums below apply.
  let maxR = -1;
  let maxC = -1;
  for (const [k, cell] of Object.entries(cells)) {
    const raw = cell?.raw ?? '';
    // "Has content" deliberately includes cellFormattingting: a cell that's only highlighted yellow with no
    // text is still meaningful and must be inside the saved bounds.
    const hasContent =
      String(raw).trim() !== '' || cell?.cellFormatting || (cell?.style && Object.keys(cell.style).length);
    if (!hasContent) continue;
    const [r, c] = k.split(',').map(Number);
    maxR = Math.max(maxR, r);
    maxC = Math.max(maxC, c);
  }

  // Manipulate here: 24 rows × 8 columns is the minimum saved grid. It exists so an older client
  // opening this doc still sees a usable, editable grid rather than a single cell.
  const rCount = Math.max(maxR + 1, 24);
  const cCount = Math.max(maxC + 1, 8);

  // Rebuild the dense 2D array the legacy readers expect, filling gaps with ''.
  const rows = [];
  for (let r = 0; r < rCount; r++) {
    const row = new Array(cCount);
    for (let c = 0; c < cCount; c++) {
      row[c] = cells[keyOf(r, c)]?.raw ?? '';
    }
    rows.push(row);
  }

  // The legacy cellFormattings map, keyed "A1". Cells outside the bounds are skipped so cellFormattings can't
  // reference a cell that doesn't exist in `rows`.
  const cellFormattings = {};
  for (const [k, cell] of Object.entries(cells)) {
    const [r, c] = k.split(',').map(Number);
    if (r >= rCount || c >= cCount) continue;
    const fmt = cellToLegacyFormat(cell);
    // Only store cells that actually have cellFormattingting — same sparseness rule as everywhere else.
    if (Object.keys(fmt).length) cellFormattings[`${colLabel(c)}${r + 1}`] = fmt;
  }

  // The modern cellFormatting: every tab, verbatim. Destructured and rebuilt (rather than spread) so ONLY
  // these five fields are persisted — any transient UI state hanging off a sheet object is dropped.
  const sheetSnapshots = sheets.map(({ id, name, cells: sheetCells, colWidths: cw, rowHeights: rh }) => ({
    id,
    name,
    cells: sheetCells,
    colWidths: cw,
    rowHeights: rh,
  }));

  // Both shapes go out in one payload: `rows`/`cellFormattings`/counts for old readers, `sheets` for this
  // editor. That dual write is what makes the cellFormatting change backwards compatible.
  return {
    rows,
    cellFormattings,
    colWidths: primary.colWidths,
    rowHeights: primary.rowHeights,
    columnCount: cCount,
    rowCount: rCount,
    sheets: sheetSnapshots,
  };
}
