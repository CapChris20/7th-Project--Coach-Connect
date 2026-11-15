/**
 * Replace ?. with junior-readable forms:
 * - optional call as statement: if (fn) { fn(...); }
 * - optional member in if-test: use && 
 * - optional member as value: keep as && chain (spoken later by hand for densest)
 *
 * This is a first pass; dense multi-?. lines still need named-local polish.
 */
const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const filePath = process.argv[2];
const source = fs.readFileSync(filePath, 'utf8');
const ast = parser.parse(source, {
  sourceType: 'module',
  plugins: [
    'jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator',
    'objectRestSpread', 'dynamicImport', 'optionalCatchBinding', 'numericSeparator',
  ],
});

let changed = 0;

/** Convert optional chain tree into && / plain member (no ?.). */
function toAndChain(node) {
  if (t.isOptionalMemberExpression(node)) {
    const obj = toAndChain(node.object);
    const access = node.computed
      ? t.memberExpression(obj, node.property, true)
      : t.memberExpression(
          // For optional level: obj && obj.prop
          // But obj may already be LogicalExpression — we need the LEFTMOST root
          // Simpler: rebuild as nested && 
          obj,
          node.property,
          false,
        );
    if (!node.optional) {
      return node.computed
        ? t.memberExpression(obj, toAndChain(node.property), true)
        : t.memberExpression(obj, node.property, false);
    }
    // obj && obj.prop — but if obj is LogicalExpression (a && a.b), accessing .c on it is wrong.
    // Correct approach: extract the "truthy object" as the full chain without optionals,
    // and guard with the previous level.
    // a?.b?.c → a && a.b && a.b.c
    const plainObj = stripOptionalToPlain(node.object);
    const plainAccess = node.computed
      ? t.memberExpression(plainObj, node.property, true)
      : t.memberExpression(plainObj, node.property, false);
    const guard = stripOptionalToPlain(node.object);
    // If object itself had optionals, wrap guard
    const left = optionalDepth(node.object) > 0 ? toAndChain(node.object) : guard;
    changed += 1;
    return t.logicalExpression('&&', left, plainAccess);
  }
  if (t.isOptionalCallExpression(node)) {
    const plainCallee = stripOptionalToPlain(node.callee);
    const args = node.arguments.map((a) => (t.isSpreadElement(a) ? a : a));
    const call = t.callExpression(plainCallee, args);
    if (!node.optional) return call;
    const left = optionalDepth(node.callee) > 0 ? toAndChain(node.callee) : plainCallee;
    changed += 1;
    return t.logicalExpression('&&', left, call);
  }
  return node;
}

function stripOptionalToPlain(node) {
  if (t.isOptionalMemberExpression(node)) {
    const obj = stripOptionalToPlain(node.object);
    return node.computed
      ? t.memberExpression(obj, node.property, true)
      : t.memberExpression(obj, node.property, false);
  }
  if (t.isOptionalCallExpression(node)) {
    const callee = stripOptionalToPlain(node.callee);
    return t.callExpression(callee, node.arguments);
  }
  return node;
}

function optionalDepth(node) {
  if (t.isOptionalMemberExpression(node) || t.isOptionalCallExpression(node)) {
    return 1 + optionalDepth(node.object || node.callee);
  }
  return 0;
}

traverse(ast, {
  OptionalMemberExpression: {
    exit(path) {
      // Only replace if this path still has optional (parent may have replaced)
      if (!t.isOptionalMemberExpression(path.node) && !t.isOptionalCallExpression(path.node)) return;
      // Skip if parent is still Optional* — let parent handle (exit order: child first)
      const parent = path.parentPath;
      if (
        parent &&
        (t.isOptionalMemberExpression(parent.node) || t.isOptionalCallExpression(parent.node))
      ) {
        return;
      }
      path.replaceWith(toAndChain(path.node));
    },
  },
  OptionalCallExpression: {
    exit(path) {
      if (!t.isOptionalCallExpression(path.node)) return;
      const parent = path.parentPath;
      if (
        parent &&
        (t.isOptionalMemberExpression(parent.node) || t.isOptionalCallExpression(parent.node))
      ) {
        return;
      }
      // Statement form: expr?.() as ExpressionStatement → if (expr) expr()
      if (parent && parent.isExpressionStatement() && path.node.optional && optionalDepth(path.node.callee) === 0) {
        const callee = path.node.callee;
        const call = t.callExpression(callee, path.node.arguments);
        parent.replaceWith(t.ifStatement(callee, t.blockStatement([t.expressionStatement(call)])));
        changed += 1;
        return;
      }
      path.replaceWith(toAndChain(path.node));
    },
  },
});

const out = generate(ast, { retainLines: true, compact: false, comments: true, jsescOption: { minimal: true } }, source);
fs.writeFileSync(filePath, out.code);
const remaining = (out.code.match(/\?\./g) || []).length;
console.log(JSON.stringify({ file: filePath, changed, remainingOptional: remaining }));
