/** Food search, barcode, USDA, restaurant nutrition */
const path = require('path');
const admin = require('firebase-admin');
const axios = require('axios');
const { normalizeOpenFoodFactsProduct } = require('../../src/nutrition/food-details/fixFoodNutritionNumbers');
const { buildRestaurantSearchQuery } = require('../utils/restaurantNutrition');
const { serperOrganicSearch } = require('../lib/serperWebSearch');
const {
  EMPTY_SEARCH_HINT,
  normalizeSearchKey,
  classifyNutritionSearchMode,
  extractMacrosFromText,
  extractMultipleSerperRowsFromOrganic,
  fixTypoForSerperQuery,
  buildSerperFallbackQueries,
  isMenuStyleQuery,
  itemMatchesQuery,
  isRetailFoodNoise,
  significantQueryTokens,
  filterFoodSearchRows,
  searchResultsDocId,
  rankSerperFoodResultRows,
} = require('../nutritionSearchHelpers');
const { resolveFoodBrandLabel, findConsumerBrandInQuery } = require('../../src/nutrition/food-details/cleanFoodBrandName');
const {
  cleanSerperFoodTitle,
  displayNameForSerperRow,
  isJunkWebSearchTitle,
  isPlausibleNutritionRow,
  dedupeFoodRows,
  formatUserQueryAsFoodName,
  applyFoodCardPresentationToRows,
} = require('../../src/nutrition/food-search/cleanFoodCardLabels');
const { lookupBarcodeFatSecret, fatSecretConfigured, searchFoodsFatSecret } = require('../lib/fatSecretClient');
const { lookupTrustedFoods } = require('../../src/nutrition/food-search/trustedFoodCatalog');
const { guardBarcodeResult, pickBestBarcodeCandidate } = require('../lib/barcodeMerge');
const { getVerifiedBarcode, saveVerifiedBarcode } = require('../lib/verifiedBarcodeCache');
const { variableWeightBarcodeHint } = require('../lib/variableWeightBarcode');
const {
  lookupBarcodeWithSerper: lookupBarcodeWithSerperImproved,
  barcodeGtinVariants,
} = require('../lib/barcodeSerperLookup');
const { lookupUpcItemDb } = require('../lib/upcItemDbLookup');
const {
  isUsableBarcodeFood,
  barcodeNotFoundPayload,
} = require('../../src/nutrition/barcode/validateBarcodeFood');

const SERPER_ORGANIC_MAX = 10;

const FOOD_SEARCH_PIPELINE_VERSION = 45;

const OPEN_FOOD_FACTS_USER_AGENT =
  'CoachConnect/1.0 (Mobile; https://github.com/coachconnect; contact: support@coachconnect.app)';

function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

