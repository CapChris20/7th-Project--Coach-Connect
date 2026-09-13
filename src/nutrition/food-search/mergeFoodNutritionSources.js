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
const { resolveFoodServingLabelDetailed } = require('./guessServingSize');
const { TRUSTED_DB_SOURCES } = require('./isReliableRestaurantFood');

/** Chains users type without the full brand name (e.g. "jets four corner", "20pc mcnuggets"). */
const LOOSE_CHAIN_HINTS = [
  { re: /\b(mcnuggets?|mc\s*nuggets?)\b/i, label: "McDonald's", itemRe: /\b(\d+\s*pc\s*)?(mc)?nuggets?\b/i },
  { re: /\bjets\b/i, label: "Jet's Pizza", itemRe: /\bjets\b/i },
  { re: /\b(big\s*mac|quarter\s*pounder|mcflurry|happy\s*meal)\b/i, label: "McDonald's" },
  { re: /\b(whopper|chicken\s*fries)\b/i, label: 'Burger King' },
  { re: /\b(dave'?s?\s*single|frosty|baconator)\b/i, label: "Wendy's" },
  { re: /\bcrazy\s*bread\b/i, label: 'Little Caesars', itemRe: /\bcrazy\s*bread\b/i },
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
  // Allow 0-cal diet drinks — only reject negative / missing.
  if (Number(cal.value) < 0) return false;
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

function applyServingFields(row, displayQuery, payload, sourceRow = null) {
  const detailed = resolveFoodServingLabelDetailed({
    userQuery: displayQuery,
    foodName: row.food_name || row.name,
    restaurant: payload?.query?.restaurant || row.restaurant,
    scraperLabel: sourceRow?.servingLabel,
    displayName: sourceRow?.displayName,
    calories: row.nf_calories ?? row.calories,
  });
  const label = detailed.label;
  return {
    ...row,
    serving_label: label,
    servingLabel: label,
    serving_unit: label,
    servingUnit: label,
    portion_text: label,
    serving_qty: 1,
    serving_size: 1,
    nutrition_unverified: Boolean(row.nutrition_unverified) || Boolean(detailed.nutrition_unverified),
    multiServingFallback: Boolean(row.multiServingFallback) || Boolean(detailed.multiServingFallback),
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
  const baseName = buildDisplayName(payload, displayQuery);
  const displayName = baseName;
  const sourceSubtitle = buildConsensusSubtitle(payload);

  const needsVerify = Object.values(consensus || {}).some((v) => v?.warning === 'verify_manually');
  const sources = Array.isArray(payload?.sources_used) ? payload.sources_used : [];
  const carbs = mapConsensusNutrient(consensus, 'carbs_g');
  const protein = mapConsensusNutrient(consensus, 'protein_g');
  const fat = mapConsensusNutrient(consensus, 'fat_g');
  let sugar = mapConsensusNutrient(consensus, 'sugar_g');
  // Soft drinks / sodas: carbs are almost entirely sugar when sugar wasn't scraped.
  if (
    (sugar == null || sugar <= 0) &&
    Number(carbs) > 0 &&
    Number(protein || 0) < 1 &&
    Number(fat || 0) < 1
  ) {
    sugar = carbs;
  }

  return applyServingFields(
    {
      id: `nutrition_consensus_${String(displayQuery || baseName).toLowerCase().replace(/\s+/g, '_')}`,
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
      sugar,
      servingSize: 1,
      servingGrams: 100,
      source: 'nutrition_consensus',
      nutrition_unverified: needsVerify || payload?.fallbackUsed,
      nf_calories: calories,
      nf_protein: protein,
      nf_total_carbohydrate: carbs,
      nf_total_fat: fat,
      nf_sugars: sugar,
      metadata: {
        consensus,
        sources_used: sources,
        cacheHit: payload?.cacheHit,
        fallbackUsed: payload?.fallbackUsed,
        source: 'nutrition_consensus',
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

  const carbs = sourceRow.carbs_g;
  const protein = sourceRow.protein_g;
  const fat = sourceRow.fat_g;
  let sugar = sourceRow.sugar_g;
  if (
    (sugar == null || sugar <= 0) &&
    Number(carbs) > 0 &&
    Number(protein || 0) < 1 &&
    Number(fat || 0) < 1
  ) {
    sugar = carbs;
  }

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
      protein,
      carbs,
      fat,
      fiber: sourceRow.fiber_g,
      sodium: sourceRow.sodium_mg,
      sugar,
      servingSize: 1,
      servingGrams: 100,
      source: sourceRow.sourceKey || 'nutrition_source',
      nutrition_unverified: false,
      nf_calories: sourceRow.calories,
      nf_protein: protein,
      nf_total_carbohydrate: carbs,
      nf_total_fat: fat,
      nf_sugars: sugar,
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

function sourcePriority(source) {
  const s = String(source || '');
  const low = s.toLowerCase();
  if (low === 'nutrition_consensus') return 200;
  if (low === 'trusted_catalog') return 150;
  if (TRUSTED_DB_SOURCES.has(s) || TRUSTED_DB_SOURCES.has(low)) return 100;
  if (low === 'serper' || low === 'mixed') return 20;
  return 50;
}

function mapNutritionSearchToFoodRows(payload, displayQuery) {
  const rows = [];
  const consensusRow = mapConsensusToFoodRow(payload, displayQuery);
  const sourceRows = mapSourceResultsToFoodRows(payload, displayQuery);

  // Consensus macros win when sources agree — that is the card the user should see.
  if (consensusRow) {
    rows.push(consensusRow);
    for (const row of sourceRows) {
      if (isSameFoodCandidate(consensusRow, row)) continue;
      rows.push(row);
    }
    return rows;
  }

  const trusted = sourceRows.filter((r) => sourcePriority(r.source) >= 100);
  const otherSources = sourceRows.filter((r) => sourcePriority(r.source) < 100);
  if (trusted.length > 0) {
    rows.push(...trusted, ...otherSources);
  } else {
    rows.push(...otherSources);
  }

  return rows.sort((a, b) => sourcePriority(b.source) - sourcePriority(a.source));
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

function mergeConsensusWithResults(consensusRow, rows, limit = 8) {
  const list = Array.isArray(rows) ? rows : [];
  if (!consensusRow || consensusRow.nutrition_unverified) return list.slice(0, limit);

  // Consensus is the primary card; drop near-duplicate cousins.
  const filtered = list.filter((row) => {
    if (String(row.source || '').toLowerCase() === 'nutrition_consensus') return false;
    if (!isSameFoodCandidate(consensusRow, row)) return true;
    const calDiff =
      Math.abs(Number(row.calories) - Number(consensusRow.calories)) /
      Math.max(Math.abs(Number(consensusRow.calories)) || 1, 1);
    return calDiff > 0.2;
  });
  return [consensusRow, ...filtered].slice(0, limit);
}

function mergeNutritionSearchWithLegacy(nutritionRows, legacyRows, limit = 8) {
  const nutrition = Array.isArray(nutritionRows) ? nutritionRows : [];
  const legacy = Array.isArray(legacyRows) ? legacyRows : [];
  if (nutrition.length === 0) return legacy.slice(0, limit);

  const hasConsensus = nutrition.some(
    (row) => String(row.source || '').toLowerCase() === 'nutrition_consensus',
  );
  const hasTrustedDb = nutrition.some((row) => sourcePriority(row.source) >= 100);

  let legacyPool = legacy;
  if (hasConsensus || hasTrustedDb) {
    // When consensus or DB already hit, drop weak web scrapes from legacy.
    legacyPool = legacy.filter((row) => {
      const src = String(row.source || '').toLowerCase();
      if (src === 'serper' || src === 'mixed') return false;
      return true;
    });
  }

  const filtered = legacyPool.filter((row) => {
    for (const anchor of nutrition) {
      if (!isSameFoodCandidate(anchor, row)) continue;
      const calDiff =
        Math.abs(Number(row.calories) - Number(anchor.calories)) /
        Math.max(Math.abs(Number(anchor.calories)) || 1, 1);
      if (calDiff <= 0.15) return false;
    }
    return true;
  });

  // Consensus / nutrition rows first; legacy only fills gaps with close names later via filter.
  return [...nutrition, ...filtered].slice(0, limit);
}

/**
 * Keep multiple results when calories/macros agree (±12% or ±25 kcal).
 * Consensus / trusted stay first; drop distant cousins.
 */
function keepCloseMacroRows(rows, limit = 5) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return [];

  const anchor =
    list.find((r) => String(r.source || '').toLowerCase() === 'nutrition_consensus') ||
    list.find((r) => String(r.source || '').toLowerCase() === 'trusted_catalog') ||
    list[0];
  const aCal = Number(anchor.calories) || 0;

  const close = list.filter((row) => {
    const cal = Number(row.calories) || 0;
    if (aCal <= 0 && cal <= 0) return true;
    const rel = Math.abs(cal - aCal) / Math.max(Math.abs(aCal), 1);
    if (rel <= 0.12) return true;
    if (Math.abs(cal - aCal) <= 25) return true;
    return false;
  });

  const priority = (row) => {
    const src = String(row.source || '').toLowerCase();
    if (src === 'nutrition_consensus') return 3;
    if (src === 'trusted_catalog') return 2;
    if (src === 'fatsecret' || src === 'usda' || src === 'usdafdc') return 1;
    return 0;
  };

  return close
    .sort((a, b) => priority(b) - priority(a) || Math.abs(Number(a.calories) - aCal) - Math.abs(Number(b.calories) - aCal))
    .slice(0, limit);
}

/** Fill missing sugar for near-zero fat/protein items (sodas) from carbs. */
function enrichSearchRowMicros(row) {
  if (!row || typeof row !== 'object') return row;
  const carbs = Number(row.carbs ?? row.nf_total_carbohydrate) || 0;
  const protein = Number(row.protein ?? row.nf_protein) || 0;
  const fat = Number(row.fat ?? row.nf_total_fat) || 0;
  let sugar = Number(row.sugar ?? row.nf_sugars);
  if ((!Number.isFinite(sugar) || sugar <= 0) && carbs > 0 && protein < 1 && fat < 1) {
    sugar = carbs;
  }
  if (!Number.isFinite(sugar) || sugar < 0) return row;
  return {
    ...row,
    sugar,
    nf_sugars: sugar,
  };
}

module.exports = {
  parseNutritionSearchQuery,
  mapConsensusToFoodRow,
  mapSourceResultToFoodRow,
  mapSourceResultsToFoodRows,
  mapNutritionSearchToFoodRows,
  mergeConsensusWithResults,
  mergeNutritionSearchWithLegacy,
  keepCloseMacroRows,
  enrichSearchRowMicros,
  isHighConfidenceConsensus,
  // Re-exported from cleanFoodCardLabels — keep for older import paths / Metro cache.
  sanitizeFoodCardTitle,
  stripLegacyFoodTitleDecorations,
};
