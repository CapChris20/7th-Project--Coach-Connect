/** HTTP fetch + HTML/text parsing helpers for nutrition scrapers. */
const cheerio = require('cheerio');
const { USER_AGENT } = require('./constants');

function parseNumber(raw) {
  if (raw == null) return null;
  const cleaned = String(raw)
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, ' ')
    .trim()
    .split(/\s+/)[0];
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function buildSearchQuery(foodName, restaurant) {
  const food = String(foodName || '').trim();
  const place = String(restaurant || '').trim();
  if (food && place) return `${place} ${food}`.trim();
  return food;
}

function normalizeMacros(partial) {
  if (!partial || typeof partial !== 'object') return null;
  const calories = parseNumber(partial.calories);
  const protein_g = parseNumber(partial.protein_g);
  const carbs_g = parseNumber(partial.carbs_g);
  const fat_g = parseNumber(partial.fat_g);
  const fiber_g = parseNumber(partial.fiber_g);
  const sodium_mg = parseNumber(partial.sodium_mg);
  const sugar_g = parseNumber(partial.sugar_g);

  const hasAny =
    calories != null ||
    protein_g != null ||
    carbs_g != null ||
    fat_g != null ||
    fiber_g != null ||
    sodium_mg != null ||
    sugar_g != null;

  if (!hasAny) return null;

  return {
    calories,
    protein_g,
    carbs_g,
    fat_g,
    fiber_g,
    sodium_mg,
    sugar_g,
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/json,*/*',
        ...(options.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHtml(url, timeoutMs = 5000) {
  const res = await fetchWithTimeout(url, {}, timeoutMs);
  if (!res.ok) return null;
  return res.text();
}

async function fetchJson(url, timeoutMs = 5000, headers = {}) {
  const res = await fetchWithTimeout(url, { headers }, timeoutMs);
  if (!res.ok) return null;
  return res.json();
}

function loadCheerio(html) {
  return cheerio.load(html || '');
}

/** Extract first numeric match for a label pattern from page text. */
function extractLabeledValue(text, labels) {
  const body = String(text || '');
  for (const label of labels) {
    const re = new RegExp(`${label}[^\\d]{0,20}([\\d,.]+)`, 'i');
    const m = body.match(re);
    const n = parseNumber(m?.[1]);
    if (n != null) return n;
  }
  return null;
}

/** Parse common nutrition table rows (Calories, Protein, Carbs, Fat, Fiber, Sodium). */
function parseNutritionFromText(text) {
  const t = String(text || '');
  return normalizeMacros({
    calories: extractLabeledValue(t, ['calories', 'kcal', 'energy']),
    protein_g: extractLabeledValue(t, ['protein']),
    carbs_g: extractLabeledValue(t, ['carbohydrate', 'carbs', 'total carbohydrate']),
    fat_g: extractLabeledValue(t, ['total fat', 'fat']),
    fiber_g: extractLabeledValue(t, ['dietary fiber', 'fiber']),
    sodium_mg: extractLabeledValue(t, ['sodium']),
    sugar_g: extractLabeledValue(t, ['total sugars', 'sugars', 'sugar']),
  });
}

function withTimeout(promise, timeoutMs, label = 'scraper') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

module.exports = {
  parseNumber,
  buildSearchQuery,
  normalizeMacros,
  fetchWithTimeout,
  fetchHtml,
  fetchJson,
  loadCheerio,
  extractLabeledValue,
  parseNutritionFromText,
  withTimeout,
};
