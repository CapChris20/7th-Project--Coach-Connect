#!/usr/bin/env node
/**
 * Offline eval of food-search pipelines (v1 live path, v2 shadow matcher).
 * No network. Reads tests/food-fixtures/corpus.json.
 * Same input produces byte-identical JSON.
 *
 *   node scripts/evalFoodSearch.js
 *   node scripts/evalFoodSearch.js --pipeline v2
 *   node scripts/evalFoodSearch.js --write-baseline
 */
const fs = require('fs');
const path = require('path');

const { presentFoodSearchRows } = require('../src/nutrition/food-search/combineFoodSources');
const { lookupTrustedFoods } = require('../src/nutrition/food-search/knownRestaurantFoods');
const { isUsableBarcodeFood } = require('../src/nutrition/barcode/rejectBadBarcodeResults');
const { pickBestBarcodeCandidate } = require('../server/lib/barcodeMerge');
const { getFoodNutritionConsensus } = require('../server/lib/nutritionMultiSourceSearch/getFoodNutritionConsensus');
const { createCandidate } = require('../src/nutrition/food-match/candidate');
const { matchCandidatesV2 } = require('../src/nutrition/food-match/matchFoodsV2');

const CORPUS_PATH = path.join(__dirname, '../tests/food-fixtures/corpus.json');
const BASELINE_PATH = path.join(__dirname, '../scripts/data/foodSearchEvalBaseline.json');
const INVARIANT_PATH = path.join(__dirname, '../scripts/data/foodSearchEvalInvariantResults.json');
const V2_RESULTS_PATH = path.join(__dirname, '../scripts/data/foodSearchEvalV2.json');

const SEARCH_CATEGORIES = ['packaged_brand', 'restaurant_menu', 'generic_ingredient'];
const ALL_CATEGORIES = [...SEARCH_CATEGORIES, 'barcode'];

function gtin14(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length > 14) return digits.slice(-14);
  return digits.padStart(14, '0');
}

function productToRow(product) {
  return {
    id: product.id,
    name: product.name,
    food_name: product.name,
    brand: product.brand || '',
    brand_name: product.brand || '',
    source: product.source || 'openfoodfacts',
    calories: product.kcal,
    protein: product.protein,
    carbs: product.carbs,
    fat: product.fat,
    nf_calories: product.kcal,
    nf_protein: product.protein,
    nf_total_carbohydrate: product.carbs,
    nf_total_fat: product.fat,
    serving_label: product.servingLabel || (product.basis === '100g' ? '100 g' : '1 serving'),
    categoryPath: product.categoryPath || [],
    gtinUpc: product.code || null,
  };
}

function productToCandidate(product) {
  const per100 = product.basis === '100g'
    ? {
      kcal: product.kcal,
      protein: product.protein,
      carbs: product.carbs,
      fat: product.fat,
      basis: 'g',
    }
    : null;
  const servings = per100
    ? []
    : [{
      label: product.servingLabel || '1 serving',
      grams: null,
      kcal: product.kcal,
      protein: product.protein,
      carbs: product.carbs,
      fat: product.fat,
      origin: 'label',
    }];
  return createCandidate({
    id: product.id,
    source: 'openFoodFacts',
    name: product.name,
    brand: product.brand || '',
    categoryPath: product.categoryPath || [],
    channel: product.brand ? 'packaged' : 'generic',
    gtin: product.code || null,
    per100,
    servings,
    quality: {
      completeness: [product.kcal, product.protein, product.carbs, product.fat]
        .filter((value) => value != null).length / 4,
      sourceFlags: [],
    },
    provenance: { url: null, fetchedAt: null },
  });
}

function decideSearchV2(query, candidates) {
  const decision = matchCandidatesV2(query, candidates);
  const results = [];
  for (const row of decision.results || []) {
    results.push({
      id: String(row.id || ''),
      source: row.candidate?.source || null,
      name: row.candidate?.name || '',
      brand: row.candidate?.brand || '',
      score: row.score,
    });
  }
  return { status: decision.status, results, reasons: decision.reasons || [] };
}

