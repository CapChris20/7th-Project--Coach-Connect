// Spreadsheet formula engine. Turns "=SUM(A1:B2)" into a number the grid can show.
// Flow: read the cell text → walk the expression left to right → look up other cells →
//       call SUM/IF/ROUND and friends. A loop back to this cell is a circular-reference error.
// Used by the spreadsheet grid when a cell starts with "=".

import { keyOf, labelToCol } from './spreadsheetConstants';

// ===== NAMED CONSTANTS =====

const FN_NAMES = ['SUM', 'AVERAGE', 'AVG', 'COUNT', 'COUNTA', 'MIN', 'MAX', 'IF', 'ROUND', 'ABS', 'CONCAT', 'LEN', 'UPPER', 'LOWER'];
// Manipulate here: a mistyped name is only suggested when it is this close to a real function.
const MAX_FUNCTION_NAME_DISTANCE = 2;
const UNSET_LEVENSHTEIN_SCORE = 99;
const LETTER_A_CHAR_CODE = 65;
const EMPTY_FORMULA_ERROR = 'Empty formula';
const EXTRA_CLOSE_PAREN_ERROR = 'Extra closing parenthesis';
const MISSING_CLOSE_PAREN_ERROR = 'Missing closing parenthesis';
const UNEXPECTED_END_ERROR = 'Unexpected end';
const UNTERMINATED_STRING_ERROR = 'Unterminated string';
const DIVISION_BY_ZERO_ERROR = 'Division by zero';
const AVERAGE_EMPTY_ERROR = 'Division by zero (no numbers in AVERAGE)';

// ===== HELPER FUNCTIONS =====

/**
 * Edit distance between two strings. Used only to guess a nearby function name.
 * vocab: dp[i][j] = cost to turn the first i letters into the first j letters.
 * @param {string} leftText
 * @param {string} rightText
 * @returns {number}
 */
function levenshtein(leftText, rightText) {
  const leftLength = leftText.length;
  const rightLength = rightText.length;
  const distanceGrid = Array.from({ length: leftLength + 1 }, () => new Array(rightLength + 1).fill(0));
  for (let i = 0; i <= leftLength; i++) distanceGrid[i][0] = i;
  for (let j = 0; j <= rightLength; j++) distanceGrid[0][j] = j;
  fillLevenshteinCells(distanceGrid, leftText, rightText);
  return distanceGrid[leftLength][rightLength];
}

/**
 * @param {number[][]} distanceGrid
 * @param {string} leftText
 * @param {string} rightText
 */
function fillLevenshteinCells(distanceGrid, leftText, rightText) {
  for (let i = 1; i <= leftText.length; i++) {
    fillLevenshteinRow(distanceGrid, leftText, rightText, i);
  }
}

/**
 * @param {number[][]} distanceGrid
 * @param {string} leftText
 * @param {string} rightText
 * @param {number} i
 */
function fillLevenshteinRow(distanceGrid, leftText, rightText, i) {
  for (let j = 1; j <= rightText.length; j++) {
    const isSameLetter = leftText[i - 1] === rightText[j - 1];
    if (isSameLetter) {
      distanceGrid[i][j] = distanceGrid[i - 1][j - 1];
      continue;
    }
    distanceGrid[i][j] = 1 + Math.min(
      distanceGrid[i - 1][j],
      distanceGrid[i][j - 1],
      distanceGrid[i - 1][j - 1],
    );
  }
}

/**
 * Closest known function name, or null when nothing is within MAX_FUNCTION_NAME_DISTANCE.
 * @param {string} name
 * @returns {string|null}
 */
function suggestFn(name) {
  const upperName = name.toUpperCase();
  let bestName = null;
  let bestScore = UNSET_LEVENSHTEIN_SCORE;
  for (const functionName of FN_NAMES) {
    const editDistance = levenshtein(upperName, functionName);
    if (editDistance < bestScore && editDistance <= MAX_FUNCTION_NAME_DISTANCE) {
      bestScore = editDistance;
      bestName = functionName;
    }
  }
  return bestName;
}

