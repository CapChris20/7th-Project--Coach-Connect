/** Firestore-safe spreadsheet row encoding (no nested arrays). */

export function deserializeSpreadsheetRows(stored) {
  if (!Array.isArray(stored) || !stored.length) return [];
  if (
    typeof stored[0] === 'object' &&
    stored[0] !== null &&
    !Array.isArray(stored[0]) &&
    Array.isArray(stored[0].cells)
  ) {
    return stored.map((row) =>
      Array.isArray(row?.cells) ? row.cells.map((cell) => (cell == null ? '' : String(cell))) : [],
    );
  }
  if (Array.isArray(stored[0])) {
    return stored.map((row) => (Array.isArray(row) ? row.map((cell) => (cell == null ? '' : String(cell))) : []));
  }
  return [];
}

export function serializeSpreadsheetRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    cells: Array.isArray(row)
      ? row.map((cell) => (cell == null ? '' : String(cell)))
      : Array.isArray(row?.cells)
        ? row.cells.map((cell) => (cell == null ? '' : String(cell)))
        : [],
  }));
}

export function spreadsheetRowsHaveContent(rows) {
  if (!Array.isArray(rows)) return false;
  return rows.some(
    (row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== ''),
  );
}
