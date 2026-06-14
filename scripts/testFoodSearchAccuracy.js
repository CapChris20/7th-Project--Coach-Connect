#!/usr/bin/env node
/**
 * Batch Serper restaurant food-search accuracy check (same pipeline as production).
 *
 * Run:
 *   npm run test:food-search                    # all 100 cases (summary mode)
 *   npm run test:food-search -- --limit 10      # first 10
 *   npm run test:food-search -- --category pizza
 *   npm run test:food-search -- --only jets-crazy-bread,wendys-frosty-large
 *   npm run test:food-search -- --smoke         # original 7 regression cases
 *   node scripts/testFoodSearchAccuracy.js --query "jets crazy bread" --verbose
 *
 * Requires SERPER_API_KEY in server/.env or .env (same as production food search).
 */
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const { FOOD_SEARCH_ACCURACY_CASES } = require('./data/foodSearchAccuracyCases');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvFile(path.join(__dirname, '../server/.env'));
loadEnvFile(path.join(__dirname, '../.env'));

const {
  extractMultipleSerperRowsFromOrganic,
  fixTypoForSerperQuery,
} = require('../server/nutritionSearchHelpers');
const {
  rankSerperFoodResultRows,
  scoreOrganicNutritionHit,
  macroCalorieConsistencyScore,
} = require('../src/nutrition/utils/restaurantSerperQuality');

/** Original smoke / regression subset */
const SMOKE_CASE_IDS = [
  'jets-buffalo-slice',
  'ledo-pepperoni-square',
  'portillos-italian-beef',
  'torchys-trailer-park',
  'pollo-tropical-tropichop',
  'white-castle-sliders',
  'cold-stone-cake-batter',
];

async function fetchSerperOrganic(query, num = 10) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error('SERPER_API_KEY missing — add to server/.env');
  const q = fixTypoForSerperQuery(query);
  const res = await axios.post(
    'https://google.serper.dev/search',
    { q: `${q} nutrition facts calories protein carbs fat`, num },
    {
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      timeout: 18000,
    },
  );
  return res.data?.organic || [];
}

function toAppRow(displayName, macros, organicScore) {
  return {
    food_name: displayName,
    name: displayName,
    nf_calories: macros.calories,
    nf_protein: macros.protein,
    nf_total_carbohydrate: macros.carbs,
    nf_total_fat: macros.fat,
    serving_label: macros.servingLabel || null,
    source: 'serper',
    _organicScore: organicScore,
  };
}

function formatRow(r, i) {
  const cal = Math.round(r.nf_calories ?? r.calories ?? 0);
  const p = Math.round(r.nf_protein ?? r.protein ?? 0);
  const c = Math.round(r.nf_total_carbohydrate ?? r.carbs ?? 0);
  const f = Math.round(r.nf_total_fat ?? r.fat ?? 0);
  const serving = r.serving_label || r.serving_unit || '—';
  const consistency = macroCalorieConsistencyScore({
    calories: cal,
    protein: p,
    carbs: c,
    fat: f,
  });
  return `  ${i + 1}. ${r.food_name || r.name}
     ${cal} cal | P ${p}g | C ${c}g | F ${f}g | serving: ${serving}
     macro/cal consistency: ${consistency}/100 | organic score: ${r._organicScore ?? '—'}`;
}

function topRowSummary(row) {
  if (!row) return null;
  return {
    name: row.food_name || row.name,
    calories: Math.round(row.nf_calories ?? row.calories ?? 0),
    protein: Math.round(row.nf_protein ?? row.protein ?? 0),
    carbs: Math.round(row.nf_total_carbohydrate ?? row.carbs ?? 0),
    fat: Math.round(row.nf_total_fat ?? row.fat ?? 0),
    serving: row.serving_label || row.serving_unit || null,
    consistency: macroCalorieConsistencyScore({
      calories: row.nf_calories ?? row.calories,
      protein: row.nf_protein ?? row.protein,
      carbs: row.nf_total_carbohydrate ?? row.carbs,
      fat: row.nf_total_fat ?? row.fat,
    }),
  };
}

