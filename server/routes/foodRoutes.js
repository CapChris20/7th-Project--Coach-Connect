/** Food search, barcode, USDA, restaurant nutrition */
const path = require('path');
const admin = require('firebase-admin');
const axios = require('axios');
const { normalizeOpenFoodFactsProduct } = require('../../src/nutrition/food-details/normalizeNutritionData');
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
  searchResultsDocId,
} = require('../nutritionSearchHelpers');
const { resolveFoodBrandLabel } = require('../../src/nutrition/food-details/formatFoodBrand');
const {
  cleanSerperFoodTitle,
  displayNameForSerperRow,
  isJunkWebSearchTitle,
  isPlausibleNutritionRow,
  dedupeFoodRows,
  formatUserQueryAsFoodName,
} = require('../../src/nutrition/food-search/formatFoodSearchTitle');
const { rankSerperFoodResultRows } = require('../../src/nutrition/food-search/validateRestaurantResult');

const SERPER_ORGANIC_MAX = 10;

const FOOD_SEARCH_PIPELINE_VERSION = 28;

function sanitizeSearchResultRows(rows, userQuery = '') {
  return (Array.isArray(rows) ? rows : []).map((it) => {
    const rawName = String(it.food_name || it.name || '').trim();
    const foodName =
      it.source === 'serper' && userQuery
        ? cleanSerperFoodTitle(rawName, userQuery)
        : rawName;
    const brand = resolveFoodBrandLabel(foodName, it.brand_name || it.brand || '');
    return {
      ...it,
      food_name: foodName || it.food_name,
      name: String(it.name || foodName || '').trim() || foodName,
      brand_name: brand,
      brand,
    };
  });
}
const foodCache = new Map();
const FOOD_CACHE_TTL = 24 * 60 * 60 * 1000;

