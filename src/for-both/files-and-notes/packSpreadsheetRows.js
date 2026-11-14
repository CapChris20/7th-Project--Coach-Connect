// Turns spreadsheet rows into a shape Firestore will store, and back.
// Flow: Firestore cannot store a nested array, so each row becomes { cells: [...] }.
// Used by the spreadsheet note saver.

// ===== NAMED CONSTANTS =====

// No tweakable numbers here — this file only reshapes row data for Firestore.

// ===== MAIN FUNCTION =====

/**
 * Turn a stored spreadsheet back into a 2D list of cell strings.
 * @param {unknown} stored
 * @returns {string[][]}
 */
export function deserializeSpreadsheetRows(stored) {
  // 1. Empty or not a list → no rows.
  const storedIsMissing = !Array.isArray(stored) || stored.length === 0;
  if (storedIsMissing) {
    return [];
  }

  const firstRow = stored[0];

  // 2. Packed shape { cells: [...] } is what we write today.
  if (isRowObjectWithCells(firstRow)) {
    return rowsFromCellObjects(stored);
  }

  // 3. Older docs stored a nested array. Accept that too.
  if (Array.isArray(firstRow)) {
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
  if (!Array.isArray(rows)) {
    return [];
  }

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
  if (!Array.isArray(rows)) {
    return false;
  }
  return anyRowHasVisibleText(rows);
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging packed vs nested row shapes.

function cellToStoredText(cell) {
  if (cell === null || cell === undefined) {
    return '';
  }
  return String(cell);
}

function isRowObjectWithCells(row) {
  const isPlainObject = typeof row === 'object' && row !== null && !Array.isArray(row);
  if (!isPlainObject) {
    return false;
  }
  return Array.isArray(row.cells);
}

function cellsToTextList(cells) {
  const textList = [];
  let index = 0;
  while (index < cells.length) {
    textList.push(cellToStoredText(cells[index]));
    index += 1;
  }
  return textList;
}

function rowsFromCellObjects(stored) {
  const rows = [];
  let index = 0;
  while (index < stored.length) {
    const row = stored[index];
    const hasCellsArray = row && Array.isArray(row.cells);
    if (hasCellsArray) {
      rows.push(cellsToTextList(row.cells));
    } else {
      rows.push([]);
    }
    index += 1;
  }
  return rows;
}

function rowsFromNestedArrays(stored) {
  const rows = [];
  let index = 0;
  while (index < stored.length) {
    const row = stored[index];
    if (Array.isArray(row)) {
      rows.push(cellsToTextList(row));
    } else {
      rows.push([]);
    }
    index += 1;
  }
  return rows;
}

function packedRowFromUnknown(row) {
  if (Array.isArray(row)) {
    return { cells: cellsToTextList(row) };
  }
  if (row && Array.isArray(row.cells)) {
    return { cells: cellsToTextList(row.cells) };
  }
  return { cells: [] };
}

function packedRowsFromUnknownList(rows) {
  const packedRows = [];
  let index = 0;
  while (index < rows.length) {
    packedRows.push(packedRowFromUnknown(rows[index]));
    index += 1;
  }
  return packedRows;
}

function cellHasVisibleText(cell) {
  // vocab: null/undefined → empty string before trim (same as ?? '')
  let rawCell = cell;
  if (rawCell === null || rawCell === undefined) {
    rawCell = '';
  }
  const text = String(rawCell).trim();
  return text !== '';
}

function rowHasVisibleText(row) {
  if (!Array.isArray(row)) {
    return false;
  }
  let index = 0;
  while (index < row.length) {
    if (cellHasVisibleText(row[index])) {
      return true;
    }
    index += 1;
  }
  return false;
}

function anyRowHasVisibleText(rows) {
  let index = 0;
  while (index < rows.length) {
    if (rowHasVisibleText(rows[index])) {
      return true;
    }
    index += 1;
  }
  return false;
}