/**
 * "B3" → row 2, column 1. Spreadsheet rows are 1-based on screen and 0-based in storage.
 * @param {string} referenceText
 * @returns {{ columnIndex: number, rowIndex: number }|null}
 */
function parseRef(referenceText) {
  const match = /^([A-Za-z]+)(\d+)$/.exec(String(referenceText || '').trim());
  if (!match) return null;
  return { columnIndex: labelToCol(match[1]), rowIndex: parseInt(match[2], 10) - 1 };
}

/**
 * Every cell from the top-left corner of the range to the bottom-right, inclusive.
 * @param {string} startRef
 * @param {string} endRef
 * @returns {Array<{ rowIndex: number, columnIndex: number }>}
 */
function expandRange(startRef, endRef) {
  const startCell = parseRef(startRef);
  const endCell = parseRef(endRef);
  if (!startCell || !endCell) return [];
  const firstRow = Math.min(startCell.rowIndex, endCell.rowIndex);
  const lastRow = Math.max(startCell.rowIndex, endCell.rowIndex);
  const firstColumn = Math.min(startCell.columnIndex, endCell.columnIndex);
  const lastColumn = Math.max(startCell.columnIndex, endCell.columnIndex);
  return cellsInRectangle(firstRow, lastRow, firstColumn, lastColumn);
}

/**
 * @param {number} firstRow
 * @param {number} lastRow
 * @param {number} firstColumn
 * @param {number} lastColumn
 * @returns {Array<{ rowIndex: number, columnIndex: number }>}
 */
function cellsInRectangle(firstRow, lastRow, firstColumn, lastColumn) {
  const cellsInRange = [];
  for (let rowIndex = firstRow; rowIndex <= lastRow; rowIndex++) {
    pushRowCells(cellsInRange, rowIndex, firstColumn, lastColumn);
  }
  return cellsInRange;
}

/**
 * @param {Array<{ rowIndex: number, columnIndex: number }>} cellsInRange
 * @param {number} rowIndex
 * @param {number} firstColumn
 * @param {number} lastColumn
 */
function pushRowCells(cellsInRange, rowIndex, firstColumn, lastColumn) {
  for (let columnIndex = firstColumn; columnIndex <= lastColumn; columnIndex++) {
    cellsInRange.push({ rowIndex, columnIndex });
  }
}

/**
 * Plain numbers stay numbers. Everything else (including "12 reps") stays text.
 * @param {*} raw
 * @returns {{ value: * }|null}
 */
function literalCellValue(raw) {
  if (String(raw).startsWith('=')) return null;
  const numericValue = Number(raw);
  const trimmedText = String(raw).trim();
  const isPlainNumber = trimmedText !== '' && !Number.isNaN(numericValue) && /^-?\d+(\.\d+)?$/.test(trimmedText);
  if (isPlainNumber) return { value: numericValue };
  return { value: raw };
}

/**
 * Unbalanced parentheses fail before we evaluate, so the error is about the formula, not a later cell.
 * @param {string} expression
 * @returns {string|null}
 */
function parenthesisBalanceError(expression) {
  let balance = 0;
  for (const character of expression) {
    balance += parenthesisDelta(character);
    if (balance < 0) return EXTRA_CLOSE_PAREN_ERROR;
  }
  if (balance > 0) return MISSING_CLOSE_PAREN_ERROR;
  return null;
}

/**
 * @param {string} character
 * @returns {number}
 */
function parenthesisDelta(character) {
  if (character === '(') return 1;
  if (character === ')') return -1;
  return 0;
}

/**
 * @param {string} sourceText
 * @param {object} cells
 * @param {Set<string>} visiting
 * @param {string|undefined} selfKey
 * @returns {*}
 */
function evalExpr(sourceText, cells, visiting, selfKey) {
  const parser = new Parser(sourceText, cells, visiting, selfKey);
  const value = parser.parseExpr();
  parser.skipWs();
  if (parser.pos < parser.src.length) throw new Error(`Unexpected '${parser.src[parser.pos]}'`);
  return value;
}

/**
 * Spreadsheet address for error text. Column 0 is A.
 * @param {number} rowIndex
 * @param {number} columnIndex
 * @returns {string}
 */
