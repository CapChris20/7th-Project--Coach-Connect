// One-off readability audit: parses every src/ + server/ file and reports
// long functions, deep nesting, vague identifiers, and magic numbers.
// Run: node scripts/readabilityAudit.mjs [--json]
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { parse } from '@babel/core';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default || traverseModule;

const MAX_FUNCTION_LINES = 30;
const MAX_NESTING_DEPTH = 2;

// Short/vague identifiers we flag. `id`, `url`, `api`, `db` are allowed per spec.
const ALLOWED_SHORT = new Set([
  'id', 'url', 'api', 'db', 'ok', 'fn', 'cb', 'to', 'at', 'on', 'of', 'in',
  'i', 'j', 'k', 'x', 'y', 'a', 'b', // loop/math counters tolerated
  '_', '__', 'e', 't', 'px', 'ms', 'uid', 'ids', 'key', 'val',
]);
const VAGUE_NAMES = new Set([
  'u', 'acc', 'temp', 'tmp', 'data', 'd', 'res', 'resp', 'req', 'obj', 'arr',
  'item', 'items', 'list', 'el', 'elem', 'ctx', 'cfg', 'opts', 'params',
  'args', 'str', 's', 'n', 'num', 'v', 'value', 'result', 'results', 'r',
  'p', 'q', 'info', 'thing', 'stuff', 'foo', 'bar', 'payload', 'body',
]);
const BOOL_PREFIXES = ['is', 'has', 'can', 'should', 'was', 'will', 'did', 'are', 'allow', 'enable', 'show', 'hide'];
const VAGUE_FUNCTIONS = new Set([
  'handleClick', 'handlePress', 'handleChange', 'handleSubmit', 'process',
  'handler', 'doIt', 'run', 'go', 'update', 'updateData', 'getData', 'setData',
  'init', 'setup', 'onPress', 'onChange', 'load', 'save', 'render',
]);
// Numbers that carry no hidden meaning.
const BENIGN_NUMBERS = new Set([0, 1, 2, -1, 100, 0.5]);

const files = execSync(
  "git ls-files 'src/**/*.js' 'src/**/*.jsx' 'server/**/*.js' | grep -v __tests__",
  { encoding: 'utf8', maxBufferableSize: 1e9 }
)
  .trim()
  .split('\n')
  .filter(Boolean);

const report = [];
const parseErrors = [];

function functionName(path) {
  const { node, parent } = path;
  if (node.id?.name) return node.id.name;
  if (node.key?.name) return node.key.name;
  if (parent?.type === 'VariableDeclarator' && parent.id?.name) return parent.id.name;
  if (parent?.type === 'ObjectProperty' && parent.key?.name) return parent.key.name;
  if (parent?.type === 'ClassMethod' && parent.key?.name) return parent.key.name;
  return '<anonymous>';
}

