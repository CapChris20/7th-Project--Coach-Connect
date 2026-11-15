#!/usr/bin/env node
/**
 * Build generated token / brand / kcal-band tables from recorded OFF products.
 * Offline by default (uses tests/food-fixtures/recorded-off-products.json).
 * Do not hand-edit the output files — regenerate with this script.
 *
 *   node scripts/buildTokenStats.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const RAW_PATH = path.join(ROOT, 'tests/food-fixtures/recorded-off-products.json');
const OUT_DIR = path.join(ROOT, 'src/nutrition/food-match/generated');

const TOP_TOKEN_CAP = 50000;
const UNKNOWN_DF = 0;

function tokensOf(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function brandPieces(brands) {
  return String(brands || '')
    .split(/[,/|]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

function kcal100(nutrients) {
  const n = nutrients || {};
  if (n['energy-kcal_100g'] != null) return Number(n['energy-kcal_100g']);
  return null;
}

function main() {
  if (!fs.existsSync(RAW_PATH)) {
    console.error(`missing ${RAW_PATH}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
  const products = raw.products || [];
  const documentCount = products.length;

  const documentFrequency = new Map();
  const brandSet = new Set();
  const bandsByCategory = new Map();

  for (const product of products) {
    const nameTokens = tokensOf(product.product_name);
    const brandTokens = tokensOf(product.brands);
    const categoryTokens = [];
    for (const tag of product.categories_tags || []) {
      const leaf = String(tag).replace(/^en:/, '');
      categoryTokens.push(...tokensOf(leaf.replace(/-/g, ' ')));
    }
    const docTokens = new Set([...nameTokens, ...brandTokens, ...categoryTokens]);
    for (const token of docTokens) {
      documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
    }
    for (const brand of brandPieces(product.brands)) {
      brandSet.add(brand.toLowerCase());
    }

    const kcal = kcal100(product.nutriments);
    const headTag = (product.categories_tags || [])[0] || 'unknown';
    if (kcal != null && Number.isFinite(kcal)) {
      if (!bandsByCategory.has(headTag)) bandsByCategory.set(headTag, []);
      bandsByCategory.get(headTag).push(kcal);
    }
  }

  const tokenRows = [...documentFrequency.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, TOP_TOKEN_CAP);

  const tokenDf = {};
  for (const [token, df] of tokenRows) tokenDf[token] = df;

  const brands = [...brandSet].sort((left, right) => left.localeCompare(right));

  const categoryKcalBands = {};
  for (const [tag, values] of [...bandsByCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sorted = [...values].sort((a, b) => a - b);
    if (sorted.length < 3) continue;
    const pick = (q) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))];
    categoryKcalBands[tag] = {
      p05: pick(0.05),
      p50: pick(0.5),
      p95: pick(0.95),
      n: sorted.length,
    };
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const payload = {
    generator: 'scripts/buildTokenStats.mjs',
    source: 'tests/food-fixtures/recorded-off-products.json',
    documentCount,
    unknownDf: UNKNOWN_DF,
    tokenDf,
    brands,
    categoryKcalBands,
  };
  const outPath = path.join(OUT_DIR, 'tokenStats.json');
  fs.writeFileSync(outPath, `${JSON.stringify(payload)}\n`);

  const readme = `# Generated food-match data

Do not hand-edit these files.

Regenerate:

\`\`\`bash
node scripts/buildTokenStats.mjs
\`\`\`

Built from recorded Open Food Facts product payloads in
\`tests/food-fixtures/recorded-off-products.json\` (see \`scripts/recordEvalCorpus.js\`).

- \`tokenStats.json\` — document frequencies (top ~50k tokens), brand strings for
  fuzzy spelling credit only, and per-category kcal/100g percentile bands.
`;
  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), readme);

  const bytes = fs.statSync(outPath).size;
  console.log(`wrote ${outPath} tokens=${tokenRows.length} brands=${brands.length} bands=${Object.keys(categoryKcalBands).length} bytes=${bytes}`);
}

main();
