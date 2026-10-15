// Cross-references the readability audit with Jest coverage so we know which
// messy files are actually protected by tests before refactoring them.
// Run: node scripts/readabilityCoverageMap.mjs
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

const ROOT = process.cwd();
const audit = JSON.parse(readFileSync('readability-audit.json', 'utf8')).report;
const coverageRaw = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));

const coverageByFile = new Map();
for (const [absolutePath, summary] of Object.entries(coverageRaw)) {
  if (absolutePath === 'total') continue;
  coverageByFile.set(relative(ROOT, absolutePath), summary.lines.pct);
}

// Refactor priority order requested by the user, matched by path fragments.
const PRIORITY_GROUPS = [
  ['1. Auth / login', [/login-and-signup/, /\/auth/i, /firebaseAuth/i, /signIn|signUp|session/i]],
  ['2. Payments', [/payment/i, /stripe/i, /\biap\b/i, /earnings/i, /purchase/i, /subscription/i, /pro-plan|proPlan/i, /billing/i]],
  ['3. Trainer\u2009/\u2009client state', [/app-start/, /trainer-client/i, /linking/i, /navigation/, /context/i, /\bstore\b/i]],
  ['4. Firebase listeners', [/listen/i, /onSnapshot/i, /subscribe/i, /realtime/i]],
  ['5. API calls / utils', [/^server\//, /\/api\//, /utils?\//i, /helpers?\.js$/i, /\/lib\//]],
];

function groupFor(file) {
  for (const [label, patterns] of PRIORITY_GROUPS) {
    if (patterns.some((pattern) => pattern.test(file))) return label;
  }
  return '6. Components / other';
}

const rows = audit.map((entry) => ({
  ...entry,
  group: groupFor(entry.file),
  coverage: coverageByFile.has(entry.file) ? coverageByFile.get(entry.file) : null,
}));

const byGroup = new Map();
for (const row of rows) {
  if (!byGroup.has(row.group)) byGroup.set(row.group, []);
  byGroup.get(row.group).push(row);
}

const formatCoverage = (pct) => (pct === null ? 'NOT LOADED' : `${pct.toFixed(0)}%`);

for (const label of [...byGroup.keys()].sort()) {
  const group = byGroup.get(label).sort((a, b) => b.score - a.score);
  const covered = group.filter((r) => (r.coverage ?? 0) > 0).length;
  console.log(`\n=== ${label} — ${group.length} files, ${covered} with any test coverage ===`);
  console.log(['score', 'lines', 'cov', 'longFn', 'nest', 'vagueVar', 'magic', 'file'].join('\t'));
  for (const row of group.slice(0, 12)) {
    console.log([
      row.score, row.totalLines, formatCoverage(row.coverage),
      row.longFunctions.length, row.deepNesting.length,
      row.vagueNames.length, row.magicNumbers, row.file,
    ].join('\t'));
  }
}

const zeroCoverageHighScore = rows.filter((r) => (r.coverage ?? 0) === 0 && r.score >= 60);
console.log(`\n=== UNTESTED + MESSY (score >= 60, 0% coverage): ${zeroCoverageHighScore.length} files ===`);
console.log('These cannot be verified by the Jest suite — refactoring them is unguarded.');
for (const row of zeroCoverageHighScore.slice(0, 25)) {
  console.log(`${row.score}\t${row.totalLines}\t${row.file}`);
}
console.log('\nTOTAL lines of code audited:', rows.reduce((sum, r) => sum + r.totalLines, 0));
