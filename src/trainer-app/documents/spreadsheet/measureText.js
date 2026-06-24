import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, MAX_COL_WIDTH } from './types';

/** Approximate text width for auto-sizing columns (RN has no canvas measureText). */
export function measureText(text, bold = false) {
  const longest = String(text || '')
    .split('\n')
    .reduce((a, b) => (a.length > b.length ? a : b), '');
  const charW = bold ? 8.5 : 7.5;
  return Math.ceil(longest.length * charW) + 24;
}

export function measureRowHeight(text) {
  const lines = String(text || '').split('\n').length;
  return Math.max(DEFAULT_ROW_HEIGHT, lines * 22 + 6);
}

/**
 * Widest content in column c across all cells.
 * @param {{ r: number, c: number, text: string, bold?: boolean } | null} draft - live edit overlay
 */
export function calcColWidth(c, cells, draft = null) {
  let maxW = DEFAULT_COL_WIDTH;

  if (draft?.c === c) {
    maxW = Math.max(maxW, measureText(draft.text ?? '', draft.bold));
  }

  for (const [k, cell] of Object.entries(cells || {})) {
    const [r, col] = k.split(',').map(Number);
    if (col !== c) continue;
    if (draft?.r === r && draft?.c === c) continue;
    const raw = cell?.raw ?? '';
    if (!raw) continue;
    maxW = Math.max(maxW, measureText(raw, cell?.style?.bold));
  }

  return Math.min(Math.max(maxW, DEFAULT_COL_WIDTH), MAX_COL_WIDTH);
}

/**
 * Tallest content in row r across all cells.
 * @param {{ r: number, c: number, text: string } | null} draft - live edit overlay
 */
export function calcRowHeight(r, cells, draft = null) {
  let maxH = DEFAULT_ROW_HEIGHT;

  if (draft?.r === r) {
    maxH = Math.max(maxH, measureRowHeight(draft.text ?? ''));
  }

  for (const [k, cell] of Object.entries(cells || {})) {
    const [row] = k.split(',').map(Number);
    if (row !== r) continue;
    if (draft?.r === r && draft?.c === parseInt(k.split(',')[1], 10)) continue;
    const raw = cell?.raw ?? '';
    if (!raw) continue;
    maxH = Math.max(maxH, measureRowHeight(raw));
  }

  return maxH;
}

export function setColWidth(colWidths, c, cells, draft = null) {
  const w = calcColWidth(c, cells, draft);
  const next = { ...colWidths };
  if (w <= DEFAULT_COL_WIDTH) delete next[c];
  else next[c] = w;
  return next;
}

export function setRowHeight(rowHeights, r, cells, draft = null) {
  const h = calcRowHeight(r, cells, draft);
  const next = { ...rowHeights };
  if (h <= DEFAULT_ROW_HEIGHT) delete next[r];
  else next[r] = h;
  return next;
}

/** Recalc column + row size for one cell (optionally using in-progress draft text). */
export function syncCellDims(cells, r, c, colWidths, rowHeights, draft = null) {
  return {
    colWidths: setColWidth(colWidths, c, cells, draft),
    rowHeights: setRowHeight(rowHeights, r, cells, draft),
  };
}

/** Recalc after bulk changes (clear, paste, etc.). */
export function syncDimsForRange(cells, colWidths, rowHeights, r1, r2, c1, c2) {
  let cw = { ...colWidths };
  let rh = { ...rowHeights };
  for (let c = c1; c <= c2; c++) cw = setColWidth(cw, c, cells);
  for (let r = r1; r <= r2; r++) rh = setRowHeight(rh, r, cells);
  return { colWidths: cw, rowHeights: rh };
}
