const { fetchHtml, parseNutritionFromText } = require('../scrapeHelpers');
const { SCRAPE_TIMEOUT_MS } = require('../constants');

async function scrapeYazio(query, timeoutMs = SCRAPE_TIMEOUT_MS) {
  const q = encodeURIComponent(query);
  const html = await fetchHtml(
    `https://www.yazio.com/en/search?q=${q}`,
    timeoutMs,
  );
  if (!html) return null;
  return parseNutritionFromText(html.slice(0, 15000));
}

module.exports = { scrapeYazio };
