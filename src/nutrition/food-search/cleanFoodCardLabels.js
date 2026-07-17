/**
 * food Search Title
 *
 * Purpose: food Search Title — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: formatUserQueryAsFoodName, isJunkWebSearchTitle, cleanSerperFoodTitle, displayNameForSerperRow, isPlausibleNutritionRow, dedupeFoodRows
 *
 * @file-header
 */
/**
 * Clean web-search (Serper) titles for food cards — never show [PDF] / "Nutrition Information".
 */
const { significantQueryTokens, countTokenHits } = require('../food-search/sortBestFoodMatches');
const {
  resolveFoodServingLabelDetailed,
  servingConflictsWithFood,
} = require('./guessServingSize');

const JUNK_TITLE_RE =
  /\[(pdf|doc|xls|ppt|docx)\]|\.pdf\b|nutrition\s+infor|nutrition\s+facts\s*(guide|sheet|pdf)?\s*$/i;

/** Concatenated web/menu-page titles and tracker noise that must never top search. */
const MENU_PAGE_JUNK_RE =
  /\bmenu\s*items?\b|breadmenu|menuitems?|\bgs1\b|\bupc\s*tracker\b|\bbarcode\s*tracker\b|\bnutritionix\s*track|\bcalorie\s*content\b|\ballergen\s*(guide|sheet)\b/i;

/** Site / pipeline names that must never become the food card title. */
const SOURCE_NAME_JUNK = new Set([
  'calorieking',
  'fatsecret',
  'fastfoodnutrition',
  'openfoodfacts',
  'foodfacto',
  'usda',
  'usdafooddatacentral',
  'serper',
  'consensus',
  'nutritionconsensus',
  'myfitnesspal',
  'nutritionix',
  'cronometer',
  'yazio',
  'menustat',
  'web',
  'unknown',
  'menuitem',
]);

const SOURCE_SUBTITLE_LABELS = {
  nutrition_consensus: null,
  fatsecret: 'FatSecret',
  fatSecret: 'FatSecret',
  calorieking: 'CalorieKing',
  calorieKing: 'CalorieKing',
  fastfoodnutrition: 'FastFoodNutrition',
  fastFoodNutrition: 'FastFoodNutrition',
  foodfacto: 'FoodFacto',
  foodFacto: 'FoodFacto',
  openfoodfacts: 'Open Food Facts',
  openFoodFacts: 'Open Food Facts',
  usda: 'USDA',
  usdafdc: 'USDA',
  usdaFdc: 'USDA FoodData Central',
  serper: 'Web',
  mixed: 'Web',
};

function titleCaseWords(s) {
  return String(s || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const low = w.toLowerCase();
      if (low === 'inn' || low === 'bbq' || low === 'ii') return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

/** User-facing name from their search (e.g. cottage inn garlic cheese bread). */
function formatUserQueryAsFoodName(query) {
  const q = String(query || '')
    .trim()
    .replace(/\s+nutrition\s+facts.*$/i, '')
    .replace(/\s+calories.*$/i, '')
    .trim();
  if (!q) return 'Menu item';
  return titleCaseWords(q);
}

function isJunkWebSearchTitle(title) {
  const t = String(title || '').trim();
  if (!t || t.length < 4) return true;
  if (JUNK_TITLE_RE.test(t)) return true;
  if (MENU_PAGE_JUNK_RE.test(t)) return true;
  // Concatenated scrapes like "Crazy Breadmenu Items"
  if (/\b\w+menu\s*items?\b/i.test(t)) return true;
  if (/^nutrition\b/i.test(t) && !/\b(pizza|burger|bread|chicken|salad)\b/i.test(t)) return true;
  if (/^(calories|carbs|protein|fat)\s+in\b/i.test(t) && t.length < 30) return true;
  if (/^(download|view|read)\b/i.test(t)) return true;
  return false;
}

/**
 * @param {string} rawTitle - Serper / Google result title
 * @param {string} userQuery - what the user typed (not the Serper-expanded query)
 */
function cleanSerperFoodTitle(rawTitle, userQuery) {
  const queryName = formatUserQueryAsFoodName(userQuery);
  const tokens = significantQueryTokens(userQuery);
  const minHits =
    tokens.length >= 4
      ? Math.max(3, Math.ceil(tokens.length * 0.55))
      : tokens.length >= 2
        ? 2
        : 1;

  let t = String(rawTitle || '')
    .replace(/^\[(PDF|DOC|XLS|PPT|DOCX)\]\s*/i, '')
    .replace(/^PDF\s+Nutrition\s+Facts\s+/i, '')
    .replace(/^Calories in\s+/i, '')
    .replace(/^Carbs in\s+/i, '')
    .replace(/^Nutrition (?:Information|Facts|Guide)(?:\s+for)?\s*[-–:]\s*/i, '')
    .replace(/\s*[-–|]\s*CalorieKing.*$/i, '')
    .replace(/\s*[-–|]\s*MyFitnessPal.*$/i, '')
    .replace(/\s*\.pdf\s*$/i, '')
    .trim();

  const parts = t.split(/\s*[-–|]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const scored = parts
      .filter((p) => !isJunkWebSearchTitle(p))
      .map((p) => ({ p, hits: countTokenHits(p, tokens) }))
      .sort((a, b) => b.hits - a.hits);
    if (scored[0]?.hits >= minHits) t = scored[0].p;
    else if (scored[0]?.p.length > 10) t = scored[0].p;
  }

  if (isJunkWebSearchTitle(t) || countTokenHits(t, tokens) < minHits) {
    return queryName;
  }
  return t.length > 90 ? `${t.slice(0, 87)}…` : t;
}

function normalizeTitleKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Strip legacy card suffixes, site names, and dangling separators from any food title. */
function stripLegacyFoodTitleDecorations(name) {
  return String(name || '')
    .replace(/\s*—\s*Consensus\s*\([^)]*\)\s*$/i, '')
    .replace(/\s*[-–|]\s*(CalorieKing|FatSecret|MyFitnessPal|FastFoodNutrition|OpenFoodFacts|USDA|Nutritionix|Cronometer).*$/i, '')
    .replace(/\s*—\s*[^—]+?\s*\(\s*\d+[^)]*cal[^)]*\)\s*$/i, '')
    .replace(/\s*—\s*[^—]+$/i, '')
    .replace(/\s*—\s*$/g, '')
    .replace(/\s+[-–|]\s*$/g, '')
    .replace(/\s+-\s*$/g, '')
    .trim();
}

