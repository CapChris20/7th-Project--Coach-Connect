// Browser build of the spreadsheet parser. Hands back the real SheetJS library.
// Flow: import SheetJS → wrap in a named loader → export that library as the default.
// Used by: the spreadsheet viewer. Metro picks this file on web instead of spreadsheetReader.js.

import * as XLSX from 'xlsx';

// ===== NAMED CONSTANTS =====

// No tweakable numbers here — this file only re-exports the web SheetJS build.

// ===== HELPER FUNCTIONS =====

/**
 * Return the browser SheetJS build. Native uses a different file with polyfills.
 * @returns {typeof XLSX}
 */
function getBrowserSheetJsLibrary() {
  return XLSX;
}

// ===== MAIN FUNCTION =====

// Call once at module load so importers get the library object, not a function.
const browserSheetJsLibrary = getBrowserSheetJsLibrary();

export default browserSheetJsLibrary;
