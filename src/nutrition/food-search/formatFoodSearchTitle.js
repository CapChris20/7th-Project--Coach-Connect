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
const { significantQueryTokens, countTokenHits } = require('../food-search/rankFoodSearchResults');

const JUNK_TITLE_RE =
  /\[(pdf|doc|xls|ppt|docx)\]|\.pdf\b|nutrition\s+infor|nutrition\s+facts\s*(guide|sheet|pdf)?\s*$/i;

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
    const { isPlausibleRestaurantNutritionRow } = require('./validateRestaurantResult');
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
  const cal = Math.round(Number(row.nf_calories ?? row.calories) || 0);
  const p = Math.round(Number(row.nf_protein ?? row.protein) || 0);
  const c = Math.round(Number(row.nf_total_carbohydrate ?? row.carbs) || 0);
  const f = Math.round(Number(row.nf_total_fat ?? row.fat) || 0);
  const label = String(row.serving_label || row.serving_unit || '').toLowerCase();
  return `${cal}|${p}|${c}|${f}|${label}`;
}

/** Drop exact duplicate macros/portions — keep different servings (e.g. 1 vs 2 slices). */
function dedupeFoodRows(rows) {
  const out = [];
  const seen = new Set();
  for (const row of rows || []) {
    const key = nutritionRowKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

module.exports = {
  formatUserQueryAsFoodName,
  isJunkWebSearchTitle,
  cleanSerperFoodTitle,
  displayNameForSerperRow,
  isPlausibleNutritionRow,
  dedupeFoodRows,
};
