// Web spreadsheet reader — real SheetJS in the browser bundle.
// Flow: import xlsx → name the browser library → export that object as the default.
// Used by SpreadsheetViewer and saveNotesAndFiles when Metro resolves the .web.js platform file.
// Read order: import → helpers → main loader → default export.

// vocab: Metro picks this .web.js file in the browser instead of spreadsheetReader.js or .native.js.
// Browser build does not need the Node polyfills that metro.config.js adds for native.

import * as XLSX from 'xlsx';

// ===== NAMED CONSTANTS =====

// No tweakable numbers here — this file only hands back the browser SheetJS build.

// ===== HELPER FUNCTIONS =====

/**
 * True when the browser bundle exposed a SheetJS-shaped module.
 * @param {object} sheetJsLibrary
 * @returns {boolean}
 */
function libraryLooksLikeSheetJs(sheetJsLibrary) {
  return Boolean(sheetJsLibrary && typeof sheetJsLibrary.read === 'function');
}

/**
 * Return the browser SheetJS build. Native uses a different file with polyfills.
 * @returns {typeof XLSX}
 */
function browserSheetJsLibrary() {
  return XLSX;
}

// ===== MAIN FUNCTION =====

/**
 * Browser build: the spreadsheet viewer imports this as the xlsx API.
 * Flow: 1. grab the browser module  2. export the object (not a loader function)
 * @returns {typeof XLSX}
 */
function loadWebSpreadsheetLibrary() {
  // 1. Browser build ships with this file instead of spreadsheetReader.native.js.
  const sheetJsLibrary = browserSheetJsLibrary();

  // 2. Importers get the library object directly, not a loader function.
  if (!libraryLooksLikeSheetJs(sheetJsLibrary)) {
    return sheetJsLibrary;
  }
  return sheetJsLibrary;
}

const webSpreadsheetLibrary = loadWebSpreadsheetLibrary();

export default webSpreadsheetLibrary;
