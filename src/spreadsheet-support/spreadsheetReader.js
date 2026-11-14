// Empty spreadsheet reader for Metro targets that are neither web nor a native device.
// Flow: name the empty workbook pieces → build a SheetJS-shaped stub → export as default.
// Used by SpreadsheetViewer and saveNotesAndFiles; Metro prefers .web.js or .native.js when those apply.
// Read order: constants → helpers → main stub API → default export.

// vocab: Metro platform extensions pick spreadsheetReader.web.js or spreadsheetReader.native.js first.
// This plain .js file is the last-resort stub so odd targets still import a matching shape.

// ===== NAMED CONSTANTS =====

const EMPTY_SHEET_NAME_LIST = [];
const EMPTY_SHEETS_BY_NAME = {};
const EMPTY_ROW_LIST = [];

// ===== HELPER FUNCTIONS =====

/**
 * Workbook shape SheetJS returns from read() — no sheet names, no sheet data.
 * Freeze: SheetNames / Sheets lettering matches real SheetJS so the viewer never branches.
 * @returns {{ SheetNames: string[], Sheets: object }}
 */
function emptyWorkbookShape() {
  return {
    SheetNames: EMPTY_SHEET_NAME_LIST,
    Sheets: EMPTY_SHEETS_BY_NAME,
  };
}

/**
 * Always-empty row list for utils.sheet_to_json.
 * Freeze: utils.sheet_to_json name matches the xlsx package API.
 * @returns {Array}
 */
function emptyRowListFromSheet() {
  return EMPTY_ROW_LIST;
}

// ===== MAIN FUNCTION =====

/**
 * Empty SheetJS stand-in for non-web / non-native Metro targets.
 * Flow: 1. name the read stub  2. name the sheet_to_json stub  3. return the API bag
 * @returns {{ read: Function, utils: { sheet_to_json: Function } }}
 */
function loadEmptySpreadsheetReader() {
  // 1. read() must return { SheetNames, Sheets } like real SheetJS.
  const readStub = emptyWorkbookShape;

  // 2. utils.sheet_to_json must exist so viewer code never branches on platform.
  const sheetToJsonStub = emptyRowListFromSheet;

  // 3. Hand back the same surface importers call on web/native.
  return {
    read: readStub,
    utils: {
      sheet_to_json: sheetToJsonStub,
    },
  };
}

const emptySpreadsheetReader = loadEmptySpreadsheetReader();

export default emptySpreadsheetReader;
