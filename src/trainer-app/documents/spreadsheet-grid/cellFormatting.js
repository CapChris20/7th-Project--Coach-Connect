// Formatting helpers for spreadsheet cell values and styles.
// Flow: detect cell type → apply display formatting (currency, percent, clean number).
// Used by: SpreadsheetEditor and SpreadsheetGrid.

// ===== NAMED CONSTANTS =====

export const FORMAT_TYPE_TEXT = 'text';
export const FORMAT_TYPE_NUMBER = 'number';
export const FORMAT_TYPE_CURRENCY = 'currency';
export const FORMAT_TYPE_PERCENT = 'percent';

const CURRENCY_SYMBOL_DEFAULT = '$';
const FRACTION_DIGITS_DEFAULT = 2;

// ===== HELPER FUNCTIONS =====

/**
 * Check if a string can be safely parsed as a finite number.
 * @param {*} cellValue
 * @returns {boolean}
 */
export function isNumericText(cellValue) {
  if (cellValue === null || cellValue === undefined) return false;
  const trimmedString = String(cellValue).trim();
  if (trimmedString === '') return false;
  return Number.isFinite(Number(trimmedString));
}

/**
 * Format a number into currency display (e.g. 135 -> "$135.00").
 */
function formatCurrencyString(numericValue) {
  const roundedAmount = Number(numericValue).toFixed(FRACTION_DIGITS_DEFAULT);
  return `${CURRENCY_SYMBOL_DEFAULT}${roundedAmount}`;
}

/**
 * Format a number into percent display (e.g. 0.25 -> "25%").
 */
function formatPercentString(numericValue) {
  const percentNumber = Number(numericValue) * 100;
  return `${percentNumber.toFixed(0)}%`;
}

// ===== MAIN FUNCTION =====

/**
 * Format a cell's raw text for on-screen display according to its configured format type.
 * Flow: 1. check for empty  2. check format type  3. format accordingly
 * @param {string} rawValue
 * @param {string} formatType
 * @returns {string}
 */
export function formatCellValue(rawValue, formatType = FORMAT_TYPE_TEXT) {
  // 1. Empty values stay empty
  if (rawValue === null || rawValue === undefined) return '';
  const textValue = String(rawValue);
  if (textValue.trim() === '') return '';

  // 2. Check if text is numeric for specialized formatting
  const isNumber = isNumericText(textValue);
  if (!isNumber) return textValue;

  const parsedNumericValue = Number(textValue);

  // 3. Format according to format type
  if (formatType === FORMAT_TYPE_CURRENCY) {
    return formatCurrencyString(parsedNumericValue);
  }

  if (formatType === FORMAT_TYPE_PERCENT) {
    return formatPercentString(parsedNumericValue);
  }

  return textValue;
}
