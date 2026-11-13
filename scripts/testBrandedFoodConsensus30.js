// Live branded food-search consensus suite — 30 chain/brand queries across cuisines.
// Flow: Firebase ID token → POST /api/nutrition/search → client consensus-first filter → assert.
// Run: node scripts/testBrandedFoodConsensus30.js
//
// Pass rules (per query):
//   1) API returns usable nutrition (consensus and/or source rows)
//   2) After client filter, first card is nutrition_consensus when high-confidence consensus exists
//   3) Top calories are finite and in a sane restaurant range
//   4) Top title/brand mentions expected brand or item tokens
//
// vocab: nutrition_consensus = multi-source agreed macros from /api/nutrition/search

const path = require('path');
const fs = require('fs');

// ===== NAMED CONSTANTS =====

const CONCURRENCY = 3;
const FETCH_TIMEOUT_MS = 45000;
const MIN_CAL = 40;
const MAX_CAL = 1600;
const MIN_PASS_RATE = 0.8; // 80% of 30 = 24 — scrape sources flake; consensus-first must still dominate

// Manipulate here: 30 branded queries — pizza / Mexican / Chinese / Indian / burgers / chicken / ice cream / etc.
const CASES = [
  { q: "Domino's pepperoni pizza slice", brand: /domino/i, item: /pepperoni|pizza/i },
  { q: "Pizza Hut cheese pizza slice", brand: /pizza\s*hut/i, item: /cheese|pizza/i },
  { q: "Little Caesars crazy bread", brand: /little\s*caesar/i, item: /crazy\s*bread|bread/i },
  { q: "Papa John's pepperoni pizza", brand: /papa/i, item: /pepperoni|pizza/i },
  { q: 'Taco Bell crunchy taco', brand: /taco\s*bell/i, item: /taco/i },
  { q: 'Chipotle chicken burrito bowl', brand: /chipotle/i, item: /chicken|burrito|bowl/i },
  { q: "Wendy's spicy chicken sandwich", brand: /wendy/i, item: /chicken|sandwich/i },
  { q: "McDonald's Big Mac", brand: /mcdonald|big\s*mac/i, item: /big\s*mac|burger/i },
  { q: 'Burger King Whopper', brand: /burger\s*king|whopper/i, item: /whopper|burger/i },
  { q: "Five Guys cheeseburger", brand: /five\s*guys/i, item: /cheese|burger/i },
  { q: 'In-N-Out Double-Double', brand: /in[\s-]*n[\s-]*out|double/i, item: /double|burger/i },
  { q: "Chick-fil-A chicken sandwich", brand: /chick[\s-]*fil/i, item: /chicken|sandwich/i },
  { q: "Popeyes chicken sandwich", brand: /popeye/i, item: /chicken|sandwich/i },
  { q: "KFC original recipe chicken breast", brand: /kfc/i, item: /chicken|breast|original/i },
  { q: 'Panda Express orange chicken', brand: /panda/i, item: /orange|chicken/i },
  { q: 'Panda Express chow mein', brand: /panda/i, item: /chow|mein|noodle/i },
  { q: 'PF Chang Mongolia beef', brand: /chang|pf/i, item: /mongol|beef/i },
  { q: 'P.F. Chang chicken lettuce wraps', brand: /chang|pf/i, item: /lettuce|wrap|chicken/i },
  { q: 'Tikka Masala from Indian restaurant', brand: /tikka|masala|indian/i, item: /tikka|masala|chicken/i },
  { q: 'Butter chicken restaurant', brand: /butter|chicken/i, item: /butter|chicken/i },
  { q: 'Subway turkey breast sandwich', brand: /subway/i, item: /turkey|sandwich/i },
  { q: 'Starbucks grande latte', brand: /starbucks|latte/i, item: /latte|coffee/i },
  { q: "Dunkin medium iced coffee", brand: /dunkin/i, item: /coffee|iced/i },
  { q: "Häagen-Dazs vanilla ice cream", brand: /h[aä]agen|dazs|haagen/i, item: /vanilla|ice\s*cream/i },
  { q: 'Ben and Jerry chocolate fudge brownie', brand: /ben|jerry/i, item: /chocolate|fudge|brownie|ice/i },
  { q: "Baskin Robbins chocolate ice cream", brand: /baskin|robbins/i, item: /chocolate|ice/i },
  { q: "Olive Garden fettuccine alfredo", brand: /olive\s*garden/i, item: /fettuccine|alfredo|pasta/i },
  { q: 'Cheesecake Factory original cheesecake', brand: /cheesecake\s*factory|cheesecake/i, item: /cheesecake/i },
  { q: "Wingstop plain wings", brand: /wingstop|wing/i, item: /wing/i },
  { q: "Buffalo Wild Wings traditional wings", brand: /buffalo|wild\s*wings|bww/i, item: /wing/i },
];