async function runCase(testCase, { verbose }) {
  const { id, query, notes, googleHint, category } = testCase;

  if (verbose) {
    console.log('\n' + '═'.repeat(72));
    console.log(`CASE: ${id}${category ? ` [${category}]` : ''}`);
    console.log(`Query: "${query}"`);
    console.log(`Notes: ${notes}`);
    if (googleHint) console.log(`Google check: ${googleHint}`);
  }

  let organic = [];
  try {
    organic = await fetchSerperOrganic(query);
  } catch (e) {
    if (verbose) console.log(`\n❌ Serper failed: ${e.message}`);
    return { id, query, category, ok: false, rows: [], error: e.message };
  }

  if (verbose) {
    console.log(`\nTop Serper hits (relevance score):`);
    organic.slice(0, 5).forEach((hit, i) => {
      const sc = scoreOrganicNutritionHit(hit, query);
      const title = String(hit.title || '').slice(0, 65);
      console.log(`  [${i}] (${sc}) ${title}`);
    });
  }

  const parsed = extractMultipleSerperRowsFromOrganic(organic, query, query.toLowerCase(), 12);
  const appRows = parsed.map((p) => toAppRow(p.displayName, p.macros, p.organicScore));
  const ranked = rankSerperFoodResultRows(appRows, query);

  if (ranked.length === 0) {
    if (verbose) console.log('\n⚠️  No plausible nutrition rows parsed.');
    return { id, query, category, ok: false, rows: [], error: 'no_rows' };
  }

  if (verbose) {
    console.log(`\nParsed results (${ranked.length}) — ranked for app:`);
    ranked.forEach((r, i) => console.log(formatRow(r, i)));
  }

  return { id, query, category, ok: true, rows: ranked, top: topRowSummary(ranked[0]) };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const flag = (name) => args.includes(name);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : null;
  };

  const queryIdx = args.indexOf('--query');
  if (queryIdx >= 0 && args[queryIdx + 1]) {
    return {
      cases: [{ id: 'custom', query: args[queryIdx + 1], notes: 'Custom query from CLI' }],
      verbose: flag('--verbose') || !flag('--quiet'),
      delayMs: Number(opt('--delay-ms')) || 400,
      jsonOut: opt('--json'),
    };
  }

  let pool = [...FOOD_SEARCH_ACCURACY_CASES];

  if (flag('--smoke')) {
    const byId = new Map(pool.map((c) => [c.id, c]));
    pool = SMOKE_CASE_IDS.map((id) => byId.get(id)).filter(Boolean);
  }

  const only = opt('--only');
  if (only) {
    const ids = new Set(only.split(',').map((s) => s.trim()));
    pool = pool.filter((c) => ids.has(c.id));
  }

  const category = opt('--category');
  if (category) {
    pool = pool.filter((c) => c.category === category);
  }

  const limit = opt('--limit');
  if (limit) {
    const n = Math.max(1, parseInt(limit, 10) || 0);
    pool = pool.slice(0, n);
  }

  const forceVerbose = flag('--verbose');
  const forceQuiet = flag('--quiet');
  const verbose = forceVerbose || (!forceQuiet && pool.length <= 12);

  return {
    cases: pool,
    verbose,
    delayMs: Number(opt('--delay-ms')) || 400,
    jsonOut: opt('--json'),
  };
}

async function main() {
  const { cases, verbose, delayMs, jsonOut } = parseArgs();

  console.log('Coach Connect — Food search accuracy batch test');
  console.log(`Library: ${FOOD_SEARCH_ACCURACY_CASES.length} distinct restaurant cases in scripts/data/foodSearchAccuracyCases.js`);
  console.log(`Running: ${cases.length} case(s) | mode: ${verbose ? 'verbose' : 'summary'}`);
  console.log('Pipeline: extractMultipleSerperRowsFromOrganic + rankSerperFoodResultRows');
  if (!verbose) {
    console.log('Tip: --verbose for full rows, --smoke for 7 regressions, --category pizza, --limit 20\n');
  } else {
    console.log('Compare each row to Google. No auto pass/fail on calories.\n');
  }

  if (!process.env.SERPER_API_KEY) {
    console.error('❌ SERPER_API_KEY not set. Add to server/.env then re-run.');
    process.exit(1);
  }

  if (cases.length === 0) {
    console.error('❌ No cases matched filters. Check --only / --category / --smoke.');
    process.exit(1);
  }

  const summary = [];
  let i = 0;
  for (const tc of cases) {
    i += 1;
    if (!verbose) {
      process.stdout.write(`\r[${i}/${cases.length}] ${tc.id}…`.padEnd(48));
    }
    summary.push(await runCase(tc, { verbose }));
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
  if (!verbose) process.stdout.write('\r' + ' '.repeat(48) + '\r');

  console.log('\n' + '═'.repeat(72));
  console.log('SUMMARY');
  for (const s of summary) {
    const top = s.top || topRowSummary(s.rows[0]);
    const topLine = top
      ? `${top.calories} cal (consistency ${top.consistency}) — ${top.name}`
      : s.error || 'no data';
    const cat = s.category ? ` [${s.category}]` : '';
    console.log(`  ${s.ok ? '✓' : '⚠'} ${s.id}${cat}: ${topLine}`);
  }

  const failed = summary.filter((s) => !s.ok).length;
  console.log(`\n${summary.length - failed}/${summary.length} returned at least one ranked row.`);

  if (jsonOut) {
    const outPath = path.isAbsolute(jsonOut) ? jsonOut : path.join(process.cwd(), jsonOut);
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          caseCount: summary.length,
          results: summary.map((s) => ({
            id: s.id,
            query: s.query,
            category: s.category,
            ok: s.ok,
            error: s.error,
            top: s.top,
            rowCount: s.rows?.length ?? 0,
          })),
        },
        null,
        2,
      ),
    );
    console.log(`Wrote ${outPath}`);
  }

  console.log('\nDone. Restart API (pipeline v26+) and reload app to match production.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
