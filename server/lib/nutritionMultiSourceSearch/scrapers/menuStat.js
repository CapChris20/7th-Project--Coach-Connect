const { fetchHtml, loadCheerio, normalizeMacros, parseNutritionFromText, parseNumber } = require('../scrapeHelpers');
const { SCRAPE_TIMEOUT_MS } = require('../constants');

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

module.exports = { scrapeMenuStat };
