#!/usr/bin/env node
/**
 * Scan src/ for likely broken React component imports (undefined at runtime).
 * Run: node scripts/checkComponentImports.js
 * Exit 1 if any HIGH confidence issues found.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const BUILTIN = new Set([
  'View', 'Text', 'ScrollView', 'SafeAreaView', 'TouchableOpacity', 'Pressable',
  'Image', 'TextInput', 'FlatList', 'SectionList', 'Modal', 'ActivityIndicator',
  'KeyboardAvoidingView', 'RefreshControl', 'StatusBar', 'Fragment', 'Switch',
  'Animated', 'StyleSheet', 'Platform', 'Alert', 'Share', 'Linking',
]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['node_modules', '.git', '__MACOSX', '.tmp'].some((x) => ent.name.includes(x))) continue;
      walk(p, out);
    } else if (/\.(jsx?|tsx?)$/.test(ent.name) && !ent.name.includes('.tmp')) {
      out.push(p);
    }
  }
  return out;
}

function parseImports(src) {
  const imports = new Map(); // localName -> { from, kind: 'default'|'named' }
  const re = /^import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const clause = m[1].trim();
    const from = m[2];
    if (clause.startsWith('{')) {
      clause
        .replace(/[{}]/g, '')
        .split(',')
        .forEach((part) => {
          const p = part.trim();
          if (!p) return;
          const [orig, alias] = p.split(/\s+as\s+/).map((s) => s.trim());
          imports.set(alias || orig, { from, kind: 'named', exportName: orig });
        });
    } else if (clause.includes('{')) {
      const [defPart, rest] = clause.split('{');
      const def = defPart.replace(/,/g, '').trim();
      if (def && def !== 'type') imports.set(def, { from, kind: 'default' });
      const named = rest.replace('}', '');
      named.split(',').forEach((part) => {
        const p = part.trim();
        if (!p) return;
        const [orig, alias] = p.split(/\s+as\s+/).map((s) => s.trim());
        imports.set(alias || orig, { from, kind: 'named', exportName: orig });
      });
    } else if (clause.startsWith('* as ')) {
      imports.set(clause.replace('* as ', '').trim(), { from, kind: 'namespace' });
    } else {
      imports.set(clause.split(',')[0].trim(), { from, kind: 'default' });
    }
  }
  return imports;
}

function resolveModule(fromFile, spec) {
  if (!spec.startsWith('.')) return null; // skip node_modules for now
  const base = path.resolve(path.dirname(fromFile), spec);
  const exts = ['.jsx', '.js', '.tsx', '.ts', '/index.jsx', '/index.js'];
  for (const ext of exts) {
    const candidate = base + ext;
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function parseExports(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const exports = { default: false, named: new Set() };
  if (/export\s+default\s+function\s+(\w+)/.test(src)) exports.default = true;
  if (/export\s+default\s+class\s+(\w+)/.test(src)) exports.default = true;
  if (/export\s+default\s+\w+/.test(src)) exports.default = true;
  const namedRe = /export\s+(?:function|const|class)\s+(\w+)/g;
  let m;
  while ((m = namedRe.exec(src)) !== null) exports.named.add(m[1]);
  const exportListRe = /export\s*\{([^}]+)\}/g;
  while ((m = exportListRe.exec(src)) !== null) {
    m[1].split(',').forEach((part) => {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name) exports.named.add(name);
    });
  }
  return exports;
}

function findJsxComponents(src) {
  const used = new Set();
  const re = /<([A-Z][A-Za-z0-9]*)\b/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (!BUILTIN.has(m[1])) used.add(m[1]);
  }
  return used;
}

const issues = [];

for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  const imports = parseImports(src);
  const used = findJsxComponents(src);

  for (const comp of used) {
    const info = imports.get(comp);
    if (!info) continue; // might be local const component

    const resolved = resolveModule(file, info.from);
    if (!resolved) continue;

    const exp = parseExports(resolved);
    if (info.kind === 'default') {
      if (!exp.default) {
        issues.push({
          severity: 'HIGH',
          file: rel,
          component: comp,
          message: `default import "${comp}" from ${info.from} but target has no default export`,
          target: path.relative(ROOT, resolved),
        });
      }
    } else if (info.kind === 'named') {
      const exportName = info.exportName || comp;
      if (!exp.named.has(exportName) && !exp.default) {
        issues.push({
          severity: 'HIGH',
          file: rel,
          component: comp,
          message: `named import "{ ${exportName} }" not exported from ${info.from}`,
          target: path.relative(ROOT, resolved),
          available: [...exp.named].slice(0, 12).join(', '),
        });
      }
    }
  }

  // Import binding exists but never exported from barrel (undefined named import)
  for (const [local, info] of imports) {
    if (info.kind !== 'named') continue;
    const resolved = resolveModule(file, info.from);
    if (!resolved) continue;
    const exp = parseExports(resolved);
    const exportName = info.exportName || local;
    if (!exp.named.has(exportName)) {
      // used in JSX?
      if (used.has(local) || new RegExp(`<${local}\\b`).test(src)) {
        issues.push({
          severity: 'HIGH',
          file: rel,
          component: local,
          message: `imports "{ ${exportName} }" from ${info.from} but export missing (got undefined component)`,
          target: path.relative(ROOT, resolved),
          available: [...exp.named].slice(0, 15).join(', ') || '(none)',
        });
      }
    }
  }
}

const high = issues.filter((i) => i.severity === 'HIGH');
const seen = new Set();
const unique = high.filter((i) => {
  const k = `${i.file}:${i.component}:${i.message}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

console.log('\n🔍 Component import audit (relative imports under src/)\n');
if (!unique.length) {
  console.log('No high-confidence broken imports found.\n');
  process.exit(0);
}

for (const i of unique) {
  console.log(`❌ ${i.file}`);
  console.log(`   ${i.component}: ${i.message}`);
  console.log(`   → ${i.target}`);
  if (i.available) console.log(`   exports: ${i.available}`);
  console.log('');
}

console.log(`${unique.length} issue(s) found.\n`);
process.exit(1);