function loadCorpus() {
  if (!fs.existsSync(CORPUS_PATH)) {
    throw new Error(`missing ${CORPUS_PATH}. Record payloads, then run scripts/buildEvalCorpus.js.`);
  }
  return JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'));
}

/**
 * v1 shows the first surviving card as the answer.
 * There is no ambiguous status. Empty means none.
 */
function decideSearch(query, rows) {
  const trusted = lookupTrustedFoods(query, 2);
  const shown = presentFoodSearchRows(query, rows, trusted, 8) || [];
  const results = [];
  for (const row of shown) {
    results.push({
      id: String(row.id || ''),
      source: row.source || null,
      name: row.name || row.food_name || '',
      brand: row.brand || row.brand_name || '',
    });
  }
  if (!results.length) return { status: 'none', results };
  return { status: 'confident', results };
}

/**
 * v1 barcode fill for one recorded OFF row: usable + best candidate.
 * This is the exact-code path only. Mismatched web fills are traced separately.
 */
function decideBarcode(barcodeCase, product) {
  if (!product) return { status: 'none', topId: null, gtinMatch: false, results: [] };
  const row = productToRow(product);
  const picked = pickBestBarcodeCandidate([row].filter((item) => isUsableBarcodeFood(item)));
  if (!picked || !isUsableBarcodeFood(picked)) {
    return { status: 'none', topId: null, gtinMatch: false, results: [] };
  }
  const match = gtin14(picked.gtinUpc) === gtin14(barcodeCase.scanned);
  return {
    status: 'confident',
    topId: product.id,
    gtinMatch: match,
    results: [{ id: product.id, source: picked.source || null, name: picked.name || '', brand: picked.brand || '' }],
  };
}

function blankTally() {
  return {
    cases: 0,
    answerable: 0,
    unanswerable: 0,
    confident: 0,
    ambiguous: 0,
    none: 0,
    wrongConfident: 0,
    correctTop1: 0,
    recallAt5: 0,
    emptyWhenUnanswerable: 0,
    wrongAutoFill: 0,
    autoFill: 0,
  };
}

function addOutcome(tally, outcome) {
  tally.cases += 1;
  if (outcome.answerable) tally.answerable += 1;
  else tally.unanswerable += 1;
  tally[outcome.status] += 1;
  if (outcome.wrongConfident) tally.wrongConfident += 1;
  if (outcome.correctTop1) tally.correctTop1 += 1;
  if (outcome.recallAt5) tally.recallAt5 += 1;
  if (!outcome.answerable && outcome.status === 'none') tally.emptyWhenUnanswerable += 1;
  if (outcome.autoFill) tally.autoFill += 1;
  if (outcome.wrongAutoFill) tally.wrongAutoFill += 1;
}

function rate(part, whole) {
  if (!whole) return null;
  return Math.round((part / whole) * 1000000) / 1000000;
}

function finishTally(tally) {
  return {
    cases: tally.cases,
    answerable: tally.answerable,
    unanswerable: tally.unanswerable,
    confident: tally.confident,
    ambiguous: tally.ambiguous,
    none: tally.none,
    wrongConfident: tally.wrongConfident,
    wrongConfidentRate: rate(tally.wrongConfident, tally.cases),
    correctTop1: tally.correctTop1,
    correctTop1Rate: rate(tally.correctTop1, tally.answerable),
    recallAt5: tally.recallAt5,
    recallAt5Rate: rate(tally.recallAt5, tally.answerable),
    emptyWhenUnanswerable: tally.emptyWhenUnanswerable,
    emptyWhenUnanswerableRate: rate(tally.emptyWhenUnanswerable, tally.unanswerable),
    autoFill: tally.autoFill,
    wrongAutoFill: tally.wrongAutoFill,
    wrongAutoFillRate: rate(tally.wrongAutoFill, tally.cases),
  };
}

