// Estimates how wide and tall spreadsheet cells should be from the text inside them.
// Flow: measure one string → scan the column or row for the largest cell → store only sizes that are not the default.
// Used after typing, pasting, clearing, or double-tapping a header to auto-size.

import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, MAX_COL_WIDTH } from './spreadsheetConstants';

// ===== NAMED CONSTANTS =====

// Manipulate here: average character width. Raise these if auto-fit clips text.
const BOLD_CHAR_WIDTH = 8.5;
const REGULAR_CHAR_WIDTH = 7.5;
// Horizontal padding so the last character does not sit on the gridline.
const COLUMN_PADDING = 24;
const LINE_HEIGHT = 22;
const ROW_VERTICAL_PADDING = 6;

// ===== HELPER FUNCTIONS =====

/**
 * The longest line decides the width. React Native has no canvas to measure real pixels.
 * @param {string} text
 * @returns {string}
 */
function longestLine(text) {
  const lines = String(text || '').split('\n');
  let longest = '';
  for (const line of lines) {
    if (line.length > longest.length) longest = line;
  }
  return longest;
}

/**
 * @param {string} cellKey
 * @returns {{ rowIndex: number, columnIndex: number }}
 */
function rowAndColumnFromKey(cellKey) {
  const [rowText, columnText] = cellKey.split(',');
  return {
    rowIndex: Number(rowText),
    columnIndex: Number(columnText),
  };
}

/**
 * @param {object|null} draft
 * @param {number} rowIndex
 * @param {number} columnIndex
 * @returns {boolean}
 */
function isDraftForCell(draft, rowIndex, columnIndex) {
  return draft?.r === rowIndex && draft?.c === columnIndex;
}

// ===== MAIN FUNCTION =====

/**
 * Approximate text width. Bold glyphs are a little wider.
 * @param {string} text
 * @param {boolean} [isBold]
 * @returns {number}
 */
export function columnWidths(text, isBold = false) {
  const longest = longestLine(text);
  const characterWidth = isBold ? BOLD_CHAR_WIDTH : REGULAR_CHAR_WIDTH;
  return Math.ceil(longest.length * characterWidth) + COLUMN_PADDING;
}

/**
 * Row height follows line count. Cells do not wrap; they grow when the text has newlines.
 * @param {string} text
 * @returns {number}
 */
export function measureRowHeight(text) {
  const lineCount = String(text || '').split('\n').length;
  return Math.max(DEFAULT_ROW_HEIGHT, lineCount * LINE_HEIGHT + ROW_VERTICAL_PADDING);
}

/**
 * Widest content in this column, including the live draft if that draft is in this column.
 * @param {number} columnIndex
 * @param {object} cells
 * @param {{ r: number, c: number, text: string, bold?: boolean }|null} [draft]
 * @returns {number}
 */
export function calcColWidth(columnIndex, cells, draft = null) {
  let maxWidth = DEFAULT_COL_WIDTH;
  if (draft?.c === columnIndex) {
    maxWidth = Math.max(maxWidth, columnWidths(draft.text ?? '', draft.bold));
  }

  for (const [cellKey, cell] of Object.entries(cells || {})) {
    const { rowIndex, columnIndex: storedColumn } = rowAndColumnFromKey(cellKey);
    if (storedColumn !== columnIndex) continue;
    if (isDraftForCell(draft, rowIndex, columnIndex)) continue;
    const rawText = cell?.raw ?? '';
    if (!rawText) continue;
    maxWidth = Math.max(maxWidth, columnWidths(rawText, cell?.style?.bold));
  }

  return Math.min(Math.max(maxWidth, DEFAULT_COL_WIDTH), MAX_COL_WIDTH);
}

/**
 * Tallest content in this row, including the live draft if that draft is in this row.
 * @param {number} rowIndex
 * @param {object} cells
 * @param {{ r: number, c: number, text: string }|null} [draft]
 * @returns {number}
 */
export function calcRowHeight(rowIndex, cells, draft = null) {
  let maxHeight = DEFAULT_ROW_HEIGHT;
  if (draft?.r === rowIndex) {
    maxHeight = Math.max(maxHeight, measureRowHeight(draft.text ?? ''));
  }

  for (const [cellKey, cell] of Object.entries(cells || {})) {
    const { rowIndex: storedRow, columnIndex: storedColumn } = rowAndColumnFromKey(cellKey);
    if (storedRow !== rowIndex) continue;
    if (isDraftForCell(draft, rowIndex, storedColumn)) continue;
    const rawText = cell?.raw ?? '';
    if (!rawText) continue;
    maxHeight = Math.max(maxHeight, measureRowHeight(rawText));
  }

  return maxHeight;
}

/**
 * Only non-default widths are stored, so a reset is simply a missing key.
 * @param {object} colWidths
 * @param {number} columnIndex
 * @param {object} cells
 * @param {object|null} [draft]
 * @returns {object}
 */
export function setColWidth(colWidths, columnIndex, cells, draft = null) {
  const nextWidth = calcColWidth(columnIndex, cells, draft);
  const nextWidths = { ...colWidths };
  if (nextWidth <= DEFAULT_COL_WIDTH) delete nextWidths[columnIndex];
  else nextWidths[columnIndex] = nextWidth;
  return nextWidths;
}

/**
 * @param {object} rowHeights
 * @param {number} rowIndex
 * @param {object} cells
 * @param {object|null} [draft]
 * @returns {object}
 */
export function setRowHeight(rowHeights, rowIndex, cells, draft = null) {
  const nextHeight = calcRowHeight(rowIndex, cells, draft);
  const nextHeights = { ...rowHeights };
  if (nextHeight <= DEFAULT_ROW_HEIGHT) delete nextHeights[rowIndex];
  else nextHeights[rowIndex] = nextHeight;
  return nextHeights;
}

/**
 * One edited cell can only change its column and its row.
 * @param {object} cells
 * @param {number} rowIndex
 * @param {number} columnIndex
 * @param {object} colWidths
 * @param {object} rowHeights
 * @param {object|null} [draft]
 * @returns {{ colWidths: object, rowHeights: object }}
 */
export function syncCellDims(cells, rowIndex, columnIndex, colWidths, rowHeights, draft = null) {
  return {
    colWidths: setColWidth(colWidths, columnIndex, cells, draft),
    rowHeights: setRowHeight(rowHeights, rowIndex, cells, draft),
  };
}

/**
 * After a paste or a clear, re-measure every column and row the change touched.
 * @param {object} cells
 * @param {object} colWidths
 * @param {object} rowHeights
 * @param {number} firstRow
 * @param {number} lastRow
 * @param {number} firstColumn
 * @param {number} lastColumn
 * @returns {{ colWidths: object, rowHeights: object }}
 */
export function syncDimsForRange(cells, colWidths, rowHeights, firstRow, lastRow, firstColumn, lastColumn) {
  let nextColWidths = { ...colWidths };
  let nextRowHeights = { ...rowHeights };
  for (let columnIndex = firstColumn; columnIndex <= lastColumn; columnIndex += 1) {
    nextColWidths = setColWidth(nextColWidths, columnIndex, cells);
  }
  for (let rowIndex = firstRow; rowIndex <= lastRow; rowIndex += 1) {
    nextRowHeights = setRowHeight(nextRowHeights, rowIndex, cells);
  }
  return { colWidths: nextColWidths, rowHeights: nextRowHeights };
}
