// Fallback spreadsheet shim for the spreadsheetReader (SheetJS) library.
// Flow: Metro picks spreadsheetReader.web.js on web and spreadsheetReader.native.js on device; this plain spreadsheetReader.js is
//       only reached in odd build targets, where it returns empty data instead of crashing.
// Imported by the spreadsheet viewer/parsers, which just need `read` and `utils.sheet_to_json` to exist.

// vocab: platform extensions = Metro resolves `./spreadsheetReader` to spreadsheetReader.web.js / spreadsheetReader.native.js first,
//        and only falls back to this bare file when neither matches.
// The empty shapes below are chosen to match what real SheetJS returns, so callers can
// map over the results without null checks.
export default {
  read: () => ({ SheetNames: [], Sheets: {} }),
  utils: {
    sheet_to_json: () => [],
  },
};