function registerFoodRoutes(app, deps) {
  const { verifyFirebaseBearerToken } = deps;

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
function normalizeGtinDigits(barcode) {
  const d = String(barcode || '').replace(/\D/g, '');
  if (!d) return '';
  const stripped = d.replace(/^0+/, '');
  return stripped || '0';
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
  const useMl = unitRaw === 'ml' || unitRaw === 'milliliters';
  const scale = servingG / 100;

  return {
    id: String(hit.fdcId),
    name: hit.description || 'Unknown',
    brand: hit.brandOwner || null,
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
    source: 'usda',
    kcalPer100Unit: kcal,
    servingAmount: Math.round(servingG),
  };
}

async function lookupBarcodeUsda(barcode) {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey || !String(barcode || '').trim()) return null;

  const clean = String(barcode).trim();
  const target = normalizeGtinDigits(clean);

  try {
    const res = await axios.post(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`,
      {
        query: clean,
        pageSize: 25,
        dataType: ['Branded'],
      },
      { timeout: 12000, headers: { 'Content-Type': 'application/json' } }
    );

    const foods = res.data?.foods || [];
    const hit =
      foods.find((f) => normalizeGtinDigits(f.gtinUpc) === target) ||
      foods.find((f) => String(f.gtinUpc || '').replace(/\D/g, '') === clean.replace(/\D/g, '')) ||
      null;

    if (!hit) return null;

    console.log('[Barcode] USDA branded match:', hit.description, 'fdcId:', hit.fdcId, 'gtin:', hit.gtinUpc);
    return mapUsdaBrandedSearchHitToBarcodeFood(hit);
  } catch (e) {
    console.warn('[Barcode] USDA lookup failed:', e.message);
    return null;
  }
}

app.get('/api/food/search', verifyFirebaseBearerToken, async (req, res) => {
  const query = req.query.query?.trim();
  if (!query) return res.status(400).json({ error: 'Query required' });

  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 1), 40);
  const normalizedKey = normalizeSearchKey(query);
  const cacheKey = `v${FOOD_SEARCH_PIPELINE_VERSION}|${normalizedKey}`;

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

  let results = null;
  let source = '';
  
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
    const list = Array.isArray(arr) ? arr.slice() : [];
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
    if (requestedBrand) return brandMatchesItem(topText, requestedBrand);
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
    if (!process.env.SERPER_API_KEY) return;
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

  async function loadOpenFoodFacts() {
    if (menuStyleQuery) {
      console.log('[Food Search] 🥫 OFF skipped for menu-style query (Serper/USDA first)');
      return;
    }
    try {
      console.log('[Food Search] 🥫 Open Food Facts:', query);
      const r = await fetchWithTimeout(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=24`,
        {},
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

  // ─── Tier order: grocery → USDA → OFF → Serper | menu-style → Serper → USDA
  if (searchMode === 'generic') {
    if (needsFill()) await loadUsdaFoundationFirst();
    if (needsFill()) await loadOpenFoodFacts();
    if (needsFill()) await mergeSerperFoodSearch('[Food Search] Serper (after USDA + OFF)');
    if (needsFill()) await loadUsdaBroad();
  } else if (searchMode === 'branded') {
    if (needsFill()) await mergeSerperFoodSearch('[Food Search] Serper (menu-style first)');
    if (needsFill()) await loadUsdaBroad();
    if (needsFill()) await loadUsdaFoundationFirst();
  } else {
    if (needsFill()) await loadOpenFoodFacts();
    if (needsFill()) await mergeSerperFoodSearch('[Food Search] Serper (after OFF)');
    if (needsFill()) await loadUsdaBroad();
    if (needsFill()) await loadUsdaFoundationFirst();
  }

  const needSerperFinal =
    process.env.SERPER_API_KEY &&
    (!results?.length ||
      (menuStyleQuery &&
        results.length > 0 &&
        !itemMatchesQuery(itemText(results[0]), query)) ||
      (requestedBrand &&
        results.length > 0 &&
        !brandMatchesItem(itemText(results[0]), requestedBrand)));

  if (needSerperFinal) {
    await mergeSerperFoodSearch('[Food Search] Serper final pass (brand / empty fix)');
  }

  if (!results || results.length === 0) {
    if (usdaResults && usdaResults.length > 0) {
      console.log('[Food Search] Fallback: USDA results');
      results = usdaResults;
      source = 'usda-fallback';
    } else if (offResults && offResults.length > 0) {
      console.log('[Food Search] Fallback: OFF results');
      results = offResults;
      source = 'openfoodfacts-fallback';
    }
  }

  if (!results || results.length === 0) {
    console.error('[Food Search] All tiers failed for query:', query);
    return res.json({
      results: [],
      source: 'none',
      hint: EMPTY_SEARCH_HINT,
      query,
    });
  }

  if (menuStyleQuery && Array.isArray(results) && results.length) {
    const strict = results.filter((it) => {
      const text = itemText(it);
      if (isRetailFoodNoise(text)) return false;
      if (it.source === 'serper') {
        const macros = {
          calories: it.nf_calories ?? it.calories,
          protein: it.nf_protein ?? it.protein,
          carbs: it.nf_total_carbohydrate ?? it.carbs,
          fat: it.nf_total_fat ?? it.fat,
        };
        if (!isPlausibleNutritionRow(macros)) return false;
        if (isJunkWebSearchTitle(it.food_name || it.name)) return false;
        return true;
      }
      if (!itemMatchesQuery(text, query)) return false;
      return true;
    });
    if (strict.length > 0) {
      results = rankResults(strict);
      console.log('[Food Search] Query-token filter:', strict.length, 'relevant rows for', query);
    }
  }

  let sliced = (results || []).slice(0, limit);
  const serperRows = sliced.filter((r) => r.source === 'serper');
  const otherRows = sliced.filter((r) => r.source !== 'serper');
  if (serperRows.length > 0) {
    sliced = [...rankSerperFoodResultRows(serperRows, query), ...otherRows].slice(0, limit);
  }
  const out = dedupeFoodRows(sanitizeSearchResultRows(sliced, query)).slice(0, limit);

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

  return res.json({ results: out, source });
});

// Barcode pipeline (fixed order): ① USDA Branded-only GTIN match ② Open Food Facts product API ③ Serper web
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

    let result = null;

    // 1. USDA FDC — branded products only (see lookupBarcodeUsda: dataType Branded + GTIN match)
    if (process.env.USDA_API_KEY) {
      result = await lookupBarcodeUsda(barcode.trim());
      if (result) console.log('Barcode from USDA:', result.name, 'fdcId:', result.id);
    }

    // 2. Open Food Facts with portion normalization
    if (!result) {
      try {
        const openFoodFactsUrl = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`;
        const offResponse = await axios.get(openFoodFactsUrl);

        if (offResponse.data && offResponse.data.product) {
          result = normalizeOpenFoodFactsProduct(offResponse.data.product);
          if (result) console.log('Barcode from OFF:', result.name, 'servingAmount:', result.servingAmount, 'calories:', result.calories);
        }
      } catch (offError) {
        console.warn('OpenFoodFacts barcode lookup failed:', offError.message);
      }
    }

    // 3. Serper web search for barcode + nutrition
    if (!result && process.env.SERPER_API_KEY) {
      try {
        result = await lookupBarcodeWithSerper(barcode);
        if (result) console.log('Barcode found via Serper:', result.name);
      } catch (serperErr) {
        console.warn('Serper barcode fallback failed:', serperErr.message);
      }
    }

    setCache(cacheKey, result);
    return res.json(result);
  } catch (error) {
    console.error('Barcode lookup error:', error);
    return res.status(500).json({ error: 'Barcode lookup failed' });
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
