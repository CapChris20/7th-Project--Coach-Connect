// Export spreadsheet rows to CSV or PDF documents for sharing and download.
// Flow: read rows → generate CSV string or HTML print page → share file with device sheet.
// Used by: SheetMenuModal in SpreadsheetEditor.

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

// ===== NAMED CONSTANTS =====

const DEFAULT_FILE_NAME = 'Spreadsheet';
const CSV_LINE_SEPARATOR = '\n';
const CSV_CELL_SEPARATOR = ',';

// ===== HELPER FUNCTIONS =====

/**
 * Escape a cell value for standard CSV compliance.
 */
function escapeCsvCell(cellValue) {
  const cellString = String(cellValue || '');
  if (/[",\n\r]/.test(cellString)) {
    return `"${cellString.replace(/"/g, '""')}"`;
  }
  return cellString;
}

/**
 * Convert a single row into a comma-separated line.
 */
function rowToCsvLine(rowCells) {
  const cellsList = Array.isArray(rowCells) ? rowCells : [];
  return cellsList.map(escapeCsvCell).join(CSV_CELL_SEPARATOR);
}

/**
 * Generate full CSV text from a 2D array of rows.
 */
export function generateCsvText(gridRows) {
  const rowList = Array.isArray(gridRows) ? gridRows : [];
  return rowList.map(rowToCsvLine).join(CSV_LINE_SEPARATOR);
}

/**
 * Build HTML table row for PDF generation.
 */
function buildHtmlTableRow(rowCells, isHeaderRow) {
  const cellTag = isHeaderRow ? 'th' : 'td';
  const headerStyle = 'background-color: #E5E2DC; font-weight: bold;';
  const cellStyle = isHeaderRow ? headerStyle : 'background-color: #FFFFFF;';

  const cellsList = Array.isArray(rowCells) ? rowCells : [];
  const cellsHtml = cellsList
    .map((cellText) => `<${cellTag} style="border: 2px solid #000; padding: 8px 12px; font-family: monospace; ${cellStyle}">${String(cellText || '')}</${cellTag}>`)
    .join('');

  return `<tr>${cellsHtml}</tr>`;
}

/**
 * Generate printable HTML document from spreadsheet data.
 */
function buildSpreadsheetHtml(documentTitle, gridRows) {
  const rowsList = Array.isArray(gridRows) ? gridRows : [];
  const rowsHtml = rowsList
    .map((rowCells, rowIndex) => buildHtmlTableRow(rowCells, rowIndex === 0))
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${documentTitle}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #000; }
          h1 { font-size: 24px; font-weight: 800; margin-bottom: 4px; }
          p { color: #666; margin-bottom: 20px; font-size: 14px; }
          table { border-collapse: collapse; width: 100%; border: 3px solid #000; }
        </style>
      </head>
      <body>
        <h1>${documentTitle}</h1>
        <p>Coach Connect Spreadsheet Program</p>
        <table>${rowsHtml}</table>
      </body>
    </html>
  `;
}

// ===== MAIN FUNCTION =====

/**
 * Export spreadsheet data as CSV file and open sharing popup.
 * Flow: 1. build CSV  2. write to cache  3. trigger sharing
 * @param {string} documentTitle
 * @param {string[][]} gridRows
 * @returns {Promise<boolean>}
 */
export async function exportSpreadsheetAsCsv(documentTitle, gridRows) {
  // 1. Convert rows to CSV text
  const cleanTitle = (documentTitle || DEFAULT_FILE_NAME).replace(/[^a-zA-Z0-9_\-]/g, '_');
  const csvContent = generateCsvText(gridRows);
  const cacheDirectory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  const filePath = `${cacheDirectory}${cleanTitle}.csv`;

  // 2. Write CSV string into local cache
  await FileSystem.writeAsStringAsync(filePath, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  // 3. Open native sharing sheet if available
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'text/csv',
      dialogTitle: `Share ${documentTitle}`,
      UTI: 'public.comma-separated-values-text',
    });
    return true;
  }

  return false;
}

/**
 * Export spreadsheet data as PDF document and open sharing popup.
 * Flow: 1. build HTML  2. print to PDF  3. trigger sharing
 * @param {string} documentTitle
 * @param {string[][]} gridRows
 * @returns {Promise<boolean>}
 */
export async function exportSpreadsheetAsPdf(documentTitle, gridRows) {
  // 1. Build styled HTML markup
  const htmlContent = buildSpreadsheetHtml(documentTitle || DEFAULT_FILE_NAME, gridRows);

  // 2. Print HTML to temporary PDF file
  const printResult = await Print.printToFileAsync({ html: htmlContent });
  const pdfUri = printResult.uri;

  // 3. Open native sharing sheet
  const canShare = await Sharing.isAvailableAsync();
  if (canShare && pdfUri) {
    await Sharing.shareAsync(pdfUri, {
      mimeType: 'application/pdf',
      dialogTitle: `Export ${documentTitle}`,
      UTI: 'com.adobe.pdf',
    });
    return true;
  }

  return false;
}
