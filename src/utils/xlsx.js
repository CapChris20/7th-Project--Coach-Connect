/**
 * xlsx
 *
 * Purpose: xlsx — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/utils
 * Key exports: (see file)
 *
 * @file-header
 */
// Default fallback for environments that don't match `.web.js` or `.native.js`.
// Keep it safe for native bundling.
export default {
  read: () => ({ SheetNames: [], Sheets: {} }),
  utils: {
    sheet_to_json: () => [],
  },
};