function isJunkFoodTitle(name) {
  const cleaned = stripLegacyFoodTitleDecorations(name);
  if (!cleaned || cleaned.length < 3) return true;
  if (isJunkWebSearchTitle(cleaned)) return true;
  const key = normalizeTitleKey(cleaned);
  if (SOURCE_NAME_JUNK.has(key)) return true;
  if (/^(calorieking|fatsecret|fastfoodnutrition|openfoodfacts|foodfacto|myfitnesspal)$/i.test(cleaned)) {
    return true;
  }
  // Source-name-only after stripping punctuation (e.g. "Menu Items", "GS1 Tracker")
  if (/^(menu\s*items?|tracker|gs1|upc|barcode)$/i.test(cleaned)) return true;
  return false;
}

/**
 * Universal food card title — works for every source (nutrition scrape, Serper, USDA, OFF, cache).
 * @param {string} name - raw row title
 * @param {string} fallback - user search query or parsed food name
 */
function sanitizeFoodCardTitle(name, fallback = '') {
  const { makeReadableFoodTitle } = require('./makeReadableFoodTitle');
  return makeReadableFoodTitle({
    name,
    userQuery: fallback,
  }).name;
}

function inferSourceSubtitle(row) {
  if (row?.source_subtitle) return row.source_subtitle;
  const src = String(row?.source || '');
  const label = SOURCE_SUBTITLE_LABELS[src] || SOURCE_SUBTITLE_LABELS[src.toLowerCase()];
  if (label) return `via ${label}`;
  return null;
}

/**
 * Final presentation pass for any search result row — title + optional via-line.
 * Call this for every row from every provider before showing or caching.
 */
function applyFoodCardPresentation(row, userQuery = '') {
  if (!row || typeof row !== 'object') return row;
  const source = String(row.source || '').toLowerCase();
  const rawName = String(row.food_name || row.name || '').trim();
  const query = String(userQuery || '').trim();

  let title;
  if ((source === 'serper' || source === 'mixed') && query) {
    title = sanitizeFoodCardTitle(cleanSerperFoodTitle(rawName, query), query);
  } else {
    title = sanitizeFoodCardTitle(rawName, query);
  }

  const { makeReadableFoodTitle } = require('./makeReadableFoodTitle');
  const normalized = makeReadableFoodTitle({
    name: title,
    brand: row.brand || row.brand_name,
    source: row.source,
    userQuery: query,
  });
  title = normalized.name;
  const brand = normalized.brand || row.brand || row.brand_name || '';

  const source_subtitle = inferSourceSubtitle(row);
  const calories = row.nf_calories ?? row.calories;
  const servingResolved = resolveFoodServingLabelDetailed({
    userQuery: query,
    foodName: title,
    restaurant: row.restaurant || row.brand_name || row.brand,
    scraperLabel: row.serving_label || row.servingLabel,
    displayName: title,
    calories,
  });
  const servingLabel = servingResolved.label;

  const conflict = servingConflictsWithFood({
    userQuery: query,
    foodName: title,
    restaurant: row.restaurant || row.brand_name || row.brand,
    servingLabel: row.serving_label || row.servingLabel,
  });

  return {
    ...row,
    name: title,
    food_name: title,
    brand,
    brand_name: brand,
    serving_label: servingLabel,
    servingLabel,
    serving_unit: servingLabel,
    servingUnit: servingLabel,
    portion_text: servingLabel,
    nutrition_unverified:
      Boolean(row.nutrition_unverified) ||
      Boolean(servingResolved.nutrition_unverified) ||
      conflict,
    multiServingFallback:
      Boolean(row.multiServingFallback) || Boolean(servingResolved.multiServingFallback),
    ...(source_subtitle ? { source_subtitle } : {}),
  };
}