function labelOf(rowIndex, columnIndex) {
  return `${String.fromCharCode(LETTER_A_CHAR_CODE + columnIndex)}${rowIndex + 1}`;
}

/**
 * Formulas treat blank and true/false the way Excel does: blank → 0, true → 1.
 * @param {*} value
 * @returns {number}
 */
function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value == null || value === '') return 0;
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) throw new Error(`Expected number, got "${value}"`);
  return numericValue;
}

/**
 * @param {*} leftValue
 * @param {string} operator
 * @param {*} rightValue
 * @returns {*}
 */
function applyAddOperator(leftValue, operator, rightValue) {
  if (operator === '+') return toNumber(leftValue) + toNumber(rightValue);
  if (operator === '-') return toNumber(leftValue) - toNumber(rightValue);
  // vocab: ?? keeps 0. || would turn a numeric 0 into an empty string.
  return String(leftValue ?? '') + String(rightValue ?? '');
}

/**
 * @param {*} leftValue
 * @param {string} operator
 * @param {*} rightValue
 * @returns {number}
 */
function applyMulOperator(leftValue, operator, rightValue) {
  if (operator === '*') return toNumber(leftValue) * toNumber(rightValue);
  const divisor = toNumber(rightValue);
  if (divisor === 0) throw new Error(DIVISION_BY_ZERO_ERROR);
  return toNumber(leftValue) / divisor;
}

/**
 * @param {string} twoCharOperator
 * @param {*} leftValue
 * @param {*} rightValue
 * @returns {boolean}
 */
function applyTwoCharCompare(twoCharOperator, leftValue, rightValue) {
  if (twoCharOperator === '>=') return toNumber(leftValue) >= toNumber(rightValue);
  if (twoCharOperator === '<=') return toNumber(leftValue) <= toNumber(rightValue);
  // vocab: != is loose, matching Excel's "not equal" on mixed text/numbers.
  return leftValue != rightValue;
}

/**
 * @param {string} operator
 * @param {*} leftValue
 * @param {*} rightValue
 * @returns {boolean}
 */
function applyOneCharCompare(operator, leftValue, rightValue) {
  if (operator === '=') return leftValue == rightValue;
  if (operator === '>') return toNumber(leftValue) > toNumber(rightValue);
  return toNumber(leftValue) < toNumber(rightValue);
}

/**
 * Finite numbers only. COUNT ignores blanks and text.
 * @param {Array} args
 * @returns {number[]}
 */
function numericArgs(args) {
  return args
    .filter((argument) => argument !== null && argument !== '' && !Number.isNaN(Number(argument)))
    .map((argument) => Number(argument));
}

/**
 * @param {number[]} numbers
 * @returns {number}
 */
