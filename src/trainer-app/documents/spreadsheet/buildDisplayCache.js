import { evaluateCell } from './formula';
import { formatValue } from './format';
import { keyOf } from './types';

const EMPTY = { text: '', rawValue: null };

/** Precompute display strings only for populated cells (avoids 5200 formula evals per frame). */
export function buildDisplayCache(cells) {
  const cache = new Map();
  if (!cells) return cache;

  for (const [k, cell] of Object.entries(cells)) {
    if (!cell) continue;
    if (cell.format === 'checkbox') {
      const v = String(cell.raw).toLowerCase() === 'true' || cell.raw === '1';
      cache.set(k, { text: v ? '☑' : '☐', rawValue: v });
      continue;
    }
    if (String(cell.raw).startsWith('=')) {
      const res = evaluateCell(cell.raw, cells, new Set(), k);
      if (res.error) cache.set(k, { text: '#ERR', error: res.error, rawValue: null });
      else cache.set(k, { text: formatValue(res.value, cell), rawValue: res.value });
      continue;
    }
    const n = Number(cell.raw);
    const rawValue = cell.raw !== '' && !Number.isNaN(n) ? n : cell.raw;
    cache.set(k, { text: formatValue(cell.raw, cell), rawValue });
  }

  return cache;
}

export function lookupDisplay(cache, r, c) {
  return cache.get(keyOf(r, c)) ?? EMPTY;
}
