// iOS and Android build of the spreadsheet parser. Hands back the real SheetJS library.
// Flow: Metro picks this file on a device instead of spreadsheetReader.js.
// Used by: the spreadsheet viewer. SheetJS needs the Node-ish globals that metro.config.js polyfills.

// vocab: SheetJS is the xlsx package. It reads .xlsx and .csv into plain objects.
import * as XLSX from 'xlsx';

// ===== NAMED CONSTANTS =====

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

function loadNativeSheetJs() {
  return XLSX;
}

export default loadNativeSheetJs();
