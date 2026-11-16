// Unit tests for SpreadsheetEditor constants, formula calculations, and formatting.

import {
  columnLabelFromIndex,
  indexFromColumnLabel,
  coordinateKey,
  parseCoordinateKey,
  buildBlankGridRows,
  buildCustomProgramStarterRows,
  buildStarterWeekSheets,
} from '../../src/trainer-app/documents/spreadsheet-grid/spreadsheetConstants';
import {
  calculateFormulaValue,
  isFormulaCell,
} from '../../src/trainer-app/documents/spreadsheet-grid/formulaCalculator';
import {
  formatCellValue,
  isNumericText,
  FORMAT_TYPE_CURRENCY,
  FORMAT_TYPE_NUMBER,
  FORMAT_TYPE_PERCENT,
  FORMAT_TYPE_TEXT,
} from '../../src/trainer-app/documents/spreadsheet-grid/cellFormatting';

describe('Spreadsheet constants and coordinate conversions', () => {
  it('converts column index to letter and back', () => {
    expect(columnLabelFromIndex(0)).toBe('A');
    expect(columnLabelFromIndex(1)).toBe('B');
    expect(columnLabelFromIndex(25)).toBe('Z');
    expect(columnLabelFromIndex(26)).toBe('AA');

    expect(indexFromColumnLabel('A')).toBe(0);
    expect(indexFromColumnLabel('B')).toBe(1);
    expect(indexFromColumnLabel('Z')).toBe(25);
    expect(indexFromColumnLabel('AA')).toBe(26);
  });

  it('coordinates key serialize and deserialize', () => {
    const key = coordinateKey(3, 2);
    expect(key).toBe('3,2');
    const parsed = parseCoordinateKey(key);
    expect(parsed.rowIndex).toBe(3);
    expect(parsed.columnIndex).toBe(2);
  });

  it('builds starter rows for custom program and blank grid', () => {
    const programRows = buildCustomProgramStarterRows();
    expect(programRows.length).toBeGreaterThan(5);
    expect(programRows[0]).toEqual(['EXERCISE', 'MON', 'WED', 'FRI']);
    expect(programRows[1][0]).toBe('Box squat');

    const blankRows = buildBlankGridRows(5, 4);
    expect(blankRows.length).toBe(6); // 1 header + 5 rows
    expect(blankRows[0][1]).toBe('A');

    const weekSheets = buildStarterWeekSheets(4);
    expect(weekSheets.length).toBe(4);
    expect(weekSheets[0].name).toBe('Week 1');
  });
});

describe('Formula calculator', () => {
  const sampleGrid = [
    ['EXERCISE', 'MON', 'WED', 'FRI'],
    ['Box squat', '8', '10', '12'],
    ['Romanian deadlift', '5', '5', '5'],
    ['Split squat', '10', '15', '20'],
  ];

  it('detects formula cells', () => {
    expect(isFormulaCell('=SUM(A1:A3)')).toBe(true);
    expect(isFormulaCell('Plain text')).toBe(false);
  });

  it('calculates SUM over ranges', () => {
    // MON column: row 1 is 8, row 2 is 5, row 3 is 10. In grid column index 1 corresponds to A (0+1)
    const sumResult = calculateFormulaValue('=SUM(A1:A3)', sampleGrid);
    expect(sumResult).toBe('23');
  });

  it('calculates AVERAGE over ranges', () => {
    const avgResult = calculateFormulaValue('=AVG(A1:A3)', sampleGrid);
    expect(avgResult).toBe('7.67');
  });

  it('calculates simple two-cell arithmetic', () => {
    const plusResult = calculateFormulaValue('=A1+A2', sampleGrid);
    expect(plusResult).toBe('13');
  });
});

describe('Cell formatting', () => {
  it('detects numeric strings', () => {
    expect(isNumericText('123')).toBe(true);
    expect(isNumericText('123.45')).toBe(true);
    expect(isNumericText('not a number')).toBe(false);
    expect(isNumericText('')).toBe(false);
  });

  it('formats currency, percent, and numbers', () => {
    expect(formatCellValue('135', FORMAT_TYPE_CURRENCY)).toBe('$135.00');
    expect(formatCellValue('0.25', FORMAT_TYPE_PERCENT)).toBe('25%');
    expect(formatCellValue('hello', FORMAT_TYPE_TEXT)).toBe('hello');
    expect(formatCellValue('123', FORMAT_TYPE_NUMBER)).toBe('123');
  });
});
