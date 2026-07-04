export const ROWS = 200;
export const COLS = 26;
export const DEFAULT_COL_WIDTH = 100;
export const DEFAULT_ROW_HEIGHT = 26;
export const HEADER_W = 46;
export const HEADER_H = 26;
export const MAX_COL_WIDTH = 500;
export const TOUCH_MIN = 44;

export const colLabel = (c) => {
  let s = '';
  let n = c;
  while (true) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return s;
};

export const labelToCol = (s) => {
  let n = 0;
  for (const ch of s.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
};

export const keyOf = (r, c) => `${r},${c}`;

export const newSheet = (i) => ({
  id: `s${i}-${Math.random().toString(36).slice(2, 7)}`,
  name: `Sheet ${i}`,
  cells: {},
  colWidths: {},
  rowHeights: {},
});

export function normalizeSel(sel) {
  return {
    r1: Math.min(sel.anchor.r, sel.focus.r),
    r2: Math.max(sel.anchor.r, sel.focus.r),
    c1: Math.min(sel.anchor.c, sel.focus.c),
    c2: Math.max(sel.anchor.c, sel.focus.c),
  };
}
