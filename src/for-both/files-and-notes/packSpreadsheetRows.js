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

// ===== MAIN FUNCTION =====

/**
 * @param {unknown} stored
 * @returns {string[][]}
 */
export function deserializeSpreadsheetRows(stored) {
  if (!Array.isArray(stored) || !stored.length) return [];
  if (isRowObjectWithCells(stored[0])) {
    return stored.map((row) => (Array.isArray(row?.cells) ? cellsToTextList(row.cells) : []));
  }
  if (Array.isArray(stored[0])) {
    return stored.map((row) => (Array.isArray(row) ? cellsToTextList(row) : []));
  }
  return [];
}

/**
 * @param {unknown} rows
 * @returns {Array<{ cells: string[] }>}
 */
export function serializeSpreadsheetRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    if (Array.isArray(row)) return { cells: cellsToTextList(row) };
    if (Array.isArray(row?.cells)) return { cells: cellsToTextList(row.cells) };
    return { cells: [] };
  });
}

/**
 * @param {unknown} rows
 * @returns {boolean}
 */
export function packSpreadsheetRowsHaveContent(rows) {
  if (!Array.isArray(rows)) return false;
  return rows.some(
    (row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== ''),
  );
}
