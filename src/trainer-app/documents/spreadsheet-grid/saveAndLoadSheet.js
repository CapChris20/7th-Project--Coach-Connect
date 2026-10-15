// Translation layer between how sheets are STORED in Firestore and how the editor works in memory.
// Flow: firestoreToSheets() on load (modern or legacy shape) → sheetsToFirestore() on save (writes both shapes).
// Used by SpreadsheetEditor. The editor wants a sparse { "r,c": cell } map; legacy storage was a dense 2D `rows` array.

import { colLabel, keyOf, newSheet } from './spreadsheetConstants';

// ===== NAMED CONSTANTS =====

const MIN_SAVED_ROW_COUNT = 24;
const MIN_SAVED_COLUMN_COUNT = 8;
const FALLBACK_SHEET_ID_PREFIX = 's';
const LEGACY_SINGLE_SHEET_ID = 's1-main';
const LEGACY_SINGLE_SHEET_NAME = 'Sheet 1';
const FORMAT_TEXT = 'text';
const FORMAT_CURRENCY = 'currency';
const FORMAT_PERCENT = 'percent';
const FORMAT_NUMBER = 'number';
const FORMAT_DATE = 'date';
const LEGACY_DECIMAL2 = 'decimal2';

// Legacy `numberFormat` names → the editor's `format` names. decimal0 and decimal2 both
// collapse to 'number' — the editor tracks decimal places elsewhere (a known one-way narrowing).
const NF_TO_FORMAT = {
  currency: FORMAT_CURRENCY,
  percent: FORMAT_PERCENT,
  decimal0: FORMAT_NUMBER,
  decimal2: FORMAT_NUMBER,
  date: FORMAT_DATE,
};

// Inverse of NF_TO_FORMAT for save. 'number' always writes decimal2 — decimal0 was lost on import.
const FORMAT_TO_LEGACY_NUMBER_FORMAT = {
  [FORMAT_CURRENCY]: FORMAT_CURRENCY,
  [FORMAT_PERCENT]: FORMAT_PERCENT,
  [FORMAT_NUMBER]: LEGACY_DECIMAL2,
  [FORMAT_DATE]: FORMAT_DATE,
};

// ===== HELPER FUNCTIONS =====

/**
 * Builds one editor cell from a legacy raw value + its legacy format entry.
 * Returns null for "nothing here" so the caller keeps storage sparse.
 * @param {*} raw
 * @param {object} [legacyFormat]
 * @returns {object|null}
 */
function legacyFormatToCell(raw, legacyFormat = {}) {
  const value = raw == null ? '' : String(raw);
  if (!value && !legacyFormat) return null;
  const cell = { raw: value };
  if (legacyFormat?.numberFormat) cell.format = NF_TO_FORMAT[legacyFormat.numberFormat] || FORMAT_TEXT;
  if (legacyFormat?.currency) cell.currency = legacyFormat.currency;
  const style = {};
  if (legacyFormat?.bold) style.bold = true;
  if (legacyFormat?.italic) style.italic = true;
  if (legacyFormat?.underline) style.underline = true;
  if (legacyFormat?.strike) style.strike = true;
  if (legacyFormat?.color) style.color = legacyFormat.color;
  if (legacyFormat?.bg) style.fill = legacyFormat.bg;
  if (legacyFormat?.align) style.align = legacyFormat.align;
  if (Object.keys(style).length) cell.style = style;
  if (!cell.raw && !cell.format && !cell.style) return null;
  return cell;
}

/**
 * Inverse of legacyFormatToCell's format/style handling. Keep these two in step.
 * 'number' always writes back as decimal2 — the decimal0/decimal2 distinction was lost on import.
 * @param {object} cell
 * @returns {object}
 */
function cellToLegacyFormat(cell) {
  const legacyFormat = {};
  const numberFormat = FORMAT_TO_LEGACY_NUMBER_FORMAT[cell.format];
  if (numberFormat) legacyFormat.numberFormat = numberFormat;
  if (cell.currency) legacyFormat.currency = cell.currency;
  if (cell.style?.bold) legacyFormat.bold = true;
  if (cell.style?.italic) legacyFormat.italic = true;
  if (cell.style?.underline) legacyFormat.underline = true;
  if (cell.style?.strike) legacyFormat.strike = true;
  if (cell.style?.color) legacyFormat.color = cell.style.color;
  if (cell.style?.fill) legacyFormat.bg = cell.style.fill;
  if (cell.style?.align) legacyFormat.align = cell.style.align;
  return legacyFormat;
}

/**
 * Two addressing schemes meet here: legacy formats are keyed "A1", editor cells are keyed "r,c".
 * @param {object} cells
 * @param {Array} row
 * @param {number} rowIndex
 * @param {number} columnIndex
 * @param {object} legacyFormats
 */