function emptyReport() {
  const report = {};
  for (const category of ALL_CATEGORIES) report[category] = finishTally(blankTally());
  return report;
}

function summarize(outcomes) {
  const buckets = {
    all: {},
    tune: {},
    holdout: {},
  };
  for (const split of Object.keys(buckets)) {
    for (const category of ALL_CATEGORIES) buckets[split][category] = blankTally();
  }
  for (const outcome of outcomes) {
    addOutcome(buckets.all[outcome.category], outcome);
    addOutcome(buckets[outcome.split][outcome.category], outcome);
  }
  const finished = {};
  for (const split of Object.keys(buckets)) {
    finished[split] = {};
    for (const category of ALL_CATEGORIES) finished[split][category] = finishTally(buckets[split][category]);
  }
  return finished;
}

function runEval(corpus = loadCorpus(), pipeline = 'v1') {
  const products = corpus.products || [];
  const productById = new Map(products.map((product) => [product.id, product]));
  const rows = products.map(productToRow);
  const candidates = products.map(productToCandidate);
  const outcomes = [];

  for (const testCase of corpus.cases || []) {
    const decision = pipeline === 'v2'
      ? decideSearchV2(testCase.query, candidates)
      : decideSearch(testCase.query, rows);
    const top = decision.results[0] || null;
    const topId = top ? top.id : null;
    const ids = decision.results.map((row) => row.id);
    const targetRank = testCase.targetId ? ids.indexOf(testCase.targetId) : -1;
    const outcome = {
      id: testCase.id,
      category: testCase.category,
      split: testCase.split,
      perturbation: testCase.perturbation,
      answerable: Boolean(testCase.answerable),
      status: decision.status,
      topId,
      topBrand: top ? top.brand : '',
      topSource: top ? top.source : null,
      targetId: testCase.targetId,
      cousinId: testCase.cousinId || null,
      topIsTarget: Boolean(testCase.targetId) && topId === testCase.targetId,
      topIsCousin: Boolean(testCase.cousinId) && topId === testCase.cousinId,
      wrongConfident: decision.status === 'confident' && topId !== testCase.targetId,
      correctTop1: Boolean(testCase.answerable) && topId === testCase.targetId,
      recallAt5: Boolean(testCase.answerable) && targetRank >= 0 && targetRank < 5,
      autoFill: false,
      wrongAutoFill: false,
      shownIds: ids,
    };
    outcomes.push(outcome);
  }

  for (const testCase of corpus.barcodeCases || []) {
    const product = productById.get(testCase.targetId);
    const decision = decideBarcode(testCase, product);
    const wrongAutoFill = decision.status === 'confident' && !decision.gtinMatch;
    outcomes.push({
      id: testCase.id,
      category: 'barcode',
      split: testCase.split,
      perturbation: testCase.perturbation,
      answerable: true,
      status: decision.status,
      topId: decision.topId,
      targetId: testCase.targetId,
      cousinId: null,
      topIsTarget: decision.gtinMatch && decision.status === 'confident',
      topIsCousin: false,
      wrongConfident: wrongAutoFill,
      correctTop1: decision.status === 'confident' && decision.gtinMatch,
      recallAt5: decision.status === 'confident' && decision.gtinMatch,
      autoFill: decision.status === 'confident',
      wrongAutoFill,
      topBrand: decision.results[0]?.brand || '',
      topSource: decision.results[0]?.source || null,
      shownIds: decision.results.map((row) => row.id),
    });
  }

  outcomes.sort((left, right) => left.id.localeCompare(right.id));
  return {
    pipeline: pipeline === 'v2' ? 'v2-matchFoodsV2' : 'v1-presentFoodSearchRows',
    retrieval: corpus.retrieval || 'closed-world recorded sample',
    notes: pipeline === 'v2'
      ? [
        'v2 uses gates + score + decide. Status may be confident, ambiguous, or none.',
        'Wrong-confident counts only status=confident with the wrong top entity.',
        'Search candidates are the recorded sample as Candidates. Not a live source call.',
        'Barcode path is unchanged in P2 (still v1 exact-code helper).',
      ]
      : [
        'v1 has no ambiguous status. Any non-empty list is counted as confident.',
        'Search candidates are the recorded sample plus lookupTrustedFoods seeds. Not a live source call.',
        'Barcode numbers here are exact recorded codes through isUsableBarcodeFood and pickBestBarcodeCandidate.',
        'A non-matching barcode fill is traced in scripts/data/barcodeMismatchTrace.json and is not in this rate.',
      ],
    productCount: products.length,
    metrics: summarize(outcomes),
    cases: outcomes,
  };
}

