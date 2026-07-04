const { fetchHtml, parseNutritionFromText } = require('../scrapeHelpers');
const { SCRAPE_TIMEOUT_MS } = require('../constants');

async function scrapeCronometer(query, timeoutMs = SCRAPE_TIMEOUT_MS) {
  const q = encodeURIComponent(query);
  const html = await fetchHtml(
    `https://cronometer.com/search/?query=${q}`,
    timeoutMs,
  );
  if (!html) return null;
  return parseNutritionFromText(html.slice(0, 15000));
}

module.exports = { scrapeCronometer };
