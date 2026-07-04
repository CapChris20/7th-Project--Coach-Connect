const {
  fetchHtml,
  loadCheerio,
  parseNutritionFromText,
  parseNumber,
} = require('../scrapeHelpers');
const { SCRAPE_TIMEOUT_MS } = require('../constants');
const { pickBestCandidate, wrapScraperResult } = require('../resolveFoodDetail');
const {
  resolveFoodServingLabel,
  extractServingLabelFromPageText,
} = require('../../../../src/nutrition/food-search/guessServingSize');

function collectCalorieKingCandidates($) {
  const candidates = [];
  $('a[href*="/foods/f/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const label = $(el).text().replace(/\s+/g, ' ').trim();
    if (!label) return;
    const url = href.startsWith('http') ? href : `https://www.calorieking.com${href}`;
    candidates.push({ href: url, label });
  });
  return candidates;
}

function isJunkCalorieKingTitle(title) {
  const t = String(title || '').trim();
  if (!t || t.length < 4) return true;
  return /^calorieking$/i.test(t) || /^search$/i.test(t);
}

function parseCalorieKingDetail(html, detailUrl, fallbackLabel = null, query = '') {
  const $ = loadCheerio(html);
  const title = $('h1').first().text().replace(/\s+/g, ' ').trim();
  const bodyText = $('body').text();

  let calories = null;
  const headingCal = bodyText.match(/##\s*([\d,]+)\s*Calories/i);
  if (headingCal) calories = parseNumber(headingCal[1]);
  const tableCal = bodyText.match(/Calories\s+([\d,]+)/i);
  if (calories == null && tableCal) calories = parseNumber(tableCal[1]);

  const parsed = parseNutritionFromText(bodyText);
  if (calories != null) parsed.calories = calories;

  let displayName = title || null;
  if (isJunkCalorieKingTitle(displayName)) {
    const fallback = String(fallbackLabel || '').replace(/\s+/g, ' ').trim();
    displayName = isJunkCalorieKingTitle(fallback) ? null : fallback;
  }

  const servingLabel =
    extractServingLabelFromPageText(bodyText) ||
    resolveFoodServingLabel({ userQuery: query, foodName: displayName || fallbackLabel, pageText: bodyText });

  return wrapScraperResult(parsed, {
    url: detailUrl,
    displayName,
    servingLabel,
    servingBasis: 'per_serving',
  });
}

async function scrapeCalorieKing(query, timeoutMs = SCRAPE_TIMEOUT_MS) {
  const q = encodeURIComponent(query);
  const html = await fetchHtml(
    `https://www.calorieking.com/us/en/foods/search?keywords=${q}`,
    timeoutMs,
  );
  if (!html) return null;

  const $ = loadCheerio(html);
  const candidates = collectCalorieKingCandidates($);
  const best = pickBestCandidate(candidates, query, null);

  if (!best?.href) {
    const fromSearch = parseNutritionFromText(html.slice(0, 15000));
    return fromSearch?.calories != null
      ? wrapScraperResult(fromSearch, {
          url: `https://www.calorieking.com/us/en/foods/search?keywords=${q}`,
        })
      : null;
  }

  const detailHtml = await fetchHtml(best.href, timeoutMs);
  if (!detailHtml) return null;
  return parseCalorieKingDetail(detailHtml, best.href, best.label, query);
}

module.exports = { scrapeCalorieKing, collectCalorieKingCandidates, parseCalorieKingDetail };