function constructedRow(fields) {
  return {
    id: fields.id,
    name: fields.name,
    food_name: fields.name,
    brand: fields.brand || '',
    source: fields.source,
    calories: fields.calories,
    protein: fields.protein,
    carbs: fields.carbs,
    fat: fields.fat,
    nf_calories: fields.calories,
    nf_protein: fields.protein,
    nf_total_carbohydrate: fields.carbs,
    nf_total_fat: fields.fat,
    serving_label: '1 serving',
  };
}

function rowShown(query, row) {
  const decision = decideSearch(query, [row]);
  return decision.results.some((shown) => shown.id === row.id);
}

function runInvariants(corpus, evalResult, evalJsonA, evalJsonB, pipeline = 'v1') {
  const results = [];
  const outcomes = evalResult.cases;
  const byId = new Map(outcomes.map((outcome) => [outcome.id, outcome]));
  const useV2 = pipeline === 'v2';

  const productById = new Map((corpus.products || []).map((product) => [product.id, product]));
  const dropBrandFails = [];
  for (const outcome of outcomes) {
    if (outcome.perturbation !== 'drop_brand') continue;
    if (outcome.status !== 'confident') continue;
    if (!outcome.topId || outcome.topId === outcome.targetId) continue;
    const targetBrand = String(productById.get(outcome.targetId)?.brand || '').trim().toLowerCase();
    const shownBrand = String(outcome.topBrand || '').trim().toLowerCase();
    if (shownBrand && targetBrand && shownBrand !== targetBrand) dropBrandFails.push(outcome.id);
  }
  results.push({
    id: 1,
    name: 'Dropping the brand token never promotes a different-brand row to confident',
    holds: dropBrandFails.length === 0,
    failures: dropBrandFails.slice(0, 20),
    failureCount: dropBrandFails.length,
  });

  const typoFails = [];
  for (const product of corpus.products || []) {
    const exact = byId.get(`${product.id}:exact`);
    const typo = byId.get(`${product.id}:typo_rare`);
    if (!exact || !typo) continue;
    if (exact.topId !== typo.topId) typoFails.push(product.id);
  }
  results.push({
    id: 2,
    name: 'A one-edit typo on a rare token yields the same top entity',
    holds: typoFails.length === 0,
    failures: typoFails.slice(0, 20),
    failureCount: typoFails.length,
  });

  const rareFails = outcomes.filter((outcome) => outcome.perturbation === 'unanswerable' && outcome.status === 'confident');
  results.push({
    id: 3,
    name: 'An unexplained rare token yields none or ambiguous, never confident',
    holds: rareFails.length === 0,
    failures: rareFails.slice(0, 20).map((outcome) => outcome.id),
    failureCount: rareFails.length,
  });

  const cousinFails = [];
  for (const outcome of outcomes) {
    if (!outcome.answerable || !outcome.cousinId) continue;
    const cousinRank = outcome.shownIds.indexOf(outcome.cousinId);
    const targetRank = outcome.shownIds.indexOf(outcome.targetId);
    if (cousinRank === -1) continue;
    if (targetRank === -1 || cousinRank < targetRank) cousinFails.push(outcome.id);
  }
  results.push({
    id: 4,
    name: 'The cousin never outranks its target',
    holds: cousinFails.length === 0,
    failures: cousinFails.slice(0, 20),
    failureCount: cousinFails.length,
  });

  const zeroRow = constructedRow({
    id: 'constructed:zero',
    name: 'cooked grain',
    source: 'usda',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  const zeroShown = useV2
    ? decideSearchV2('cooked grain', [productToCandidate({
      id: 'constructed:zero',
      name: 'cooked grain',
      brand: '',
      categoryPath: ['en:cereals'],
      basis: '100g',
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      code: null,
    })]).status === 'confident'
    : rowShown('cooked grain', zeroRow);
  results.push({
    id: 5,
    name: 'All-zero macros outside beverage/water/sweetener categories are rejected',
    holds: zeroShown === false,
    failures: zeroShown ? ['constructed:zero'] : [],
    failureCount: zeroShown ? 1 : 0,
  });

  const atwaterRow = constructedRow({
    id: 'constructed:atwater',
    name: 'plain cracker',
    source: 'usda',
    calories: 100,
    protein: 0,
    carbs: 0,
    fat: 40,
  });
  const atwaterShown = useV2
    ? decideSearchV2('plain cracker', [productToCandidate({
      id: 'constructed:atwater',
      name: 'plain cracker',
      brand: '',
      categoryPath: ['en:crackers'],
      basis: '100g',
      kcal: 100,
      protein: 0,
      carbs: 0,
      fat: 40,
      code: null,
    })]).status === 'confident'
    : rowShown('plain cracker', atwaterRow);
  results.push({
    id: 6,
    name: 'Atwater-violating candidates are rejected',
    holds: atwaterShown === false,
    failures: atwaterShown ? ['constructed:atwater'] : [],
    failureCount: atwaterShown ? 1 : 0,
  });

  const serperRow = constructedRow({
    id: 'constructed:serper',
    name: 'plain cracker',
    source: 'serper',
    calories: 180,
    protein: 3,
    carbs: 30,
    fat: 6,
  });
  const serperDecision = useV2
    ? decideSearchV2('plain cracker', [createCandidate({
      id: 'constructed:serper',
      source: 'serper',
      name: 'plain cracker',
      brand: '',
      channel: 'unknown',
      servings: [{ label: '1 serving', grams: null, kcal: 180, protein: 3, carbs: 30, fat: 6, origin: 'derived' }],
    })])
    : decideSearch('plain cracker', [serperRow]);
  const serperFood = {
    name: 'plain cracker',
    source: 'serper',
    calories: 180,
    protein: 3,
    carbs: 30,
    fat: 6,
  };
  const serperAutofill = isUsableBarcodeFood(serperFood);
  // P2 does not rewrite barcode autofill yet — still expect barcode half to fail on v2 until P4.
  const serperSearchOk = serperDecision.status !== 'confident';
  const serperHolds = useV2 ? serperSearchOk : (serperSearchOk && serperAutofill === false);
  results.push({
    id: 7,
    name: 'Serper-only data is never confident and never auto-fills a barcode',
    holds: serperHolds,
    failures: [
      serperDecision.status === 'confident' ? 'search-status-confident' : null,
      (!useV2 && serperAutofill) ? 'barcode-autofill' : null,
    ].filter(Boolean),
    failureCount: serperHolds ? 0 : 1,
    note: useV2 ? 'P2 checks search confidence only; barcode autofill is P4.' : undefined,
  });

  const tracePath = path.join(__dirname, '../scripts/data/barcodeMismatchTrace.json');
  let checksumCalls = null;
  if (fs.existsSync(tracePath)) {
    const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
    checksumCalls = trace.badChecksum?.networkCalls;
  }
  const checksumHolds = checksumCalls === 0;
  results.push({
    id: 8,
    name: 'Barcodes with a bad checksum make no network call',
    holds: checksumHolds,
    failures: checksumHolds ? [] : [`networkCalls=${checksumCalls == null ? 'trace-missing' : checksumCalls}`],
    failureCount: checksumHolds ? 0 : 1,
    note: 'Count comes from scripts/traceBarcodeMismatch.js, which invokes the live /api/food/barcode handler with axios stubbed.',
  });

  const consensus = getFoodNutritionConsensus({
    usdaFdc: {
      calories: 180,
      protein_g: 8,
      carbs_g: 22,
      fat_g: 6,
      displayName: 'cooked grain',
      servingBasis: 'per_serving',
    },
    fatSecret: {
      calories: 180,
      protein_g: 8,
      carbs_g: 22,
      fat_g: 6,
      displayName: 'canned soup',
      servingBasis: 'per_serving',
    },
  });
  const merged = consensus?.consensus?.calories?.value != null;
  results.push({
    id: 9,
    name: 'Consensus never merges rows from different clusters',
    holds: merged === false,
    failures: merged ? ['usdaFdc:cooked grain + fatSecret:canned soup'] : [],
    failureCount: merged ? 1 : 0,
  });

  results.push({
    id: 10,
    name: 'Output is byte-identical across runs',
    holds: evalJsonA === evalJsonB,
    failures: evalJsonA === evalJsonB ? [] : ['eval-json-mismatch'],
    failureCount: evalJsonA === evalJsonB ? 0 : 1,
  });

  return results;
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) sorted[key] = sortValue(value[key]);
    return sorted;
  }
  return value;
}

