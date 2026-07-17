#!/usr/bin/env node
/**
 * Food search accuracy harness — tests Coach Connect ranking/catalog (+ optional Serper).
 *
 *   node scripts/testFoodSearchPipelineAccuracy.js
 *   node scripts/testFoodSearchPipelineAccuracy.js --live          # also hit Serper
 *   node scripts/testFoodSearchPipelineAccuracy.js --only must
 *   node scripts/testFoodSearchPipelineAccuracy.js --limit 20
 */
const path = require('path');
const fs = require('fs');

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

const { FOOD_SEARCH_ACCURACY_CASES, MUST_PASS_CASES } = require('./data/foodSearchAccuracyCases');
const { lookupTrustedFoods } = require('../src/nutrition/food-search/trustedFoodCatalog');
const { filterFoodSearchRows } = require('../src/nutrition/food-search/sortBestFoodMatches');
const { applyFoodCardPresentationToRows } = require('../src/nutrition/food-search/cleanFoodCardLabels');
const {
  rankSerperFoodResultRows,
  scoreOrganicNutritionHit,
  macroCalorieConsistencyScore,
} = require('../src/nutrition/food-search/isReliableRestaurantFood');

function parseArgs(argv) {
  const args = { live: false, only: null, limit: null, verbose: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--live') args.live = true;
    else if (a === '--verbose') args.verbose = true;
    else if (a === '--only' && argv[i + 1]) args.only = argv[++i];
    else if (a === '--limit' && argv[i + 1]) args.limit = parseInt(argv[++i], 10);
  }
  return args;
}

function rowText(row) {
  return `${row?.food_name || row?.name || ''} ${row?.brand || row?.brand_name || ''} ${row?.serving_label || ''}`.toLowerCase();
}

function scoreCase(testCase, top) {
  const fails = [];
  if (!top) {
    return { pass: false, fails: ['no_top_result'], top: null };
  }
  const text = rowText(top);
  const name = String(top.food_name || top.name || '');
  const serving = String(top.serving_label || top.servingLabel || '');
  const cal = Number(top.nf_calories ?? top.calories) || 0;

  if (testCase.expectedName && !testCase.expectedName.test(name)) {
    fails.push(`name_mismatch:${name}`);
  }
  if (testCase.mustIncludeTokens) {
    for (const t of testCase.mustIncludeTokens) {
      if (!text.includes(String(t).toLowerCase())) fails.push(`missing_token:${t}`);
    }
  }
  if (testCase.forbidTokens) {
    for (const t of testCase.forbidTokens) {
      if (text.includes(String(t).toLowerCase())) fails.push(`forbidden_token:${t}`);
    }
  }
  if (testCase.forbidServing && testCase.forbidServing.test(serving)) {
    fails.push(`forbidden_serving:${serving}`);
  }
  if (testCase.expectedCal != null && testCase.expectedCal > 0) {
    const tol = testCase.calTolerance ?? 0.25;
    const diff = Math.abs(cal - testCase.expectedCal) / testCase.expectedCal;
    if (diff > tol) fails.push(`cal_off:${cal}_vs_${testCase.expectedCal}`);
  }

  return {
    pass: fails.length === 0,
    fails,
    top: {
      name,
      calories: cal,
      serving,
      protein: Number(top.nf_protein ?? top.protein) || 0,
      source: top.source,
    },
  };
}

function simulateAppSearch(query) {
  const trusted = lookupTrustedFoods(query, 3);
  const q = String(query || '').toLowerCase();

  // Inject the exact production junk that broke Crazy Bread screenshots.
  const junk = [];
  if (/\bcrazy\s*bread\b/.test(q) || /\blittle\s*caesar/.test(q)) {
    junk.push(
      {
        food_name: 'Crazy Breadmenu Items',
        brand: 'Little Caesars',
        serving_label: '10 pc nuggets',
        nf_calories: 800,
        nf_protein: 25,
        nf_total_carbohydrate: 128,
        nf_total_fat: 22,
        source: 'serper',
      },
      {
        food_name: '14" Cheese Pizza, Thin Crust',
        brand: 'Little Caesars',
        serving_label: '1 slice',
        nf_calories: 309,
        nf_protein: 16,
        nf_total_carbohydrate: 23,
        nf_total_fat: 17,
        source: 'serper',
      },
      {
        food_name: 'Little Caesars Pineapple Soda',
        brand: 'Pepsi',
        serving_label: '1 can',
        nf_calories: 42,
        nf_protein: 0,
        nf_total_carbohydrate: 12,
        nf_total_fat: 0,
        source: 'serper',
      },
    );
  }

  // For offline broad coverage: if no catalog hit, synthesize a plausible FatSecret-style row from the query.
  if (trusted.length === 0) {
    const title = query
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    trusted.push({
      food_name: title,
      name: title,
      brand: '',
      serving_label: '1 serving',
      nf_calories: 400,
      nf_protein: 20,
      nf_total_carbohydrate: 40,
      nf_total_fat: 15,
      calories: 400,
      protein: 20,
      carbs: 40,
      fat: 15,
      source: 'fatSecret',
    });
  }

  const merged = [...trusted, ...junk];
  const filtered = filterFoodSearchRows(query, merged, 10);
  const presented = applyFoodCardPresentationToRows(
    filtered.length ? filtered : trusted,
    query,
  );
  return presented;
}

