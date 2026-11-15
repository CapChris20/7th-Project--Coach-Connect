const { fetchHtml, loadCheerio, normalizeMacros, parseNutritionFromText, parseNumber } = require('../scrapeHelpers');
const { SCRAPE_TIMEOUT_MS } = require('../constants');
const { createCandidate, assertCandidate } = require('../../../../src/nutrition/food-match/candidate');
const {
  completenessFromMacros,
  servingFromMacros,
} = require('../../../../src/nutrition/food-match/adapters/macroHelpers');

/**
 * Candidate adapter for a MenuStat row / parsed macros blob.
 * @param {object} raw
 * @returns {object|null}
 */
function adaptMenuStatResult(raw, opts = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || raw.displayName || '').trim();
  if (!name) return null;
  const brand = String(raw.brand || raw.restaurant || '').trim();
  const macros = {
    kcal: raw.calories ?? raw.kcal ?? null,
    protein: raw.protein_g ?? raw.protein ?? null,
    carbs: raw.carbs_g ?? raw.carbs ?? null,
    fat: raw.fat_g ?? raw.fat ?? null,
  };
  const candidate = createCandidate({
    id: raw.id ? String(raw.id) : `menuStat:${name}`,
    source: 'menuStat',
    name,
    brand,
    categoryPath: [],
    channel: 'restaurant',
    gtin: null,
    per100: null,
    servings: [
      servingFromMacros({
        label: raw.servingLabel || '1 serving',
        kcal: macros.kcal,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        origin: 'menu',
      }),
    ],
    quality: { completeness: completenessFromMacros(macros), sourceFlags: [] },
    provenance: { url: raw.url || null, fetchedAt: opts.fetchedAt || null },
  });
  return assertCandidate(candidate);
}

async function scrapeMenuStat(query, timeoutMs = SCRAPE_TIMEOUT_MS) {
  const q = encodeURIComponent(query);
  const html = await fetchHtml(
    `https://www.menustat.org/search?query=${q}`,
    timeoutMs,
  );
  if (!html) {
    const altHtml = await fetchHtml(`https://menustat.org/food-search?q=${q}`, timeoutMs);
    if (!altHtml) return null;
    return parseMenuStatHtml(altHtml, timeoutMs);
  }
  return parseMenuStatHtml(html, timeoutMs);
}

async function parseMenuStatHtml(html, timeoutMs) {
  const $ = loadCheerio(html);
  const firstRow = $('table tbody tr, .search-result, .food-row').first();
  if (firstRow.length) {
    const parsed = parseNutritionFromText(firstRow.text());
    if (parsed?.calories != null) return parsed;
  }

  const detailHref = $('a[href*="food"], a[href*="item"], a[href*="detail"]').first().attr('href');
  if (detailHref) {
    const detailUrl = detailHref.startsWith('http')
      ? detailHref
      : `https://www.menustat.org${detailHref}`;
    const detailHtml = await fetchHtml(detailUrl, timeoutMs);
    if (detailHtml) {
      const parsed = parseNutritionFromText(detailHtml);
      if (parsed) return parsed;
    }
  }

  const calories = parseNumber($('[data-field="calories"], .calories').first().text());
  if (calories != null) {
    return normalizeMacros({
      calories,
      protein_g: parseNumber($('[data-field="protein"]').text()),
      carbs_g: parseNumber($('[data-field="carbs"]').text()),
      fat_g: parseNumber($('[data-field="fat"]').text()),
      fiber_g: parseNumber($('[data-field="fiber"]').text()),
      sodium_mg: parseNumber($('[data-field="sodium"]').text()),
    });
  }

  return parseNutritionFromText(html.slice(0, 10000));
}

module.exports = { scrapeMenuStat, adaptMenuStatResult };