function stableJson(value) {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

function parsePipelineArg(argv) {
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === '--pipeline' && argv[index + 1]) return argv[index + 1];
  }
  return 'v1';
}

function main() {
  const pipeline = parsePipelineArg(process.argv);
  if (pipeline !== 'v1' && pipeline !== 'v2') {
    process.stderr.write('pipeline must be v1 or v2\n');
    process.exit(1);
  }

  const corpus = loadCorpus();
  const first = runEval(corpus, pipeline);
  const second = runEval(corpus, pipeline);
  const firstJson = stableJson(first);
  const secondJson = stableJson(second);
  if (firstJson !== secondJson) {
    process.stderr.write('eval output differed across two runs\n');
    process.exit(1);
  }

  const invariants = runInvariants(corpus, first, firstJson, secondJson, pipeline);
  const writeBaseline = process.argv.includes('--write-baseline');
  if (writeBaseline && pipeline === 'v1') {
    fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
    fs.writeFileSync(BASELINE_PATH, firstJson);
    fs.writeFileSync(INVARIANT_PATH, stableJson({ pipeline: 'v1', invariants }));
  }
  if (pipeline === 'v2') {
    fs.mkdirSync(path.dirname(V2_RESULTS_PATH), { recursive: true });
    fs.writeFileSync(V2_RESULTS_PATH, firstJson);
    fs.writeFileSync(
      path.join(__dirname, '../scripts/data/foodSearchEvalInvariantResultsV2.json'),
      stableJson({ pipeline: 'v2', invariants }),
    );
  }

  const lines = [];
  lines.push(`pipeline=${pipeline}`);
  lines.push('byteIdentical=true');
  for (const split of ['all', 'tune', 'holdout']) {
    for (const category of ALL_CATEGORIES) {
      const metric = first.metrics[split][category];
      lines.push(
        `${split}/${category} cases=${metric.cases} wrongConfidentRate=${metric.wrongConfidentRate} correctTop1Rate=${metric.correctTop1Rate} recallAt5Rate=${metric.recallAt5Rate} emptyWhenUnanswerableRate=${metric.emptyWhenUnanswerableRate} wrongAutoFillRate=${metric.wrongAutoFillRate}`,
      );
    }
  }
  for (const invariant of invariants) {
    lines.push(`invariant ${invariant.id} ${invariant.holds ? 'PASS' : 'FAIL'} failures=${invariant.failureCount}`);
  }
  process.stdout.write(`${lines.join('\n')}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  runEval,
  runInvariants,
  stableJson,
  loadCorpus,
  decideSearch,
  emptyReport,
  BASELINE_PATH,
  INVARIANT_PATH,
};