function roundSearchMacro(v, decimals = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function sanitizeSearchResultRows(rows, userQuery = '') {
  return applyFoodCardPresentationToRows(Array.isArray(rows) ? rows : [], userQuery).map((it) => {
    const foodName = String(it.food_name || it.name || '').trim();
    const brand = resolveFoodBrandLabel(foodName, it.brand_name || it.brand || '');
    const cal = roundSearchMacro(it.nf_calories ?? it.calories, 0);
    const protein = roundSearchMacro(it.nf_protein ?? it.protein, 1);
    const carbs = roundSearchMacro(it.nf_total_carbohydrate ?? it.carbs, 1);
    const fat = roundSearchMacro(it.nf_total_fat ?? it.fat, 1);
    return {
      ...it,
      food_name: foodName || it.food_name,
      name: foodName || it.name,
      brand_name: brand,
      brand,
      nf_calories: cal,
      nf_protein: protein,
      nf_total_carbohydrate: carbs,
      nf_total_fat: fat,
      calories: cal,
      protein,
      carbs,
      fat,
    };
  });
}
const foodCache = new Map();
const FOOD_CACHE_TTL = 24 * 60 * 60 * 1000;

function registerFoodRoutes(app, deps) {
  const { verifyFirebaseBearerToken, checkMonthlyApiBudget } = deps;

const searchFoodWithSerper = async (rawQuery) => {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  const userQuery = String(rawQuery || '').trim();
  const serperCap = 12;
  const fallbackQueries = buildSerperFallbackQueries(userQuery);

  const toSerperRow = (name, macros, extras = {}, organicScore = 0) => {
    const serving_label = extras.serving_label ?? macros.servingLabel ?? null;
    const unitLabel = serving_label || extras.serving_unit || 'serving';
    const displayName = name || userQuery;
    const brandLabel = resolveFoodBrandLabel(displayName, '');
    return {
      id: `serper_${Date.now()}_${Math.random()}`,
      food_name: displayName,
      name: displayName,
      brand_name: brandLabel,
      brand: brandLabel,
      restaurant: null,
      serving_qty: 1,
      serving_unit: unitLabel,
      serving_label,
      nf_calories: macros.calories,
      nf_protein: macros.protein,
      nf_total_carbohydrate: macros.carbs,
      nf_total_fat: macros.fat,
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      fiber: extras.fiber ?? null,
      sodium: extras.sodium ?? null,
      sugar: extras.sugar ?? null,
      servingSize: 1,
      servingUnit: unitLabel,
      servingGrams: 100,
      photo: null,
      source: 'serper',
      _organicScore: organicScore,
      multiServingFallback: Boolean(extras.multiServingFallback),
      servingMultiplier: extras.servingMultiplier ?? null,
      nutrition_unverified: Boolean(extras.nutrition_unverified),
    };
  };

  const fetchSerperPayload = async (serperQueryText, relaxed) => {
    const query = fixTypoForSerperQuery(serperQueryText);
    const res = await axios.post(
      'https://google.serper.dev/search',
      {
        q: `${query} nutrition facts calories protein carbs fat`,
        num: SERPER_ORGANIC_MAX,
      },
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 12000,
      },
    );
    return { data: res.data || {}, queryHint: String(query || '').toLowerCase(), relaxed };
  };

  const parseSerperData = (data, queryHint, relaxed) => {
    const results = [];

    const organicBlob = (n = 8) =>
      Array.isArray(data.organic)
        ? data.organic
            .slice(0, n)
            .map((r) => `${r.title || ''} ${r.snippet || ''}`)
            .join('\n')
        : '';

    const mergeOrganicForMacros = (snippet) =>
      `${String(snippet || '')}\n${organicBlob()}`.trim();

    const pushFromText = (name, text) => {
      const macros = extractMacrosFromText(text, queryHint);
      if (!isPlausibleNutritionRow(macros)) return;
      const displayName = displayNameForSerperRow(name, userQuery, macros);
      results.push(toSerperRow(displayName, macros));
    };

    if (data.answerBox) {
      const box = data.answerBox;
      let title = box.title || userQuery;
      title = String(title).replace(/^Calories in /i, '').replace(/^Carbs in /i, '').trim();
      if (!isJunkWebSearchTitle(title)) {
        const snippet = mergeOrganicForMacros(box.answer || box.snippet || '');
        pushFromText(title, snippet);
      }
    }

    if (data.knowledgeGraph?.attributes) {
      const attrs = data.knowledgeGraph.attributes;
      const cleanNum = (v) => parseFloat(String(v || '0').replace(/[^\d.]/g, '') || 0);
      const cals = cleanNum(attrs['Calories'] || attrs['Energy'] || '0');
      let protein = cleanNum(attrs['Protein'] || '0');
      let carbs = cleanNum(attrs['Total Carbohydrate'] || attrs['Carbohydrates'] || '0');
      let fat = cleanNum(attrs['Total Fat'] || attrs['Fat'] || '0');
      const fiber = cleanNum(attrs['Dietary Fiber'] || '0');
      const sodium = cleanNum(attrs['Sodium'] || '0');

      const kgBlob = [
        data.knowledgeGraph.title,
        data.knowledgeGraph.description || '',
        ...Object.entries(attrs).map(([k, v]) => `${k}: ${v}`),
        organicBlob(),
      ].join('\n');
      const parsedKg = extractMacrosFromText(kgBlob, queryHint);

      if (cals > 0 && protein === 0 && carbs === 0 && fat === 0) {
        if (parsedKg.protein > 0) protein = parsedKg.protein;
        if (parsedKg.carbs > 0) carbs = parsedKg.carbs;
        if (parsedKg.fat > 0) fat = parsedKg.fat;
      }
      if (/\b(burger|cheeseburger|hamburger)\b/.test(queryHint) && parsedKg.carbs > carbs) {
        carbs = parsedKg.carbs;
      }

      const kgMacros = {
        calories: cals,
        protein,
        carbs,
        fat,
        servingLabel: parsedKg.servingLabel,
      };
      if (cals > 0 && isPlausibleNutritionRow(kgMacros)) {
        results.push(
          toSerperRow(
            cleanSerperFoodTitle(data.knowledgeGraph.title || userQuery, userQuery),
            kgMacros,
            { fiber: fiber || null, sodium: sodium || null },
          ),
        );
      }
    }

    if (Array.isArray(data.organic) && data.organic.length > 0) {
      const multi = extractMultipleSerperRowsFromOrganic(
        data.organic,
        userQuery,
        queryHint,
        serperCap,
        { relaxed },
      );
      for (const row of multi) {
        results.push(
          toSerperRow(row.displayName, row.macros, {
            multiServingFallback: row.multiServingFallback,
            servingMultiplier: row.servingMultiplier,
            nutrition_unverified: row.nutrition_unverified,
          }, row.organicScore || 0),
        );
      }
    }

    return results;
  };

  try {
    for (let i = 0; i < fallbackQueries.length; i += 1) {
      const relaxed = i > 0;
      const serperQueryText = fallbackQueries[i];
      let payload;
      try {
        payload = await fetchSerperPayload(serperQueryText, relaxed);
      } catch (e) {
        console.warn('[Food Search] Serper attempt failed:', serperQueryText, e.message);
        continue;
      }

      const rawRows = parseSerperData(payload.data, payload.queryHint, relaxed);
      const deduped = dedupeFoodRows(rawRows);
      const ranked = rankSerperFoodResultRows(deduped, userQuery);
      if (ranked.length > 0) {
        return ranked.slice(0, serperCap);
      }
    }

    return [];
  } catch (e) {
    console.error('Serper food search error:', e.message);
    return [];
  }
};

// Barcode lookup via Serper when Open Food Facts has no product
const lookupBarcodeWithSerper = async (barcode) => {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return null;

  try {
    const q = `${barcode} UPC barcode nutrition facts calories per serving`;
    const res = await axios.post(
      'https://google.serper.dev/search',
      { q, num: 5 },
      {
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        timeout: 12000,
      }
    );
    const data = res.data || {};
    const parseSnippet = (text) => {
      const t = String(text || '');
      const cals = parseFloat(t.match(/(\d+(?:\.\d+)?)\s*cal/i)?.[1] || 0);
      const protein = parseFloat(t.match(/(\d+(?:\.\d+)?)\s*g\s*protein/i)?.[1] || 0);
      const carbs = parseFloat(t.match(/(\d+(?:\.\d+)?)\s*g\s*carb/i)?.[1] || 0);
      const fat = parseFloat(t.match(/(\d+(?:\.\d+)?)\s*g\s*fat/i)?.[1] || 0);
      return { cals, protein, carbs, fat };
    };
    const num = (v) => (v != null && !Number.isNaN(Number(v))) ? Number(v) : 0;

    // 1. answerBox
    if (data.answerBox) {
      const box = data.answerBox;
      const title = (box.title || `Product ${barcode}`).trim();
      const snippet = box.answer || box.snippet || '';
      const { cals, protein, carbs, fat } = parseSnippet(snippet);
      if (title && (cals > 0 || protein > 0)) {
        return {
          id: `serper_barcode_${barcode}`,
          name: title,
          brand: resolveFoodBrandLabel(title, ''),
          restaurant: null,
          calories: cals,
          protein,
          carbs,
          fat,
          fiber: null,
          sodium: null,
          sugar: null,
          servingSize: 1,
          servingUnit: 'serving',
          servingGrams: 100,
          source: 'serper',
        };
      }
    }

    // 2. knowledgeGraph
    if (data.knowledgeGraph?.title) {
      const kg = data.knowledgeGraph;
      const attrs = kg.attributes || {};
      const cleanNum = (v) => num(parseFloat(String(v || '0').replace(/[^\d.]/g, '')));
      const cals = cleanNum(attrs['Calories'] || attrs['Energy'] || '0');
      const protein = cleanNum(attrs['Protein'] || '0');
      const carbs = cleanNum(attrs['Total Carbohydrate'] || attrs['Carbohydrates'] || '0');
      const fat = cleanNum(attrs['Total Fat'] || attrs['Fat'] || '0');
      if (cals > 0) {
        return {
          id: `serper_barcode_${barcode}`,
          name: kg.title,
          brand: resolveFoodBrandLabel(kg.title, ''),
          restaurant: null,
          calories: cals,
          protein,
          carbs,
          fat,
          fiber: null,
          sodium: null,
          sugar: null,
          servingSize: 1,
          servingUnit: 'serving',
          servingGrams: 100,
          source: 'serper',
        };
      }
    }

    // 3. first organic result with parsed nutrition
    if (Array.isArray(data.organic) && data.organic.length > 0) {
      for (const r of data.organic.slice(0, 3)) {
        const text = `${r.title || ''} ${r.snippet || ''}`;
        const { cals, protein, carbs, fat } = parseSnippet(text);
        const name = (r.title || `Product ${barcode}`).split('-')[0].split('|')[0].trim();
        if (name && (cals > 0 || protein > 0)) {
          return {
            id: `serper_barcode_${barcode}`,
            name,
            brand: resolveFoodBrandLabel(name, ''),
            restaurant: null,
            calories: cals,
            protein,
            carbs,
            fat,
            fiber: null,
            sodium: null,
            sugar: null,
            servingSize: 1,
            servingUnit: 'serving',
            servingGrams: 100,
            source: 'serper',
          };
        }
      }
      // return best guess with product name even if we couldn't parse calories
      const first = data.organic[0];
      const name = (first.title || `Product ${barcode}`).split('-')[0].split('|')[0].trim();
      if (name) {
        const text = `${first.title || ''} ${first.snippet || ''}`;
        const { cals, protein, carbs, fat } = parseSnippet(text);
        return {
          id: `serper_barcode_${barcode}`,
          name,
          brand: resolveFoodBrandLabel(name, ''),
          restaurant: null,
          calories: cals || 0,
          protein: protein || 0,
          carbs: carbs || 0,
          fat: fat || 0,
          fiber: null,
          sodium: null,
          sugar: null,
          servingSize: 1,
          servingUnit: 'serving',
          servingGrams: 100,
          source: 'serper',
        };
      }
    }
    return null;
  } catch (e) {
    console.warn('Serper barcode lookup failed:', e.message);
    return null;
  }
};

// Nutrition API endpoints — barcode: USDA → Open Food Facts → Serper | search: USDA → OFF → Serper (restaurant chains: Serper first)
// All return same shape: { id, name, brand, calories, protein, carbs, fat, servingSize, servingUnit, servingGrams, source }

// Simple in-memory cache for food search + barcode (good enough for dev / small scale)
const searchCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const getCached = (key) => {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }
  return entry.data;
};

const setCache = (key, data) => {
  // Prevent unbounded memory growth
  if (searchCache.size > 500) {
    const firstKey = searchCache.keys().next().value;
    if (firstKey) searchCache.delete(firstKey);
  }
  searchCache.set(key, { data, timestamp: Date.now() });
};

// ─── USDA Branded barcode → same shape as Open Food Facts normalizer (client + addFoodLog) ───
/** Compare barcodes as GTIN-14 (left-pad). Do NOT strip zeros — that merges distinct UPC-A rows. */
function toGtin14(barcode) {
  const d = String(barcode || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length > 14) return d.slice(-14);
  return d.padStart(14, '0');
}

