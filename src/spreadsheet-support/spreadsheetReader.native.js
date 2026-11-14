// Native (iOS/Android) spreadsheet reader — real SheetJS via Metro.
// Flow: import xlsx (polyfills already in metro.config.js) → name the module → export as default.
// Used by SpreadsheetViewer and saveNotesAndFiles on device builds.
// Read order: import → helpers → main loader → default export.

// vocab: SheetJS / xlsx parses .xlsx and .csv into plain row objects for the viewer.
// vocab: Metro picks this .native.js file on iOS/Android instead of spreadsheetReader.js or .web.js.

import * as XLSX from 'xlsx';

// ===== NAMED CONSTANTS =====

// No tweakable numbers here — this file only hands back the native SheetJS module.
// Polyfills (Buffer, etc.) live in metro.config.js, not in this wrapper.

// ===== HELPER FUNCTIONS =====

/**
 * True when Metro handed us a module object with a read function (SheetJS shape).
 * @param {object} sheetJsModule
 * @returns {boolean}
 */
function moduleLooksLikeSheetJs(sheetJsModule) {
  return Boolean(sheetJsModule && typeof sheetJsModule.read === 'function');
}

/**
 * Return the SheetJS module object Metro loaded for native.
 * @returns {typeof XLSX}
 */
function nativeSheetJsModuleFromMetro() {
  return XLSX;
}

// ===== MAIN FUNCTION =====

/**
 * Device build: the spreadsheet viewer imports this as the xlsx API.
 * Flow: 1. grab the native module  2. export it so callers use .read / utils the same as on web
 * @returns {typeof XLSX}
 */
function loadNativeSpreadsheetLibrary() {
  // 1. Polyfills already applied in metro.config.js — no wrapper logic needed here.
  const sheetJsModule = nativeSheetJsModuleFromMetro();

  // 2. Return the module object so viewer calls XLSX.read the same way as on web.
  // (moduleLooksLikeSheetJs is a sanity check for humans reading this file — Metro always loads xlsx.)
  if (!moduleLooksLikeSheetJs(sheetJsModule)) {
    return sheetJsModule;
  }
  return sheetJsModule;
}

const nativeSpreadsheetLibrary = loadNativeSpreadsheetLibrary();

export default nativeSpreadsheetLibrary;
