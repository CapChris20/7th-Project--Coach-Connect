import { keyOf, labelToCol } from './types';

const FN_NAMES = ['SUM', 'AVERAGE', 'AVG', 'COUNT', 'COUNTA', 'MIN', 'MAX', 'IF', 'ROUND', 'ABS', 'CONCAT', 'LEN', 'UPPER', 'LOWER'];

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function suggestFn(name) {
  const upper = name.toUpperCase();
  let best = null;
  let bestScore = 99;
  for (const fn of FN_NAMES) {
    const d = levenshtein(upper, fn);
    if (d < bestScore && d <= 2) {
      bestScore = d;
      best = fn;
    }
  }
  return best;
}

function parseRef(s) {
  const m = /^([A-Za-z]+)(\d+)$/.exec(String(s || '').trim());
  if (!m) return null;
  return { c: labelToCol(m[1]), r: parseInt(m[2], 10) - 1 };
}

function expandRange(a, b) {
  const ra = parseRef(a);
  const rb = parseRef(b);
  if (!ra || !rb) return [];
  const r1 = Math.min(ra.r, rb.r);
  const r2 = Math.max(ra.r, rb.r);
  const c1 = Math.min(ra.c, rb.c);
  const c2 = Math.max(ra.c, rb.c);
  const out = [];
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) out.push({ r, c });
  }
  return out;
}

export function evaluateCell(raw, cells, visiting = new Set(), selfKey) {
  if (raw == null || raw === '') return { value: null };
  if (!String(raw).startsWith('=')) {
    const n = Number(raw);
    if (String(raw).trim() !== '' && !Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(String(raw).trim())) {
      return { value: n };
    }
    return { value: raw };
  }

  let expr = String(raw).slice(1).trim();
  if (!expr) return { value: null, error: 'Empty formula' };

  let bal = 0;
  for (const ch of expr) {
    if (ch === '(') bal++;
    else if (ch === ')') bal--;
    if (bal < 0) return { value: null, error: 'Extra closing parenthesis' };
  }
  if (bal > 0) return { value: null, error: 'Missing closing parenthesis' };

  try {
    if (selfKey) visiting.add(selfKey);
    const v = evalExpr(expr, cells, visiting, selfKey);
    if (selfKey) visiting.delete(selfKey);
    return { value: v };
  } catch (e) {
    if (selfKey) visiting.delete(selfKey);
    return { value: null, error: e.message || 'Error' };
  }
}