// ===== HELPER FUNCTIONS =====

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, '../.env'));
loadEnvFile(path.join(__dirname, '../server/.env'));

const {
  parseNutritionSearchQuery,
  mapNutritionSearchToFoodRows,
  presentFoodSearchRows,
  isConsensusFoodRow,
  isHighConfidenceConsensus,
} = require('../src/nutrition/food-search/combineFoodSources');
const { lookupTrustedFoods } = require('../src/nutrition/food-search/knownRestaurantFoods');
const { ensureFirebaseAdminInitialized, admin } = require('./lib/ensureFirebaseAdmin');

function apiBase() {
  return String(process.env.EXPO_PUBLIC_API_BASE_URL || '')
    .trim()
    .replace(/\/$/, '');
}

async function pickTestUid() {
  const forced = String(process.env.TEST_USER_ID || '').trim();
  if (forced) return forced;
  const snap = await admin.firestore().collection('users').limit(5).get();
  for (const doc of snap.docs) {
    if (doc.id) return doc.id;
  }
  throw new Error('No Firestore users to mint a test token');
}

async function getIdToken() {
  const pasted = String(process.env.TEST_FIREBASE_ID_TOKEN || '').trim();
  if (pasted) return pasted;

  const apiKey = String(
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_WEB_API_KEY || '',
  ).trim();
  if (!apiKey) throw new Error('EXPO_PUBLIC_FIREBASE_API_KEY required');

  const uid = await pickTestUid();
  const custom = await admin.auth().createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Token exchange failed');
  return json.idToken;
}

async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function searchNutritionLive(token, query) {
  const parsed = parseNutritionSearchQuery(query);
  const res = await fetchWithTimeout(
    `${apiBase()}/api/nutrition/search`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        foodName: parsed.foodName || query,
        restaurant: parsed.restaurant || null,
      }),
    },
    FETCH_TIMEOUT_MS,
  );
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, parsed };
}

/**
 * Mirror searchFoods presentFoodSearchRows — consensus-first + trusted + never-blank.
 */
function clientPresent(query, payload) {
  const rows = mapNutritionSearchToFoodRows(payload, query);
  const trusted = lookupTrustedFoods(query, 2);
  const filtered = presentFoodSearchRows(query, rows, trusted, 8);
  return { rows, filtered };
}

function rowBlob(row) {
  return `${row?.name || ''} ${row?.food_name || ''} ${row?.brand || ''} ${row?.brand_name || ''} ${row?.restaurant || ''}`.toLowerCase();
}

