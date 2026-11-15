const {
  fetchHtml,
  loadCheerio,
  parseNutritionFromText,
  parseNumber,
} = require('../scrapeHelpers');
const { SCRAPE_TIMEOUT_MS } = require('../constants');
const {
  pickBestCandidate,
  restaurantToBrandSlug,
  wrapScraperResult,
  normalizeText,
  RESTAURANT_BRAND_SLUGS: BRAND_SLUGS,
} = require('../resolveFoodDetail');
const {
  resolveFoodServingLabel,
  extractServingLabelFromPageText,
} = require('../../../../src/nutrition/food-search/guessServingLabel');
const { createCandidate, assertCandidate } = require('../../../../src/nutrition/food-match/candidate');
const {
  completenessFromMacros,
  servingFromMacros,
} = require('../../../../src/nutrition/food-match/adapters/macroHelpers');

/**
 * Candidate adapter for a FastFoodNutrition detail payload.
 * @param {object} raw
 * @returns {object|null}
 */
function adaptFastFoodNutritionResult(raw, opts = {}) {
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
    id: raw.id ? String(raw.id) : `fastFoodNutrition:${name}`,
    source: 'fastFoodNutrition',
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

function collectFfnCandidates($, baseUrl = 'https://fastfoodnutrition.org') {
  const seen = new Set();
  const candidates = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href || href.includes('/search') || href === '/') return;
    const path = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
    if (!/\/[a-z0-9-]+\/[a-z0-9-]+/i.test(path)) return;
    if (seen.has(path)) return;
    seen.add(path);
    const label = $(el).text().replace(/\s+/g, ' ').trim();
    if (!label || label.length < 3) return;
    candidates.push({ href: path, label });
  });

  return candidates;
}

function parseFfnDetailPage(html, detailUrl, query = '') {
  const $ = loadCheerio(html);
  const title = $('h1').first().text().replace(/\s+/g, ' ').trim();
  const bodyText = $('body').text();

  let calories = null;
  const calMatch = bodyText.match(/There are\s+([\d,]+)\s+calories/i);
  if (calMatch) calories = parseNumber(calMatch[1]);

  const parsed = parseNutritionFromText(bodyText);
  if (calories != null) parsed.calories = calories;

  const fromPage =
    extractServingLabelFromPageText(bodyText) ||
    resolveFoodServingLabel({ userQuery: query, foodName: title, pageText: bodyText });

  return wrapScraperResult(parsed, {
    url: detailUrl,
    displayName: title || null,
    servingLabel: fromPage,
    servingBasis: 'per_serving',
  });
}

function detectRestaurantLabel(query) {
  const q = normalizeText(query);
  for (const name of Object.keys(BRAND_SLUGS)) {
    if (q.includes(normalizeText(name))) return name;
  }
  return null;
}

async function tryDirectSlug(query, timeoutMs) {
  const restaurantLabel = detectRestaurantLabel(query);
  const brand = restaurantToBrandSlug(restaurantLabel || query);
  if (!brand) return null;

  const q = normalizeText(query);
  const slugParts = [];

  if (/\bnugget|mcnugget/i.test(q)) {
    slugParts.push('chicken-mcnuggets');
    const pc = q.match(/\b(\d+)\s*(?:pc|piece)/);
    if (pc) slugParts.push(`${pc[1]}-piece`);
  } else if (/\bbig\s*mac\b/i.test(q)) {
    slugParts.push('big-mac');
  } else if (/\bbaconator\b/i.test(q)) {
    slugParts.push('baconator');
  } else if (/\bwhopper\b/i.test(q)) {
    slugParts.push('whopper');
  } else if (/\bcrunchwrap\b/i.test(q)) {
    slugParts.push('crunchwrap-supreme');
  }

  if (slugParts.length === 0) return null;

  const detailUrl = `https://fastfoodnutrition.org/${brand}/${slugParts.join('/')}`;
  const html = await fetchHtml(detailUrl, timeoutMs);
  if (!html || /not found|404/i.test(html.slice(0, 500))) return null;
  const result = parseFfnDetailPage(html, detailUrl, query);
  return result?.calories != null ? result : null;
}

async function scrapeFastFoodNutrition(query, timeoutMs = SCRAPE_TIMEOUT_MS) {
  const direct = await tryDirectSlug(query, timeoutMs);
  if (direct) return direct;

  const q = encodeURIComponent(query);
  const searchHtml = await fetchHtml(`https://fastfoodnutrition.org/search?q=${q}`, timeoutMs);
  if (!searchHtml) return null;

  const $ = loadCheerio(searchHtml);
  const candidates = collectFfnCandidates($);
  const restaurantLabel = detectRestaurantLabel(query);
  const best = pickBestCandidate(candidates, query, restaurantLabel);
  if (!best?.href) return null;

  const detailHtml = await fetchHtml(best.href, timeoutMs);
  if (!detailHtml) return null;
  return parseFfnDetailPage(detailHtml, best.href, query);
}

module.exports = {
  scrapeFastFoodNutrition,
  collectFfnCandidates,
  parseFfnDetailPage,
  adaptFastFoodNutritionResult,
};
