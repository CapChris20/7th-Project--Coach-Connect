// iOS and Android build of the spreadsheet parser. Hands back the real SheetJS library.
// Flow: Metro picks this file on a device instead of spreadsheetReader.js.
// Used by: the spreadsheet viewer. SheetJS needs the Node-ish globals that metro.config.js polyfills.

// vocab: SheetJS is the xlsx package. It reads .xlsx and .csv into plain objects.
import * as XLSX from 'xlsx';

// ===== NAMED CONSTANTS =====

// No tweakable numbers — this file only re-exports the native SheetJS module.

// ===== HELPER FUNCTIONS =====

/**
 * Return the SheetJS module object Metro loaded for native.
 * @returns {typeof XLSX}
 */
function nativeSheetJsModule() {
  return XLSX;
}

// ===== MAIN FUNCTION =====

/**
 * Device build: the spreadsheet viewer imports this as the xlsx API.
 * @returns {typeof XLSX}
 */
function loadNativeSheetJs() {
  return nativeSheetJsModule();
}

export default loadNativeSheetJs();
