const { fetchHtml, parseNutritionFromText } = require('../scrapeHelpers');
const { SCRAPE_TIMEOUT_MS } = require('../constants');
const { adaptWeakHtmlSource } = require('../../../../src/nutrition/food-match/adapters/adaptWeakHtmlSource');

function adaptMyFitnessPalResult(raw, opts = {}) {
  return adaptWeakHtmlSource('myFitnessPal', raw, opts);
}

async function scrapeMyFitnessPal(query, timeoutMs = SCRAPE_TIMEOUT_MS) {
  const q = encodeURIComponent(query);
  const html = await fetchHtml(
    `https://www.myfitnesspal.com/food/search?search=${q}`,
    timeoutMs,
  );
  if (!html) return null;
  return parseNutritionFromText(html.slice(0, 15000));
}

module.exports = { scrapeMyFitnessPal, adaptMyFitnessPalResult };