function evalExpr(src, cells, visiting, selfKey) {
  const p = new Parser(src, cells, visiting, selfKey);
  const v = p.parseExpr();
  p.skipWs();
  if (p.pos < p.src.length) throw new Error(`Unexpected '${p.src[p.pos]}'`);
  return v;
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

  eat(ch) {
    this.skipWs();
    if (this.src[this.pos] === ch) {
      this.pos++;
      return true;
    }
    return false;
  }

  parseExpr() {
    return this.parseCompare();
  }

  parseCompare() {
    let left = this.parseAdd();
    this.skipWs();
    const two = this.src.substr(this.pos, 2);
    if (two === '>=' || two === '<=' || two === '<>') {
      this.pos += 2;
      const right = this.parseAdd();
      if (two === '>=') return num(left) >= num(right);
      if (two === '<=') return num(left) <= num(right);
      return left != right;
    }
    const ch = this.src[this.pos];
    if (ch === '=' || ch === '>' || ch === '<') {
      this.pos++;
      const right = this.parseAdd();
      if (ch === '=') return left == right;
      if (ch === '>') return num(left) > num(right);
      return num(left) < num(right);
    }
    return left;
  }

  parseAdd() {
    let left = this.parseMul();
    while (true) {
      this.skipWs();
      const ch = this.src[this.pos];
      if (ch === '+' || ch === '-') {
        this.pos++;
        const r = this.parseMul();
        left = ch === '+' ? num(left) + num(r) : num(left) - num(r);
      } else if (ch === '&') {
        this.pos++;
        const r = this.parseMul();
        left = String(left ?? '') + String(r ?? '');
      } else break;
    }
    return left;
  }

  parseMul() {
    let left = this.parseUnary();
    while (true) {
      this.skipWs();
      const ch = this.src[this.pos];
      if (ch === '*' || ch === '/') {
        this.pos++;
        const r = this.parseUnary();
        if (ch === '*') left = num(left) * num(r);
        else {
          const d = num(r);
          if (d === 0) throw new Error('Division by zero');
          left = num(left) / d;
        }
      } else break;
    }
    return left;
  }

  parseUnary() {
    this.skipWs();
    if (this.src[this.pos] === '-') {
      this.pos++;
      return -num(this.parseUnary());
    }
    if (this.src[this.pos] === '+') {
      this.pos++;
      return this.parseUnary();
    }
    return this.parsePower();
  }

  parsePower() {
    let left = this.parsePrimary();
    this.skipWs();
    if (this.src[this.pos] === '^') {
      this.pos++;
      const r = this.parseUnary();
      return Math.pow(num(left), num(r));
    }
    return left;
  }

  parsePrimary() {
    this.skipWs();
    const ch = this.src[this.pos];
    if (!ch) throw new Error('Unexpected end');
    if (ch === '(') {
      this.pos++;
      const v = this.parseExpr();
      if (!this.eat(')')) throw new Error('Missing closing parenthesis');
      return v;
    }
    if (ch === '"') {
      this.pos++;
      let s = '';
      while (this.pos < this.src.length && this.src[this.pos] !== '"') s += this.src[this.pos++];
      if (this.src[this.pos] !== '"') throw new Error('Unterminated string');
      this.pos++;
      return s;
    }
    if (/[0-9.]/.test(ch)) {
      let s = '';
      while (this.pos < this.src.length && /[0-9.]/.test(this.src[this.pos])) s += this.src[this.pos++];
      if (this.src[this.pos] === '%') {
        this.pos++;
        return parseFloat(s) / 100;
      }
      return parseFloat(s);
    }
    if (/[A-Za-z_]/.test(ch)) {
      let id = '';
      while (this.pos < this.src.length && /[A-Za-z0-9_]/.test(this.src[this.pos])) id += this.src[this.pos++];
      this.skipWs();
      if (this.src[this.pos] === '(') {
        this.pos++;
        const args = [];
        const upper = id.toUpperCase();
        if (this.src[this.pos] !== ')') {
          do {
            const startPos = this.pos;
            this.skipWs();
            const refMatch = /^([A-Za-z]+\d+)\s*:\s*([A-Za-z]+\d+)/.exec(this.src.slice(this.pos));
            if (refMatch) {
              this.pos += refMatch[0].length;
              const refs = expandRange(refMatch[1], refMatch[2]);
              for (const ref of refs) args.push(this.readRef(ref.r, ref.c));
            } else {
              this.pos = startPos;
              args.push(this.parseExpr());
            }
          } while (this.eat(','));
        }
        if (!this.eat(')')) throw new Error('Missing closing parenthesis');
        return callFn(upper, args, id);
      }
      const ref = parseRef(id);
      if (ref) return this.readRef(ref.r, ref.c);
      if (id.toUpperCase() === 'TRUE') return true;
      if (id.toUpperCase() === 'FALSE') return false;
      throw new Error(`Unknown name ${id}`);
    }
    throw new Error(`Unexpected '${ch}'`);
  }

  readRef(r, c) {
    const k = keyOf(r, c);
    if (k === this.selfKey) throw new Error(`Circular reference: ${k}`);
    if (this.visiting.has(k)) throw new Error(`Circular reference at ${labelOf(r, c)}`);
    const cell = this.cells[k];
    if (!cell || !cell.raw) return 0;
    this.visiting.add(k);
    const res = evaluateCell(cell.raw, this.cells, this.visiting, k);
    this.visiting.delete(k);
    if (res.error) throw new Error(res.error);
    if (typeof res.value === 'string') {
      const n = Number(res.value);
      if (!Number.isNaN(n) && res.value.trim() !== '') return n;
    }
    return res.value ?? 0;
  }
}

function labelOf(r, c) {
  return `${String.fromCharCode(65 + c)}${r + 1}`;
}

function num(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v == null || v === '') return 0;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`Expected number, got "${v}"`);
  return n;
}

function callFn(name, args, original) {
  const nums = () => args.filter((a) => a !== null && a !== '' && !Number.isNaN(Number(a))).map((a) => Number(a));
  switch (name) {
    case 'SUM':
      return nums().reduce((a, b) => a + b, 0);
    case 'AVG':
    case 'AVERAGE': {
      const ns = nums();
      if (ns.length === 0) throw new Error('Division by zero (no numbers in AVERAGE)');
      return ns.reduce((a, b) => a + b, 0) / ns.length;
    }
    case 'COUNT':
      return nums().length;
    case 'COUNTA':
      return args.filter((a) => a !== null && a !== '' && a !== undefined).length;
    case 'MIN': {
      const ns = nums();
      return ns.length ? Math.min(...ns) : 0;
    }
    case 'MAX': {
      const ns = nums();
      return ns.length ? Math.max(...ns) : 0;
    }
    case 'IF':
      return args[0] ? args[1] : args[2];
    case 'ROUND':
      return Math.round(Number(args[0]) * Math.pow(10, Number(args[1] || 0))) / Math.pow(10, Number(args[1] || 0));
    case 'ABS':
      return Math.abs(Number(args[0]));
    case 'CONCAT':
      return args.map((a) => String(a ?? '')).join('');
    case 'LEN':
      return String(args[0] ?? '').length;
    case 'UPPER':
      return String(args[0] ?? '').toUpperCase();
    case 'LOWER':
      return String(args[0] ?? '').toLowerCase();
    default: {
      const sug = suggestFn(original);
      throw new Error(`Unknown function ${original}${sug ? ` — did you mean ${sug}?` : ''}`);
    }
  }
}
