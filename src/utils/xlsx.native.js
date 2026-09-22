// iOS/Android build of the spreadsheet parser — hands back the real SheetJS library.
// Metro auto-picks this file over xlsx.js when bundling for device.
// Note: SheetJS expects Node-ish globals, so this only works because metro.config.js polyfills them.

// vocab: SheetJS = the `xlsx` npm package that reads .xlsx/.csv into plain JS objects
import * as XLSX from 'xlsx';

export default XLSX;
