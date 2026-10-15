// Spreadsheet value formatting: guess a cell's type from what was typed, and render it back out.
// Flow: detectFormat(raw) runs on entry/paste to tag the cell → formatValue(value, cell) runs on render.
// Used by the display cache and the paste pipeline in the spreadsheet editor.

// ===== NAMED CONSTANTS =====

const FORMAT_CURRENCY = 'currency';
const FORMAT_PERCENT = 'percent';
const FORMAT_EMAIL = 'email';
const FORMAT_URL = 'url';
const FORMAT_PHONE = 'phone';
const FORMAT_DATE = 'date';
const FORMAT_NUMBER = 'number';
const FORMAT_CHECKBOX = 'checkbox';

const BOOLEAN_TRUE_LABEL = 'TRUE';
const BOOLEAN_FALSE_LABEL = 'FALSE';
const CHECKED_GLYPH = '☑';
const UNCHECKED_GLYPH = '☐';
const DEFAULT_CURRENCY_SYMBOL = '$';
const ISO_DATE_LENGTH = 10;
const PERCENT_STORE_DIVISOR = 100;
const CURRENCY_FRACTION_DIGITS = 2;
const PERCENT_FRACTION_DIGITS = 2;
const DEFAULT_NUMBER_FRACTION_DIGITS = 8;
const NICE_NUMBER_SEPARATOR_THRESHOLD = 1000;
const NICE_NUMBER_LARGE_FRACTION_DIGITS = 2;
const NICE_NUMBER_SMALL_FRACTION_DIGITS = 4;
const PLAIN_INTEGER_ABS_MAX = 1e6;
const PHONE_MIN_DIGITS = 7;
const PHONE_MAX_DIGITS = 15;

// ===== HELPER FUNCTIONS =====

function digitCount(text) {
  return text.replace(/\D/g, '').length;
}

function isPhoneNumberText(trimmedInput) {
  if (!/^\+?[\d][\d\s\-().]{6,}\d$/.test(trimmedInput)) return false;
  const phoneDigits = digitCount(trimmedInput);
  return phoneDigits >= PHONE_MIN_DIGITS && phoneDigits <= PHONE_MAX_DIGITS;
}

function isDateText(trimmedInput) {
  return /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(trimmedInput) || /^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmedInput);
}

function isoDateIfValid(trimmedInput) {
  const parsedDate = new Date(trimmedInput);
  // vocab: an invalid Date's getTime() is NaN — that's the standard "did this parse?" test
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate.toISOString().slice(0, ISO_DATE_LENGTH);
}

function formatCurrencyDisplay(numericValue, cell) {
  // Manipulate here: '$' is the fallback symbol when the cell didn't record one.
  const currencySymbol = cell?.currency || DEFAULT_CURRENCY_SYMBOL;
  // vocab: toLocaleString = format a number using the device's locale (comma/period rules).
  // Passing `undefined` as the locale means "use the device's". Forcing min AND max to 2
  // is what makes money always show cents — "5" renders as "$5.00".
  return currencySymbol + numericValue.toLocaleString(undefined, {
    minimumFractionDigits: CURRENCY_FRACTION_DIGITS,
    maximumFractionDigits: CURRENCY_FRACTION_DIGITS,
  });
}

function formatPercentDisplay(numericValue) {
  // Undo the /100 that detectFormat applied when storing.
  return (numericValue * PERCENT_STORE_DIVISOR).toLocaleString(undefined, {
    maximumFractionDigits: PERCENT_FRACTION_DIGITS,
  }) + '%';
}

function formatUntaggedNumber(numericValue) {
  // Untagged numbers: keep small whole numbers exactly as typed (no thousands separator on
  // "1234", which would look wrong for things like a year or a rep count), and only switch
  // to locale formatting for large or fractional values.
  // Manipulate here: PLAIN_INTEGER_ABS_MAX is the "big enough to deserve separators" threshold.
  if (Number.isInteger(numericValue) && Math.abs(numericValue) < PLAIN_INTEGER_ABS_MAX) {
    return String(numericValue);
  }
  // Manipulate here: DEFAULT_NUMBER_FRACTION_DIGITS stops float noise (0.30000000000000004)
  // from leaking into the grid.
  return numericValue.toLocaleString(undefined, { maximumFractionDigits: DEFAULT_NUMBER_FRACTION_DIGITS });
}

function isCheckboxChecked(value) {
  return String(value).toLowerCase() === 'true' || value === true;
}

// ===== MAIN FUNCTION =====

/**
 * Auto-detect: "what did the user just type?" Returns null when nothing matches, meaning
 * "leave it as plain text". `normalized` is the clean value we STORE; the original string is
 * only for display. Order matters — the most specific patterns are tested first, because a
 * currency string like "$1,200" would also loosely resemble a number.
 * @param {*} raw
 * @returns {{ format: string, normalized: string, currency?: string }|null}
 */