function applyFoodCardPresentationToRows(rows, userQuery = '') {
  return (Array.isArray(rows) ? rows : []).map((row) => applyFoodCardPresentation(row, userQuery));
}

/** Card title — base name plus portion when several web hits share the same dish name. */
function displayNameForSerperRow(rawTitle, userQuery, macros) {
  const base = isJunkWebSearchTitle(rawTitle)
    ? formatUserQueryAsFoodName(userQuery)
    : cleanSerperFoodTitle(rawTitle, userQuery);
  const label = String(macros?.servingLabel || '').trim();
  if (!label) return base;
  const bl = label.toLowerCase();
  if (base.toLowerCase().includes(bl)) return base;
  return `${base} · ${label}`;
}

function macroCalories(p, c, f) {
  return 4 * (Number(p) || 0) + 4 * (Number(c) || 0) + 9 * (Number(f) || 0);
}

/** Drop Serper rows that only found calories with no protein/carbs/fat (common in PDF snippets). */
function isPlausibleNutritionRow(macros) {
  try {
    const { isPlausibleRestaurantNutritionRow } = require('./isReliableRestaurantFood');
    return isPlausibleRestaurantNutritionRow(macros);
  } catch {
    const cal = Number(macros?.calories) || 0;
    const p = Number(macros?.protein) || 0;
    const c = Number(macros?.carbs) || 0;
    const f = Number(macros?.fat) || 0;
    if (cal <= 0) return false;
    const mc = macroCalories(p, c, f);
    if (mc >= 20) return true;
    if (cal >= 80) return false;
    return cal > 0 && (p > 0 || c > 0 || f > 0);
  }
}

function nutritionRowKey(row) {
  const { makeReadableFoodTitle } = require('./makeReadableFoodTitle');
  const { name } = makeReadableFoodTitle({
    name: row.food_name || row.name,
    brand: row.brand || row.brand_name,
    source: row.source,
  });
  const nameKey = normalizeTitleKey(name);
  const cal = Math.round(Number(row.nf_calories ?? row.calories) || 0);
  const p = Math.round(Number(row.nf_protein ?? row.protein) || 0);
  const c = Math.round(Number(row.nf_total_carbohydrate ?? row.carbs) || 0);
  const f = Math.round(Number(row.nf_total_fat ?? row.fat) || 0);
  const label = String(row.serving_label || row.serving_unit || '').toLowerCase();
  return `${nameKey}|${cal}|${p}|${c}|${f}|${label}`;
}

function rowMacroTuple(row) {
  return {
    cal: Number(row.nf_calories ?? row.calories) || 0,
    p: Number(row.nf_protein ?? row.protein) || 0,
    c: Number(row.nf_total_carbohydrate ?? row.carbs) || 0,
    f: Number(row.nf_total_fat ?? row.fat) || 0,
    nameKey: normalizeTitleKey(
      String(row.food_name || row.name || '')
        .replace(/\b(little\s*caesars?|mcdonald'?s?|chipotle|wendy'?s?|domino'?s?)\b/gi, ''),
    ),
  };
}

function macrosWithinPct(a, b, pct = 0.05) {
  const keys = ['cal', 'p', 'c', 'f'];
  for (const k of keys) {
    const av = a[k];
    const bv = b[k];
    if (av === 0 && bv === 0) continue;
    const base = Math.max(Math.abs(av), Math.abs(bv), 1);
    if (Math.abs(av - bv) / base > pct) return false;
  }
  return true;
}

/** Drop exact duplicates and near-identical rows (same name ± brand, macros within ~5%). */
function dedupeFoodRows(rows) {
  const out = [];
  const seen = new Set();
  for (const row of rows || []) {
    const key = nutritionRowKey(row);
    if (seen.has(key)) continue;

    const macros = rowMacroTuple(row);
    const nearDup = out.find((prev) => {
      const pm = rowMacroTuple(prev);
      if (!macros.nameKey || !pm.nameKey) return false;
      const sameName =
        macros.nameKey === pm.nameKey ||
        macros.nameKey.includes(pm.nameKey) ||
        pm.nameKey.includes(macros.nameKey);
      return sameName && macrosWithinPct(macros, pm, 0.05);
    });
    if (nearDup) continue;

    seen.add(key);
    out.push(row);
  }
  return out;
}

module.exports = {
  formatUserQueryAsFoodName,
  isJunkWebSearchTitle,
  isJunkFoodTitle,
  cleanSerperFoodTitle,
  displayNameForSerperRow,
  isPlausibleNutritionRow,
  dedupeFoodRows,
  stripLegacyFoodTitleDecorations,
  sanitizeFoodCardTitle,
  inferSourceSubtitle,
  applyFoodCardPresentation,
  applyFoodCardPresentationToRows,
};
