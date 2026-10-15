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
 * Append one base-26 digit (A–Z) onto the front of the letter string, then shift remaining.
 * @param {number} remaining
 * @param {string} lettersSoFar
 * @returns {{ remaining: number, letters: string }}
 */
function takeNextColumnLetter(remaining, lettersSoFar) {
  const digitIndex = remaining % ALPHABET_SIZE;
  const nextLetter = String.fromCharCode(LETTER_A_CHAR_CODE + digitIndex);
  const nextRemaining = Math.floor(remaining / ALPHABET_SIZE) - 1;
  return {
    remaining: nextRemaining,
    letters: nextLetter + lettersSoFar,
  };
}

/**
 * Base-26 with no zero digit. A is both the first letter and the value 0, so the carry subtracts 1.
 * vocab: String.fromCharCode(65) is capital A.
 * @param {number} columnIndex
 * @returns {string}
 */
function columnLetters(columnIndex) {
  let letters = '';
  let remaining = columnIndex;
  while (remaining >= 0) {
    const step = takeNextColumnLetter(remaining, letters);
    letters = step.letters;
    remaining = step.remaining;
  }
  return letters;
}

/**
 * One letter of a column label → its 1-based alphabet value (A=1 … Z=26).
 * @param {string} letter
 * @returns {number}
 */
function letterToOneBasedValue(letter) {
  return letter.charCodeAt(0) - LETTER_A_ONE_BASED;
}

/**
 * Short random suffix used in new sheet ids.
 * vocab: toString(36) makes a short id from random digits and letters.
 * @returns {string}
 */
function randomSheetIdSuffix() {
  return Math.random().toString(RANDOM_ID_RADIX).slice(RANDOM_ID_START, RANDOM_ID_END);
}

// ===== MAIN FUNCTION =====

/**
 * Column index 0 → "A", 25 → "Z", 26 → "AA".
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
  const upperLabel = label.toUpperCase();
  for (const letter of upperLabel) {
    columnNumber = columnNumber * ALPHABET_SIZE + letterToOneBasedValue(letter);
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
 * @param {number} sheetIndex
 * @returns {object}
 */
export const newSheet = (sheetIndex) => ({
  id: `s${sheetIndex}-${randomSheetIdSuffix()}`,
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
  const topRow = Math.min(selection.anchor.r, selection.focus.r);
  const bottomRow = Math.max(selection.anchor.r, selection.focus.r);
  const leftColumn = Math.min(selection.anchor.c, selection.focus.c);
  const rightColumn = Math.max(selection.anchor.c, selection.focus.c);
  return {
    r1: topRow,
    r2: bottomRow,
    c1: leftColumn,
    c2: rightColumn,
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