function normalizeGtinDigits(barcode) {
  return toGtin14(barcode).replace(/^0+/, '') || '0';
}

function gtinDigitsEqual(a, b) {
  const ga = toGtin14(a);
  const gb = toGtin14(b);
  return !!(ga && gb && ga === gb);
}

function scoreUsdaBarcodeCandidate(hit, hintTokens = []) {
  let score = 0;
  if (getFdcNutrientFromSearchFood(hit, 1008) > 0) score += 5;
  if (getFdcNutrientFromSearchFood(hit, 1003) > 0) score += 1;
  if (getFdcNutrientFromSearchFood(hit, 1005) > 0) score += 1;
  if (getFdcNutrientFromSearchFood(hit, 1004) > 0) score += 1;
  if (Number(hit.servingSize) > 0) score += 1;
  const desc = String(hit.description || '');
  // Prefer specific branded retail labels over sparse/zero-macro duplicates for the same GTIN
  if (desc.length > 20) score += 1;
  const hay = `${desc} ${hit.brandOwner || ''} ${hit.brandName || ''}`.toLowerCase();
  for (const t of hintTokens) {
    if (t.length > 2 && hay.includes(t)) score += 3;
  }
  return score;
}

function pickBestUsdaGtinHit(foods, clean, hintTokens = []) {
  const matches = (foods || []).filter(
    (f) => gtinDigitsEqual(f.gtinUpc, clean) || barcodeGtinVariants(clean).some((v) => gtinDigitsEqual(f.gtinUpc, v)),
  );
  if (!matches.length) return null;
  matches.sort((a, b) => scoreUsdaBarcodeCandidate(b, hintTokens) - scoreUsdaBarcodeCandidate(a, hintTokens));
  return matches[0];
}

function getFdcNutrientFromSearchFood(item, ...nutrientIds) {
  const nutrients = item.foodNutrients || [];
  for (const id of nutrientIds) {
    const n = nutrients.find((x) => x.nutrientId === id);
    if (n != null && n.value != null && !Number.isNaN(Number(n.value))) return Number(n.value);
  }
  return 0;
}

function mapUsdaBrandedSearchHitToBarcodeFood(hit) {
  const kcal = getFdcNutrientFromSearchFood(hit, 1008);
  const protein = getFdcNutrientFromSearchFood(hit, 1003);
  const carbs = getFdcNutrientFromSearchFood(hit, 1005);
  const fat = getFdcNutrientFromSearchFood(hit, 1004);
  const fiber = getFdcNutrientFromSearchFood(hit, 1079);
  const sodium = getFdcNutrientFromSearchFood(hit, 1090, 1093);
  const sugar = getFdcNutrientFromSearchFood(hit, 2000);

  let servingG = Number(hit.servingSize);
  if (!Number.isFinite(servingG) || servingG <= 0) servingG = 100;
  const unitRaw = String(hit.servingSizeUnit || 'g').toLowerCase();
  // FDC branded search nutrients are per 100 g/ml. Unit codes: G, ML, MLT, OZA, ONZ…
  const useMl = unitRaw === 'ml' || unitRaw === 'mlt' || unitRaw === 'milliliters' || unitRaw === 'milliliter';
  if (unitRaw === 'oz' || unitRaw === 'onz' || unitRaw === 'oza' || unitRaw === 'ounce' || unitRaw === 'ounces') {
    servingG = servingG * 28.3495;
  }
  const scale = servingG / 100;
  const household = String(hit.householdServingFullText || '').trim();
  const servingLabel = household
    ? `${household}${servingG ? ` (${Math.round(servingG)} g)` : ''}`
    : `${Math.round(servingG)} g`;

  return {
    id: String(hit.fdcId),
    name: hit.description || 'Unknown',
    brand: hit.brandOwner || hit.brandName || null,
    restaurant: null,
    calories: kcal,
    protein,
    carbs,
    fat,
    fiber: fiber || null,
    sodium: sodium || null,
    sugar: sugar || null,
    servingSize: scale,
    servingUnit: useMl ? 'ml' : 'grams',
    servingGrams: Math.round(servingG),
    serving_label: servingLabel,
    source: 'usda',
    dataBasis: 'per_100g',
    kcalPer100Unit: kcal,
    servingAmount: Math.round(servingG),
    gtinUpc: hit.gtinUpc || null,
  };
}

async function lookupBarcodeUsda(barcode) {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey || !String(barcode || '').trim()) return null;

  const clean = String(barcode).trim();
  const variants = barcodeGtinVariants(clean);
  if (!variants.includes(clean.replace(/\D/g, ''))) {
    variants.unshift(clean.replace(/\D/g, ''));
  }

  try {
    // Collect every GTIN match across pad variants — USDA sometimes stores the same
    // code as 12-digit and 14-digit with different (even conflicting) product rows.
    const allMatches = [];
    const seenFdc = new Set();
    for (const q of variants) {
      const res = await axios.post(
        `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`,
        {
          query: q,
          pageSize: 40,
          dataType: ['Branded'],
        },
        { timeout: 12000, headers: { 'Content-Type': 'application/json' } }
      );

      for (const f of res.data?.foods || []) {
        if (!gtinDigitsEqual(f.gtinUpc, clean) && !variants.some((v) => gtinDigitsEqual(f.gtinUpc, v))) continue;
        const id = String(f.fdcId);
        if (seenFdc.has(id)) continue;
        seenFdc.add(id);
        allMatches.push(f);
      }
    }

    let hintTokens = [];
    if (allMatches.length > 1) {
      try {
        const upcItem = await lookupUpcItemDb(clean);
        const hint = String(upcItem?.name || '').toLowerCase();
        hintTokens = hint.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
        if (hintTokens.length) {
          console.log('[Barcode] USDA multi-hit, ranking with UPCitemdb hint:', upcItem.name);
        }
      } catch (_) { /* ignore */ }
      if (!hintTokens.length) {
        try {
          const offHint = await lookupBarcodeOpenFoodFacts(clean);
          const hint = String(offHint?.name || '').toLowerCase();
          hintTokens = hint.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
          if (hintTokens.length) {
            console.log('[Barcode] USDA multi-hit, ranking with OFF hint:', offHint.name);
          }
        } catch (_) { /* ignore */ }
      }
    }

    const hit = pickBestUsdaGtinHit(allMatches, clean, hintTokens);
    if (hit) {
      console.log(
        '[Barcode] USDA branded match:',
        hit.description,
        'fdcId:', hit.fdcId,
        'gtin:', hit.gtinUpc,
        'score:', scoreUsdaBarcodeCandidate(hit, hintTokens),
      );
      return mapUsdaBrandedSearchHitToBarcodeFood(hit);
    }
    return null;
  } catch (e) {
    console.warn('[Barcode] USDA lookup failed:', e.message);
    return null;
  }
}

/** Drop generic words that caused Oreos → "ORIGINAL BEEF STICKS" false matches. */
const USDA_NAME_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'food', 'foods', 'product', 'pack', 'packaging',
  'original', 'mild', 'classic', 'natural', 'organic', 'nutrition', 'nutritional',
  'protein', 'calorie', 'calories', 'facts', 'serving', 'size', 'barcode', 'upc',
  'stick', 'sticks', 'bar', 'bars', 'snack', 'snacks', 'energy', 'supplement',
]);

function distinctiveNameTokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !USDA_NAME_STOPWORDS.has(t));
}

