// Constants and coordinate converters for the spreadsheet editor.
// Flow: grid sizes → column letter conversions → starter program rows.
// Used by: SpreadsheetEditor and SpreadsheetGrid.

// ===== NAMED CONSTANTS =====

export const DEFAULT_ROW_COUNT = 30;
export const DEFAULT_COLUMN_COUNT = 10;
export const MIN_COLUMN_COUNT = 6;
export const MIN_ROW_COUNT = 15;

export const COLUMN_WIDTH_STICKY = 120;
export const COLUMN_WIDTH_STANDARD = 110;
export const ROW_HEIGHT_STANDARD = 44;
export const ROW_HEIGHT_HEADER = 40;

const CHAR_CODE_CAPITAL_A = 65;
const ALPHABET_LENGTH = 26;

// Starter program templates for the "Custom program" option
export const PROGRAM_DAYS = ['MON', 'WED', 'FRI'];
export const PROGRAM_EXERCISES = [
  'Box squat',
  'Romanian deadlift',
  'Split squat',
  'Hip thrust',
  'Calf raise',
  'Total sets',
];

// ===== HELPER FUNCTIONS =====

/**
 * Convert zero-based column index to letter label (0 -> "A", 1 -> "B", 25 -> "Z", 26 -> "AA").
 * @param {number} columnIndex
 * @returns {string}
 */
export function columnLabelFromIndex(columnIndex) {
  let remaining = columnIndex;
  let labelLetters = '';

  while (remaining >= 0) {
    const letterCode = CHAR_CODE_CAPITAL_A + (remaining % ALPHABET_LENGTH);
    labelLetters = String.fromCharCode(letterCode) + labelLetters;
    remaining = Math.floor(remaining / ALPHABET_LENGTH) - 1;
  }

  return labelLetters;
}

/**
 * Convert letter label to zero-based column index ("A" -> 0, "B" -> 1, "AA" -> 26).
 * @param {string} columnText
 * @returns {number}
 */
export function indexFromColumnLabel(columnText) {
  const upperText = String(columnText || '').trim().toUpperCase();
  let calculatedIndex = 0;

  for (let characterIndex = 0; characterIndex < upperText.length; characterIndex += 1) {
    const charCode = upperText.charCodeAt(characterIndex) - CHAR_CODE_CAPITAL_A + 1;
    calculatedIndex = calculatedIndex * ALPHABET_LENGTH + charCode;
  }

  return calculatedIndex - 1;
}

/**
 * Storage key for row and column coordinates.
 * @param {number} rowIndex
 * @param {number} columnIndex
 * @returns {string}
 */
export function coordinateKey(rowIndex, columnIndex) {
  return `${rowIndex},${columnIndex}`;
}

/**
 * Parse storage key back into row and column coordinates.
 * @param {string} storageKey
 * @returns {{ rowIndex: number, columnIndex: number }}
 */
export function parseCoordinateKey(storageKey) {
  const parts = String(storageKey || '').split(',');
  const parsedRow = parseInt(parts[0], 10) || 0;
  const parsedColumn = parseInt(parts[1], 10) || 0;
  return { rowIndex: parsedRow, columnIndex: parsedColumn };
}

// ===== MAIN FUNCTION =====

/**
 * Build starter rows for a blank general spreadsheet.
 * Flow: 1. header row with column labels  2. empty body rows  3. return combined rows
 * @param {number} rowCount
 * @param {number} columnCount
 * @returns {string[][]}
 */
export function buildBlankGridRows(rowCount = DEFAULT_ROW_COUNT, columnCount = DEFAULT_COLUMN_COUNT) {
  // 1. Header row starts with empty corner, then column labels A, B, C...
  const headerRow = [''];
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    headerRow.push(columnLabelFromIndex(columnIndex));
  }

  // 2. Build body rows with row numbers in first column and empty cells
  const gridRows = [headerRow];
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const bodyRow = [String(rowIndex + 1)];
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      bodyRow.push('');
    }
    gridRows.push(bodyRow);
  }

  // 3. Return the 2D grid
  return gridRows;
}

/**
 * Build starter rows for a "Custom program" workout sheet (matching screenshots).
 * Flow: 1. define exercises and days  2. build exercise rows  3. return starter grid
 * @returns {string[][]}
 */
export function buildCustomProgramStarterRows() {
  // 1. Columns: Exercise name, then training days
  const headerRow = ['EXERCISE', 'MON', 'WED', 'FRI'];

  // 2. Pre-populated rows matching the design screenshots
  const gridRows = [
    headerRow,
    ['Box squat', '3×8 @ 135', '3×8 @ 140', '3×8 @ 145'],
    ['Romanian deadlift', '3×10 @ 115', '3×10 @ 115', '3×10 @ 120'],
    ['Split squat', '2×10 @ 25', '2×10 @ 30', '2×10 @ 30'],
    ['Hip thrust', '3×10 @ 135', '3×10 @ 145', '3×10 @ 150'],
    ['Calf raise', '3×15', '3×15', '3×15'],
    ['Total sets', '11', '11', '11'],
  ];

  // 3. Return the program grid
  return gridRows;
}

/**
 * Build starter week sheets for a custom multi-week program.
 * Flow: 1. loop week numbers  2. create week sheet  3. return sheets list
 * @param {number} weekCount
 * @returns {Array<{ id: string, name: string, rows: string[][] }>}
 */
export function buildStarterWeekSheets(weekCount = 4) {
  const weekSheets = [];

  for (let weekIndex = 1; weekIndex <= weekCount; weekIndex += 1) {
    const weekId = `week-${weekIndex}-${Date.now()}`;
    const weekName = `Week ${weekIndex}`;
    const starterRows = buildCustomProgramStarterRows();
    weekSheets.push({
      id: weekId,
      name: weekName,
      rows: starterRows,
    });
  }

  return weekSheets;
}