function averageOfNumbers(numbers) {
  if (numbers.length === 0) throw new Error(AVERAGE_EMPTY_ERROR);
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

/**
 * Built-in spreadsheet functions. Unknown names get a "did you mean" hint when close.
 * @param {string} name
 * @param {Array} args
 * @param {string} original
 * @returns {*}
 */
function callFn(name, args, original) {
  if (name === 'SUM') return numericArgs(args).reduce((sum, value) => sum + value, 0);
  if (name === 'AVG' || name === 'AVERAGE') return averageOfNumbers(numericArgs(args));
  if (name === 'COUNT') return numericArgs(args).length;
  if (name === 'COUNTA') return args.filter((argument) => argument !== null && argument !== '' && argument !== undefined).length;
  if (name === 'MIN') {
    const numbers = numericArgs(args);
    return numbers.length ? Math.min(...numbers) : 0;
  }
  if (name === 'MAX') {
    const numbers = numericArgs(args);
    return numbers.length ? Math.max(...numbers) : 0;
  }
  if (name === 'IF') return args[0] ? args[1] : args[2];
  if (name === 'ROUND') {
    const places = Number(args[1] || 0);
    const factor = Math.pow(10, places);
    return Math.round(Number(args[0]) * factor) / factor;
  }
  if (name === 'ABS') return Math.abs(Number(args[0]));
  if (name === 'CONCAT') return args.map((argument) => String(argument ?? '')).join('');
  if (name === 'LEN') return String(args[0] ?? '').length;
  if (name === 'UPPER') return String(args[0] ?? '').toUpperCase();
  if (name === 'LOWER') return String(args[0] ?? '').toLowerCase();
  const suggestion = suggestFn(original);
  const hint = suggestion ? ` — did you mean ${suggestion}?` : '';
  throw new Error(`Unknown function ${original}${hint}`);
}

class Parser {
  constructor(src, cells, visiting, selfKey) {
    this.src = src;
    this.cells = cells;
    this.visiting = visiting;
    this.selfKey = selfKey;
    this.pos = 0;
  }

  skipWs() {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) this.pos++;
  }

  eat(character) {
    this.skipWs();
    if (this.src[this.pos] === character) {
      this.pos++;
      return true;
    }
    return false;
  }

  parseExpr() {
    return this.parseCompare();
  }

  parseCompare() {
    const leftValue = this.parseAdd();
    this.skipWs();
    const twoCharOperator = this.src.substr(this.pos, 2);
    if (twoCharOperator === '>=' || twoCharOperator === '<=' || twoCharOperator === '<>') {
      this.pos += 2;
      return applyTwoCharCompare(twoCharOperator, leftValue, this.parseAdd());
    }
    const operator = this.src[this.pos];
    if (operator === '=' || operator === '>' || operator === '<') {
      this.pos++;
      return applyOneCharCompare(operator, leftValue, this.parseAdd());
    }
    return leftValue;
  }

  parseAdd() {
    let leftValue = this.parseMul();
    // while(true)+break keeps "+", "-", and "&" in one loop without rewriting to while remaining>=0.
    while (true) {
      this.skipWs();
      const operator = this.src[this.pos];
      if (operator !== '+' && operator !== '-' && operator !== '&') break;
      this.pos++;
      leftValue = applyAddOperator(leftValue, operator, this.parseMul());
    }
    return leftValue;
  }

  parseMul() {
    let leftValue = this.parseUnary();
    while (true) {
      this.skipWs();
      const operator = this.src[this.pos];
      if (operator !== '*' && operator !== '/') break;
      this.pos++;
      leftValue = applyMulOperator(leftValue, operator, this.parseUnary());
    }
    return leftValue;
  }

  parseUnary() {
    this.skipWs();
    if (this.src[this.pos] === '-') {
      this.pos++;
      return -toNumber(this.parseUnary());
    }
    if (this.src[this.pos] === '+') {
      this.pos++;
      return this.parseUnary();
    }
    return this.parsePower();
  }

  parsePower() {
    const leftValue = this.parsePrimary();
    this.skipWs();
    if (this.src[this.pos] === '^') {
      this.pos++;
      return Math.pow(toNumber(leftValue), toNumber(this.parseUnary()));
    }
    return leftValue;
  }

  parsePrimary() {
    this.skipWs();
    const character = this.src[this.pos];
    if (!character) throw new Error(UNEXPECTED_END_ERROR);
    if (character === '(') return this.parseGroupedExpression();
    if (character === '"') return this.parseQuotedString();
    if (/[0-9.]/.test(character)) return this.parseNumberLiteral();
    if (/[A-Za-z_]/.test(character)) return this.parseNameOrReference();
    throw new Error(`Unexpected '${character}'`);
  }

  parseGroupedExpression() {
    this.pos++;
    const value = this.parseExpr();
    if (!this.eat(')')) throw new Error(MISSING_CLOSE_PAREN_ERROR);
    return value;
  }

  parseQuotedString() {
    this.pos++;
    let text = '';
    while (this.pos < this.src.length && this.src[this.pos] !== '"') text += this.src[this.pos++];
    if (this.src[this.pos] !== '"') throw new Error(UNTERMINATED_STRING_ERROR);
    this.pos++;
    return text;
  }

  parseNumberLiteral() {
    let digits = '';
    while (this.pos < this.src.length && /[0-9.]/.test(this.src[this.pos])) digits += this.src[this.pos++];
    if (this.src[this.pos] === '%') {
      this.pos++;
      return parseFloat(digits) / 100;
    }
    return parseFloat(digits);
  }

  parseNameOrReference() {
    let identifier = '';
    while (this.pos < this.src.length && /[A-Za-z0-9_]/.test(this.src[this.pos])) identifier += this.src[this.pos++];
    this.skipWs();
    if (this.src[this.pos] === '(') return this.parseFunctionCall(identifier);
    const cellRef = parseRef(identifier);
    if (cellRef) return this.readRef(cellRef.rowIndex, cellRef.columnIndex);
    if (identifier.toUpperCase() === 'TRUE') return true;
    if (identifier.toUpperCase() === 'FALSE') return false;
    throw new Error(`Unknown name ${identifier}`);
  }

  parseFunctionCall(identifier) {
    this.pos++;
    const argumentValues = this.parseFunctionArguments();
    if (!this.eat(')')) throw new Error(MISSING_CLOSE_PAREN_ERROR);
    return callFn(identifier.toUpperCase(), argumentValues, identifier);
  }

  parseFunctionArguments() {
    const argumentValues = [];
    if (this.src[this.pos] === ')') return argumentValues;
    this.pushOneFunctionArgument(argumentValues);
    while (this.eat(',')) this.pushOneFunctionArgument(argumentValues);
    return argumentValues;
  }

  pushOneFunctionArgument(argumentValues) {
    const startPos = this.pos;
    this.skipWs();
    const rangeMatch = /^([A-Za-z]+\d+)\s*:\s*([A-Za-z]+\d+)/.exec(this.src.slice(this.pos));
    if (!rangeMatch) {
      this.pos = startPos;
      argumentValues.push(this.parseExpr());
      return;
    }
    this.pos += rangeMatch[0].length;
    const refs = expandRange(rangeMatch[1], rangeMatch[2]);
    for (const cellRef of refs) {
      argumentValues.push(this.readRef(cellRef.rowIndex, cellRef.columnIndex));
    }
  }

  readRef(rowIndex, columnIndex) {
    const cellKey = keyOf(rowIndex, columnIndex);
    if (cellKey === this.selfKey) throw new Error(`Circular reference: ${cellKey}`);
    if (this.visiting.has(cellKey)) throw new Error(`Circular reference at ${labelOf(rowIndex, columnIndex)}`);
    const cell = this.cells[cellKey];
    if (!cell || !cell.raw) return 0;
    this.visiting.add(cellKey);
    const result = evaluateCell(cell.raw, this.cells, this.visiting, cellKey);
    this.visiting.delete(cellKey);
    if (result.error) throw new Error(result.error);
    return coercedCellNumber(result.value);
  }
}

