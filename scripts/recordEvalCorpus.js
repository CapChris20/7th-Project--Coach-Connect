#!/usr/bin/env node
/**
 * NEEDS NETWORK. Do not run in CI.
 *
 * Records Open Food Facts product payloads, stratified by OFF category tags.
 * Writes tests/food-fixtures/recorded-off-products.json for the offline eval.
 * Does not rank, filter, or invent nutrition numbers.
 *
 *   node scripts/recordEvalCorpus.js
 */
const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, '../tests/food-fixtures/recorded-off-products.json');
const USER_AGENT = 'CoachConnect/1.0 (eval-corpus; contact: support@coachconnect.app)';
const PAGE_SIZE = 20;

// Source taxonomy tags. Not brands. Used only to stratify the download.
const CATEGORY_TAGS = [
  'en:breads',
  'en:yogurts',
  'en:cheeses',
  'en:breakfast-cereals',
  'en:sweet-snacks',
  'en:waters',
  'en:vegetables',
  'en:fruits',
  'en:legumes',
  'en:sandwiches',
  'en:pizzas',
  'en:meals',
  'en:fast-foods',
];

const NUTRIENT_KEYS = [
  'energy-kcal_100g',
  'energy-kcal_serving',
  'energy-kcal',
  'proteins_100g',
  'proteins_serving',
  'proteins',
  'carbohydrates_100g',
  'carbohydrates_serving',
  'carbohydrates',
  'fat_100g',
  'fat_serving',
  'fat',
];

function finiteOrNull(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number;
}

function pickNutrients(nutriments) {
  const source = nutriments || {};
  const kept = {};
  for (const key of NUTRIENT_KEYS) {
    const number = finiteOrNull(source[key]);
    if (number != null) kept[key] = number;
  }
  return kept;
}

function hasCalories(nutrients) {
  return nutrients['energy-kcal_100g'] != null
    || nutrients['energy-kcal_serving'] != null
    || nutrients['energy-kcal'] != null;
}

async function fetchCategoryPage(tag, page) {
  const url = new URL('https://world.openfoodfacts.org/api/v2/search');
  url.searchParams.set('categories_tags', tag);
  url.searchParams.set('page_size', String(PAGE_SIZE));
  url.searchParams.set('page', String(page));
  url.searchParams.set('fields', 'code,product_name,brands,categories_tags,nutriments,serving_size');
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    return { tag, page, status: response.status, products: [], error: `http_${response.status}` };
  }
  const body = await response.json();
  const products = [];
  for (const product of body.products || []) {
    const nutrients = pickNutrients(product.nutriments);
    const name = String(product.product_name || '').replace(/\s+/g, ' ').trim();
    const code = String(product.code || '').replace(/\D/g, '');
    if (!name || !code || !hasCalories(nutrients)) continue;
    products.push({
      code,
      product_name: name,
      brands: String(product.brands || '').replace(/\s+/g, ' ').trim(),
      categories_tags: Array.isArray(product.categories_tags) ? product.categories_tags.map(String) : [],
      serving_size: product.serving_size ? String(product.serving_size) : null,
      nutriments: nutrients,
      fetchedFromTag: tag,
    });
  }
  return {
    tag,
    page,
    status: response.status,
    count: (body.products || []).length,
    kept: products.length,
    products,
  };
}

async function fetchCategory(tag) {
  const pages = [];
  for (const page of [1, 2]) {
    let result = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        result = await fetchCategoryPage(tag, page);
        if (!result.error) break;
      } catch (error) {
        result = { tag, page, status: 0, count: 0, kept: 0, products: [], error: error.message || String(error) };
      }
    }
    pages.push(result);
  }
  const products = [];
  for (const page of pages) products.push(...(page.products || []));
  const worst = pages.find((page) => page.error) || pages[pages.length - 1];
  return {
    tag,
    status: worst.status,
    count: pages.reduce((sum, page) => sum + (page.count || 0), 0),
    kept: products.length,
    error: pages.every((page) => page.error) ? worst.error : null,
    products,
  };
}

async function main() {
  const gaps = [];
  const byCode = new Map();
  const strata = [];

  if (!process.env.USDA_API_KEY) {
    gaps.push('USDA_API_KEY is not set. No USDA Foundation / SR foods were recorded.');
  }
  if (!process.env.SERPER_API_KEY) {
    gaps.push('SERPER_API_KEY is not set. No Serper payloads were recorded.');
  }
  gaps.push('No MenuStat or CalorieKing restaurant menus were recorded. Those scrapers need a live HTML fetch and were not run.');

  for (const tag of CATEGORY_TAGS) {
    try {
      const stratum = await fetchCategory(tag);
      strata.push({
        tag: stratum.tag,
        status: stratum.status,
        count: stratum.count || 0,
        kept: stratum.kept || 0,
        error: stratum.error || null,
      });
      for (const product of stratum.products) {
        if (!byCode.has(product.code)) byCode.set(product.code, product);
      }
      process.stderr.write(`recorded ${tag} kept=${stratum.kept || 0}\n`);
    } catch (error) {
      strata.push({ tag, status: 0, count: 0, kept: 0, error: error.message || String(error) });
      process.stderr.write(`failed ${tag} ${error.message}\n`);
    }
  }

  const products = [...byCode.values()].sort((left, right) => left.code.localeCompare(right.code));
  const payload = {
    generator: 'scripts/recordEvalCorpus.js',
    needsNetwork: true,
    source: 'https://world.openfoodfacts.org/api/v2/search',
    note: 'Recorded source payloads. Do not hand-edit. Regenerate with the script above.',
    gaps,
    strata,
    products,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  process.stdout.write(`wrote ${products.length} products to ${OUT_PATH}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
