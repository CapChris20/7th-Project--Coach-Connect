#!/usr/bin/env node
/**
 * Live regression benchmark for multi-source nutrition connectors.
 * Usage: node scripts/benchmarkNutritionSources.mjs [--quick]
 */
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const BENCHMARK_ITEMS = [
  { foodName: '20 piece chicken mcnuggets', restaurant: "McDonald's", minCal: 820, maxCal: 900 },
  { foodName: 'four corner pizza slice', restaurant: "Jet's Pizza", minCal: 380, maxCal: 420 },
  { foodName: 'Tropicana orange juice 8 oz', restaurant: null, minCal: 105, maxCal: 115 },
  { foodName: 'chicken bowl', restaurant: 'Chipotle', minCal: 400, maxCal: 1200, wide: true },
  { foodName: 'large egg', restaurant: null, minCal: 70, maxCal: 76 },
  { foodName: 'Big Mac', restaurant: "McDonald's", minCal: 550, maxCal: 590 },
  { foodName: 'medium banana', restaurant: null, minCal: 100, maxCal: 110 },
  { foodName: 'Baconator', restaurant: "Wendy's", minCal: 930, maxCal: 980 },
  { foodName: '8 piece chicken nuggets', restaurant: 'Chick-fil-A', minCal: 240, maxCal: 270 },
  { foodName: '6 inch turkey sub', restaurant: 'Subway', minCal: 270, maxCal: 300 },
  { foodName: 'pepperoni pizza slice', restaurant: "Domino's", minCal: 270, maxCal: 310 },
  { foodName: 'grande caffe latte', restaurant: 'Starbucks', minCal: 180, maxCal: 200 },
  { foodName: 'coca cola 12 oz can', restaurant: null, minCal: 135, maxCal: 145 },
  { foodName: 'crunchwrap supreme', restaurant: 'Taco Bell', minCal: 520, maxCal: 550 },
  { foodName: 'original recipe chicken breast', restaurant: 'KFC', minCal: 370, maxCal: 410 },
  { foodName: 'double double', restaurant: 'In-N-Out', minCal: 650, maxCal: 690 },
  { foodName: 'broccoli cheddar soup cup', restaurant: 'Panera', minCal: 340, maxCal: 380 },
  { foodName: 'glazed donut', restaurant: 'Krispy Kreme', minCal: 180, maxCal: 200 },
  { foodName: 'Whopper', restaurant: 'Burger King', minCal: 650, maxCal: 680 },
  { foodName: 'cheeseburger', restaurant: 'Five Guys', minCal: 840, maxCal: 870 },
  { foodName: 'avocado medium', restaurant: null, minCal: 110, maxCal: 130 },
  { foodName: 'white rice cooked 1 cup', restaurant: null, minCal: 195, maxCal: 215 },
  { foodName: 'atlantic salmon 4 oz', restaurant: null, minCal: 180, maxCal: 230 },
  { foodName: 'plain greek yogurt cup', restaurant: null, minCal: 90, maxCal: 120 },
  { foodName: 'zzzz_nonexistent_food_xyz', restaurant: null, expect404: true },
];

const QUICK_ITEMS = BENCHMARK_ITEMS.slice(0, 5);

function inBand(cal, item) {
  if (cal == null) return false;
  if (item.expect404) return false;
  return cal >= item.minCal && cal <= item.maxCal;
}

async function loadSearch() {
  const mod = await import(
    pathToFileURL(path.join(root, 'server/lib/nutritionMultiSourceSearch/scrapeNutritionSources.js')).href
  );
  return mod.searchFoodNutrition;
}

async function runItem(searchFoodNutrition, item) {
  const result = await searchFoodNutrition({
    foodName: item.foodName,
    restaurant: item.restaurant,
    timeoutMs: 8000,
  });

  const perSource = Object.entries(result.rawResults || {})
    .filter(([, v]) => v != null)
    .map(([key, v]) => ({
      source: key,
      calories: v.calories,
      url: v.url || null,
      inBand: inBand(v.calories, item),
    }));

  const consensusCal = result.consensus?.calories?.value ?? null;
  const inlierCount = (result.sourceResults || []).length;
  const hasConsensus = consensusCal != null;

  let pass = false;
  if (item.expect404) {
    pass = perSource.length === 0 && !hasConsensus;
  } else {
    const inBandSources = perSource.filter((s) => s.inBand);
    pass =
      inBandSources.length >= 2 &&
      (consensusCal == null || inBand(consensusCal, item)) &&
      perSource.every((s) => s.calories == null || s.calories >= (item.restaurant ? 50 : 20));
  }

  return {
    query: item,
    pass,
    perSource,
    consensusCal,
    inlierCount,
    sourceResults: result.sourceResults || [],
    excludedSources: result.excludedSources || [],
  };
}

async function main() {
  const quick = process.argv.includes('--quick');
  const items = quick ? QUICK_ITEMS : BENCHMARK_ITEMS;
  const searchFoodNutrition = await loadSearch();

  console.log(`\nNutrition benchmark (${items.length} items${quick ? ', quick' : ''})\n`);

  let passed = 0;
  for (const item of items) {
    const row = await runItem(searchFoodNutrition, item);
    const label = item.restaurant
      ? `${item.restaurant} — ${item.foodName}`
      : item.foodName;
    const status = row.pass ? 'PASS' : 'FAIL';
    if (row.pass) passed += 1;

    console.log(`[${status}] ${label}`);
    for (const s of row.perSource) {
      console.log(`  ${s.source}: ${s.calories ?? '—'} cal ${s.inBand ? '✓' : ''} ${s.url || ''}`);
    }
    if (row.consensusCal != null) {
      console.log(`  consensus: ${row.consensusCal} cal (${row.inlierCount} inlier rows)`);
    }
    if (row.excludedSources?.length) {
      console.log(`  excluded: ${row.excludedSources.map((e) => `${e.source}(${e.reason})`).join(', ')}`);
    }
    console.log('');
  }

  console.log(`Result: ${passed}/${items.length} passed\n`);
  process.exit(passed === items.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
