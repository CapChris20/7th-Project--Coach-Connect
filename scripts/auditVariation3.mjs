// Bucket inventory files into Variation 3 status lists.
// Writes scripts/full-rewrite/def-dont.txt, floor-only.txt, variation3-status.json
// Usage: node scripts/auditVariation3.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'scripts/full-rewrite');

const ALLOWED = new Set(['id', 'url', 'api', 'db', 'req', 'res', 'msg', 'uid', 'doc', 'i', 'j', 'k', 'x', 'y', 'e']);
const BAD_SHORT = new Set([
  'p', 'n', 'q', 't', 's', 'd', 'r', 'c', 'u', 'v', 'o', 'a', 'b', 'f', 'g', 'h', 'm', 'w',
  'bg', 'conv', 'tmp', 'temp', 'tA', 'tB', 'acc',
]);
const NESTERS = new Set([
  'IfStatement', 'ForStatement', 'ForOfStatement', 'ForInStatement',
  'WhileStatement', 'DoWhileStatement', 'SwitchStatement', 'TryStatement',
]);

const GOLD_DEF = [
  'src/for-both/weekly-report/WeeklyReportBody.jsx',
  'src/for-both/weekly-report/WeeklyReportScreen.jsx',
  'src/ai-coach/coach-actions/readActionsFromReply.js',
];
const CLAIMED_GOLD_BUT_FLAGGED = ['src/nutrition/food-search/searchFoods.js'];

