/**
 * Shared with Cloud Functions — keep implementation in functions/lib so deploys
 * include it (firebase packages only the functions/ directory).
 */
module.exports = require('../../functions/lib/macroRecalibration');
