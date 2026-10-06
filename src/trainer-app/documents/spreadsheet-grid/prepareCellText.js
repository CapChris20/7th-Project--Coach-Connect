// Turns stored sheet cells into display strings once per change, not on every scroll frame.
// Flow: each saved cell → checkbox, formula, or plain value → Map the grid reads while scrolling.
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

// ===== HELPER FUNCTIONS =====

// Checkboxes have been saved as a real boolean, the word "true", or the string "1".
function isCheckedValue(raw) {
  return String(raw).toLowerCase() === 'true' || raw === '1';
}

function checkboxDisplay(cell) {
  const isChecked = isCheckedValue(cell.raw);
  const glyph = isChecked ? CHECKED_GLYPH : UNCHECKED_GLYPH;
  return { text: glyph, rawValue: isChecked };
}

// The Set is the cycle guard. evaluateCell records each visited cell so A1 = B1 = A1 stops.
function formulaDisplay(cell, cells, cellKey) {
  const formulaResult = evaluateCell(cell.raw, cells, new Set(), cellKey);
  if (formulaResult.error) {
    return { text: FORMULA_ERROR_TEXT, error: formulaResult.error, rawValue: null };
  }
  return { text: formatValue(formulaResult.value, cell), rawValue: formulaResult.value };
}

// Coerce to a number only when the raw text really is numeric. "N/A" and "" stay as typed.
// vocab: Number.isNaN = the not-a-number value, which is stricter than the global isNaN.
function numericOrOriginal(raw) {
  const numericRaw = Number(raw);
  if (raw !== '' && !Number.isNaN(numericRaw)) return numericRaw;
  return raw;
}

// text keeps the typed raw so formatting sees what the user entered. rawValue is the coerced number.
function plainValueDisplay(cell) {
  return {
    text: formatValue(cell.raw, cell),
    rawValue: numericOrOriginal(cell.raw),
  };
}

function displayForCell(cell, cells, cellKey) {
  if (cell.format === 'checkbox') return checkboxDisplay(cell);
  if (String(cell.raw).startsWith('=')) return formulaDisplay(cell, cells, cellKey);
  return plainValueDisplay(cell);
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

  // vocab: Object.entries = turn { "0,0": cell } into pairs so we get the key and the cell together.
  for (const [cellKey, cell] of Object.entries(cells)) {
    if (!cell) continue;
    displayCache.set(cellKey, displayForCell(cell, cells, cellKey));
  }

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
  return displayCache.get(keyOf(rowIndex, columnIndex)) ?? EMPTY_CELL_DISPLAY;
}
