// Browser build of the spreadsheet parser. Hands back the real SheetJS library.
// Flow: Metro picks this file on web instead of spreadsheetReader.js.
// Used by: the spreadsheet viewer. The browser build does not need the native polyfills.

import * as XLSX from 'xlsx';

// ===== NAMED CONSTANTS =====

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

function loadWebSheetJs() {
  return XLSX;
}

export default loadWebSheetJs();