/** When barcode miss, use product name from web/Serper to find USDA branded row. */
async function lookupUsdaBrandedByName(productName, brandHint = '') {
  const apiKey = process.env.USDA_API_KEY;
  const q = String(productName || '').trim();
  if (!apiKey || q.length < 3) return null;

  try {
    const query = [brandHint, q].filter(Boolean).join(' ').slice(0, 120);
    const res = await axios.post(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`,
      {
        query,
        pageSize: 25,
        dataType: ['Branded'],
      },
      { timeout: 12000, headers: { 'Content-Type': 'application/json' } }
    );
    const foods = res.data?.foods || [];
    if (!foods.length) return null;

    const tokens = distinctiveNameTokens(q);
    if (tokens.length < 2) return null;

    const brandTok = distinctiveNameTokens(brandHint)[0] || '';
    const scored = foods.map((f) => {
      const desc = `${f.description || ''} ${f.brandOwner || ''} ${f.brandName || ''}`.toLowerCase();
      let score = 0;
      let matched = 0;
      for (const t of tokens) {
        if (desc.includes(t)) {
          score += 2;
          matched += 1;
        }
      }
      if (brandTok && desc.includes(brandTok)) score += 4;
      if (brandHint && desc.includes(String(brandHint).toLowerCase())) score += 2;
      // Prefer rows with a real serving size + calories
      if (Number(f.servingSize) > 0) score += 1;
      const kcal = getFdcNutrientFromSearchFood(f, 1008);
      if (kcal > 0) score += 5;
      else if (!/\b(diet|zero|sugar.?free|unsweetened)\b/i.test(desc)) score -= 4;
      return { f, score, matched };
    }).sort((a, b) => b.score - a.score);

    const best = scored[0];
    // Require most distinctive tokens to appear — stops yeast/Chomps poisoning
    const needMatched = Math.max(2, Math.ceil(tokens.length * 0.6));
    if (!best || best.matched < needMatched || best.score < 6) return null;
    console.log('[Barcode] USDA name fallback:', best.f.description, 'score:', best.score, 'matched:', best.matched);
    return mapUsdaBrandedSearchHitToBarcodeFood(best.f);
  } catch (e) {
    console.warn('[Barcode] USDA name fallback failed:', e.message);
    return null;
  }
}

async function lookupBarcodeOpenFoodFacts(barcode) {
  const variants = barcodeGtinVariants(barcode);
  for (const code of variants.length ? variants : [String(barcode || '').trim()]) {
    try {
      const openFoodFactsUrl = `https://world.openfoodfacts.org/api/v2/product/${code}.json`;
      const offResponse = await axios.get(openFoodFactsUrl, { timeout: 12000 });
      if (offResponse.data?.product) {
        const result = normalizeOpenFoodFactsProduct(offResponse.data.product);
        if (result) {
          console.log('Barcode from OFF:', result.name, 'code:', code, 'servingAmount:', result.servingAmount, 'calories:', result.calories);
          return result;
        }
      }
    } catch (offError) {
      console.warn('OpenFoodFacts barcode lookup failed:', code, offError.message);
    }
  }
  return null;
}

