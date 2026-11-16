// Formula calculator for spreadsheet cells.
// Flow: check for formula prefix "=" → parse function or expression → compute result.
// Used by: SpreadsheetEditor and SpreadsheetGrid.

import { indexFromColumnLabel } from './spreadsheetConstants';

// ===== NAMED CONSTANTS =====

const PREFIX_FORMULA = '=';
const ERROR_CIRCULAR = '#REF!';
const ERROR_VALUE = '#VALUE!';
const ERROR_DIV_ZERO = '#DIV/0!';
const ERROR_NAME = '#NAME?';

// ===== HELPER FUNCTIONS =====

/**
 * Check if cell text is a formula.
 * @param {*} cellValue
 * @returns {boolean}
 */
export function isFormulaCell(cellValue) {
  if (typeof cellValue !== 'string') return false;
  return cellValue.trim().startsWith(PREFIX_FORMULA);
}

/**
 * Parse an Excel-like cell reference (e.g. "B2", "C10") into grid coordinates.
 * @param {string} referenceText
 * @returns {{ rowIndex: number, columnIndex: number }|null}
 */
function parseCellReference(referenceText) {
  const matchResult = String(referenceText || '').trim().match(/^([A-Za-z]+)(\d+)$/);
  if (!matchResult) return null;

  const columnLetters = matchResult[1];
  const rowDigits = matchResult[2];
  const zeroBasedColumn = indexFromColumnLabel(columnLetters);
  const oneBasedRow = parseInt(rowDigits, 10);

  return { rowIndex: oneBasedRow, columnIndex: zeroBasedColumn + 1 };
}

/**
 * Get numeric value of a single cell from 2D rows.
 * @param {string[][]} gridRows
 * @param {number} rowIndex
 * @param {number} columnIndex
 * @returns {number|null}
 */
function numericCellValue(gridRows, rowIndex, columnIndex) {
  if (!gridRows || rowIndex >= gridRows.length) return null;
  const targetRow = gridRows[rowIndex];
  if (!targetRow || columnIndex >= targetRow.length) return null;

  const rawText = String(targetRow[columnIndex] || '').trim();
  if (rawText === '') return null;

  const parsedNumber = Number(rawText);
  if (Number.isFinite(parsedNumber)) return parsedNumber;

  const firstIntegerMatch = rawText.match(/^-?\d+(\.\d+)?/);
  if (firstIntegerMatch) {
    const extractedNumber = Number(firstIntegerMatch[0]);
    if (Number.isFinite(extractedNumber)) return extractedNumber;
  }

  return null;
}

/**
 * Collect numbers from one horizontal row within the rectangle.
 */
function collectRowNumbers(gridRows, rowIndex, leftColumn, rightColumn) {
  const rowNumbers = [];
  for (let columnIndex = leftColumn; columnIndex <= rightColumn; columnIndex += 1) {
    const cellNumber = numericCellValue(gridRows, rowIndex, columnIndex);
    if (cellNumber !== null) rowNumbers.push(cellNumber);
  }
  return rowNumbers;
}

/**
 * Collect all numeric values in a rectangular cell range (e.g. "B2:B5").
 */
function collectRangeValues(gridRows, startRef, endRef) {
  const startCoordinates = parseCellReference(startRef);
  const endCoordinates = parseCellReference(endRef);
  if (!startCoordinates || !endCoordinates) return [];

  const topRow = Math.min(startCoordinates.rowIndex, endCoordinates.rowIndex);
  const bottomRow = Math.max(startCoordinates.rowIndex, endCoordinates.rowIndex);
  const leftColumn = Math.min(startCoordinates.columnIndex, endCoordinates.columnIndex);
  const rightColumn = Math.max(startCoordinates.columnIndex, endCoordinates.columnIndex);

  const collectedNumbers = [];
  for (let rowIndex = topRow; rowIndex <= bottomRow; rowIndex += 1) {
    const numbersInRow = collectRowNumbers(gridRows, rowIndex, leftColumn, rightColumn);
    collectedNumbers.push(...numbersInRow);
  }

  return collectedNumbers;
}

/**
 * Compute aggregate function result over a number array.
 */
