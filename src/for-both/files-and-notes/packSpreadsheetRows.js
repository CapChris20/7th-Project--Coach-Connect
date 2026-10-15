// Turns spreadsheet rows into a shape Firestore will store, and back.
// Flow: Firestore cannot store a nested array, so each row becomes { cells: [...] }.
// Used by: the spreadsheet note saver.

// ===== NAMED CONSTANTS =====

// ===== HELPER FUNCTIONS =====

/**
 * @param {unknown} cell
 * @returns {string}
 */
function cellToStoredText(cell) {
  if (cell == null) return '';
  return String(cell);
}

/**
 * @param {unknown} row
 * @returns {boolean}
 */
function isRowObjectWithCells(row) {
  return typeof row === 'object' && row !== null && !Array.isArray(row) && Array.isArray(row.cells);
}

/**
 * @param {unknown[]} cells
 * @returns {string[]}
 */
function cellsToTextList(cells) {
  return cells.map((cell) => cellToStoredText(cell));
}

function rowsFromCellObjects(stored) {
  return stored.map((row) => (Array.isArray(row?.cells) ? cellsToTextList(row.cells) : []));
}

function rowsFromNestedArrays(stored) {
  return stored.map((row) => (Array.isArray(row) ? cellsToTextList(row) : []));
}

function packedRowFromUnknown(row) {
  if (Array.isArray(row)) return { cells: cellsToTextList(row) };
  if (Array.isArray(row?.cells)) return { cells: cellsToTextList(row.cells) };
  return { cells: [] };
}

function packedRowsFromUnknownList(rows) {
  return rows.map(packedRowFromUnknown);
}

function cellHasVisibleText(cell) {
  return String(cell ?? '').trim() !== '';
}

function rowHasVisibleText(row) {
  return Array.isArray(row) && row.some(cellHasVisibleText);
}

// ===== MAIN FUNCTION =====

/**
 * Turn a stored spreadsheet back into a 2D list of cell strings.
 * @param {unknown} stored
 * @returns {string[][]}
 */
export function deserializeSpreadsheetRows(stored) {
  // 1. Empty or not a list → no rows.
  if (!Array.isArray(stored) || !stored.length) return [];

  // 2. Packed shape { cells: [...] } is what we write today.
  if (isRowObjectWithCells(stored[0])) {
    return rowsFromCellObjects(stored);
  }

  // 3. Older docs stored a nested array. Accept that too.
  if (Array.isArray(stored[0])) {
    return rowsFromNestedArrays(stored);
  }
  return [];
}

/**
 * Pack each row as { cells } so Firestore will accept it.
 * @param {unknown} rows
 * @returns {Array<{ cells: string[] }>}
 */
export function serializeSpreadsheetRows(rows) {
  // 1. Need a list. Anything else becomes no rows.
  if (!Array.isArray(rows)) return [];

  // 2. Each row is already an array, or already { cells }.
  return packedRowsFromUnknownList(rows);
}

/**
 * True when at least one cell has visible text.
 * @param {unknown} rows
 * @returns {boolean}
 */
export function packSpreadsheetRowsHaveContent(rows) {
  // 1. Need a list with at least one non-blank cell.
  if (!Array.isArray(rows)) return false;
  return rows.some(rowHasVisibleText);
}