function addLegacyCellAt(cells, row, rowIndex, columnIndex, legacyFormats) {
  const raw = row[columnIndex] ?? '';
  const formatRef = `${colLabel(columnIndex)}${rowIndex + 1}`;
  const cell = legacyFormatToCell(raw, legacyFormats[formatRef]);
  if (cell) cells[keyOf(rowIndex, columnIndex)] = cell;
}

function fillLegacyCells(gridRows, legacyFormats) {
  const cells = {};
  for (let rowIndex = 0; rowIndex < gridRows.length; rowIndex++) {
    const row = gridRows[rowIndex];
    if (!Array.isArray(row)) continue;
    for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
      addLegacyCellAt(cells, row, rowIndex, columnIndex, legacyFormats);
    }
  }
  return cells;
}

function cellHasContent(cell) {
  const raw = cell?.raw ?? '';
  return String(raw).trim() !== '' || cell?.format || (cell?.style && Object.keys(cell.style).length);
}

function usedBounds(cells) {
  let maxRow = -1;
  let maxColumn = -1;
  for (const [cellKey, cell] of Object.entries(cells)) {
    if (!cellHasContent(cell)) continue;
    const [rowIndex, columnIndex] = cellKey.split(',').map(Number);
    maxRow = Math.max(maxRow, rowIndex);
    maxColumn = Math.max(maxColumn, columnIndex);
  }
  return { maxRow, maxColumn };
}

function denseRowsFromCells(cells, rowCount, columnCount) {
  const rows = [];
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const row = new Array(columnCount);
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
      row[columnIndex] = cells[keyOf(rowIndex, columnIndex)]?.raw ?? '';
    }
    rows.push(row);
  }
  return rows;
}

function legacyFormatsFromCells(cells, rowCount, columnCount) {
  const formats = {};
  for (const [cellKey, cell] of Object.entries(cells)) {
    const [rowIndex, columnIndex] = cellKey.split(',').map(Number);
    if (rowIndex >= rowCount || columnIndex >= columnCount) continue;
    const legacyFormat = cellToLegacyFormat(cell);
    if (Object.keys(legacyFormat).length) {
      formats[`${colLabel(columnIndex)}${rowIndex + 1}`] = legacyFormat;
    }
  }
  return formats;
}

function modernSheetSnapshots(sheets) {
  return sheets.map(({ id, name, cells: sheetCells, colWidths, rowHeights }) => ({
    id,
    name,
    cells: sheetCells,
    colWidths,
    rowHeights,
  }));
}

// ===== MAIN FUNCTION =====

/**
 * Load Firestore rows/formats into the sheet-genius sheet model.
 * Fast path: a modern `sheets` array needs no conversion. Legacy path walks the dense 2D array.
 * @param {{ rows?: Array, formats?: object, colWidths?: object, rowHeights?: object, sheets?: Array }} payload
 * @returns {Array}
 */
export function firestoreToSheets({ rows, formats, colWidths, rowHeights, sheets: storedSheets }) {
  if (Array.isArray(storedSheets) && storedSheets.length) {
    return storedSheets.map((storedSheet, index) => ({
      id: storedSheet.id || `${FALLBACK_SHEET_ID_PREFIX}${index + 1}`,
      name: storedSheet.name || `Sheet ${index + 1}`,
      cells: storedSheet.cells || {},
      colWidths: storedSheet.colWidths || {},
      rowHeights: storedSheet.rowHeights || {},
    }));
  }

  const legacyFormats = formats && typeof formats === 'object' ? formats : {};
  const gridRows = Array.isArray(rows) ? rows : [];
  const cells = fillLegacyCells(gridRows, legacyFormats);

  return [{
    id: LEGACY_SINGLE_SHEET_ID,
    name: LEGACY_SINGLE_SHEET_NAME,
    cells,
    colWidths: colWidths && typeof colWidths === 'object' ? colWidths : {},
    rowHeights: rowHeights && typeof rowHeights === 'object' ? rowHeights : {},
  }];
}

/**
 * Serialize sheets back to a Firestore-compatible payload (sparse — only populated bounds).
 * Dual-writes `rows`/`formats` for old readers and `sheets` for this editor.
 * @param {Array} sheets
 * @returns {object}
 */
export function sheetsToFirestore(sheets) {
  const primary = sheets[0] || newSheet(1);
  const cells = primary.cells || {};
  const { maxRow, maxColumn } = usedBounds(cells);

  const rowCount = Math.max(maxRow + 1, MIN_SAVED_ROW_COUNT);
  const columnCount = Math.max(maxColumn + 1, MIN_SAVED_COLUMN_COUNT);

  const rows = denseRowsFromCells(cells, rowCount, columnCount);
  const formats = legacyFormatsFromCells(cells, rowCount, columnCount);
  const sheetSnapshots = modernSheetSnapshots(sheets);

  return {
    rows,
    formats,
    colWidths: primary.colWidths,
    rowHeights: primary.rowHeights,
    columnCount,
    rowCount,
    sheets: sheetSnapshots,
  };
}