function computeAggregate(functionName, numberList) {
  if (numberList.length === 0) return 0;

  if (functionName === 'SUM') {
    return numberList.reduce((runningTotal, nextValue) => runningTotal + nextValue, 0);
  }

  if (functionName === 'AVERAGE' || functionName === 'AVG') {
    const totalSum = numberList.reduce((runningTotal, nextValue) => runningTotal + nextValue, 0);
    return Math.round((totalSum / numberList.length) * 100) / 100;
  }

  if (functionName === 'COUNT') return numberList.length;
  if (functionName === 'MIN') return Math.min(...numberList);
  if (functionName === 'MAX') return Math.max(...numberList);

  return ERROR_NAME;
}

/**
 * Parse comma-separated references like "B2, B3, B4".
 */
function collectCommaNumbers(gridRows, commaSeparatedRefs) {
  const singleRefs = commaSeparatedRefs.split(',');
  const collectedNumbers = [];
  for (let index = 0; index < singleRefs.length; index += 1) {
    const cellCoordinates = parseCellReference(singleRefs[index]);
    const cellValue = cellCoordinates ? numericCellValue(gridRows, cellCoordinates.rowIndex, cellCoordinates.columnIndex) : null;
    if (cellValue !== null) collectedNumbers.push(cellValue);
  }
  return collectedNumbers;
}

/**
 * Evaluate function calls like SUM(B2:B5) or AVG(C1,C2).
 */
function evaluateFunctionFormula(functionName, argumentsText, gridRows) {
  const rangeParts = argumentsText.split(':');
  if (rangeParts.length === 2) {
    const rangeNumbers = collectRangeValues(gridRows, rangeParts[0], rangeParts[1]);
    return String(computeAggregate(functionName, rangeNumbers));
  }

  const commaNumbers = collectCommaNumbers(gridRows, argumentsText);
  return String(computeAggregate(functionName, commaNumbers));
}

/**
 * Evaluate simple binary math expressions like "=B2+B3" or "=B2*2".
 */
function evaluateArithmeticFormula(arithmeticMatch, gridRows) {
  const leftCoords = parseCellReference(arithmeticMatch[1]);
  const operator = arithmeticMatch[2];
  const rightOperandText = arithmeticMatch[3];

  const leftNumber = leftCoords ? numericCellValue(gridRows, leftCoords.rowIndex, leftCoords.columnIndex) || 0 : 0;
  const rightCoords = parseCellReference(rightOperandText);
  const rightNumber = rightCoords ? numericCellValue(gridRows, rightCoords.rowIndex, rightCoords.columnIndex) || 0 : Number(rightOperandText) || 0;

  if (operator === '+') return String(leftNumber + rightNumber);
  if (operator === '-') return String(leftNumber - rightNumber);
  if (operator === '*') return String(leftNumber * rightNumber);
  if (operator === '/') {
    if (rightNumber === 0) return ERROR_DIV_ZERO;
    return String(Math.round((leftNumber / rightNumber) * 100) / 100);
  }
  return ERROR_VALUE;
}

// ===== MAIN FUNCTION =====

/**
 * Calculate the displayed result for a spreadsheet formula.
 * Flow: 1. check prefix  2. test function match  3. test arithmetic  4. lookup single ref
 * @param {string} formulaText
 * @param {string[][]} gridRows
 * @returns {string}
 */
export function calculateFormulaValue(formulaText, gridRows) {
  // 1. If not a formula, return the text unchanged
  if (!isFormulaCell(formulaText)) {
    return String(formulaText || '');
  }

  const cleanFormula = formulaText.trim().slice(1).trim();

  // 2. Check for function formulas like SUM(B2:B5)
  const functionMatch = cleanFormula.match(/^([A-Za-z]+)\(([^)]+)\)$/);
  if (functionMatch) {
    const functionName = functionMatch[1].toUpperCase();
    const argumentsText = functionMatch[2];
    return evaluateFunctionFormula(functionName, argumentsText, gridRows);
  }

  // 3. Check for simple two-cell arithmetic like "=B2+B3"
  const arithmeticMatch = cleanFormula.match(/^([A-Za-z]+\d+)\s*([\+\-\*\/])\s*([A-Za-z]+\d+|\d+)$/);
  if (arithmeticMatch) {
    return evaluateArithmeticFormula(arithmeticMatch, gridRows);
  }

  // 4. Single cell reference like "=B2"
  const singleCellRef = parseCellReference(cleanFormula);
  if (singleCellRef) {
    const targetRow = gridRows[singleCellRef.rowIndex];
    const cellValue = targetRow && singleCellRef.columnIndex < targetRow.length ? targetRow[singleCellRef.columnIndex] : '';
    return String(cellValue || '');
  }

  return formulaText;
}