async function runLiveSerper(query) {
  const axios = require('axios');
  const {
    extractMultipleSerperRowsFromOrganic,
    fixTypoForSerperQuery,
  } = require('../server/nutritionSearchHelpers');

  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error('SERPER_API_KEY missing');
  const q = fixTypoForSerperQuery(query);
  const res = await axios.post(
    'https://google.serper.dev/search',
    { q: `${q} nutrition facts calories protein carbs fat`, num: 10 },
    { headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }, timeout: 18000 },
  );
  const organic = res.data?.organic || [];
  const parsed = extractMultipleSerperRowsFromOrganic(organic, query, query.toLowerCase(), 12);
  const rows = parsed.map((p) => ({
    food_name: p.displayName,
    nf_calories: p.macros.calories,
    nf_protein: p.macros.protein,
    nf_total_carbohydrate: p.macros.carbs,
    nf_total_fat: p.macros.fat,
    serving_label: p.macros.servingLabel || null,
    source: 'serper',
    _organicScore: p.organicScore,
  }));
  const ranked = rankSerperFoodResultRows(rows, query);
  const trusted = lookupTrustedFoods(query, 2);
  const merged = filterFoodSearchRows(query, [...trusted, ...ranked], 10);
  return applyFoodCardPresentationToRows(merged.length ? merged : trusted, query);
}

async function main() {
  const args = parseArgs(process.argv);
  let cases = FOOD_SEARCH_ACCURACY_CASES;
  if (args.only === 'must') cases = MUST_PASS_CASES;
  if (args.limit) cases = cases.slice(0, args.limit);

  console.log(`\nFood search accuracy — ${cases.length} cases (live=${args.live})\n`);

  const results = [];
  let pass = 0;
  let fail = 0;

  for (const testCase of cases) {
    let rows = [];
    let mode = 'catalog+filter';
    try {
      if (args.live) {
        mode = 'live+catalog';
        rows = await runLiveSerper(testCase.query);
      } else {
        rows = simulateAppSearch(testCase.query);
      }
    } catch (e) {
      results.push({
        id: testCase.id,
        query: testCase.query,
        pass: false,
        fails: [`error:${e.message}`],
        mode,
      });
      fail += 1;
      continue;
    }

    const scored = scoreCase(testCase, rows[0]);
    if (scored.pass) pass += 1;
    else fail += 1;
    results.push({
      id: testCase.id,
      query: testCase.query,
      category: testCase.category,
      pass: scored.pass,
      fails: scored.fails,
      top: scored.top,
      mode,
    });

    if (args.verbose || !scored.pass) {
      const mark = scored.pass ? '✅' : '❌';
      console.log(
        `${mark} ${testCase.id} → ${scored.top?.name || '—'} (${scored.top?.calories ?? '—'} cal, ${scored.top?.serving || '—'})`,
      );
      if (!scored.pass) console.log(`   fails: ${scored.fails.join(', ')}`);
    }
  }

  const outPath = path.join(__dirname, 'data/foodSearchPipelineAccuracyResults.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        live: args.live,
        total: cases.length,
        pass,
        fail,
        passRate: cases.length ? pass / cases.length : 0,
        results,
      },
      null,
      2,
    ),
  );

  console.log(`\n${'═'.repeat(56)}`);
  console.log(`PASS ${pass} / ${cases.length} (${((pass / cases.length) * 100).toFixed(1)}%)`);
  console.log(`FAIL ${fail}`);
  console.log(`Wrote ${outPath}`);

  // Must-pass subset must be green in catalog mode.
  const must = results.filter((r) => MUST_PASS_CASES.some((m) => m.id === r.id));
  const mustFail = must.filter((r) => !r.pass);
  if (mustFail.length && !args.live) {
    console.error(`\nMust-pass failures (${mustFail.length}):`);
    mustFail.forEach((r) => console.error(` - ${r.id}: ${r.fails.join(', ')}`));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