app.get('/api/food/search', verifyFirebaseBearerToken, async (req, res) => {
  const query = req.query.query?.trim();
  if (!query) return res.status(400).json({ error: 'Query required' });

  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 1), 40);
  const normalizedKey = normalizeSearchKey(query);
  const cacheKey = `v${FOOD_SEARCH_PIPELINE_VERSION}|${normalizedKey}`;

  // Catalog seeds famous items into the pool — never short-circuit past consensus/filter.
  const trustedHits = lookupTrustedFoods(query, Math.min(3, limit));

  const cachedMem = foodCache.get(cacheKey);
  if (cachedMem && Date.now() - cachedMem.timestamp < FOOD_CACHE_TTL) {
    console.log('[Food Search] In-memory cache hit:', query);
    return res.json({
      results: sanitizeSearchResultRows(cachedMem.data, query).slice(0, limit),
      source: 'cache',
      cached: true,
    });
  }

  try {
    if (admin.apps.length) {
      const docId = searchResultsDocId(normalizedKey);
      const snap = await admin.firestore().collection('searchResults').doc(docId).get();
      if (snap.exists) {
        const d = snap.data();
        if (Number(d.pipelineVersion) !== FOOD_SEARCH_PIPELINE_VERSION) {
          console.log('[Food Search] Firestore cache stale version — refetch');
        } else if (Array.isArray(d.results) && d.results.length > 0) {
          console.log('[Food Search] Firestore searchResults hit:', query);
          foodCache.set(cacheKey, { data: d.results, timestamp: Date.now() });
          return res.json({
            results: sanitizeSearchResultRows(d.results, query).slice(0, limit),
            source: d.source || 'firestore-cache',
            cached: true,
          });
        }
      }
    }
  } catch (fcReadErr) {
    console.warn('[Food Search] Firestore cache read failed:', fcReadErr.message);
  }

  let serperAllowed = !!process.env.SERPER_API_KEY;
  if (process.env.SERPER_API_KEY && admin.apps.length && checkMonthlyApiBudget) {
    serperAllowed = await checkMonthlyApiBudget('serper');
    if (!serperAllowed) {
      console.warn('[Food Search] Serper monthly cap reached — USDA/FatSecret/OFF only');
    }
  }

  let results = null;
  let source = '';
  let searchHint = null;
  
  // --- Matching & ranking (query tokens — no hardcoded restaurant name list) ---
  const PACKAGED_BEVERAGE_BRANDS = ['coca cola', 'coca-cola', 'coke', 'pepsi', 'sprite', 'dr pepper'];

  const normalizeText = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/’/g, "'")
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  /** Strip punctuation/spacing so "Domino's" / "domino s" match query token "dominos". */
  const brandKey = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/['’`]/g, '')
      .replace(/[^a-z0-9]/g, '');

  const isLetterChar = (c) => c != null && c !== '' && /[a-z]/i.test(c);

  /**
   * Match chain/brand as a real token, not a substring inside another word.
   * Prevents "dominos" matching "DOMINOSTEINE" / "dominosteine" (old logic used naive includes on brandKey).
   */
  const brandMatchesItem = (text, brand) => {
    const hay = normalizeText(text);
    const needle = normalizeText(brand);
    if (!needle) return false;

    let i = 0;
    while ((i = hay.indexOf(needle, i)) !== -1) {
      const before = i === 0 ? ' ' : hay[i - 1];
      const after = i + needle.length >= hay.length ? ' ' : hay[i + needle.length];
      if (!isLetterChar(before) && !isLetterChar(after)) return true;
      i += 1;
    }

    const kb = brandKey(brand);
    const tk = brandKey(hay);
    if (kb.length < 3) return false;

    let j = 0;
    while ((j = tk.indexOf(kb, j)) !== -1) {
      const beforeC = j === 0 ? null : tk[j - 1];
      const afterC = j + kb.length >= tk.length ? null : tk[j + kb.length];
      const okBefore = beforeC == null || !isLetterChar(beforeC);
      const okAfter = afterC == null || !isLetterChar(afterC);
      if (okBefore && okAfter) return true;
      j += 1;
    }
    return false;
  };

  const queryLower = normalizeText(query);
  const menuStyleQuery = isMenuStyleQuery(query);
  const requestedBrand = PACKAGED_BEVERAGE_BRANDS.find((b) => queryLower.includes(normalizeText(b))) || null;

  const searchMode = classifyNutritionSearchMode(queryLower);
  console.log('[Food Search] Mode:', searchMode, 'query:', query);

  const queryMeta = {
    hasOz: /\b\d+(\.\d+)?\s*oz\b/.test(queryLower) || /\b\d+(\.\d+)?\s*fl\s*oz\b/.test(queryLower),
    hasMl: /\b\d+\s*ml\b/.test(queryLower),
    hasLarge: /\blarge\b|\blg\b/.test(queryLower),
    hasMedium: /\bmedium\b|\bmed\b/.test(queryLower),
    hasSmall: /\bsmall\b|\bsm\b/.test(queryLower),
    hasDeepDish: /\bdeep\s*dish\b/.test(queryLower),
    hasDetroit: /\bdetroit\b/.test(queryLower),
    pieceCount: (() => {
      const m = queryLower.match(/\b(\d+)\s*(piece|pc|pcs)\b/);
      return m ? Number(m[1]) : null;
    })(),
    ozCount: (() => {
      const m = queryLower.match(/\b(\d+(?:\.\d+)?)\s*(?:fl\s*)?oz\b/);
      return m ? Number(m[1]) : null;
    })(),
  };

  const queryTokens = significantQueryTokens(query);
  const requiredConsumerBrand = findConsumerBrandInQuery(query);

  /** "apple jacks cereal" → "apple jacks" so phrase match beats random apple+cereal baby foods */
  const queryCorePhrase = queryLower
    .replace(/\b(cereal|ready[\s-]?to[\s-]?eat|rte|milk|bar|drink|soda|juice|snack|chips|crackers|oatmeal)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const escapeRe = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const itemText = (item) => {
    const n = normalizeText(item?.food_name || item?.name || '');
    const b = normalizeText(item?.brand_name || item?.brand || '');
    return `${n} ${b}`.trim();
  };

  const findBrandInText = (text) => PACKAGED_BEVERAGE_BRANDS.find((b) => brandMatchesItem(text, b)) || null;

  const sizeScore = (text) => {
    let s = 0;
    if (queryMeta.hasDeepDish && /\bdeep\s*dish\b/.test(text)) s += 8;
    if (queryMeta.hasDetroit && /\bdetroit\b/.test(text)) s += 8;
    if (queryMeta.hasLarge && /\blarge\b|\b14\b|\b16\b/.test(text)) s += 6;
    if (queryMeta.hasMedium && /\bmedium\b|\b12\b/.test(text)) s += 4;
    if (queryMeta.hasSmall && /\bsmall\b|\b10\b/.test(text)) s += 4;
    if (queryMeta.ozCount != null) {
      const oz = queryMeta.ozCount;
      if (new RegExp(`\\b${oz}\\s*(?:fl\\s*)?oz\\b`).test(text)) s += 10;
      // 20oz soda is often represented as ~591ml
      if (oz === 20 && /\b591(\.\d+)?\s*ml\b/.test(text)) s += 10;
    }
    if (queryMeta.pieceCount != null) {
      const pc = queryMeta.pieceCount;
      if (new RegExp(`\\b${pc}\\s*(piece|pc|pcs)\\b`).test(text)) s += 10;
    }
    return s;
  };

  const scoreItem = (item) => {
    const text = itemText(item);
    if (!text) return -999;

    let score = 0;

    // Strong match: full product phrase (e.g. "apple jacks") — beats apple+cereal in babyfood
    if (queryCorePhrase.length >= 4 && text.includes(queryCorePhrase)) {
      score += 120;
    }
    // Multi-word query: reward consecutive words from core phrase appearing together
    const coreWords = queryCorePhrase.split(' ').filter((w) => w.length > 2);
    if (coreWords.length >= 2) {
      const joined = coreWords.join(' ');
      if (text.includes(joined)) score += 60;
    }

    // Token overlap — whole word only (avoids "jack" inside unrelated cheese when token is "jacks")
    let tokenHits = 0;
    for (const t of queryTokens) {
      try {
        if (new RegExp(`\\b${escapeRe(t)}\\b`, 'i').test(text)) tokenHits += 1;
      } catch {
        if (text.includes(t)) tokenHits += 1;
      }
    }
    score += tokenHits * 6;

    if (menuStyleQuery) {
      if (itemMatchesQuery(text, query)) score += 42;
      else score -= 58;
      if (isRetailFoodNoise(text)) score -= 100;
      if (item?.source === 'serper' && itemMatchesQuery(text, query)) score += 24;
    } else if (requestedBrand) {
      if (brandMatchesItem(text, requestedBrand)) score += 40;
      else score -= 52;
      const foundBrand = findBrandInText(text);
      if (foundBrand && brandKey(foundBrand) !== brandKey(requestedBrand)) score -= 60;
    } else if (requiredConsumerBrand) {
      if (brandMatchesItem(text, requiredConsumerBrand)) score += 50;
      else score -= 65;
    }

    // Size / variant matching (20oz, large, deep dish, etc.)
    score += sizeScore(text);

    // Sanity checks (down-rank obvious junk)
    const kcal = Number(item?.nf_calories ?? item?.calories ?? 0);
    if (!Number.isFinite(kcal) || kcal <= 0) score -= 15;
    // For soda queries, penalize water/seltzer
    if ((requestedBrand === 'coke' || requestedBrand === 'coca cola' || requestedBrand === 'coca-cola') && /\bwater\b|\bseltzer\b/.test(text)) {
      score -= 50;
    }

    // User typed grocery cereal — not baby food jars
    if (/\bbabyfood\b|\bbaby food\b/i.test(text) && !/\b(baby|infant|toddler|jar)\b/.test(queryLower)) {
      score -= 55;
    }
    // Asked for cereal but row is clearly cheese / unrelated
    if (/\bcereal\b/.test(queryLower) && /\bcheese\b|\bcheeses\b/i.test(text) && !/\bcereal\b/i.test(text)) {
      score -= 70;
    }

    return score;
  };

  const rankResults = (arr) => {
    const list = (Array.isArray(arr) ? arr.slice() : []).filter((it) => {
      const macros = {
        calories: it?.nf_calories ?? it?.calories,
        protein: it?.nf_protein ?? it?.protein,
        carbs: it?.nf_total_carbohydrate ?? it?.carbs,
        fat: it?.nf_total_fat ?? it?.fat,
      };
      if (!macros.calories && !macros.protein && !macros.carbs && !macros.fat) return true;
      return isPlausibleNutritionRow(macros);
    });
    return list
      .map((it) => ({ it, _score: scoreItem(it) }))
      .sort((a, b) => b._score - a._score)
      .map((x) => x.it);
  };

  const hasGoodMatch = (arr) => {
    const ranked = rankResults(arr);
    if (!ranked.length) return false;
    const topText = itemText(ranked[0]);
    if (menuStyleQuery) return itemMatchesQuery(topText, query) && !isRetailFoodNoise(topText);
    if (requiredConsumerBrand) return brandMatchesItem(topText, requiredConsumerBrand);
    if (requestedBrand) return brandMatchesItem(topText, requestedBrand);
    if (queryTokens.length >= 2) return itemMatchesQuery(topText, query);
    return true;
  };

  const needsFill = () =>
    !results?.length ||
    !hasGoodMatch(results) ||
    (menuStyleQuery && results.length < Math.min(4, limit));

  const mapUsdaFoods = (foods) =>
    (foods || []).map((item) => {
      const nutrients = item.foodNutrients || [];
      const get = (id) => nutrients.find((n) => n.nutrientId === id)?.value || 0;
      const household = item.householdServingFullText ? String(item.householdServingFullText).trim() : '';
      const sizeBit = item.servingSize ? `${item.servingSize}${item.servingSizeUnit || ''}` : '';
      const servingHuman = String(household || sizeBit || '').trim();
      return {
        food_name: item.description,
        brand_name: item.brandOwner || '',
        serving_qty: 1,
        serving_unit: servingHuman || 'serving',
        serving_label: household || sizeBit || null,
        householdServingFullText: household || null,
        nf_calories: get(1008),
        nf_protein: get(1003),
        nf_total_carbohydrate: get(1005),
        nf_total_fat: get(1004),
        photo: null,
        source: 'usda',
      };
    });

  /** Serper web results merged into `results` / `source`. */
  async function mergeSerperFoodSearch(logLabel) {
    if (!process.env.SERPER_API_KEY || !serperAllowed) return;
    try {
      console.log(logLabel);
      let parsed = [];
      try {
        parsed = await searchFoodWithSerper(query, limit);
      } catch (helperErr) {
        console.warn('[Food Search] Serper helper failed:', helperErr?.message || helperErr);
      }

      if (!parsed.length) {
        const qSerper = fixTypoForSerperQuery(query);
        const r = await fetchWithTimeout(
          'https://google.serper.dev/search',
          {
            method: 'POST',
            headers: {
              'X-API-KEY': process.env.SERPER_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              q: `${qSerper} calories protein carbs fat nutrition facts menu`,
              num: 8,
            }),
          },
          12000,
        );
        if (r.ok) {
          const data = await r.json();
          const answer = data.answerBox || data.knowledgeGraph;
          if (answer) {
            let cleanTitle = answer.title || query;
            if (cleanTitle.startsWith('Calories in ')) cleanTitle = cleanTitle.replace('Calories in ', '');
            if (cleanTitle.startsWith('Carbs in ')) cleanTitle = cleanTitle.replace('Carbs in ', '');
            if (cleanTitle.includes(' - CalorieKing')) cleanTitle = cleanTitle.replace(' - CalorieKing', '');
            const organicExtra = Array.isArray(data.organic)
              ? data.organic
                  .slice(0, 8)
                  .map((o) => `${o.title || ''} ${o.snippet || ''}`)
                  .join('\n')
              : '';
            const snippet = `${answer.snippet || ''} ${answer.answer || ''}\n${organicExtra}`.trim();
            const macros = extractMacrosFromText(snippet, String(query || '').toLowerCase());
            const extractNumber = (text, pattern) => {
              const match = text.match(pattern);
              return match ? parseFloat(match[1]) : 0;
            };
            const srv = macros.servingLabel || null;
            const serperTitle = cleanSerperFoodTitle(cleanTitle.trim(), query);
            const serperMacros = {
              calories:
                parseFloat(answer.calories) ||
                macros.calories ||
                extractNumber(snippet, /(\d+)\s*calories/i) ||
                0,
              protein:
                parseFloat(answer.protein) || macros.protein || extractNumber(snippet, /(\d+\.?\d*)\s*g?\s*protein/i) || 0,
              carbs:
                parseFloat(answer.carbohydrates) ||
                parseFloat(answer.carbs) ||
                macros.carbs ||
                extractNumber(snippet, /(\d+\.?\d*)\s*g?\s*carb/i) ||
                0,
              fat:
                parseFloat(answer.fat) || macros.fat || extractNumber(snippet, /(\d+\.?\d*)\s*g?\s*fat/i) || 0,
            };
            if (!isPlausibleNutritionRow(serperMacros)) {
              parsed = [];
            } else {
              parsed = [
                {
                  food_name: serperTitle,
                  brand_name: resolveFoodBrandLabel(serperTitle, ''),
                  serving_qty: 1,
                  serving_unit: srv || 'serving',
                  serving_label: srv,
                  nf_calories: serperMacros.calories,
                  nf_protein: serperMacros.protein,
                  nf_total_carbohydrate: serperMacros.carbs,
                  nf_total_fat: serperMacros.fat,
                  photo: null,
                  source: 'serper',
                },
              ];
            }
          }
        }
      }

      if (Array.isArray(parsed) && parsed.length) {
        const merged = rankResults([...parsed, ...(results || [])]);
        results = merged;
        source = results?.[0]?.source === 'serper' ? 'serper' : source || 'mixed';
        console.log('[Food Search] 🔍 Serper merged', parsed.length, 'items');
      }
    } catch (e) {
      console.error('[Food Search] Serper failed:', e.message);
    }
  }

  let usdaResults = null;
  let offResults = null;

  async function loadUsdaFoundationFirst() {
    if (!process.env.USDA_API_KEY) return;
    try {
      // FDC mixed-type searches return SR Legacy baby foods / Survey noise BEFORE Kellogg's branded rows.
      // Terminal proof: Branded-only + "apple jacks" returns Kellogg's Apple Jacks; mixed "Apple Jacks cereal" does not (first page).
      const combinedFoods = [];
      const seenIds = new Set();
      const pushFoods = (foods) => {
        for (const f of foods || []) {
          if (f?.fdcId && !seenIds.has(f.fdcId)) {
            seenIds.add(f.fdcId);
            combinedFoods.push(f);
          }
        }
      };

      const brandedQuery =
        queryCorePhrase.length >= 3 ? queryCorePhrase : queryLower;

      const apiUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(process.env.USDA_API_KEY)}`;

      console.log('[Food Search] USDA Branded-first:', brandedQuery);
      const rBrand = await fetchWithTimeout(
        apiUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: brandedQuery,
            pageSize: 45,
            dataType: ['Branded'],
          }),
        },
        12000,
      );
      if (rBrand.ok) {
        const dBrand = await rBrand.json();
        pushFoods(dBrand.foods);
      }

      console.log('[Food Search] USDA mixed datatypes (full query)...');
      const rMix = await fetchWithTimeout(
        apiUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            pageSize: 50,
            dataType: ['Branded', 'Foundation', 'SR Legacy', 'Survey (FNDDS)'],
          }),
        },
        12000,
      );
      if (rMix.ok) {
        const dMix = await rMix.json();
        pushFoods(dMix.foods);
      }

      usdaResults = rankResults(mapUsdaFoods(combinedFoods.slice(0, 120)));
      if (hasGoodMatch(usdaResults)) {
        results = usdaResults;
        source = 'usda';
        console.log('[Food Search] USDA grocery match:', results.length, 'pool:', combinedFoods.length);
      } else {
        console.log('[Food Search] USDA weak match — may try other tiers');
      }
    } catch (e) {
      console.error('[Food Search] USDA primary search failed:', e.message);
    }
  }

  async function loadUsdaBroad() {
    if (!process.env.USDA_API_KEY) return;
    try {
      console.log('[Food Search] USDA (broad search)...');
      const r = await fetchWithTimeout(
        `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=12&api_key=${process.env.USDA_API_KEY}`,
        {},
        10000,
      );
      if (!r.ok) return;
      const data = await r.json();
      const mapped = rankResults(mapUsdaFoods((data.foods || []).slice(0, 12)));
      usdaResults = mapped;
      if (hasGoodMatch(mapped)) {
        results = mapped;
        source = 'usda';
        console.log('[Food Search] USDA broad match:', results.length);
      }
    } catch (e) {
      console.error('[Food Search] USDA broad failed:', e.message);
    }
  }

  async function loadFatSecretSearch() {
    if (!fatSecretConfigured()) return;
    try {
      console.log('[Food Search] FatSecret foods.search:', query);
      const rows = await searchFoodsFatSecret(query, limit);
      if (!rows.length) return;
      const ranked = rankResults(rows);
      if (hasGoodMatch(ranked)) {
        results = ranked;
        source = 'fatsecret';
        console.log('[Food Search] FatSecret match:', results.length);
      } else if (!results?.length) {
        results = ranked.slice(0, limit);
        source = 'fatsecret-weak';
        console.log('[Food Search] FatSecret weak match:', results.length);
      }
    } catch (e) {
      console.warn('[Food Search] FatSecret search failed:', e.message);
    }
  }

  async function loadOpenFoodFacts() {
    if (menuStyleQuery) {
      console.log('[Food Search] 🥫 OFF skipped for menu-style query (Serper/USDA first)');
      return;
    }
    try {
      console.log('[Food Search] 🥫 Open Food Facts:', query);
      const r = await fetchWithTimeout(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=24`,
        { headers: { 'User-Agent': OPEN_FOOD_FACTS_USER_AGENT, Accept: 'application/json' } },
        10000,
      );
      console.log('[Food Search] 🥫 Open Food Facts status:', r.status);
      if (!r.ok) return;
      const data = await r.json();
      console.log('[Food Search] 🥫 OFF products:', data.products?.length || 0);
      offResults = (data.products || []).slice(0, 24).map((item) => {
        const n = item.nutriments || {};
        return {
          food_name: item.product_name || query,
          brand_name: item.brands || '',
          serving_qty: 1,
          serving_unit: item.serving_size || 'serving',
          nf_calories: n['energy-kcal_serving'] || n['energy-kcal_100g'] || 0,
          nf_protein: n['proteins_serving'] || n['proteins_100g'] || 0,
          nf_total_carbohydrate: n['carbohydrates_serving'] || n['carbohydrates_100g'] || 0,
          nf_total_fat: n['fat_serving'] || n['fat_100g'] || 0,
          photo: item.image_small_url || null,
          source: 'openfoodfacts',
        };
      });
      offResults = rankResults(offResults);
      if (hasGoodMatch(offResults)) {
        const top = offResults[0];
        const topText = itemText(top);
        const retailFrozen =
          /\bpizza\b/.test(queryLower) &&
          /\b(take\s*&\s*bake|take\s+and\s+bake|bake\s+at\s+home)\b/.test(topText) &&
          !/\b(take|bake|frozen|grocery)\b/.test(queryLower);
        if (retailFrozen) {
          console.log(
            '[Food Search] 🥫 OFF top looks retail/frozen pizza — continuing to web search for better match',
          );
        } else {
          results = offResults;
          source = 'openfoodfacts';
          console.log('[Food Search] 🥫 OFF good match:', results.length);
        }
      }
    } catch (e) {
      console.error('[Food Search] 🥫 Open Food Facts FAILED:', e.message);
    }
  }

  // ─── Tier order: grocery → USDA → FatSecret → OFF → Serper | menu → FatSecret → Serper → USDA
  if (searchMode === 'generic') {
    if (requiredConsumerBrand) {
      if (needsFill()) await loadFatSecretSearch();
      if (needsFill()) await mergeSerperFoodSearch('[Food Search] Serper (consumer brand query)');
    }
    if (needsFill()) await loadUsdaFoundationFirst();
    if (needsFill()) await loadFatSecretSearch();
    if (needsFill()) await loadOpenFoodFacts();
    if (needsFill()) await mergeSerperFoodSearch('[Food Search] Serper (after USDA + OFF)');
    if (needsFill()) await loadUsdaBroad();
  } else if (searchMode === 'branded') {
    if (needsFill()) await loadFatSecretSearch();
    // FatSecret-first: skip Serper when we already have a strong menu match.
    const fatSecretOk = Array.isArray(results) && results.length > 0 && hasGoodMatch(results);
    if (!fatSecretOk && needsFill()) {
      await mergeSerperFoodSearch('[Food Search] Serper (menu-style fallback after FatSecret miss)');
    }
    if (needsFill()) await loadUsdaBroad();
    if (needsFill()) await loadUsdaFoundationFirst();
  } else {
    if (needsFill()) await loadOpenFoodFacts();
    if (needsFill()) await mergeSerperFoodSearch('[Food Search] Serper (after OFF)');
    if (needsFill()) await loadUsdaBroad();
    if (needsFill()) await loadUsdaFoundationFirst();
  }

  const needSerperFinal =
    serperAllowed &&
    process.env.SERPER_API_KEY &&
    (!results?.length ||
      (requiredConsumerBrand &&
        results.length > 0 &&
        !brandMatchesItem(itemText(results[0]), requiredConsumerBrand)) ||
      (menuStyleQuery &&
        results.length > 0 &&
        !itemMatchesQuery(itemText(results[0]), query)) ||
      (requestedBrand &&
        results.length > 0 &&
        !brandMatchesItem(itemText(results[0]), requestedBrand)) ||
      (queryTokens.length >= 2 &&
        results.length > 0 &&
        !itemMatchesQuery(itemText(results[0]), query)));

  if (needSerperFinal) {
    await mergeSerperFoodSearch('[Food Search] Serper final pass (brand / empty fix)');
  }

  if (!results || results.length === 0) {
    if (trustedHits.length > 0) {
      results = trustedHits.slice();
      source = 'trusted_catalog';
    } else if (!menuStyleQuery) {
      if (usdaResults && usdaResults.length > 0) {
        let fallback = usdaResults;
        if (requiredConsumerBrand) {
          fallback = usdaResults.filter((it) => brandMatchesItem(itemText(it), requiredConsumerBrand));
        }
        if (fallback.length > 0) {
          console.log('[Food Search] Fallback: USDA results');
          results = fallback;
          source = 'usda-fallback';
        }
      } else if (offResults && offResults.length > 0) {
        console.log('[Food Search] Fallback: OFF results');
        results = offResults;
        source = 'openfoodfacts-fallback';
      }
    } else {
      console.log('[Food Search] Menu-style query — skipping USDA/OFF fallback');
    }
  }

  if ((!results || results.length === 0) && trustedHits.length === 0) {
    console.error('[Food Search] All tiers failed for query:', query);
    return res.json({
      results: [],
      source: 'none',
      hint: EMPTY_SEARCH_HINT,
      query,
    });
  }

  // Seed curated close matches into the pool, then strict-filter everything.
  if (trustedHits.length > 0) {
    results = [...trustedHits, ...(results || [])];
  }

  if (Array.isArray(results) && results.length) {
    const serperSafe = results.filter((it) => {
      if (it.source !== 'serper') return true;
      const macros = {
        calories: it.nf_calories ?? it.calories,
        protein: it.nf_protein ?? it.protein,
        carbs: it.nf_total_carbohydrate ?? it.carbs,
        fat: it.nf_total_fat ?? it.fat,
      };
      if (!isPlausibleNutritionRow(macros)) return false;
      if (isJunkWebSearchTitle(it.food_name || it.name)) return false;
      return true;
    });
    const before = serperSafe.length;
    results = filterFoodSearchRows(query, serperSafe, Math.min(limit, 5));
    console.log('[Food Search] Strict close-name filter:', before, '→', results.length, 'for', query);
    if (results.length === 0 && requiredConsumerBrand) {
      searchHint = `No ${requiredConsumerBrand} products matched. Try scanning the barcode or a shorter product name.`;
    }
  }

  if (!results || results.length === 0) {
    return res.json({
      results: [],
      source: 'none',
      hint: searchHint || EMPTY_SEARCH_HINT,
      query,
    });
  }

  let sliced = (results || []).slice(0, Math.min(limit, 5));
  const serperRows = sliced.filter((r) => r.source === 'serper');
  const otherRows = sliced.filter((r) => r.source !== 'serper');
  if (serperRows.length > 0) {
    sliced = [...rankSerperFoodResultRows(serperRows, query), ...otherRows].slice(0, Math.min(limit, 5));
  }
  const out = dedupeFoodRows(sanitizeSearchResultRows(sliced, query)).slice(0, Math.min(limit, 5));


  if (!serperAllowed && out.length === 0 && (menuStyleQuery || requiredConsumerBrand)) {
    searchHint = searchHint || 'Live menu web search is temporarily limited. Try again later or use a shorter item name.';
  }

  foodCache.set(cacheKey, { data: out, timestamp: Date.now() });

  try {
    if (admin.apps.length && out.length > 0) {
      const docId = searchResultsDocId(normalizedKey);
      await admin.firestore().collection('searchResults').doc(docId).set(
        {
          queryKey: normalizedKey,
          originalQuery: query,
          pipelineVersion: FOOD_SEARCH_PIPELINE_VERSION,
          food_name: out[0]?.food_name || out[0]?.name || query,
          calories: Number(out[0]?.nf_calories ?? out[0]?.calories ?? 0),
          protein: Number(out[0]?.nf_protein ?? out[0]?.protein ?? 0),
          carbs: Number(out[0]?.nf_total_carbohydrate ?? out[0]?.carbs ?? 0),
          fat: Number(out[0]?.nf_total_fat ?? out[0]?.fat ?? 0),
          source: source || out[0]?.source || 'unknown',
          results: out,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  } catch (fwErr) {
    console.warn('[Food Search] Firestore cache write failed:', fwErr.message);
  }

  return res.json({ results: out, source, hint: searchHint || undefined });
});

// Barcode pipeline: ① USDA ② FatSecret ③ Open Food Facts ④ Serper
app.post('/api/food/barcode', verifyFirebaseBearerToken, async (req, res) => {
  try {
    const { barcode } = req.body;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    const cacheKey = `barcode:${barcode}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const clean = String(barcode || '').trim();
    let result = null;

    // 0. User-verified Firestore catalog (instant + accurate on repeat scans)
    try {
      result = await getVerifiedBarcode(clean);
      if (result) console.log('[Barcode] Verified cache hit:', result.name);
    } catch (vcErr) {
      console.warn('[Barcode] Verified cache lookup failed:', vcErr.message);
    }

    // 1–3. Parallel branded DBs → merge (prefer FatSecret/OFF label serving over USDA per-100g)
    if (!result) {
      const [usdaResult, fatsecretResult, offResult] = await Promise.all([
        process.env.USDA_API_KEY ? lookupBarcodeUsda(clean) : Promise.resolve(null),
        lookupBarcodeFatSecret(clean).catch((e) => {
          console.warn('FatSecret barcode lookup failed:', e.message);
          return null;
        }),
        lookupBarcodeOpenFoodFacts(clean),
      ]);

      const candidates = [usdaResult, fatsecretResult, offResult].filter(
        (f) => f && isUsableBarcodeFood(f),
      );
      result = pickBestBarcodeCandidate(candidates);
      if (result) {
        console.log('[Barcode] Merged pick:', result.name, 'source:', result.source, 'basis:', result.dataBasis);
      } else if (usdaResult && !isUsableBarcodeFood(usdaResult)) {
        console.warn('[Barcode] USDA hit unusable, continuing pipeline:', usdaResult.name);
      }
    }

    // 3b. UPCitemdb → USDA by product name (covers GTINs USDA indexes under a different pad)
    let upcItemHint = null;
    if (!result) {
      try {
        upcItemHint = await lookupUpcItemDb(clean);
        if (upcItemHint?.name) {
          const usdaFromUpcItem = await lookupUsdaBrandedByName(upcItemHint.name, upcItemHint.brand || '');
          if (usdaFromUpcItem && isUsableBarcodeFood(usdaFromUpcItem)) {
            console.log('[Barcode] USDA via UPCitemdb name:', usdaFromUpcItem.name);
            result = usdaFromUpcItem;
          }
        }
      } catch (upcErr) {
        console.warn('[Barcode] UPCitemdb assist failed:', upcErr.message);
      }
    }

    // 4. Serper web search for barcode + nutrition (junk GS1/tracker pages filtered)
    let serperSuggested = [];
    if (upcItemHint?.name) serperSuggested.push(upcItemHint.name);
    if (!result && process.env.SERPER_API_KEY) {
      try {
        const serper = await lookupBarcodeWithSerperImproved(clean);
        serperSuggested = serper?.suggestedSearchQueries || [];
        if (serper?.food) {
          result = {
            ...serper.food,
            dataBasis: serper.food.dataBasis || 'label_serving',
            barcodeConfidence: 'low',
            needsVerification: true,
          };
          console.log('Barcode found via Serper:', result.name);
        }
      } catch (serperErr) {
        console.warn('Serper barcode fallback failed:', serperErr.message);
      }
    }

    // 5. USDA by product name (covers brands whose package GTIN isn’t in FDC under that exact code)
    if ((!result || !isUsableBarcodeFood(result) || String(result.source).toLowerCase() === 'serper') && process.env.USDA_API_KEY) {
      const nameCandidates = [
        result?.name,
        ...(Array.isArray(serperSuggested) ? serperSuggested : []),
      ].filter((n) => n && !/barcode|gs1|tracker|fooddata|calorie content/i.test(String(n)));
      const brandHint = result?.brand || '';
      for (const nameHint of nameCandidates.slice(0, 4)) {
        const usdaByName = await lookupUsdaBrandedByName(nameHint, brandHint);
        if (usdaByName && isUsableBarcodeFood(usdaByName)) {
          console.log('[Barcode] Preferring USDA name match over', result?.source || 'miss');
          result = usdaByName;
          break;
        }
      }
    }

    result = guardBarcodeResult(result);

    // Reject GS1 "Food Barcode" / zero-macro junk that would log as 0 kcal
    if (result && !isUsableBarcodeFood(result)) {
      console.warn('[Barcode] Rejected unusable hit:', result?.name, result?.source);
      result = null;
    }

    if (!result) {
      const clean = String(barcode || '').trim();
      const vwHint = variableWeightBarcodeHint(clean);
      if (vwHint) {
        console.log('[Barcode] Variable-weight scale label (no GTIN match):', clean, 'PLU:', vwHint.itemPlu);
        setCache(cacheKey, vwHint);
        return res.json(vwHint);
      }
      const notFound = barcodeNotFoundPayload(clean, serperSuggested);
      setCache(cacheKey, notFound);
      return res.json(notFound);
    }

    setCache(cacheKey, result);
    return res.json({ ...result, scannedBarcode: clean });
  } catch (error) {
    console.error('Barcode lookup error:', error);
    return res.status(500).json({ error: 'Barcode lookup failed' });
  }
});

// Save user-confirmed barcode food to shared verified catalog
app.post('/api/food/barcode/verify', verifyFirebaseBearerToken, async (req, res) => {
  try {
    const { barcode, food } = req.body || {};
    const clean = String(barcode || food?.gtinUpc || food?.barcode || '').trim();
    if (!clean || !food || typeof food !== 'object') {
      return res.status(400).json({ error: 'barcode and food are required' });
    }
    const guarded = guardBarcodeResult({ ...food, verified: true });
    if (!guarded || !isUsableBarcodeFood(guarded)) {
      return res.status(400).json({ error: 'Food row is not usable for cache' });
    }
    const uid = req.user?.uid || null;
    const ok = await saveVerifiedBarcode(clean, guarded, uid);
    if (!ok) {
      return res.status(500).json({ error: 'Failed to save verified barcode' });
    }
    return res.json({ ok: true, gtin: clean, food: guarded });
  } catch (error) {
    console.error('Barcode verify save error:', error);
    return res.status(500).json({ error: 'Failed to save verified barcode' });
  }
});

// Restaurant nutrition: web search + fetch first URL + OpenAI extraction (structured JSON only)
const EXTRACTION_PROMPT = `You are a nutrition data extractor.
Extract exact calories, protein, carbohydrates, fat, and serving description for the specified menu item.
Return ONLY valid JSON.
Do not explain anything.
If data is not found, return null.`;

const RESTAURANT_JSON_SCHEMA = {
  name: 'string',
  calories: 'number',
  protein: 'number',
  carbs: 'number',
  fat: 'number',
  serving_description: 'string',
  source_url: 'string',
};

app.post('/api/nutrition/restaurant', verifyFirebaseBearerToken, async (req, res) => {
  // Overall timeout for this pipeline (Serper + HTML fetch)
  const routeTimeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'Restaurant lookup timed out. Try a more specific search.' });
    }
  }, 20000);

  try {
    const { query } = req.body || {};
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'query is required' });
    }
    // For now, return null since we removed OpenAI extraction
    // In the future, consider using Claude via /api/ai-coach for extraction
    console.warn('Restaurant nutrition extraction requires API integration - returning null');
    return res.json(null);
  } catch (error) {
    console.error('Restaurant nutrition error:', error?.message || error);
    return res.status(500).json({ error: 'Restaurant nutrition failed' });
  } finally {
    clearTimeout(routeTimeout);
  }
});

app.post('/api/food/usda', verifyFirebaseBearerToken, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=20&dataType=Foundation,SR%20Legacy&api_key=${process.env.USDA_API_KEY}`;
    const usdaResponse = await axios.get(usdaUrl);

    if (usdaResponse.data && usdaResponse.data.foods) {
      const results = usdaResponse.data.foods.map(food => ({
        id: food.fdcId || `usda_${Date.now()}_${Math.random()}`,
        name: food.description,
        brand: food.brandOwner || null,
        restaurant: null,
        calories: food.foodNutrients?.find(n => n.nutrientId === 1008)?.value || 0,
        protein: food.foodNutrients?.find(n => n.nutrientId === 1003)?.value || 0,
        carbs: food.foodNutrients?.find(n => n.nutrientId === 1005)?.value || 0,
        fat: food.foodNutrients?.find(n => n.nutrientId === 1004)?.value || 0,
        fiber: food.foodNutrients?.find(n => n.nutrientId === 1079)?.value || null,
        sodium: food.foodNutrients?.find(n => n.nutrientId === 1093)?.value || null,
        sugar: food.foodNutrients?.find(n => n.nutrientId === 2000)?.value || null,
        servingSize: 100,
        servingUnit: 'grams',
        servingGrams: 100,
        source: 'usda'
      }));

      return res.json(results);
    }

    return res.json([]);
  } catch (error) {
    console.error('USDA search error:', error);
    return res.status(500).json({ error: 'USDA search failed' });
  }
});

}

module.exports = { registerFoodRoutes, FOOD_SEARCH_PIPELINE_VERSION };
