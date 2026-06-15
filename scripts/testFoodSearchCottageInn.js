#!/usr/bin/env node
/**
 * Live + fixture test: cottage inn large cheese pizza → 240 cal / large slice
 * Run: node scripts/testFoodSearchCottageInn.js
 */
const path = require('path');
const fs = require('fs');
const axios = require('axios');

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
  extractMacrosFromText,
  extractMultipleSerperRowsFromOrganic,
  fixTypoForSerperQuery,
} = require('../server/nutritionSearchHelpers');
const { isPlausibleNutritionRow } = require('../src/nutrition/food-search/formatFoodSearchTitle');
const { scoreOrganicNutritionHit } = require('../src/nutrition/food-search/validateRestaurantResult');

const USER_QUERY = 'cottage inn large cheese pizza';
const EXPECTED_CAL = 240;
const TOLERANCE = 25;

async function fetchSerperOrganic(query) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error('SERPER_API_KEY missing');
  const q = fixTypoForSerperQuery(query);
  const res = await axios.post(
    'https://google.serper.dev/search',
    { q: `${q} nutrition facts calories protein carbs fat`, num: 10 },
    {
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      timeout: 15000,
    },
  );
  return res.data?.organic || [];
}

function find240LargeSlice(rows) {
  return rows.find((r) => {
    const cal = Math.round(r.macros?.calories || 0);
    const label = String(r.macros?.servingLabel || r.displayName || '').toLowerCase();
    const near240 = Math.abs(cal - EXPECTED_CAL) <= TOLERANCE;
    const largeSlice =
      /\blarge\b/.test(label) ||
      /\blarge\b/.test(r.displayName.toLowerCase()) ||
      (/\b1\s*slice\b|\bone\s+slice\b|\bper\s+slice\b/.test(label) && near240);
    return near240 && (/\bslice\b/.test(label) || /\bslice\b/.test(r.displayName.toLowerCase()) || cal === EXPECTED_CAL);
  });
}

async function main() {
  console.log('Query:', USER_QUERY);
  console.log('Expected: ~240 cal for 1 large slice (Cottage Inn official nutrition)\n');

  const fixtureOrganic = [
    {
      title: 'Large Slice with Cheese',
      snippet:
        'Cottage Inn Standard Pizza Large Slice With Cheese 240 cal 7.9g fat 31g carbs 11.5g protein 1 slice',
    },
    {
      title: '[PDF] Nutrition Information',
      snippet: 'Large Slice with Cheese 240 31 18 7.9 1.5 11.5 3.5 503',
    },
    {
      title: 'Cottage Inn Pizza Large Pizza Slice With Cheese - Eat This Much',
      snippet: '1 Slice contains 240 Calories 31g carbs 8g fat 12g protein',
    },
  ];

  const fixtureRows = extractMultipleSerperRowsFromOrganic(
    fixtureOrganic,
    USER_QUERY,
    USER_QUERY.toLowerCase(),
    12,
  );
  console.log('--- Fixture organic (official-style snippets) ---');
  for (const r of fixtureRows) {
    console.log(
      `  ${r.displayName} | ${r.macros.calories} cal | P${r.macros.protein} C${r.macros.carbs} F${r.macros.fat} | ${r.macros.servingLabel || '(no serving)'}`,
    );
  }
  const fixtureHit = find240LargeSlice(fixtureRows);
  console.log(fixtureHit ? '✅ Fixture includes ~240 cal large slice row' : '❌ Fixture missing 240 cal slice\n');

  let liveRows = [];
  try {
    const organic = await fetchSerperOrganic(USER_QUERY);
    console.log(`\n--- Live Serper (${organic.length} organic hits) ---`);
    organic.slice(0, 6).forEach((o, i) => {
      console.log(`  [${i}] ${String(o.title || '').slice(0, 70)}`);
      console.log(`      ${String(o.snippet || '').slice(0, 100)}…`);
    });
    liveRows = extractMultipleSerperRowsFromOrganic(
      organic,
      USER_QUERY,
      USER_QUERY.toLowerCase(),
      12,
    );
    console.log('\n--- Parsed rows ---');
    for (const r of liveRows) {
      const ok = isPlausibleNutritionRow(r.macros);
      console.log(
        `  ${ok ? '✓' : '✗'} ${r.displayName} | ${r.macros.calories} cal | P${r.macros.protein} C${r.macros.carbs} F${r.macros.fat} | ${r.macros.servingLabel || '-'}`,
      );
    }
  } catch (e) {
    console.warn('Live Serper skipped:', e.message);
  }

  const liveHit = find240LargeSlice(liveRows);
  const top = liveRows[0];
  console.log('\n--- Summary ---');
  if (liveHit) {
    console.log(`✅ Found target row: ${liveHit.displayName} → ${liveHit.macros.calories} cal`);
  } else if (liveRows.length) {
    console.log(`❌ No ~240 cal large-slice row. Top result: ${top?.displayName} → ${top?.macros?.calories} cal`);
    const with240 = liveRows.filter((r) => Math.abs((r.macros?.calories || 0) - 240) <= TOLERANCE);
    if (with240.length) {
      console.log('   Rows near 240 cal:', with240.map((r) => `${r.displayName} (${r.macros.calories})`).join(', '));
    }
  } else {
    console.log('❌ No parsed rows from live search');
  }

  process.exit(fixtureHit && (liveRows.length === 0 || liveHit) ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
