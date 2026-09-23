// Web build of the spreadsheet parser — hands back the real SheetJS library unmodified.
// Metro auto-picks this file over spreadsheetReader.js when bundling for browser.
// No polyfills needed here; SheetJS ships a browser-ready build.

import * as XLSX from 'spreadsheetReader';

export default XLSX;