export function detectFormat(raw) {
  const trimmedInput = String(raw || '').trim();
  if (!trimmedInput) return null;

  // Currency: a leading symbol, optional space, optional minus, thousands commas, optional decimals.
  // vocab: /^...$/ = anchored regex — must match the WHOLE string, not just part of it
  // vocab: .exec() returns null on no-match, or an array where [1], [2] are the ( ) capture groups
  // Manipulate here: add a symbol to [$€£¥] to recognize another currency.
  const currencyMatch = /^([$€£¥])\s*(-?[\d,]+(?:\.\d+)?)$/.exec(trimmedInput);
  if (currencyMatch) {
    return { format: FORMAT_CURRENCY, normalized: currencyMatch[2].replace(/,/g, ''), currency: currencyMatch[1] };
  }

  // Percent: we store the MATH value, not the typed one — "50%" is saved as 0.5 so SUM/AVG
  // work correctly. formatValue multiplies by 100 again on the way out.
  const percentMatch = /^(-?[\d,]+(?:\.\d+)?)\s*%$/.exec(trimmedInput);
  if (percentMatch) {
    return {
      format: FORMAT_PERCENT,
      normalized: String(parseFloat(percentMatch[1].replace(/,/g, '')) / PERCENT_STORE_DIVISOR),
    };
  }

  // Email / URL: deliberately loose "good enough for a spreadsheet" checks, not RFC validation.
  // Their only job is to decide whether the cell renders as a tappable link.
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(trimmedInput)) return { format: FORMAT_EMAIL, normalized: trimmedInput };
  if (/^https?:\/\/\S+$/i.test(trimmedInput)) return { format: FORMAT_URL, normalized: trimmedInput };

  if (isPhoneNumberText(trimmedInput)) {
    return { format: FORMAT_PHONE, normalized: trimmedInput };
  }

  // Date: only two shapes are accepted (M/D/YYYY and YYYY-M-D) to avoid guessing wildly.
  // We then hand it to Date to confirm it's a REAL date — the regex would happily accept 99/99/2024.
  if (isDateText(trimmedInput)) {
    const isoDate = isoDateIfValid(trimmedInput);
    if (isoDate) return { format: FORMAT_DATE, normalized: isoDate };
  }

  // Formatted number, e.g. "1,234.5". Bare digits are NOT tagged here — they're already numeric,
  // so they fall through to the default branch of formatValue with no format at all.
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(trimmedInput)) {
    return { format: FORMAT_NUMBER, normalized: trimmedInput.replace(/,/g, '') };
  }
  return null;
}

/**
 * Render side: stored value + the cell's format tag → the string shown in the grid.
 * Every branch defensively falls back to String(value) when the value doesn't match its format,
 * so bad data shows the raw text instead of "NaN" or a crash.
 * @param {*} value
 * @param {{ format?: string, currency?: string }} [cell]
 * @returns {string}
 */
export function formatValue(value, cell) {
  if (value == null || value === '') return '';
  // vocab: ?. = optional chaining — `cell` may be undefined when formatting a formula result
  const cellFormat = cell?.format;
  // Booleans come from formulas (e.g. =A1>5). Uppercase TRUE/FALSE is the spreadsheet convention.
  if (typeof value === 'boolean') return value ? BOOLEAN_TRUE_LABEL : BOOLEAN_FALSE_LABEL;
  switch (cellFormat) {
    case FORMAT_CURRENCY: {
      const numericValue = Number(value);
      if (Number.isNaN(numericValue)) return String(value);
      return formatCurrencyDisplay(numericValue, cell);
    }
    case FORMAT_PERCENT: {
      const numericValue = Number(value);
      if (Number.isNaN(numericValue)) return String(value);
      return formatPercentDisplay(numericValue);
    }
    case FORMAT_NUMBER: {
      const numericValue = Number(value);
      if (Number.isNaN(numericValue)) return String(value);
      return numericValue.toLocaleString();
    }
    case FORMAT_DATE: {
      const parsedDate = new Date(value);
      if (Number.isNaN(parsedDate.getTime())) return String(value);
      return parsedDate.toLocaleDateString();
    }
    // These three are stored and shown verbatim — the format tag only affects tap behavior
    // and styling elsewhere, not the text itself.
    case FORMAT_PHONE:
    case FORMAT_EMAIL:
    case FORMAT_URL:
      return String(value);
    case FORMAT_CHECKBOX:
      return isCheckboxChecked(value) ? CHECKED_GLYPH : UNCHECKED_GLYPH;
    default:
      if (typeof value === 'number') {
        return formatUntaggedNumber(value);
      }
      return String(value);
  }
}

/**
 * Formatter for numbers shown OUTSIDE cells (status bar totals, SUM previews, etc).
 * Big or whole numbers get 2 decimals; small fractions get 4 so a value like 0.0125 doesn't
 * collapse to "0.01" and look like zero movement.
 * @param {number} numericValue
 * @returns {string}
 */
export function formatNumberNice(numericValue) {
  // vocab: Number.isFinite = a real number, excluding NaN and Infinity
  if (!Number.isFinite(numericValue)) return String(numericValue);
  if (Math.abs(numericValue) >= NICE_NUMBER_SEPARATOR_THRESHOLD || Number.isInteger(numericValue)) {
    return numericValue.toLocaleString(undefined, { maximumFractionDigits: NICE_NUMBER_LARGE_FRACTION_DIGITS });
  }
  return numericValue.toLocaleString(undefined, { maximumFractionDigits: NICE_NUMBER_SMALL_FRACTION_DIGITS });
}
