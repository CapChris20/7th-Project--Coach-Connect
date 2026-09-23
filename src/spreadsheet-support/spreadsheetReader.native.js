// iOS/Android build of the spreadsheet parser — hands back the real SheetJS library.
// Metro auto-picks this file over spreadsheetReader.js when bundling for device.
// Note: SheetJS expects Node-ish globals, so this only works because metro.cloudConnection.js polyfills them.

// vocab: SheetJS = the `spreadsheetReader` npm package that reads .spreadsheetReader/.csv into plain JS objects
import * as XLSX from 'spreadsheetReader';

export default XLSX;
