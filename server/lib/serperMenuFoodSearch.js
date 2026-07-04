'use strict';

const axios = require('axios');
const {
  extractMacrosFromText,
  extractExtendedNutrientsFromText,
  extractExtendedFromKgAttributes,
  mergeExtendedNutrients,
  extractMultipleSerperRowsFromOrganic,
  fixTypoForSerperQuery,
  buildSerperFallbackQueries,
} = require('../nutritionSearchHelpers');
const { resolveFoodBrandLabel } = require('../../src/nutrition/utils/foodBrandDisplay');
const {
  cleanSerperFoodTitle,
  displayNameForSerperRow,
  isJunkWebSearchTitle,
  isPlausibleNutritionRow,
  dedupeFoodRows,
} = require('../../src/nutrition/utils/foodSearchTitle');
const { rankSerperFoodResultRows } = require('../../src/nutrition/utils/restaurantSerperQuality');
const { servingLabelFromQueryStructure } = require('../../src/nutrition/utils/casualMenuSearch');

const SERPER_ORGANIC_MAX = 10;

/** Shared Serper food parser — same logic as Nutrition tab /api/food/search. */
async function searchFoodWithSerper(rawQuery) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  const userQuery = String(rawQuery || '').trim();
  const serperCap = 12;
  const fallbackQueries = buildSerperFallbackQueries(userQuery);

  const toSerperRow = (name, macros, extras = {}, organicScore = 0) => {
    const serving_label =
      extras.serving_label
      ?? macros.servingLabel
      ?? servingLabelFromQueryStructure(userQuery)
      ?? null;
    const unitLabel = serving_label || extras.serving_unit || 'serving';
    const displayName = name || userQuery;
    const brandLabel = resolveFoodBrandLabel(displayName, '');
    const extended = mergeExtendedNutrients(extras, extras.extended || {});
    return {
      id: `serper_${Date.now()}_${Math.random()}`,
      food_name: displayName,
      name: displayName,
      brand_name: brandLabel,
      brand: brandLabel,
      restaurant: null,
      serving_qty: 1,
      serving_unit: unitLabel,
      serving_label,
      nf_calories: macros.calories,
      nf_protein: macros.protein,
      nf_total_carbohydrate: macros.carbs,
      nf_total_fat: macros.fat,
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      fiber: extended.fiber ?? extras.fiber ?? null,
      sodium: extended.sodium ?? extras.sodium ?? null,
      sugar: extended.sugar ?? extras.sugar ?? null,
      potassium: extended.potassium ?? null,
      cholesterol: extended.cholesterol ?? null,
      saturatedFat: extended.saturatedFat ?? null,
      transFat: extended.transFat ?? null,
      polyunsaturatedFat: extended.polyunsaturatedFat ?? null,
      monounsaturatedFat: extended.monounsaturatedFat ?? null,
      calcium: extended.calcium ?? null,
      iron: extended.iron ?? null,
      vitaminA: extended.vitaminA ?? null,
      vitaminC: extended.vitaminC ?? null,
      vitaminD: extended.vitaminD ?? null,
      servingSize: 1,
      servingUnit: unitLabel,
      servingGrams: 100,
      photo: null,
      source: 'serper',
      _organicScore: organicScore,
      multiServingFallback: Boolean(extras.multiServingFallback),
      servingMultiplier: extras.servingMultiplier ?? null,
      nutrition_unverified: Boolean(extras.nutrition_unverified),
    };
  };

  const fetchSerperPayload = async (serperQueryText, relaxed) => {
    const query = fixTypoForSerperQuery(serperQueryText);
    const res = await axios.post(
      'https://google.serper.dev/search',
      {
        q: `${query} nutrition facts calories protein carbs fat`,
        num: SERPER_ORGANIC_MAX,
      },
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 12000,
      },
    );
    return { data: res.data || {}, queryHint: String(query || '').toLowerCase(), relaxed };
  };

  const parseSerperData = (data, queryHint, relaxed) => {
    const results = [];

    const organicBlob = (n = 8) =>
      Array.isArray(data.organic)
        ? data.organic
            .slice(0, n)
            .map((r) => `${r.title || ''} ${r.snippet || ''}`)
            .join('\n')
        : '';

    const mergeOrganicForMacros = (snippet) =>
      `${String(snippet || '')}\n${organicBlob()}`.trim();

    const pushFromText = (name, text) => {
      const macros = extractMacrosFromText(text, queryHint);
      if (!isPlausibleNutritionRow(macros)) return;
      const displayName = displayNameForSerperRow(name, userQuery, macros);
      const extended = extractExtendedNutrientsFromText(text);
      results.push(toSerperRow(displayName, macros, { extended }));
    };

    if (data.answerBox) {
      const box = data.answerBox;
      let title = box.title || userQuery;
      title = String(title).replace(/^Calories in /i, '').replace(/^Carbs in /i, '').trim();
      if (!isJunkWebSearchTitle(title)) {
        const snippet = mergeOrganicForMacros(box.answer || box.snippet || '');
        pushFromText(title, snippet);
      }
    }

    if (data.knowledgeGraph?.attributes) {
      const attrs = data.knowledgeGraph.attributes;
      const cleanNum = (v) => parseFloat(String(v || '0').replace(/[^\d.]/g, '') || 0);
      const cals = cleanNum(attrs['Calories'] || attrs['Energy'] || '0');
      let protein = cleanNum(attrs['Protein'] || '0');
      let carbs = cleanNum(attrs['Total Carbohydrate'] || attrs['Carbohydrates'] || '0');
      let fat = cleanNum(attrs['Total Fat'] || attrs['Fat'] || '0');
      const kgExtended = extractExtendedFromKgAttributes(attrs);
      const fiber = kgExtended.fiber ?? cleanNum(attrs['Dietary Fiber'] || '0');
      const sodium = kgExtended.sodium ?? cleanNum(attrs['Sodium'] || '0');

      const kgBlob = [
        data.knowledgeGraph.title,
        data.knowledgeGraph.description || '',
        ...Object.entries(attrs).map(([k, v]) => `${k}: ${v}`),
        organicBlob(),
      ].join('\n');
      const parsedKg = extractMacrosFromText(kgBlob, queryHint);

      if (cals > 0 && protein === 0 && carbs === 0 && fat === 0) {
        if (parsedKg.protein > 0) protein = parsedKg.protein;
        if (parsedKg.carbs > 0) carbs = parsedKg.carbs;
        if (parsedKg.fat > 0) fat = parsedKg.fat;
      }
      if (/\b(burger|cheeseburger|hamburger)\b/.test(queryHint) && parsedKg.carbs > carbs) {
        carbs = parsedKg.carbs;
      }

      const kgMacros = {
        calories: cals,
        protein,
        carbs,
        fat,
        servingLabel: parsedKg.servingLabel,
      };
      if (cals > 0 && isPlausibleNutritionRow(kgMacros)) {
        const textExtended = extractExtendedNutrientsFromText(kgBlob);
        const mergedExtended = mergeExtendedNutrients(kgExtended, textExtended);
        results.push(
          toSerperRow(
            cleanSerperFoodTitle(data.knowledgeGraph.title || userQuery, userQuery),
            kgMacros,
            {
              fiber: fiber || null,
              sodium: sodium || null,
              extended: mergedExtended,
            },
          ),
        );
      }
    }

    if (Array.isArray(data.organic) && data.organic.length > 0) {
      const multi = extractMultipleSerperRowsFromOrganic(
        data.organic,
        userQuery,
        queryHint,
        serperCap,
        { relaxed },
      );
      for (const row of multi) {
        results.push(
          toSerperRow(row.displayName, row.macros, {
            multiServingFallback: row.multiServingFallback,
            servingMultiplier: row.servingMultiplier,
            nutrition_unverified: row.nutrition_unverified,
          }, row.organicScore || 0),
        );
      }
    }

    return results;
  };

  try {
    for (let i = 0; i < fallbackQueries.length; i += 1) {
      const relaxed = i > 0;
      const serperQueryText = fallbackQueries[i];
      let payload;
      try {
        payload = await fetchSerperPayload(serperQueryText, relaxed);
      } catch (e) {
        console.warn('[Food Search] Serper attempt failed:', serperQueryText, e.message);
        continue;
      }

      const rawRows = parseSerperData(payload.data, payload.queryHint, relaxed);
      const deduped = dedupeFoodRows(rawRows);
      const ranked = rankSerperFoodResultRows(deduped, userQuery);
      if (ranked.length > 0) {
        return ranked.slice(0, serperCap);
      }
    }

    return [];
  } catch (e) {
    console.error('Serper food search error:', e.message);
    return [];
  }
}

module.exports = { searchFoodWithSerper, SERPER_ORGANIC_MAX };
