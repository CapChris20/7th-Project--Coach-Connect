'use strict';

const admin = require('firebase-admin');
const { normalizeSearchKey, searchResultsDocId } = require('../nutritionSearchHelpers');
const { searchFoodWithSerper } = require('./serperMenuFoodSearch');
const { FOOD_SEARCH_PIPELINE_VERSION } = require('../routes/foodRoutes');

const COACH_FOOD_SEARCH_APPEND = `

NUTRITION DATABASE MODE (CoachConnect Nutrition tab pipeline):
The user asked about food nutrition facts. You may have APP_FOOD_SEARCH_RESULTS below — same USDA / Open Food Facts / Serper pipeline as the in-app Nutrition search screen.
- If APP_FOOD_SEARCH_RESULTS are present: cite those exact calories and macros. Say you looked it up in the app's nutrition database.
- Do NOT say you are "only answering from general coaching knowledge", "don't have live search", or "can't look that up" when results are present.
- If no results matched: give a cautious labeled estimate and suggest confirming in the Nutrition tab search.
Never confuse this with Perplexity web search — this is the app's food lookup system.`;

function formatCoachFoodRow(r) {
  const calories = Math.round(Number(r.nf_calories ?? r.calories ?? 0));
  if (!Number.isFinite(calories) || calories <= 0) return null;
  return {
    name: String(r.food_name || r.name || '').trim(),
    calories,
    protein: Math.round(Number(r.nf_protein ?? r.protein ?? 0) * 10) / 10,
    carbs: Math.round(Number(r.nf_total_carbohydrate ?? r.carbs ?? 0) * 10) / 10,
    fat: Math.round(Number(r.nf_total_fat ?? r.fat ?? 0) * 10) / 10,
    serving: r.serving_label || r.serving_unit || null,
    source: r.source || 'app-food-search',
  };
}

/** Same pipeline as Nutrition tab — Firestore cache then Serper food search. */
async function fetchCoachFoodSearchTopResults(query, limit = 3) {
  const q = String(query || '').trim();
  if (!q) return [];

  const normalizedKey = normalizeSearchKey(q);
  if (admin.apps.length) {
    try {
      const docId = searchResultsDocId(normalizedKey);
      const snap = await admin.firestore().collection('searchResults').doc(docId).get();
      if (snap.exists) {
        const data = snap.data() || {};
        if (Number(data.pipelineVersion) === FOOD_SEARCH_PIPELINE_VERSION) {
          const results = data.results;
          if (Array.isArray(results) && results.length) {
            return results
              .map(formatCoachFoodRow)
              .filter(Boolean)
              .slice(0, limit);
          }
        }
      }
    } catch (_) {
      /* fall through to live search */
    }
  }

  const serperRows = await searchFoodWithSerper(q);
  return serperRows
    .map(formatCoachFoodRow)
    .filter(Boolean)
    .slice(0, limit);
}

function extractCoachFoodLookupQuery(userText) {
  const raw = String(userText || '').trim();
  if (!raw || raw.length > 220) return null;

  const calIn = raw.match(/\b(?:how many )?calories?\s+(?:in|for|of)\s+(.+?)[.?!]*$/i);
  if (calIn?.[1]) return calIn[1].trim();

  const macroIn = raw.match(
    /\b(?:what(?:'s| is| are) (?:the )?)?(?:calories?|macros?|nutrition(?: facts?)?)\s+(?:in|for|of)\s+(.+?)[.?!]*$/i,
  );
  if (macroIn?.[1]) return macroIn[1].trim();

  const lookUp = raw.match(/\b(?:look\s*up|lookup|find|search for)\s+(.+?)[.?!]*$/i);
  if (lookUp?.[1]) return lookUp[1].trim();

  const nutritionFor = raw.match(/\b(?:nutrition facts?|macros?)\s+(?:for|of)\s+(.+?)[.?!]*$/i);
  if (nutritionFor?.[1]) return nutritionFor[1].trim();

  if (
    /\b(mcnugget|mcnuggets|big mac|whopper|nugget|pizza|fries|combo meal|chicken|burger|sandwich|burrito|bowl)\b/i.test(
      raw,
    ) ||
    /\b\d+\s*(?:pc|piece|pcs)\b/i.test(raw)
  ) {
    return raw.replace(/\b(?:search|google|web|online)\b.*$/i, '').trim();
  }
  return null;
}

function isBrandedFoodCalorieQuery(userText) {
  const q = extractCoachFoodLookupQuery(userText) || String(userText || '').trim();
  const t = q.toLowerCase();
  if (!t) return false;
  const branded =
    /\b(mcnugget|mcnuggets|mcdonald|burger king|wendy|taco bell|chipotle|subway|kfc|chick-fil|nugget|big mac|whopper|domino|pizza hut|five guys|pizza|fries|combo|starbucks|panera|shake shack|in-n-out|popeyes|arbys|sonic|dunkin)\b/;
  const hasCal = /\bcalories?|kcal|macros?|nutrition\b/.test(String(userText).toLowerCase());
  const hasServing = /\b\d+\s*(?:pc|piece|pcs)\b/.test(t);
  return (branded.test(t) && (hasCal || hasServing)) || (hasCal && branded.test(t));
}

function isNutritionFactsQuestion(userText) {
  const raw = String(userText || '').trim();
  const t = raw.toLowerCase();
  if (!t) return false;
  if (/\b(my|i ate|i had|did i|food log|logged)\b/.test(t) && /\b(today|yesterday|this week)\b/.test(t)) {
    return false;
  }
  const hasFoodIntent =
    /\b(calories?|kcal|macros?|nutrition|protein|carbs?|fat|grams?)\b/.test(t) &&
    /\b(how many|how much|what(?:'s| is| are)|look\s*up|lookup|find|nutrition facts?|in a|in the|for a|for the|for an)\b/.test(
      t,
    );
  return hasFoodIntent || isBrandedFoodCalorieQuery(userText);
}

function isDenyingOrComplainingAboutWeb(userText) {
  const t = String(userText || '').toLowerCase();
  if (!/\b(web|search|internet|online|nutrition tools?|perplexity)\b/.test(t)) return false;
  return /\b(can'?t|cannot|don'?t|won'?t|shouldn'?t|couldn'?t|not able|unable|stop|annoying|why|u can)\b/.test(
    t,
  );
}

function shouldPreferCoachFoodSearch(userText) {
  if (isDenyingOrComplainingAboutWeb(userText)) return false;
  if (/\b(search the web|look up online|google it|browse the web)\b/i.test(userText)) return false;
  return isNutritionFactsQuestion(userText);
}

module.exports = {
  fetchCoachFoodSearchTopResults,
  extractCoachFoodLookupQuery,
  isBrandedFoodCalorieQuery,
  isNutritionFactsQuestion,
  isDenyingOrComplainingAboutWeb,
  shouldPreferCoachFoodSearch,
  COACH_FOOD_SEARCH_APPEND,
};