/**
 * A numeric string from another cell is treated as a number so SUM(A1) works when A1 is "12".
 * @param {*} value
 * @returns {*}
 */
function coercedCellNumber(value) {
  if (typeof value === 'string') {
    const numericValue = Number(value);
    if (!Number.isNaN(numericValue) && value.trim() !== '') return numericValue;
  }
  return value ?? 0;
}

// ===== MAIN FUNCTION =====

/**
 * Evaluate one cell. visiting tracks the path of references so A1→B1→A1 errors instead of looping.
 * @param {*} raw
 * @param {object} cells
 * @param {Set<string>} [visiting]
 * @param {string} [selfKey]
 * @returns {{ value: *, error?: string }}
 */
export function evaluateCell(raw, cells, visiting = new Set(), selfKey) {
  if (raw == null || raw === '') return { value: null };
  const literalValue = literalCellValue(raw);
  if (literalValue) return literalValue;

  const expression = String(raw).slice(1).trim();
  if (!expression) return { value: null, error: EMPTY_FORMULA_ERROR };

  const balanceError = parenthesisBalanceError(expression);
  if (balanceError) return { value: null, error: balanceError };

  try {
    if (selfKey) visiting.add(selfKey);
    const value = evalExpr(expression, cells, visiting, selfKey);
    if (selfKey) visiting.delete(selfKey);
    return { value };
  } catch (error) {
    if (selfKey) visiting.delete(selfKey);
    return { value: null, error: error.message || 'Error' };
  }
}
