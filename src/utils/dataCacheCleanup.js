// Legacy alias kept alive so older imports of `dataCacheCleanup` still resolve.
// Everything it does lives in ./clearDataOnLogout — point new code there instead.

// vocab: module.exports = require(...) = CommonJS re-export; this file adds nothing of its own
/** @deprecated Use clearDataOnLogout.js */
module.exports = require('./clearDataOnLogout');
