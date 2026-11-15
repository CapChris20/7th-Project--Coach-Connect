const { fetchHtml, parseNutritionFromText } = require('../scrapeHelpers');
const { SCRAPE_TIMEOUT_MS } = require('../constants');
const { adaptWeakHtmlSource } = require('../../../../src/nutrition/food-match/adapters/adaptWeakHtmlSource');

function adaptYazioResult(raw, opts = {}) {
  return adaptWeakHtmlSource('yazio', raw, opts);
}

async function scrapeYazio(query, timeoutMs = SCRAPE_TIMEOUT_MS) {
  const q = encodeURIComponent(query);
  const html = await fetchHtml(
    `https://www.yazio.com/en/search?q=${q}`,
    timeoutMs,
  );
  if (!html) return null;
  return parseNutritionFromText(html.slice(0, 15000));
}

module.exports = { scrapeYazio, adaptYazioResult };
