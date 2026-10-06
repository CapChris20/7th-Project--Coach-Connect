// Fallback spreadsheet reader for odd build targets that are neither web nor a device.
// Flow: Metro prefers spreadsheetReader.web.js or spreadsheetReader.native.js. This file returns empty sheets.
// Used by: the spreadsheet viewer, which only needs read() and utils.sheet_to_json().

// vocab: Metro resolves ./spreadsheetReader to the .web or .native file first.

// ===== NAMED CONSTANTS =====

const EMPTY_WORKBOOK = { SheetNames: [], Sheets: {} };
const EMPTY_ROWS = [];

// ===== HELPER FUNCTIONS =====

function readEmptyWorkbook() {
  return EMPTY_WORKBOOK;
}

function sheetToEmptyRows() {
  return EMPTY_ROWS;
}

// ===== MAIN FUNCTION =====

export default {
  read: readEmptyWorkbook,
  utils: {
    sheet_to_json: sheetToEmptyRows,
  },
};
