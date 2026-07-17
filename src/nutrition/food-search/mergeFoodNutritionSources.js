/**
 * Client helpers for POST /api/nutrition/search — multi-source consensus rows.
 */
const {
  parseCasualMenuIntent,
  RESTAURANT_CHAINS,
} = require('../utils/casualMenuSearch');
const { significantQueryTokens } = require('./sortBestFoodMatches');
const {
  formatUserQueryAsFoodName,
  stripLegacyFoodTitleDecorations,
  isJunkFoodTitle,
  sanitizeFoodCardTitle,
} = require('./cleanFoodCardLabels');
const { resolveFoodServingLabel } = require('./guessServingSize');

/** Chains users type without the full brand name (e.g. "jets four corner", "20pc mcnuggets"). */
const LOOSE_CHAIN_HINTS = [
  { re: /\b(mcnuggets?|mc\s*nuggets?)\b/i, label: "McDonald's", itemRe: /\b(\d+\s*pc\s*)?(mc)?nuggets?\b/i },
  { re: /\bjets\b/i, label: "Jet's Pizza", itemRe: /\bjets\b/i },
  { re: /\b(big\s*mac|quarter\s*pounder|mcflurry|happy\s*meal)\b/i, label: "McDonald's" },
  { re: /\b(whopper|chicken\s*fries)\b/i, label: 'Burger King' },
  { re: /\b(dave'?s?\s*single|frosty|baconator)\b/i, label: "Wendy's" },
];

function detectLooseRestaurantChain(q) {
  for (const hint of LOOSE_CHAIN_HINTS) {
    if (hint.re.test(q)) {
      return { label: hint.label, itemRe: hint.itemRe || hint.re };
    }
  }
  for (const chain of RESTAURANT_CHAINS) {
    if (chain.re.test(q)) return { label: chain.label, itemRe: chain.re };
  }
  return null;
}

function stripRestaurantFromQuery(q, chain) {
  let phrase = q;
  if (chain?.itemRe) phrase = phrase.replace(chain.itemRe, ' ');
  for (const c of RESTAURANT_CHAINS) {
    phrase = phrase.replace(c.re, ' ');
  }
  return phrase.replace(/\s+/g, ' ').trim();
}

function parseNutritionSearchQuery(rawQuery) {
  const q = String(rawQuery || '').trim();
  if (!q) return { foodName: '', restaurant: null };

  const intent = parseCasualMenuIntent(q);
  if (intent.chain) {
    const item = String(intent.itemPhrase || q).trim();
    return {
      foodName: item || q,
      restaurant: intent.chain.label,
    };
  }

  const loose = detectLooseRestaurantChain(q);
  if (loose) {
    const item = stripRestaurantFromQuery(q, loose) || q;
    return {
      foodName: item,
      restaurant: loose.label,
    };
  }

  return { foodName: q, restaurant: null };
}

function isHighConfidenceConsensus(consensus, { fallbackUsed = false } = {}) {
  if (fallbackUsed) return false;
  const cal = consensus?.calories;
  if (!cal || cal.value == null) return false;
  if ((cal.sources_agreeing || 0) < 2) return false;
  if (cal.value < 50) return false;
  return true;
}

function mapConsensusNutrient(consensus, key) {
  const entry = consensus?.[key];
  if (!entry || entry.value == null) return null;
  return entry.value;
}

function buildDisplayName(payload, displayQuery) {
  const raw = String(displayQuery || '').trim();
  const query = payload?.query || {};

  // Prefer a real scraper title so macros stay tied to the measured item (not a renamed query).
  const sourceTitles = (payload?.sourceResults || [])
    .map((r) => stripLegacyFoodTitleDecorations(r?.displayName))
    .filter((t) => t && !isJunkFoodTitle(t));
  if (sourceTitles.length > 0) {
    const cleaned = sanitizeFoodCardTitle(sourceTitles[0], raw);
    if (cleaned && !isJunkFoodTitle(cleaned)) return cleaned;
    return sourceTitles[0];
  }

  const fromUser = formatUserQueryAsFoodName(raw);
  if (fromUser && !isJunkFoodTitle(fromUser)) return fromUser;

  const fromParsed = query.restaurant
    ? formatUserQueryAsFoodName(`${query.restaurant} ${query.foodName || ''}`.trim())
    : formatUserQueryAsFoodName(query.foodName || '');
  if (fromParsed && !isJunkFoodTitle(fromParsed)) return fromParsed;

  return fromUser || fromParsed || 'Food';
}

function resolveSourceFoodTitle(sourceRow, payload, displayQuery) {
  const cleaned = stripLegacyFoodTitleDecorations(sourceRow?.displayName);
  if (cleaned && !isJunkFoodTitle(cleaned)) return cleaned;
  // Junk/source-only title — prefer the user's query for this row (not another scraper's name)
  const fromUser = formatUserQueryAsFoodName(displayQuery);
  if (fromUser && !isJunkFoodTitle(fromUser)) return fromUser;
  return buildDisplayName(payload, displayQuery);
}

function buildConsensusSubtitle(payload) {
  const fromResults = (payload?.sourceResults || []).map((r) => r.source).filter(Boolean);
  const fromUsed = Array.isArray(payload?.sources_used) ? payload.sources_used : [];
  const names = [...new Set(fromResults.length ? fromResults : fromUsed)];
  if (names.length === 0) return 'via consensus';
  if (names.length === 1) return `via ${names[0]}`;
  return `via ${names.slice(0, 4).join(', ')}`;
}

function parseGramsFromServingLabel(label) {
  const t = String(label || '');
  const parenG = t.match(/\((\d+)\s*g\)/i);
  if (parenG) return Number(parenG[1]);
  const plainG = t.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (plainG) return Number(plainG[1]);
  const tbsp = t.match(/(\d+(?:\.\d+)?)\s*(tbsp|tablespoons?)\b/i);
  if (tbsp) return Math.round(Number(tbsp[1]) * 15);
  return 0;
}

function applyServingFields(row, displayQuery, payload, sourceRow = null) {
  const label = resolveFoodServingLabel({
    userQuery: displayQuery,
    foodName: row.food_name || row.name,
    restaurant: payload?.query?.restaurant || row.restaurant,
    scraperLabel: sourceRow?.servingLabel,
    displayName: sourceRow?.displayName,
  });
  const parsedG = parseGramsFromServingLabel(label)
    || parseGramsFromServingLabel(sourceRow?.servingLabel)
    || 0;
  const servingGrams = parsedG > 0 ? Math.round(parsedG) : (Number(row.servingGrams) > 0 ? Number(row.servingGrams) : 100);
  return {
    ...row,
    serving_label: label,
    servingLabel: label,
    serving_unit: label,
    servingUnit: label,
    portion_text: label,
    serving_qty: 1,
    serving_size: 1,
    servingGrams,
    labelServingGrams: servingGrams,
    dataBasis: row.dataBasis || 'label_serving',
  };
}

function mapConsensusToFoodRow(payload, displayQuery) {
  const consensus = payload?.consensus;
  if (!isHighConfidenceConsensus(consensus, { fallbackUsed: payload?.fallbackUsed })) {
    return null;
  }

  const calories = mapConsensusNutrient(consensus, 'calories');
  if (calories == null) return null;

  const query = payload?.query || {};
  const protein = mapConsensusNutrient(consensus, 'protein_g');
  const carbs = mapConsensusNutrient(consensus, 'carbs_g');
  const fat = mapConsensusNutrient(consensus, 'fat_g');
  const displayName = buildDisplayName(payload, displayQuery);
  const sourceSubtitle = buildConsensusSubtitle(payload);

  const needsVerify = Object.values(consensus || {}).some((v) => v?.warning === 'verify_manually');
  const incompleteMacros =
    (Number(calories) >= 200 && (!protein || protein === 0))
    || (Number(calories) >= 250 && (!carbs || carbs === 0) && (!fat || fat === 0));
  const sources = Array.isArray(payload?.sources_used) ? payload.sources_used : [];

  return applyServingFields(
    {
      id: `nutrition_consensus_${String(displayQuery || displayName).toLowerCase().replace(/\s+/g, '_')}`,
      name: displayName,
      food_name: displayName,
      source_subtitle: sourceSubtitle,
      brand: query.restaurant || null,
      brand_name: query.restaurant || null,
      restaurant: query.restaurant || null,
      calories,
      protein,
      carbs,
      fat,
      fiber: mapConsensusNutrient(consensus, 'fiber_g'),
      sodium: mapConsensusNutrient(consensus, 'sodium_mg'),
      sugar: null,
      servingSize: 1,
      servingGrams: 100,
      dataBasis: 'label_serving',
      source: 'nutrition_consensus',
      nutrition_unverified: needsVerify || payload?.fallbackUsed || incompleteMacros,
      nf_calories: calories,
      nf_protein: protein,
      nf_total_carbohydrate: carbs,
      nf_total_fat: fat,
      metadata: {
        consensus,
        sources_used: sources,
        cacheHit: payload?.cacheHit,
        fallbackUsed: payload?.fallbackUsed,
        source: 'nutrition_consensus',
        incompleteMacros,
      },
    },
    displayQuery,
    payload,
    payload?.sourceResults?.[0],
  );
}

function mapSourceResultToFoodRow(sourceRow, payload, displayQuery) {
  if (!sourceRow || sourceRow.calories == null) return null;

  const query = payload?.query || {};
  const baseName = buildDisplayName(payload, displayQuery);
  const itemLabel = resolveSourceFoodTitle(sourceRow, payload, displayQuery);
  const displayName = itemLabel || baseName;
  const sourceSubtitle = sourceRow.source ? `via ${sourceRow.source}` : null;

  return applyServingFields(
    {
      id: `nutrition_source_${sourceRow.sourceKey}_${String(itemLabel).toLowerCase().replace(/\s+/g, '_')}`,
      name: displayName,
      food_name: displayName,
      source_subtitle: sourceSubtitle,
      brand: query.restaurant || null,
      brand_name: query.restaurant || null,
      restaurant: query.restaurant || null,
      calories: sourceRow.calories,
      protein: sourceRow.protein_g,
      carbs: sourceRow.carbs_g,
      fat: sourceRow.fat_g,
      fiber: sourceRow.fiber_g,
      sodium: sourceRow.sodium_mg,
      sugar: null,
      servingSize: 1,
      servingGrams: 100,
      dataBasis: 'label_serving',
      source: sourceRow.sourceKey || 'nutrition_source',
      nutrition_unverified:
        (Number(sourceRow.calories) >= 200 && !(Number(sourceRow.protein_g) > 0)),
      nf_calories: sourceRow.calories,
      nf_protein: sourceRow.protein_g,
      nf_total_carbohydrate: sourceRow.carbs_g,
      nf_total_fat: sourceRow.fat_g,
      metadata: {
        sourceResult: sourceRow,
        url: sourceRow.url,
        servingBasis: sourceRow.servingBasis,
        source: sourceRow.sourceKey,
      },
    },
    displayQuery,
    payload,
    sourceRow,
  );
}

function mapSourceResultsToFoodRows(payload, displayQuery) {
  const rows = [];
  const seen = new Set();

  for (const sourceRow of payload?.sourceResults || []) {
    const row = mapSourceResultToFoodRow(sourceRow, payload, displayQuery);
    if (!row) continue;
    const key = `${row.source}:${row.calories}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows;
}

function mapNutritionSearchToFoodRows(payload, displayQuery) {
  const rows = [];
  const consensusRow = mapConsensusToFoodRow(payload, displayQuery);
  if (consensusRow) rows.push(consensusRow);

  const sourceRows = mapSourceResultsToFoodRows(payload, displayQuery);
  rows.push(...sourceRows);

  return rows;
}

function isSameFoodCandidate(a, b) {
  if (!a || !b) return false;
  const nameA = String(a.name || a.food_name || '').toLowerCase();
  const nameB = String(b.name || b.food_name || '').toLowerCase();
  if (!nameA || !nameB) return false;
  if (nameA === nameB) return true;

  const tokensA = significantQueryTokens(nameA);
  const tokensB = significantQueryTokens(nameB);
  if (tokensA.length && tokensB.length) {
    const overlap = tokensA.filter((t) => tokensB.includes(t)).length;
    const minLen = Math.min(tokensA.length, tokensB.length);
    if (minLen >= 2 && overlap >= minLen - 1) return true;
  }

  const calA = Number(a.calories);
  const calB = Number(b.calories);
  if (Number.isFinite(calA) && Number.isFinite(calB) && calA > 0) {
    const diff = Math.abs(calA - calB) / calA;
    if (diff <= 0.08 && (nameA.includes(nameB) || nameB.includes(nameA))) return true;
  }
  return false;
}

function mergeConsensusWithResults(consensusRow, rows, limit = 20) {
  const list = Array.isArray(rows) ? rows : [];
  if (!consensusRow || consensusRow.nutrition_unverified) return list.slice(0, limit);

  const filtered = list.filter((row) => {
    if (!isSameFoodCandidate(consensusRow, row)) return true;
    const calDiff =
      Math.abs(Number(row.calories) - Number(consensusRow.calories)) /
      Math.max(Number(consensusRow.calories), 1);
    return calDiff > 0.15;
  });
  return [consensusRow, ...filtered].slice(0, limit);
}

function mergeNutritionSearchWithLegacy(nutritionRows, legacyRows, limit = 20) {
  const nutrition = Array.isArray(nutritionRows) ? nutritionRows : [];
  const legacy = Array.isArray(legacyRows) ? legacyRows : [];
  if (nutrition.length === 0) return legacy.slice(0, limit);

  const filtered = legacy.filter((row) => {
    for (const anchor of nutrition) {
      if (!isSameFoodCandidate(anchor, row)) continue;
      const calDiff =
        Math.abs(Number(row.calories) - Number(anchor.calories)) /
        Math.max(Number(anchor.calories), 1);
      if (calDiff <= 0.15) return false;
    }
    return true;
  });

  return [...nutrition, ...filtered].slice(0, limit);
}

module.exports = {
  parseNutritionSearchQuery,
  mapConsensusToFoodRow,
  mapSourceResultToFoodRow,
  mapSourceResultsToFoodRows,
  mapNutritionSearchToFoodRows,
  mergeConsensusWithResults,
  mergeNutritionSearchWithLegacy,
  isHighConfidenceConsensus,
  // Re-exported from cleanFoodCardLabels — keep for older import paths / Metro cache.
  sanitizeFoodCardTitle,
  stripLegacyFoodTitleDecorations,
};
