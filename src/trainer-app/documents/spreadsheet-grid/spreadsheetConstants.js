// Shared size and address helpers for the spreadsheet editor.
// Flow: agree on how big the sheet is → turn a column number into a letter → build the cell key.
// Used by the grid, the formula engine, and the renderer so they address cells the same way.

// ===== NAMED CONSTANTS =====

// Manipulate here: more rows or columns makes scrolling and a full recalculation slower.
const ROWS = 200;
const COLS = 26;
const DEFAULT_COL_WIDTH = 100;
const DEFAULT_ROW_HEIGHT = 26;
const HEADER_W = 46;
const HEADER_H = 26;
const MAX_COL_WIDTH = 500;
// Manipulate here: 44pt is Apple's minimum tap target.
const TOUCH_MIN = 44;

const ALPHABET_SIZE = 26;
const LETTER_A_CHAR_CODE = 65;
const LETTER_A_ONE_BASED = 64;
const RANDOM_ID_RADIX = 36;
const RANDOM_ID_START = 2;
const RANDOM_ID_END = 7;

// ===== HELPER FUNCTIONS =====

/**
 * Base-26 with no zero digit. A is both the first letter and the value 0, so the carry subtracts 1.
 * vocab: String.fromCharCode(65) is capital A.
 * @param {number} columnIndex
 * @returns {string}
 */
function columnLetters(columnIndex) {
  let letters = '';
  let remaining = columnIndex;
  while (true) {
    letters = String.fromCharCode(LETTER_A_CHAR_CODE + (remaining % ALPHABET_SIZE)) + letters;
    remaining = Math.floor(remaining / ALPHABET_SIZE) - 1;
    // Stop after the shift. Checking before it would drop the last letter.
    if (remaining < 0) break;
  }
  return letters;
}

// ===== MAIN FUNCTION =====

/**
 * @param {number} columnIndex
 * @returns {string}
 */
export const colLabel = (columnIndex) => columnLetters(columnIndex);

/**
 * Inverse of colLabel. 'A' is 0 and 'AA' is 26.
 * vocab: charCodeAt(0) - 64 turns 'A' into 1.
 * @param {string} label
 * @returns {number}
 */
export const labelToCol = (label) => {
  let columnNumber = 0;
  for (const letter of label.toUpperCase()) {
    columnNumber = columnNumber * ALPHABET_SIZE + (letter.charCodeAt(0) - LETTER_A_ONE_BASED);
  }
  return columnNumber - 1;
};

/**
 * The storage key. One format so a saved sheet still finds its cells.
 * @param {number} rowIndex
 * @param {number} columnIndex
 * @returns {string}
 */
export const keyOf = (rowIndex, columnIndex) => `${rowIndex},${columnIndex}`;

/**
 * A blank tab stores only the cells the user touched, so a 200 by 26 grid stays small.
 * vocab: toString(36) makes a short id from random digits and letters.
 * @param {number} sheetIndex
 * @returns {object}
 */
export const newSheet = (sheetIndex) => ({
  id: `s${sheetIndex}-${Math.random().toString(RANDOM_ID_RADIX).slice(RANDOM_ID_START, RANDOM_ID_END)}`,
  name: `Sheet ${sheetIndex}`,
  cells: {},
  colWidths: {},
  rowHeights: {},
});

/**
 * A drag that goes up or left stores the end before the start. This returns top-left then bottom-right.
 * @param {{ anchor: { r: number, c: number }, focus: { r: number, c: number } }} selection
 * @returns {{ r1: number, r2: number, c1: number, c2: number }}
 */
export function normalizeSel(selection) {
  return {
    r1: Math.min(selection.anchor.r, selection.focus.r),
    r2: Math.max(selection.anchor.r, selection.focus.r),
    c1: Math.min(selection.anchor.c, selection.focus.c),
    c2: Math.max(selection.anchor.c, selection.focus.c),
  };
}

export {
  ROWS,
  COLS,
  DEFAULT_COL_WIDTH,
  DEFAULT_ROW_HEIGHT,
  HEADER_W,
  HEADER_H,
  MAX_COL_WIDTH,
  TOUCH_MIN,
};
