import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
const traverse = _traverse.default || _traverse;

const ROOT = '/Users/captainchris20/Projects/My-Coding-Portfolio/7th-Project--Coach-Connect';
const CRYPTIC = new Set(['p','n','q','t','s','d','r','c','u','v','x','o','a','b','e','f','g','h','m','w','i','j','k','el','el2','tmp','temp','conv','tA','tB','bg','res','resp','req','obj','arr','val','num','str','ctx','cfg','opts','acc','fn','cb','doc']);
const ALLOWED = new Set(['id','url','api','db','req','res','msg','uid','doc','i','j','k','x','y','e']);
// i,j,k,x,y,e are loop/event. Plan examples of bad names are p,n,q,conv,tA. I'll flag those specifically plus 1-letter except i,j,k,x,y.
const BAD_SHORT = new Set(['p','n','q','t','s','d','r','c','u','v','o','a','b','f','g','h','m','w','bg','conv','tmp','temp','tA','tB','acc']);

function walk(dir, out=[]) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(js|jsx)$/.test(name)) out.push(p);
  }
  return out;
}

function hasTopSummary(src) {
  const lines = src.split('\n').slice(0, 12);
  const comments = lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('/*') || l.trim().startsWith('*'));
  return comments.length >= 2;
}

const NESTERS = new Set(['IfStatement','ForStatement','ForOfStatement','ForInStatement','WhileStatement','DoWhileStatement','SwitchStatement','TryStatement']);

function analyze(file) {
  const src = readFileSync(file, 'utf8');
  const rel = file.slice(ROOT.length + 1);
  const reasons = [];
  let ast;
  try {
    ast = parse(src, { sourceType: 'unambiguous', plugins: ['jsx','classProperties','optionalChaining','nullishCoalescingOperator','objectRestSpread','exportDefaultFrom'] });
  } catch (e) {
    return { file: rel, pass: false, reasons: ['could not parse: ' + e.message.split('\n')[0]] };
  }
  const cryptic = [];
  const deep = [];
  const longConfusing = [];
  let magic = 0;
  traverse(ast, {
    VariableDeclarator(path) {
      const name = path.node.id && path.node.id.name;
      if (!name) return;
      if (BAD_SHORT.has(name) || (name.length === 1 && !ALLOWED.has(name))) {
        cryptic.push(name + '@' + (path.node.loc?.start.line || '?'));
      }
    },
    Function(path) {
      const loc = path.node.loc;
      if (!loc) return;
      const lines = loc.end.line - loc.start.line + 1;
      let deepest = 0;
      path.traverse({
        Function(inner) { inner.skip(); },
        enter(p) {
          if (!NESTERS.has(p.node.type)) return;
          if (p.parentPath && p.parentPath.node.type === 'JSXExpressionContainer') return;
          let depth = 0;
          let cursor = p.parentPath;
          while (cursor && cursor !== path) {
            if (NESTERS.has(cursor.node.type)) depth += 1;
            cursor = cursor.parentPath;
          }
          if (depth + 1 > deepest) deepest = depth + 1;
        },
      });
      const name = path.node.id?.name || path.parent?.id?.name || path.parent?.key?.name || 'anonymous';
      if (deepest >= 3) deep.push(`${name} depth ${deepest} @${loc.start.line}`);
      if (lines >= 80 && deepest >= 2) longConfusing.push(`${name} ${lines} lines @${loc.start.line}`);
    },
    NumericLiteral(path) {
      const value = path.node.value;
      if (![0,1,2,-1,100].includes(value) && (value >= 1000 || (value >= 400 && value <= 599) || value === 24 || value === 60 || value === 7)) {
        const inStyle = path.findParent(p => p.node.type === 'CallExpression' && p.node.callee?.object?.name === 'StyleSheet');
        const inJsx = path.findParent(p => p.node.type === 'JSXAttribute');
        const parent = path.parentPath;
        const bound = parent?.node.type === 'VariableDeclarator' && /^[A-Z0-9_]+$/.test(parent.node.id?.name || '');
        if (!inStyle && !inJsx && !bound) magic += 1;
      }
    },
  });
  if (cryptic.length >= 1) reasons.push(`${cryptic.length} cryptic names (${cryptic.slice(0,4).join(', ')})`);
  if (deep.length) reasons.push(`nesting 3+: ${deep.slice(0,2).join('; ')}`);
  if (longConfusing.length) reasons.push(`long and nested: ${longConfusing.slice(0,2).join('; ')}`);
  const lineCount = src.split('\n').length;
  if (!hasTopSummary(src)) reasons.push('no plain opening (what / flow / who uses it)');
  const hasSections = src.includes('// ===== NAMED CONSTANTS =====')
    && src.includes('// ===== HELPER FUNCTIONS =====')
    && src.includes('// ===== MAIN FUNCTION =====');
  if (!hasSections) reasons.push('missing the three section headers');
  const exportWithoutDoc = [];
  traverse(ast, {
    ExportNamedDeclaration(path) {
      const decl = path.node.declaration;
      if (!decl || (decl.type !== 'FunctionDeclaration' && decl.type !== 'VariableDeclaration')) return;
      if (decl.type === 'VariableDeclaration') {
        const init = decl.declarations[0]?.init;
        if (!init || (init.type !== 'ArrowFunctionExpression' && init.type !== 'FunctionExpression')) return;
      }
      const comments = path.node.leadingComments || [];
      const hasDoc = comments.some((comment) => comment.value && comment.value.trim().length > 8);
      if (!hasDoc) exportWithoutDoc.push(path.node.loc?.start.line || '?');
    },
  });
  if (exportWithoutDoc.length) reasons.push(`export missing JSDoc @${exportWithoutDoc.slice(0, 3).join(',')}`);
  if (magic >= 1) reasons.push(`${magic} inline rule-numbers (timeouts, status codes, or day/hour math)`);
  return { file: rel, lines: lineCount, pass: reasons.length === 0, reasons };
}

const files = walk(join(ROOT, 'src'));
const results = files.map(analyze);
const pass = results.filter(r => r.pass);
const fail = results.filter(r => !r.pass);
writeFileSync('/tmp/cc-audit/classification.json', JSON.stringify({ pass: pass.map(p => p.file), fail }, null, 2));
console.log(`files ${results.length}`);
console.log(`already readable ${pass.length}`);
console.log(`needs rewrite ${fail.length}`);
console.log('\n--- NEEDS REWRITE ---');
for (const f of fail.sort((a,b) => (b.lines||0) - (a.lines||0))) {
  console.log(`${f.file} — ${f.reasons.join(' | ')}`);
}
console.log('\n--- ALREADY READABLE (count by folder) ---');
const by = {};
for (const p of pass) {
  const folder = p.file.split('/').slice(0, 2).join('/');
  by[folder] = (by[folder] || 0) + 1;
}
Object.entries(by).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`${v}\t${k}`));