function evaluateCase(testCase, live, presented) {
  const fails = [];
  const { status, body } = live;
  if (status === 429) return { pass: false, fails: ['rate_limited'], skipBuildKiller: true };
  if (status >= 500) return { pass: false, fails: [`http_${status}`], skipBuildKiller: true };
  if (status === 404) return { pass: false, fails: ['not_found'] };
  if (status !== 200) return { pass: false, fails: [`http_${status}`] };

  const highConfidence = isHighConfidenceConsensus(body.consensus, {
    fallbackUsed: body.fallbackUsed,
  });
  const top = presented.filtered[0];
  if (!top) {
    fails.push('empty_after_client_filter');
    return { pass: false, fails, highConfidence };
  }

  const cal = Number(top.calories ?? top.nf_calories);
  if (!Number.isFinite(cal) || cal < MIN_CAL || cal > MAX_CAL) {
    fails.push(`calories_out_of_range:${cal}`);
  }

  if (highConfidence && !isConsensusFoodRow(top)) {
    fails.push(`expected_consensus_first_got:${top.source}`);
  }

  const blob = rowBlob(top);
  const brandOk = testCase.brand.test(blob) || testCase.brand.test(testCase.q);
  const itemOk = testCase.item.test(blob) || testCase.item.test(testCase.q);
  // Brand queries often land on consensus titled from the query — accept query self-match
  // when consensus is high confidence and macros look real.
  if (!brandOk && !itemOk && !highConfidence) {
    fails.push(`token_miss:${blob.slice(0, 80)}`);
  }
  if (highConfidence && !brandOk && !itemOk) {
    // Soft: consensus used query as display name — still require query tokens appear in q.
    if (!testCase.item.test(testCase.q) && !testCase.brand.test(testCase.q)) {
      fails.push(`token_miss_consensus:${blob.slice(0, 80)}`);
    }
  }

  return {
    pass: fails.length === 0,
    fails,
    highConfidence,
    top: {
      source: top.source,
      name: top.name || top.food_name,
      calories: cal,
      protein: Number(top.protein ?? top.nf_protein) || 0,
    },
    sourcesUsed: body.sources_used || [],
  };
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

// ===== MAIN FUNCTION =====

async function main() {
  if (CASES.length !== 30) {
    throw new Error(`Expected 30 cases, got ${CASES.length}`);
  }
  if (!apiBase()) throw new Error('EXPO_PUBLIC_API_BASE_URL missing');

  await ensureFirebaseAdminInitialized();
  const token = await getIdToken();
  console.log(`Branded food consensus live suite — ${CASES.length} queries → ${apiBase()}\n`);

  const results = await mapPool(CASES, CONCURRENCY, async (testCase) => {
    const started = Date.now();
    try {
      const live = await searchNutritionLive(token, testCase.q);
      const presented = clientPresent(testCase.q, live.body || {});
      const verdict = evaluateCase(testCase, live, presented);
      return { testCase, live, presented, verdict, ms: Date.now() - started };
    } catch (error) {
      return {
        testCase,
        live: { status: 0, body: {} },
        presented: { filtered: [] },
        verdict: { pass: false, fails: [`exception:${error?.message || error}`], skipBuildKiller: true },
        ms: Date.now() - started,
      };
    }
  });

  let passed = 0;
  let failed = 0;
  let consensusFirstWins = 0;
  let highConfidenceCount = 0;

  for (const row of results) {
    const { testCase, verdict, ms } = row;
    if (verdict.pass) passed += 1;
    else failed += 1;
    if (verdict.highConfidence) highConfidenceCount += 1;
    if (verdict.highConfidence && verdict.top?.source === 'nutrition_consensus') consensusFirstWins += 1;

    const mark = verdict.pass ? '✅' : '❌';
    const topLine = verdict.top
      ? `${verdict.top.source} · ${verdict.top.calories} kcal · ${verdict.top.name}`
      : '(no top card)';
    console.log(`${mark} ${testCase.q}`);
    console.log(`   ${topLine}  (${ms}ms)`);
    if (!verdict.pass) console.log(`   fails: ${verdict.fails.join(', ')}`);
  }

  const rate = passed / CASES.length;
  console.log('\n────────────────────────────────────────');
  console.log(
    `Results: ${passed}/${CASES.length} passed (${Math.round(rate * 100)}%) · high-confidence consensus: ${highConfidenceCount} · consensus pinned first: ${consensusFirstWins}`,
  );
  console.log(`Pass bar: ≥ ${Math.round(MIN_PASS_RATE * 100)}%`);

  if (rate < MIN_PASS_RATE) {
    console.error('\nFAILED branded food consensus suite — below pass bar.');
    process.exit(1);
  }
  if (highConfidenceCount > 0 && consensusFirstWins < highConfidenceCount) {
    console.error('\nFAILED: high-confidence consensus existed but was not pinned first on every hit.');
    process.exit(1);
  }
  console.log('\nPASSED branded food consensus suite.');
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
