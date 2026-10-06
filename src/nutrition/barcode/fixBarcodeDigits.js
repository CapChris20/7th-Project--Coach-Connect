// Cleans barcode digits from the camera or a typed field before the server lookup.
// Flow: keep only digits → pad a short or 11-digit code to 12 → cap a long scan at 14.
// Used by: the barcode scanner. Phone cameras often drop the leading zero on a UPC-A.

// ===== NAMED CONSTANTS =====

// Manipulate here: UPC-A is 12 digits. Scanners often return 11. EAN can be up to 14.
const UPC_A_LENGTH = 12;
const TRUNCATED_UPC_LENGTH = 11;
const SHORTEST_USEFUL_BARCODE = 8;
const LONGEST_ACCEPTED_BARCODE = 14;

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} digitsOnly
 * @returns {string}
 */
function padToUpcLength(digitsOnly) {
  return digitsOnly.padStart(UPC_A_LENGTH, '0');
}

// ===== MAIN FUNCTION =====

/**
 * Normalize camera or manual barcode digits before the server lookup.
 * @param {string} raw
 * @returns {string}
 */
export function fixBarcodeDigits(raw) {
  const digitsOnly = String(raw || '').replace(/\D/g, '');
  if (!digitsOnly) return '';
  if (digitsOnly.length === TRUNCATED_UPC_LENGTH) return padToUpcLength(digitsOnly);
  const lengthIsUseful = digitsOnly.length >= SHORTEST_USEFUL_BARCODE && digitsOnly.length <= LONGEST_ACCEPTED_BARCODE;
  if (lengthIsUseful) return digitsOnly;
  if (digitsOnly.length < SHORTEST_USEFUL_BARCODE) return padToUpcLength(digitsOnly);
  return digitsOnly.slice(0, LONGEST_ACCEPTED_BARCODE);
}
