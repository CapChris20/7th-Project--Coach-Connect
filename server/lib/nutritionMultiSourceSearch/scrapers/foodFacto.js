const { fetchHtml, loadCheerio, parseNumber } = require('../scrapeHelpers');
const { SCRAPE_TIMEOUT_MS } = require('../constants');
const {
  restaurantToBrandSlug,
  FOODFACTO_BRAND_SLUGS,
  queryTokens,
  scoreSearchCandidate,
  wrapScraperResult,
  normalizeText,
} = require('../resolveFoodDetail');

function detectBrandSlugFromQuery(query) {
  const q = normalizeText(query);
  for (const [name, slug] of Object.entries(FOODFACTO_BRAND_SLUGS)) {
    const normalizedName = normalizeText(name);
    if (q.includes(normalizedName)) return slug;
  }
  return null;
}

function parseFoodFactoMenuItems(html) {
  const $ = loadCheerio(html);
  const items = [];
  const body = $('body').text();

  const itemRe =
    /(Chicken McNuggets\s*\(\d+\s*piece\)|Big Mac|Baconator|Whopper|Crunchwrap Supreme|[^.\n]{4,60})\s*[\s\S]{0,120}?(\d{2,4})\s*cal/gi;
  let m;
  while ((m = itemRe.exec(body)) !== null) {
    const name = m[1].replace(/\s+/g, ' ').trim();
    if (name.length < 4) continue;
    items.push({
      name,
      calories: parseNumber(m[2]),
      block: m[0],
    });
  }

  $('h3').each((_, el) => {
    const name = $(el).text().replace(/\s+/g, ' ').trim();
    const parentText = $(el).parent().text().replace(/\s+/g, ' ');
    const calMatch = parentText.match(/(\d{2,4})\s*cal/i);
    if (name && calMatch) {
      items.push({
        name,
        calories: parseNumber(calMatch[1]),
        block: parentText,
      });
    }
  });

  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.name}:${item.calories}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return item.calories != null;
  });
}

function pickFoodFactoItem(items, query) {
  const tokens = queryTokens(query, null);
  let best = null;
  let bestScore = 0;

  for (const item of items) {
    const score = scoreSearchCandidate(item.name, '', tokens, null);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return bestScore >= 4 ? best : null;
}

async function scrapeFoodFacto(query, timeoutMs = SCRAPE_TIMEOUT_MS) {
  const resolvedSlug = detectBrandSlugFromQuery(query);
  if (!resolvedSlug) return null;

  const pageUrl = `https://foodfacto.com/restaurant-nutrition/${resolvedSlug}`;
  const html = await fetchHtml(pageUrl, timeoutMs);
  if (!html) return null;

  const items = parseFoodFactoMenuItems(html);
  const hit = pickFoodFactoItem(items, query);
  if (!hit?.calories) return null;

  const proteinMatch = hit.block?.match(/(\d{1,3})g\s*protein/i);
  const fatMatch = hit.block?.match(/(\d{1,3})g\s*fat/i);
  const carbMatch = hit.block?.match(/(\d{1,3})g\s*carb/i);

  return wrapScraperResult(
    {
      calories: hit.calories,
      protein_g: proteinMatch ? parseNumber(proteinMatch[1]) : null,
      carbs_g: carbMatch ? parseNumber(carbMatch[1]) : null,
      fat_g: fatMatch ? parseNumber(fatMatch[1]) : null,
      fiber_g: null,
      sodium_mg: null,
    },
    {
      url: pageUrl,
      displayName: hit.name,
      servingLabel: '1 serving',
      servingBasis: 'per_serving',
    },
  );
}

module.exports = { scrapeFoodFacto, parseFoodFactoMenuItems, detectBrandSlugFromQuery };