// Counts how deeply if/for/while/switch/try blocks stack inside one function,
// stopping at nested function boundaries so each function is scored alone.
function nestingDepth(fnPath) {
  let deepest = 0;
  let deepestLine = null;
  const NESTERS = new Set([
    'IfStatement', 'ForStatement', 'ForOfStatement', 'ForInStatement',
    'WhileStatement', 'DoWhileStatement', 'SwitchStatement', 'TryStatement',
  ]);
  fnPath.traverse({
    Function(innerPath) { innerPath.skip(); },
    enter(path) {
      if (!NESTERS.has(path.node.type)) return;
      let depth = 0;
      let cursor = path.parentPath;
      while (cursor && cursor !== fnPath) {
        if (NESTERS.has(cursor.node.type)) {
          // `else if` chains read as one level, not two.
          const isElseIf =
            cursor.node.type === 'IfStatement' &&
            cursor.node.alternate === path.node;
          if (!isElseIf) depth += 1;
        }
        cursor = cursor.parentPath;
      }
      if (depth > deepest) {
        deepest = depth;
        deepestLine = path.node.loc?.start.line ?? null;
      }
    },
  });
  return { depth: deepest + 1, line: deepestLine };
}

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const totalLines = source.split('\n').length;
  let ast;
  try {
    ast = parse(source, {
      filename: file,
      sourceType: 'unambiguous',
      ast: true,
      code: false,
      presets: [],
      plugins: [],
      parserOpts: { plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator', 'objectRestSpread'] },
      babelrc: false,
      configFile: false,
    });
  } catch (error) {
    parseErrors.push({ file, message: error.message.split('\n')[0] });
    continue;
  }

  const entry = {
    file,
    totalLines,
    longFunctions: [],
    deepNesting: [],
    vagueNames: [],
    vagueFunctions: [],
    nonBooleanBooleans: [],
    magicNumbers: 0,
    magicNumberSamples: [],
  };

  traverse(ast, {
    Function(path) {
      const { loc } = path.node;
      if (!loc) return;
      const lines = loc.end.line - loc.start.line + 1;
      const name = functionName(path);
      if (lines > MAX_FUNCTION_LINES) {
        entry.longFunctions.push({ name, lines, line: loc.start.line });
      }
      const { depth, line } = nestingDepth(path);
      if (depth > MAX_NESTING_DEPTH) {
        entry.deepNesting.push({ name, depth, line: line ?? loc.start.line });
      }
      if (VAGUE_FUNCTIONS.has(name)) {
        entry.vagueFunctions.push({ name, line: loc.start.line });
      }
    },

    VariableDeclarator(path) {
      const name = path.node.id?.name;
      if (!name) return;
      const line = path.node.loc?.start.line;
      const isShort = name.length <= 2 && !ALLOWED_SHORT.has(name);
      if (isShort || VAGUE_NAMES.has(name)) {
        entry.vagueNames.push({ name, line });
      }
      // Boolean-valued consts that don't read as questions.
      const init = path.node.init;
      const isLiteralBool = init?.type === 'BooleanLiteral';
      const isComparison =
        init?.type === 'BinaryExpression' &&
        ['===', '!==', '==', '!=', '>', '<', '>=', '<='].includes(init.operator);
      const isNegation = init?.type === 'UnaryExpression' && init.operator === '!';
      if (isLiteralBool || isComparison || isNegation) {
        const readsAsBoolean = BOOL_PREFIXES.some((prefix) =>
          name.startsWith(prefix) && name.length > prefix.length && name[prefix.length] === name[prefix.length].toUpperCase()
        );
        if (!readsAsBoolean) entry.nonBooleanBooleans.push({ name, line });
      }
    },

    NumericLiteral(path) {
      const { value } = path.node;
      if (BENIGN_NUMBERS.has(value)) return;
      // Skip numbers already bound to a SCREAMING_CASE constant.
      const parent = path.parentPath;
      if (parent?.node.type === 'VariableDeclarator') {
        const name = parent.node.id?.name || '';
        if (/^[A-Z0-9_]+$/.test(name)) return;
      }
      // Style objects are mostly layout values, not business magic numbers.
      if (path.findParent((p) => p.node.type === 'JSXAttribute')) return;
      let isStyleSheet = false;
      path.findParent((p) => {
        if (
          p.node.type === 'CallExpression' &&
          p.node.callee?.object?.name === 'StyleSheet'
        ) isStyleSheet = true;
        return false;
      });
      if (isStyleSheet) return;
      entry.magicNumbers += 1;
      if (entry.magicNumberSamples.length < 6) {
        entry.magicNumberSamples.push({ value, line: path.node.loc?.start.line });
      }
    },
  });

  report.push(entry);
}

const score = (e) =>
  e.longFunctions.length * 6 +
  e.deepNesting.length * 5 +
  e.vagueNames.length * 2 +
  e.vagueFunctions.length * 3 +
  e.nonBooleanBooleans.length * 2 +
  Math.min(e.magicNumbers, 60);

report.forEach((e) => { e.score = score(e); });
report.sort((a, b) => b.score - a.score);

writeFileSync('readability-audit.json', JSON.stringify({ report, parseErrors }, null, 2));

const totals = report.reduce(
  (acc, e) => ({
    longFunctions: acc.longFunctions + e.longFunctions.length,
    deepNesting: acc.deepNesting + e.deepNesting.length,
    vagueNames: acc.vagueNames + e.vagueNames.length,
    vagueFunctions: acc.vagueFunctions + e.vagueFunctions.length,
    nonBooleanBooleans: acc.nonBooleanBooleans + e.nonBooleanBooleans.length,
    magicNumbers: acc.magicNumbers + e.magicNumbers,
  }),
  { longFunctions: 0, deepNesting: 0, vagueNames: 0, vagueFunctions: 0, nonBooleanBooleans: 0, magicNumbers: 0 }
);

console.log(`files parsed: ${report.length}  parse errors: ${parseErrors.length}`);
console.log('TOTALS', JSON.stringify(totals, null, 2));
console.log('\n--- WORST 45 FILES ---');
console.log(
  ['score', 'lines', 'longFn', 'deepNest', 'vagueVar', 'vagueFn', 'boolName', 'magicNum', 'file'].join('\t')
);
for (const e of report.slice(0, 45)) {
  console.log([
    e.score, e.totalLines, e.longFunctions.length, e.deepNesting.length,
    e.vagueNames.length, e.vagueFunctions.length, e.nonBooleanBooleans.length,
    e.magicNumbers, e.file,
  ].join('\t'));
}
if (parseErrors.length) {
  console.log('\n--- PARSE ERRORS ---');
  parseErrors.forEach((p) => console.log(`${p.file}: ${p.message}`));
}
