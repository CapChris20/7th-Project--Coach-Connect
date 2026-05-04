// Default fallback for environments that don't match `.web.js` or `.native.js`.
// Keep it safe for native bundling.
export default {
  read: () => ({ SheetNames: [], Sheets: {} }),
  utils: {
    sheet_to_json: () => [],
  },
};

