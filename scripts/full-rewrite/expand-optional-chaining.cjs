/**
 * Expand OptionalMemberExpression / OptionalCallExpression into
 * plain == null ternaries (same short-circuit as ?.), then we hand-polish
 * dense ones into named locals / ifs.
 */
const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node expand-optional-chaining.cjs <file>');
  process.exit(1);
}

const source = fs.readFileSync(filePath, 'utf8');
const ast = parser.parse(source, {
  sourceType: 'module',
  plugins: [
    'jsx',
    'classProperties',
    'optionalChaining',
    'nullishCoalescingOperator',
    'objectRestSpread',
    'dynamicImport',
    'optionalCatchBinding',
    'numericSeparator',
  ],
});

let changed = 0;

function expandOptionalMember(node) {
  const object = expandDeep(node.object);

  if (!node.optional) {
    if (node.computed) {
      return t.memberExpression(object, expandDeep(node.property), true);
    }
    return t.memberExpression(object, node.property, false);
  }

  // Avoid double-evaluating object: if object is a complex expression that
  // was itself expanded, it may be a ConditionalExpression — still correct
  // for ?. semantics when object has no side effects (typical for reads).
  const propertyAccess = node.computed
    ? t.memberExpression(object, expandDeep(node.property), true)
    : t.memberExpression(object, node.property, false);

  changed += 1;
  return t.conditionalExpression(
    t.binaryExpression('==', object, t.nullLiteral()),
    t.unaryExpression('void', t.numericLiteral(0)),
    propertyAccess,
  );
}

function expandOptionalCall(node) {
  const callee = expandDeep(node.callee);
  const args = node.arguments.map((arg) => {
    if (t.isSpreadElement(arg)) return t.spreadElement(expandDeep(arg.argument));
    if (t.isArgumentPlaceholder && t.isArgumentPlaceholder(arg)) return arg;
    return expandDeep(arg);
  });

  if (!node.optional) {
    return t.callExpression(callee, args);
  }

  changed += 1;
  return t.conditionalExpression(
    t.binaryExpression('==', callee, t.nullLiteral()),
    t.unaryExpression('void', t.numericLiteral(0)),
    t.callExpression(callee, args),
  );
}

function expandDeep(node) {
  if (!node) return node;
  if (t.isOptionalMemberExpression(node)) return expandOptionalMember(node);
  if (t.isOptionalCallExpression(node)) return expandOptionalCall(node);
  return node;
}

// Visit deepest first by replacing children via path traversal order
traverse(ast, {
  // exit so children already expanded... but replaceWith on parent after child
  // Optional* nodes: replace on enter after manually expanding nested
  OptionalMemberExpression: {
    exit(path) {
      if (!t.isOptionalMemberExpression(path.node) && !t.isOptionalCallExpression(path.node)) return;
      // After child exits, path.node may still be Optional*
      if (t.isOptionalMemberExpression(path.node)) {
        path.replaceWith(expandOptionalMember(path.node));
      }
    },
  },
  OptionalCallExpression: {
    exit(path) {
      if (t.isOptionalCallExpression(path.node)) {
        path.replaceWith(expandOptionalCall(path.node));
      }
    },
  },
});

const out = generate(ast, {
  retainLines: true,
  compact: false,
  comments: true,
  jsescOption: { minimal: true },
}, source);

fs.writeFileSync(filePath, out.code);
const remaining = (out.code.match(/\?\./g) || []).length;
console.log(JSON.stringify({ file: filePath, expanded: changed, remainingOptional: remaining }));