function readList(fileName) {
  const absolutePath = join(OUT, fileName);
  if (!existsSync(absolutePath)) return [];
  return readFileSync(absolutePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

function hasTopSummary(src) {
  const lines = src.split('\n').slice(0, 12);
  const comments = lines.filter(
    (line) =>
      line.trim().startsWith('//') ||
      line.trim().startsWith('/*') ||
      line.trim().startsWith('*'),
  );
  return comments.length >= 2;
}

function mechanicalAnalyze(rel) {
  if (!existsSync(join(ROOT, rel))) {
    return {
      file: rel,
      lines: 0,
      mechanicalPass: false,
      reasons: ['missing file'],
      signals: {},
    };
  }
  const src = readFileSync(join(ROOT, rel), 'utf8');
  const reasons = [];
  let ast;
  try {
    ast = parse(src, {
      sourceType: 'unambiguous',
      plugins: [
        'jsx',
        'classProperties',
        'optionalChaining',
        'nullishCoalescingOperator',
        'objectRestSpread',
        'exportDefaultFrom',
      ],
    });
  } catch {
    return {
      file: rel,
      lines: src.split('\n').length,
      mechanicalPass: false,
      reasons: ['could not parse'],
      signals: {},
    };
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
        cryptic.push(name);
      }
    },
    Function(path) {
      const loc = path.node.loc;
      if (!loc) return;
      const lines = loc.end.line - loc.start.line + 1;
      let deepest = 0;
      path.traverse({
        Function(inner) {
          inner.skip();
        },
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
      const name =
        path.node.id?.name || path.parent?.id?.name || path.parent?.key?.name || 'anonymous';
      if (deepest >= 3) deep.push(name);
      if (lines >= 80 && deepest >= 2) longConfusing.push(name);
    },
    NumericLiteral(path) {
      const value = path.node.value;
      if (
        ![0, 1, 2, -1, 100].includes(value) &&
        (value >= 1000 || (value >= 400 && value <= 599) || value === 24 || value === 60 || value === 7)
      ) {
        const inStyle = path.findParent(
          (p) =>
            p.node.type === 'CallExpression' && p.node.callee?.object?.name === 'StyleSheet',
        );
        const inJsx = path.findParent((p) => p.node.type === 'JSXAttribute');
        const parent = path.parentPath;
        const bound =
          parent?.node.type === 'VariableDeclarator' &&
          /^[A-Z0-9_]+$/.test(parent.node.id?.name || '');
        if (!inStyle && !inJsx && !bound) magic += 1;
      }
    },
  });

  if (cryptic.length >= 1) reasons.push('cryptic names');
  if (deep.length) reasons.push('nesting 3+');
  if (longConfusing.length) reasons.push('long and nested');
  if (!hasTopSummary(src)) reasons.push('weak file-top');
  const hasSections =
    src.includes('// ===== NAMED CONSTANTS =====') &&
    src.includes('// ===== HELPER FUNCTIONS =====') &&
    src.includes('// ===== MAIN FUNCTION =====');
  if (!hasSections) reasons.push('missing section headers');

  const exportWithoutDoc = [];
  traverse(ast, {
    ExportNamedDeclaration(path) {
      const decl = path.node.declaration;
      if (!decl || (decl.type !== 'FunctionDeclaration' && decl.type !== 'VariableDeclaration')) {
        return;
      }
      if (decl.type === 'VariableDeclaration') {
        const init = decl.declarations[0]?.init;
        if (
          !init ||
          (init.type !== 'ArrowFunctionExpression' && init.type !== 'FunctionExpression')
        ) {
          return;
        }
      }
      const comments = path.node.leadingComments || [];
      const hasDoc = comments.some(
        (comment) => comment.value && comment.value.trim().length > 8,
      );
      if (!hasDoc) exportWithoutDoc.push(true);
    },
  });
  if (exportWithoutDoc.length) reasons.push('export missing JSDoc');
  if (magic >= 1) reasons.push('unbound rule-numbers');

  return {
    file: rel,
    lines: src.split('\n').length,
    mechanicalPass: reasons.length === 0,
    reasons,
    signals: {
      hasNumberedRecipe: /\/\/\s*\d+\.|Step\s+\d+/i.test(src),
      hasPlumbing: /PLUMBING/.test(src),
      stripPassComment: /Strip pass/i.test(src),
      presentationSmell: /presentation pass|batch 1|TODO.*rewrite/i.test(src),
    },
  };
}

const inventory = readList('inventory-all.txt');
const batch1 = [...readList('batch1a.txt'), ...readList('batch1b.txt')];
const secondPass = readList('batch1-priority-second-pass.txt');

const defMatch = [];
const defDont = [];
const floorOnly = [];
const missing = [];

for (const rel of inventory) {
  const result = mechanicalAnalyze(rel);
  if (result.reasons.includes('missing file')) {
    missing.push(rel);
    continue;
  }

  const documentedDont =
    secondPass.includes(rel) ||
    result.signals.stripPassComment ||
    result.signals.presentationSmell ||
    CLAIMED_GOLD_BUT_FLAGGED.includes(rel) ||
    (batch1.includes(rel) && !GOLD_DEF.includes(rel));

  if (GOLD_DEF.includes(rel) && result.mechanicalPass && !result.signals.stripPassComment) {
    defMatch.push(rel);
    continue;
  }

  if (!result.mechanicalPass || documentedDont) {
    defDont.push(rel);
    continue;
  }

  floorOnly.push(rel);
}

writeFileSync(join(OUT, 'def-dont.txt'), `${defDont.join('\n')}\n`, 'utf8');
writeFileSync(join(OUT, 'floor-only.txt'), `${floorOnly.join('\n')}\n`, 'utf8');
writeFileSync(
  join(OUT, 'variation3-status.json'),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      inventoryCount: inventory.length,
      defMatchCount: defMatch.length,
      defDontCount: defDont.length,
      floorOnlyCount: floorOnly.length,
      missingCount: missing.length,
      defMatch,
      missing,
      note:
        'DEF MATCH = gold + mechanical pass. DEF DONT = fail or documented redo. FLOOR ONLY = checker pass, not proven Variation 3.',
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(
  JSON.stringify(
    {
      inventory: inventory.length,
      defMatch: defMatch.length,
      defDont: defDont.length,
      floorOnly: floorOnly.length,
      missing: missing.length,
    },
    null,
    2,
  ),
);
