// Fallback spreadsheet reader for odd build targets that are neither web nor a device.
// Flow: Metro prefers spreadsheetReader.web.js or spreadsheetReader.native.js. This file returns empty sheets.
// Used by: the spreadsheet viewer, which only needs read() and utils.sheet_to_json().

// vocab: Metro resolves ./spreadsheetReader to the .web or .native file first.

// ===== NAMED CONSTANTS =====

const EMPTY_SHEET_NAMES = [];
const EMPTY_SHEETS_MAP = {};
const EMPTY_ROWS = [];

// ===== HELPER FUNCTIONS =====

/**
 * Stub workbook with no sheet names and no sheet data.
 * @returns {{ SheetNames: string[], Sheets: object }}
 */
function makeEmptyWorkbook() {
  return {
    SheetNames: EMPTY_SHEET_NAMES,
    Sheets: EMPTY_SHEETS_MAP,
  };
}

/**
 * Stub sheet_to_json — always returns an empty row list.
 * @returns {Array}
 */
function sheetToEmptyRows() {
  return EMPTY_ROWS;
}

/**
 * Shape the spreadsheet viewer expects from the xlsx package.
 * @returns {{ read: Function, utils: { sheet_to_json: Function } }}
 */
function buildEmptySpreadsheetApi() {
  return {
    read: makeEmptyWorkbook,
    utils: {
      sheet_to_json: sheetToEmptyRows,
    },
  };
}

// ===== MAIN FUNCTION =====

/**
 * Empty SheetJS stand-in for non-web / non-native Metro targets.
 */
const emptySpreadsheetApi = buildEmptySpreadsheetApi();

export default emptySpreadsheetApi;
