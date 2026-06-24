import { colLabel, keyOf, newSheet } from './types';

const NF_TO_FORMAT = {
  currency: 'currency',
  percent: 'percent',
  decimal0: 'number',
  decimal2: 'number',
  date: 'date',
};

function legacyFormatToCell(raw, fmt = {}) {
  const value = raw == null ? '' : String(raw);
  if (!value && !fmt) return null;
  const cell = { raw: value };
  if (fmt?.numberFormat) cell.format = NF_TO_FORMAT[fmt.numberFormat] || 'text';
  if (fmt?.currency) cell.currency = fmt.currency;
  const style = {};
  if (fmt?.bold) style.bold = true;
  if (fmt?.italic) style.italic = true;
  if (fmt?.underline) style.underline = true;
  if (fmt?.strike) style.strike = true;
  if (fmt?.color) style.color = fmt.color;
  if (fmt?.bg) style.fill = fmt.bg;
  if (fmt?.align) style.align = fmt.align;
  if (Object.keys(style).length) cell.style = style;
  if (!cell.raw && !cell.format && !cell.style) return null;
  return cell;
}

function cellToLegacyFormat(cell) {
  const fmt = {};
  if (cell.format === 'currency') fmt.numberFormat = 'currency';
  else if (cell.format === 'percent') fmt.numberFormat = 'percent';
  else if (cell.format === 'number') fmt.numberFormat = 'decimal2';
  else if (cell.format === 'date') fmt.numberFormat = 'date';
  if (cell.currency) fmt.currency = cell.currency;
  if (cell.style?.bold) fmt.bold = true;
  if (cell.style?.italic) fmt.italic = true;
  if (cell.style?.underline) fmt.underline = true;
  if (cell.style?.strike) fmt.strike = true;
  if (cell.style?.color) fmt.color = cell.style.color;
  if (cell.style?.fill) fmt.bg = cell.style.fill;
  if (cell.style?.align) fmt.align = cell.style.align;
  return fmt;
}

/** Load Firestore rows/formats into sheet-genius sheet model. */
export function firestoreToSheets({ rows, formats, colWidths, rowHeights, sheets: storedSheets }) {
  if (Array.isArray(storedSheets) && storedSheets.length) {
    return storedSheets.map((s, i) => ({
      id: s.id || `s${i + 1}`,
      name: s.name || `Sheet ${i + 1}`,
      cells: s.cells || {},
      colWidths: s.colWidths || {},
      rowHeights: s.rowHeights || {},
    }));
  }

  const cells = {};
  const legacyFormats = formats && typeof formats === 'object' ? formats : {};
  const gridRows = Array.isArray(rows) ? rows : [];

  for (let r = 0; r < gridRows.length; r++) {
    const row = gridRows[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c++) {
      const raw = row[c] ?? '';
      const ref = `${colLabel(c)}${r + 1}`;
      const cell = legacyFormatToCell(raw, legacyFormats[ref]);
      if (cell) cells[keyOf(r, c)] = cell;
    }
  }

  return [{
    id: 's1-main',
    name: 'Sheet 1',
    cells,
    colWidths: colWidths && typeof colWidths === 'object' ? colWidths : {},
    rowHeights: rowHeights && typeof rowHeights === 'object' ? rowHeights : {},
  }];
}

/** Serialize sheets back to Firestore-compatible payload (sparse — only populated bounds). */
export function sheetsToFirestore(sheets) {
  const primary = sheets[0] || newSheet(1);
  const cells = primary.cells || {};

  let maxR = -1;
  let maxC = -1;
  for (const [k, cell] of Object.entries(cells)) {
    const raw = cell?.raw ?? '';
    const hasContent =
      String(raw).trim() !== '' || cell?.format || (cell?.style && Object.keys(cell.style).length);
    if (!hasContent) continue;
    const [r, c] = k.split(',').map(Number);
    maxR = Math.max(maxR, r);
    maxC = Math.max(maxC, c);
  }

  const rCount = Math.max(maxR + 1, 24);
  const cCount = Math.max(maxC + 1, 8);

  const rows = [];
  for (let r = 0; r < rCount; r++) {
    const row = new Array(cCount);
    for (let c = 0; c < cCount; c++) {
      row[c] = cells[keyOf(r, c)]?.raw ?? '';
    }
    rows.push(row);
  }

  const formats = {};
  for (const [k, cell] of Object.entries(cells)) {
    const [r, c] = k.split(',').map(Number);
    if (r >= rCount || c >= cCount) continue;
    const fmt = cellToLegacyFormat(cell);
    if (Object.keys(fmt).length) formats[`${colLabel(c)}${r + 1}`] = fmt;
  }

  const sheetSnapshots = sheets.map(({ id, name, cells: sheetCells, colWidths: cw, rowHeights: rh }) => ({
    id,
    name,
    cells: sheetCells,
    colWidths: cw,
    rowHeights: rh,
  }));

  return {
    rows,
    formats,
    colWidths: primary.colWidths,
    rowHeights: primary.rowHeights,
    columnCount: cCount,
    rowCount: rCount,
    sheets: sheetSnapshots,
  };
}
