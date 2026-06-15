/**
 * xlsx native
 *
 * Purpose: xlsx native — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/utils
 * Key exports: (see file)
 *
 * @file-header
 */
// Native (iOS/Android/Expo Go) shim for `xlsx`.
//
// `xlsx` depends on Node core modules like `fs/stream/events`, which Metro cannot
// bundle for the native runtime. This stub keeps the app buildable.

export default {
  read: () => ({ SheetNames: [], Sheets: {} }),
  utils: {
    sheet_to_json: () => [],
    book_new: () => ({}),
    aoa_to_sheet: () => ({}),
    book_append_sheet: () => {},
  },
  write: () => new ArrayBuffer(0),
};

