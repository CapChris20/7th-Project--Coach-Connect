// Fallback spreadsheet shim for the xlsx (SheetJS) library.
// Flow: Metro picks xlsx.web.js on web and xlsx.native.js on device; this plain xlsx.js is
//       only reached in odd build targets, where it returns empty data instead of crashing.
// Imported by the spreadsheet viewer/parsers, which just need `read` and `utils.sheet_to_json` to exist.

// vocab: platform extensions = Metro resolves `./xlsx` to xlsx.web.js / xlsx.native.js first,
//        and only falls back to this bare file when neither matches.
// The empty shapes below are chosen to match what real SheetJS returns, so callers can
// map over the results without null checks.
export default {
  read: () => ({ SheetNames: [], Sheets: {} }),
  utils: {
    sheet_to_json: () => [],
  },
};

