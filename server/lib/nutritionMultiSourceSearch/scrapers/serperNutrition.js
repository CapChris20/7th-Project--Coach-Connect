const axios = require('axios');
const { normalizeMacros } = require('../scrapeHelpers');
const { validateScrapedMacros } = require('../validateScrapedMacros');
const { SCRAPE_TIMEOUT_MS } = require('../constants');
const {
  extractMacrosFromText,
  buildSerperFallbackQueries,
  fixTypoForSerperQuery,
  extractMultipleSerperRowsFromOrganic,
  rankSerperFoodResultRows,
} = require('../../../nutritionSearchHelpers');
const { isPlausibleNutritionRow } = require('../../../../src/nutrition/food-search/cleanFoodCardLabels');

async function fetchSerperOrganic(query, timeoutMs) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return null;

  const res = await axios.post(
    'https://google.serper.dev/search',
    {
      q: `${query} nutrition facts calories protein carbs fat`,
      num: 10,
    },
    {
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: timeoutMs,
    },
  );
  return res.data || {};
}

function serperPayloadToMacros(data, userQuery, queryHint) {
  const organic = Array.isArray(data?.organic) ? data.organic : [];
  const blob = organic.map((r) => `${r.title || ''} ${r.snippet || ''}`).join('\n');

  if (data?.answerBox) {
    const box = data.answerBox;
    const title = String(box.title || userQuery).replace(/^Calories in /i, '').trim();
    const text = `${title}\n${box.answer || box.snippet || ''}\n${blob}`;
    const macros = extractMacrosFromText(text, queryHint);
    if (isPlausibleNutritionRow(macros)) {
      return normalizeMacros({
        calories: macros.calories,
        protein_g: macros.protein,
        carbs_g: macros.carbs,
        fat_g: macros.fat,
        fiber_g: macros.fiber,
        sodium_mg: macros.sodium,
      });
    }
  }

  const multi = extractMultipleSerperRowsFromOrganic(organic, userQuery, queryHint);
  if (multi.length > 0) {
    const ranked = rankSerperFoodResultRows(
      multi.map((row) => ({
        food_name: row.displayName,
        name: row.displayName,
        calories: row.macros?.calories,
        protein: row.macros?.protein,
        carbs: row.macros?.carbs,
        fat: row.macros?.fat,
        source: 'serper',
      })),
      userQuery,
    );
    const top = ranked[0];
    if (top) {
      return normalizeMacros({
        calories: top.calories ?? top.nf_calories,
        protein_g: top.protein ?? top.nf_protein,
        carbs_g: top.carbs ?? top.nf_total_carbohydrate,
        fat_g: top.fat ?? top.nf_total_fat,
        fiber_g: top.fiber,
        sodium_mg: top.sodium,
      });
    }
  }

  const fallback = extractMacrosFromText(blob, queryHint);
  if (!isPlausibleNutritionRow(fallback)) return null;
  return normalizeMacros({
    calories: fallback.calories,
    protein_g: fallback.protein,
    carbs_g: fallback.carbs,
    fat_g: fallback.fat,
    fiber_g: fallback.fiber,
    sodium_mg: fallback.sodium,
  });
}

async function scrapeSerperNutrition(query, timeoutMs = SCRAPE_TIMEOUT_MS) {
  const userQuery = String(query || '').trim();
  if (!userQuery) return null;

  const fallbackQueries = buildSerperFallbackQueries(userQuery);
  for (const fq of fallbackQueries) {
    const serperQuery = fixTypoForSerperQuery(fq);
    const queryHint = serperQuery.toLowerCase();
    try {
      const data = await fetchSerperOrganic(serperQuery, timeoutMs);
      const macros = serperPayloadToMacros(data, userQuery, queryHint);
      if (macros && validateScrapedMacros(macros, userQuery)) return macros;
    } catch (_) {
      // try next fallback query
    }
  }
  return null;
}

module.exports = { scrapeSerperNutrition };
