// Turns stored sheet cells into display strings once per change, not on every scroll frame.
// Flow: list populated keys → build checkbox / formula / plain display → Map the grid reads while scrolling.
// Used by the spreadsheet grid. Blank cells are absent from storage, so this loop stays small.

import { evaluateCell } from './formulaCalculator';
import { formatValue } from './cellFormatting';
import { keyOf } from './spreadsheetConstants';

// ===== NAMED CONSTANTS =====

// One shared blank so an empty lookup does not allocate a new object on every cell paint.
const EMPTY_CELL_DISPLAY = { text: '', rawValue: null };

// Manipulate here: the glyphs the grid shows for a checkbox. The stored value stays boolean.
const CHECKED_GLYPH = '☑';
const UNCHECKED_GLYPH = '☐';

// Manipulate here: the in-cell text for a formula that failed. The real error is kept beside it.
const FORMULA_ERROR_TEXT = '#ERR';
const FORMULA_PREFIX = '=';
const CHECKBOX_FORMAT = 'checkbox';
const TRUTHY_STRING_TRUE = 'true';
const TRUTHY_STRING_ONE = '1';

// ===== HELPER FUNCTIONS =====

/**
 * Checkboxes have been saved as a real boolean, the word "true", or the string "1".
 * @param {*} rawValue
 * @returns {boolean}
 */
function isCheckedValue(rawValue) {
  const asLowerString = String(rawValue).toLowerCase();
  if (asLowerString === TRUTHY_STRING_TRUE) return true;
  if (rawValue === TRUTHY_STRING_ONE) return true;
  return false;
}

/**
 * @param {object} cell
 * @returns {{ text: string, rawValue: boolean }}
 */
function checkboxDisplay(cell) {
  const isChecked = isCheckedValue(cell.raw);
  const glyph = isChecked ? CHECKED_GLYPH : UNCHECKED_GLYPH;
  return { text: glyph, rawValue: isChecked };
}

/**
 * The Set is the cycle guard. evaluateCell records each visited cell so A1 = B1 = A1 stops.
 * @param {object} cell
 * @param {object} cells
 * @param {string} cellKey
 * @returns {{ text: string, rawValue: *, error?: string }}
 */
function formulaDisplay(cell, cells, cellKey) {
  const visitedKeys = new Set();
  const formulaResult = evaluateCell(cell.raw, cells, visitedKeys, cellKey);
  if (formulaResult.error) {
    return { text: FORMULA_ERROR_TEXT, error: formulaResult.error, rawValue: null };
  }
  return {
    text: formatValue(formulaResult.value, cell),
    rawValue: formulaResult.value,
  };
}

/**
 * Coerce to a number only when the raw text really is numeric. "N/A" and "" stay as typed.
 * vocab: Number.isNaN = the not-a-number value, which is stricter than the global isNaN.
 * @param {*} rawValue
 * @returns {*}
 */
function numericOrOriginal(rawValue) {
  if (rawValue === '') return rawValue;
  const numericRaw = Number(rawValue);
  if (Number.isNaN(numericRaw)) return rawValue;
  return numericRaw;
}

/**
 * text keeps the typed raw so formatting sees what the user entered. rawValue is the coerced number.
 * @param {object} cell
 * @returns {{ text: string, rawValue: * }}
 */
function plainValueDisplay(cell) {
  return {
    text: formatValue(cell.raw, cell),
    rawValue: numericOrOriginal(cell.raw),
  };
}

/**
 * Pick the display builder for one stored cell.
 * @param {object} cell
 * @param {object} cells
 * @param {string} cellKey
 * @returns {{ text: string, rawValue: *, error?: string }}
 */
function displayForCell(cell, cells, cellKey) {
  if (cell.format === CHECKBOX_FORMAT) return checkboxDisplay(cell);
  const rawAsString = String(cell.raw);
  if (rawAsString.startsWith(FORMULA_PREFIX)) return formulaDisplay(cell, cells, cellKey);
  return plainValueDisplay(cell);
}

/**
 * Fill the display cache for every non-null stored cell.
 * @param {object} cells
 * @param {Map} displayCache
 */
function fillDisplayCache(cells, displayCache) {
  const cellKeys = Object.keys(cells);
  for (let index = 0; index < cellKeys.length; index += 1) {
    const cellKey = cellKeys[index];
    const cell = cells[cellKey];
    if (!cell) continue;
    displayCache.set(cellKey, displayForCell(cell, cells, cellKey));
  }
}

// ===== MAIN FUNCTION =====

/**
 * Precompute display strings for populated cells so the grid does not re-run formulas while scrolling.
 * @param {object|null|undefined} cells Map-like object keyed by "row,col".
 * @returns {Map<string, { text: string, rawValue: *, error?: string }>}
 */
export function prepareCellText(cells) {
  // vocab: Map = key→value store. keyOf builds the "row,col" string the grid already uses.
  const displayCache = new Map();
  if (!cells) return displayCache;

  fillDisplayCache(cells, displayCache);
  return displayCache;
}

/**
 * One Map lookup for a grid cell. Missing keys share the blank object.
 * @param {Map} displayCache
 * @param {number} rowIndex
 * @param {number} columnIndex
 * @returns {{ text: string, rawValue: * }}
 */
export function lookupDisplay(displayCache, rowIndex, columnIndex) {
  // vocab/symbol: ?? = if this cell is not in the cache, hand back the shared blank.
  const cached = displayCache.get(keyOf(rowIndex, columnIndex));
  return cached ?? EMPTY_CELL_DISPLAY;
}
