/**
 * food Search Query Match
 *
 * Purpose: Shared relevance scoring + strict close-name filtering for client and server food search.
 * Philosophy: only return what the user typed (or near-exact titles). Empty beats junk cousins.
 *
 * @file-header
 */

const { inferFoodServingCategory } = require('./guessServingSize');

const QUERY_STOP_WORDS = new Set([
  'with',
  'and',
  'from',
  'the',
  'for',
  'nutrition',
  'facts',
  'calories',
  'protein',
  'carbs',
  'carb',
  'fat',
  'menu',
  'item',
  'order',
  'serving',
  'size',
  // Grocery descriptors — users type them; product titles often omit them.
  'greek',
  'whole',
  'skim',
  'organic',
  'natural',
  'fresh',
  'frozen',
  'raw',
  'cooked',
  'unsweetened',
  'sweetened',
  'original',
  'classic',
]);

/** Category / size words titles often omit — still used for ranking, not hard-required. */
const OPTIONAL_CATEGORY_TOKENS = new Set([
  'cereal',
  'snack',
  'snacks',
  'bar',
  'bars',
  'drink',
  'beverage',
  'food',
  'style',
  'flavor',
  'flavour',
  'nutrition',
  'supplement',
  'powder',
  'meal',
  'combo',
  'large',
  'small',
  'medium',
  'regular',
  'personal',
  'family',
  'grand',
  'venti',
  'tall',
]);

/** Menu / prepared-food language — not a brand list. */
const MENU_STYLE_PATTERN =
  /\b(pizza|burger|sandwich|wrap|bowl|salad|taco|burrito|wing|wings|nugget|nuggets|combo|meal|latte|mocha|frappuccino|sub\b|hoagie|calzone|pasta|entree|appetizer|deep\s*dish|corner|slice|cheeseburger|hamburger|quesadilla|nachos|fries|chicken\s+fingers|crazy\s*bread|breadstick|garlic\s+bread|cheesy\s+bread|big\s*mac|whopper|baconator|frosty)\b/i;

const GROCERY_INGREDIENT_PATTERN =
  /\b(chicken breast|boneless\s+skinless|skinless\s+boneless|ground beef|ground turkey|pork chop|salmon fillet|tilapia|shrimp|turkey breast|brown rice|white rice|olive oil|greek yogurt|almond milk|protein powder|raw\s+chicken)\b/i;

const PACKAGED_SUPPLEMENT_PATTERN =
  /\b(whey|protein powder|pre workout|preworkout|creatine|bcaa|isolate|mass gainer|casein|collagen|greens powder|electrolyte|energy drink mix)\b/i;

/** Category words — useful for ranking, not for requiring every token in the title. */
const PRODUCT_GENERIC_WORDS = new Set([
  'protein',
  'whey',
  'powder',
  'isolate',
  'blend',
  'supplement',
  'flavor',
  'flavour',
  'lifestyle',
  'nutrition',
  'snack',
  'bar',
  'drink',
  'mix',
  'cereal',
  'yogurt',
  'milk',
  'cheese',
  'bread',
  'cookie',
  'cookies',
  'cracker',
  'crackers',
  'chips',
  'soup',
  'sauce',
  'juice',
  'water',
  'soda',
  'coffee',
  'tea',
]);

function isGroceryIngredientQuery(query) {
  const q = normalizeQueryText(query);
  return !!q && GROCERY_INGREDIENT_PATTERN.test(q);
}

function normalizeQueryText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[''`]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRe(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function quantityTokenAliases(token) {
  const t = String(token || '').toLowerCase();
  const m = t.match(/^(\d+)(pc|pcs|piece|pieces|pk|pack)$/i);
  if (!m) return [t];
  const n = m[1];
  return [t, n, `${n}pc`, `${n}pcs`, `${n} piece`, `${n} pieces`, `${n}-piece`, `${n}-pc`];
}

function tokenHitsInHay(hay, token) {
  const variants = new Set(quantityTokenAliases(token));
  const t = String(token || '').toLowerCase();
  if (t.endsWith('s') && t.length > 3) variants.add(t.slice(0, -1));
  if (t.length > 2 && !t.endsWith('s')) variants.add(`${t}s`);

  for (const variant of variants) {
    try {
      if (new RegExp(`\\b${escapeRe(variant)}\\b`, 'i').test(hay)) return true;
    } catch {
      if (hay.includes(variant)) return true;
    }
  }
  return false;
}

function significantQueryTokens(query) {
  return normalizeQueryText(query)
    .split(' ')
    .filter((w) => {
      if (!w || QUERY_STOP_WORDS.has(w)) return false;
      // Keep sizes / counts: "14", "20oz", "10pc"
      if (/^\d/.test(w)) return true;
      return w.length > 2;
    });
}

/** Tokens the result title must contain (category words like "cereal" may be omitted). */
function requiredQueryTokens(query) {
  const tokens = significantQueryTokens(query);
  const required = tokens.filter((t) => !OPTIONAL_CATEGORY_TOKENS.has(t));
  return required.length ? required : tokens;
}

function isMenuStyleQuery(query) {
  const q = normalizeQueryText(query);
  if (!q || q.length < 3) return false;
  if (GROCERY_INGREDIENT_PATTERN.test(q)) return false;
  if (PACKAGED_SUPPLEMENT_PATTERN.test(q)) return false;

  try {
    const { findConsumerBrandInQuery } = require('../food-details/cleanFoodBrandName');
    if (findConsumerBrandInQuery(query)) return false;
  } catch (_) {
    /* optional in tests */
  }

  if (MENU_STYLE_PATTERN.test(q)) return true;
  if (/\b\d+\s*(piece|pc|pcs|slice|oz|fl\s*oz)\b/i.test(q) && MENU_STYLE_PATTERN.test(q)) {
    return true;
  }

  const tokens = significantQueryTokens(query);
  if (tokens.length === 1 && MENU_STYLE_PATTERN.test(q)) return true;
  return false;
}

function countTokenHits(text, tokens) {
  const hay = normalizeQueryText(text);
  let hits = 0;
  for (const t of tokens) {
    if (tokenHitsInHay(hay, t)) hits += 1;
  }
  return hits;
}

function getConsumerBrandInQuery(query) {
  try {
    const { findConsumerBrandInQuery } = require('../food-details/cleanFoodBrandName');
    return findConsumerBrandInQuery(query) || null;
  } catch (_) {
    return null;
  }
}

function brandTokensFromQuery(query) {
  const brand = getConsumerBrandInQuery(query);
  if (!brand) return [];
  return normalizeQueryText(brand).split(' ').filter((w) => w.length > 1);
}

/** Common US chain tokens for branded menu ranking (avoids circular require with casualMenuSearch). */
const CHAIN_TOKEN_PATTERNS = [
  /\blittle\s*caesars?\b/i,
  /\bmcdonald'?s?\b/i,
  /\bchipotle\b/i,
  /\bwendy'?s?\b/i,
  /\bdomino'?s?\b/i,
  /\bburger\s*king\b/i,
  /\btaco\s*bell\b/i,
  /\bstarbucks\b/i,
  /\bpapa\s*john'?s?\b/i,
  /\bpizza\s*hut\b/i,
  /\bchick[\s-]?fil[\s-]?a\b/i,
  /\bjets?\b/i,
  /\bsubway\b/i,
  /\bpanda\s*express\b/i,
  /\bfive\s*guys\b/i,
  /\bin[\s-]?n[\s-]?out\b/i,
];

/** Item tokens after stripping chain/brand (e.g. crazy + bread from "little caesars crazy bread"). */
function menuItemTokensFromQuery(query) {
  const brandParts = new Set(brandTokensFromQuery(query));
  let qNorm = normalizeQueryText(query);
  for (const re of CHAIN_TOKEN_PATTERNS) {
    qNorm = qNorm.replace(re, ' ');
  }
  qNorm = qNorm.replace(/\s+/g, ' ').trim();
  return significantQueryTokens(qNorm).filter((t) => !brandParts.has(t));
}

function distinctiveQueryTokens(query) {
  const brandParts = brandTokensFromQuery(query);
  return significantQueryTokens(query).filter(
    (t) => !brandParts.includes(t) && !PRODUCT_GENERIC_WORDS.has(t),
  );
}

function textIncludesBrand(itemText, brandLabel) {
  const hay = normalizeQueryText(itemText);
  const brandNorm = normalizeQueryText(brandLabel);
  if (!brandNorm) return false;
  if (new RegExp(`\\b${escapeRe(brandNorm)}\\b`, 'i').test(hay)) return true;
  const first = brandNorm.split(' ')[0];
  return first.length > 2 && new RegExp(`\\b${escapeRe(first)}\\b`, 'i').test(hay);
}

function rowSearchText(row) {
  return `${row?.name || row?.food_name || ''} ${row?.brand || row?.brand_name || ''} ${row?.serving_label || row?.servingLabel || row?.serving || ''}`.trim();
}

/** Name + brand only — never use serving labels for food-family inference (they are often wrong). */
function rowNameBrandText(row) {
  return `${row?.name || row?.food_name || ''} ${row?.brand || row?.brand_name || row?.restaurant || ''}`.trim();
}

/**
 * Collapse burger/sandwich into one compatibility group; everything else is its own family.
 */
function foodFamilyCompatGroup(category) {
  if (category === 'burger' || category === 'sandwich') return 'sandwich';
  return category || 'generic';
}

/**
 * True when the result is a different food family than what the user searched
 * (bread ≠ pizza ≠ nuggets ≠ taco ≠ burrito, etc.). Applies to ALL brands.
 */
function hasUnrequestedFoodFamilyMismatch(nameBrandText, query) {
  const qCat = inferFoodServingCategory(query, '', '');
  if (qCat === 'generic') return false;
  const rowCat = inferFoodServingCategory('', nameBrandText, '');
  if (rowCat === 'generic') return false;
  return foodFamilyCompatGroup(qCat) !== foodFamilyCompatGroup(rowCat);
}

/** Toppings / variants that must appear in the query to keep a result (plain cheese ≠ Philly steak). */
const EXTRA_MENU_MODIFIERS = [
  'philly',
  'steak',
  'wisconsin',
  'pepperoni',
  'sausage',
  'supreme',
  'meat',
  'meats',
  'hawaiian',
  'buffalo',
  'bbq',
  'barbecue',
  'veggie',
  'vegetable',
  'mushroom',
  'bacon',
  'spinach',
  'feta',
  'goat',
  'extravaganza',
  'pacific',
  'deluxe',
  'stuffed',
  'brooklyn',
];

function extraModifiersInText(text) {
  const hay = normalizeQueryText(text);
  const found = [];
  for (const mod of EXTRA_MENU_MODIFIERS) {
    if (new RegExp(`\\b${escapeRe(mod)}\\b`, 'i').test(hay)) found.push(mod);
  }
  // "6 cheese" / specialty cheese blends when user only said "cheese"
  if (/\b\d+\s*cheese\b/i.test(hay) || /\bsix\s*cheese\b/i.test(hay)) found.push('multi_cheese');
  return found;
}

/**
 * True when the row adds specialty toppings/variants the user did not ask for.
 * e.g. query "dominos large cheese pizza" vs row "Philly Cheese Steak Pizza"
 */
function hasUnrequestedMenuModifiers(itemText, query) {
  const qMods = new Set(extraModifiersInText(query));
  const rowMods = extraModifiersInText(itemText);
  if (!rowMods.length) return false;
  return rowMods.some((m) => !qMods.has(m));
}

/** Diet / zero / pack / wrong-drink tokens that must appear in the query to keep a result. */
const EXTRA_VARIANT_MODIFIERS = [
  'diet',
  'zero',
  'zéro',
  'light',
  'lite',
  'seltzer',
  'sparkling',
  'feisty',
  'mini',
  'fridge',
  'multipack',
  'sugarfree',
  'caffeine',
];

function queryFluidOz(query) {
  const q = normalizeQueryText(query);
  const m = q.match(/\b(\d+)\s*(fl\s*)?oz\b/);
  return m ? Number(m[1]) : null;
}

function rowFluidOz(itemText) {
  const hay = normalizeQueryText(itemText);
  const m = hay.match(/\b(\d+)\s*(fl\s*)?oz\b/);
  return m ? Number(m[1]) : null;
}

function queryPieceCount(query) {
  const q = normalizeQueryText(query);
  const m =
    q.match(/\b(\d+)\s*(pc|pcs|piece|pieces)\b/) ||
    q.match(/\b(\d+)(pc|pcs)\b/);
  return m ? Number(m[1]) : null;
}

function rowPieceCount(itemText) {
  const hay = normalizeQueryText(itemText);
  const m =
    hay.match(/\b(\d+)\s*(pc|pcs|piece|pieces)\b/) ||
    hay.match(/\b(\d+)(pc|pcs)\b/) ||
    hay.match(/\b(\d+)\s*-\s*piece\b/);
  return m ? Number(m[1]) : null;
}

function queryMenuSize(query) {
  const q = normalizeQueryText(query);
  if (/\bextra\s*large\b|\bxl\b/.test(q)) return 'extra large';
  for (const size of ['small', 'medium', 'large', 'grande', 'venti', 'tall', 'regular']) {
    if (new RegExp(`\\b${size}\\b`).test(q)) return size;
  }
  return null;
}

function rowMenuSize(itemText) {
  const hay = normalizeQueryText(itemText);
  if (/\bextra\s*large\b|\bxl\b/.test(hay)) return 'extra large';
  for (const size of ['small', 'medium', 'large', 'grande', 'venti', 'tall', 'regular']) {
    if (new RegExp(`\\b${size}\\b`).test(hay)) return size;
  }
  return null;
}

function isBeverageStyleQuery(query) {
  const q = normalizeQueryText(query);
  return /\b(coke|cola|pepsi|sprite|fanta|dr\s*pepper|soda|drink|beverage|gatorade|powerade|juice|tea|coffee|latte|mocha|shake|smoothie)\b/i.test(
    q,
  );
}

/**
 * True when a result adds diet/zero/wrong size/pack the user did not type.
 * Applies to food + beverages (not only sodas).
 */
function hasUnrequestedVariantMismatch(itemText, query) {
  const qNorm = normalizeQueryText(query);
  const hay = normalizeQueryText(itemText);

  for (const mod of EXTRA_VARIANT_MODIFIERS) {
    if (
      new RegExp(`\\b${escapeRe(mod)}\\b`, 'i').test(hay) &&
      !new RegExp(`\\b${escapeRe(mod)}\\b`, 'i').test(qNorm)
    ) {
      return true;
    }
  }

  if (/\bdiet\b/i.test(hay) && !/\bdiet\b/i.test(qNorm)) return true;
  if (/\bsugar[\s-]*free\b/i.test(hay) && !/\bsugar[\s-]*free\b/i.test(qNorm)) return true;
  if (/\b(family|value)\s*pack\b/i.test(hay) && !/\bpack\b/i.test(qNorm)) return true;
  if (/\b(\d+)\s*pack\b/i.test(hay) && !/\bpack\b/i.test(qNorm)) return true;

  const wantOz = queryFluidOz(query);
  if (wantOz != null) {
    const gotOz = rowFluidOz(itemText);
    if (gotOz != null && gotOz !== wantOz) return true;
    if (wantOz >= 16 && /\b(mini|can|cans)\b/i.test(hay) && !/\bbottle\b/i.test(hay) && !/\bcan\b/i.test(qNorm)) {
      return true;
    }
  }

  const wantPc = queryPieceCount(query);
  if (wantPc != null) {
    const gotPc = rowPieceCount(itemText);
    if (gotPc != null && gotPc !== wantPc) return true;
  }

  // Hard size mismatch when user asked for one size (medium fries ≠ large fries).
  const wantSize = queryMenuSize(query);
  if (wantSize) {
    const gotSize = rowMenuSize(itemText);
    if (gotSize && gotSize !== wantSize) return true;
  }

  return false;
}

/** @deprecated use hasUnrequestedVariantMismatch */
function hasUnrequestedBeverageMismatch(itemText, query) {
  if (!isBeverageStyleQuery(query)) return false;
  return hasUnrequestedVariantMismatch(itemText, query);
}

/**
 * Soda / soft-drink rows with impossible macros (e.g. 2000 cal / 65g fat "Cherry Coke").
 */
function isAbsurdBeverageNutrition(row, query) {
  if (!isBeverageStyleQuery(query)) return false;
  const q = normalizeQueryText(query);
  const isShakeOrSmoothie = /\b(shake|smoothie|protein)\b/i.test(q);
  const cal = Number(row?.calories) || 0;
  const fat = Number(row?.fat) || 0;
  const protein = Number(row?.protein) || 0;
  if (!isShakeOrSmoothie) {
    if (fat >= 5) return true;
    if (protein >= 5) return true;
    if (cal >= 450) return true;
  } else if (cal >= 1200) {
    return true;
  }
  return false;
}

/**
 * Strict close-name gate: every required query token must appear in the result.
 * Better empty than cousins (Philly when you typed cheese, diet when you didn't).
 */
function isCloseNameMatch(itemText, query, nameBrandText = '') {
  const need = requiredQueryTokens(query);
  if (!need.length) return true;
  if (countTokenHits(itemText, need) < need.length) return false;
  if (hasUnrequestedMenuModifiers(itemText, query)) return false;
  if (hasUnrequestedVariantMismatch(itemText, query)) return false;
  if (hasUnrequestedFoodFamilyMismatch(nameBrandText || itemText, query)) return false;
  return true;
}

/**
 * Higher = better match. Used for ranking; thresholds vary by query type.
 */
function scoreFoodSearchRelevance(itemText, query) {
  const tokens = significantQueryTokens(query);
  const hay = normalizeQueryText(itemText);
  const qNorm = normalizeQueryText(query);
  if (!tokens.length) return 1;

  let score = countTokenHits(itemText, tokens) * 12;

  const phrase = tokens.join(' ');
  if (phrase.length >= 4 && hay.includes(phrase)) score += 45;
  if (tokens.length >= 2 && hay.includes(tokens.slice(0, 2).join(' '))) score += 22;

  // Exact / near-exact title match for the item phrase (not just shared brand tokens).
  const itemTokens = menuItemTokensFromQuery(query);
  if (itemTokens.length >= 2) {
    const itemPhrase = itemTokens.join(' ');
    if (hay.includes(itemPhrase)) score += 80;
    // "cheese pizza" as contiguous phrase beats "cheese steak pizza"
    if (itemTokens.includes('cheese') && itemTokens.includes('pizza')) {
      if (/\bcheese\s+pizza\b/.test(hay) && !/\b(steak|philly|pepperoni|sausage)\b/.test(hay)) {
        score += 70;
      }
    }
  }

  const requiredBrand = getConsumerBrandInQuery(query);
  if (requiredBrand) {
    if (textIncludesBrand(itemText, requiredBrand)) score += 35;
    else score -= 120;
    const flavorTokens = distinctiveQueryTokens(query);
    score += countTokenHits(itemText, flavorTokens) * 8;
  }

  if (isMenuStyleQuery(query)) {
    if (isRetailFoodNoise(itemText)) score -= 200;
    if (/\bjets\b/.test(qNorm) && /\bpizza\b/.test(qNorm) && /\bcandy|gummi\b/.test(hay)) {
      score -= 200;
    }

    if (itemTokens.length >= 1) {
      const itemHits = countTokenHits(itemText, itemTokens);
      if (itemHits >= itemTokens.length) score += 55;
      else if (itemHits === 0) score -= 110;
      else score += itemHits * 12;
    }

    // Specialty toppings user didn't ask for → bury (Philly steak when you wanted cheese).
    if (hasUnrequestedMenuModifiers(itemText, query)) score -= 220;

    // Size: prefer "large" when asked; demote extra-large if user didn't say extra.
    if (/\blarge\b/.test(qNorm) && !/\bextra\s*large\b/.test(qNorm)) {
      if (/\bextra\s*large\b/.test(hay)) score -= 40;
      else if (/\blarge\b/.test(hay)) score += 25;
    }
  }

  // Wrong food family (pizza when searching bread, etc.) — all brands.
  if (hasUnrequestedFoodFamilyMismatch(itemText, query)) score -= 280;

  if (hasUnrequestedVariantMismatch(itemText, query)) score -= 240;

  const wantOz = queryFluidOz(query);
  if (wantOz != null) {
    const gotOz = rowFluidOz(itemText);
    if (gotOz === wantOz) score += 60;
    else if (gotOz != null) score -= 80;
  }

  const wantPc = queryPieceCount(query);
  if (wantPc != null) {
    const gotPc = rowPieceCount(itemText);
    if (gotPc === wantPc) score += 50;
    else if (gotPc != null) score -= 90;
  }

  if (tokens.length >= 2 && countTokenHits(itemText, tokens) === 0) score -= 40;

  return score;
}

/** Minimum token hits — always require full required-token coverage. */
function minTokenHitsForMatch(query) {
  const need = requiredQueryTokens(query);
  return Math.max(1, need.length);
}

function itemMatchesQuery(itemText, query) {
  if (isRetailFoodNoise(itemText) && isMenuStyleQuery(query)) return false;
  const requiredBrand = getConsumerBrandInQuery(query);
  if (requiredBrand && !textIncludesBrand(itemText, requiredBrand)) return false;
  return isCloseNameMatch(itemText, query);
}

/**
 * Strict close-name filter for ALL query types. Better empty than unrelated cousins.
 */
function filterFoodSearchRows(query, rows, limit = 8) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return [];

  const requiredBrand = getConsumerBrandInQuery(query);
  const need = requiredQueryTokens(query);
  const cap = Math.min(Math.max(limit, 1), 8);

  let candidates = list.filter((row) => {
    const text = rowSearchText(row);
    const nameBrand = rowNameBrandText(row);
    if (isRetailFoodNoise(text)) return false;
    if (requiredBrand && !textIncludesBrand(text, requiredBrand)) return false;
    if (!isCloseNameMatch(text, query, nameBrand)) return false;
    if (isAbsurdBeverageNutrition(row, query)) return false;
    return true;
  });

  if (!candidates.length) return [];

  const scored = candidates
    .map((row) => {
      const text = rowSearchText(row);
      const nameBrand = rowNameBrandText(row);
      const src = String(row.source || '').toLowerCase();
      const sourceBoost =
        src === 'nutrition_consensus'
          ? 300
          : src === 'trusted_catalog'
            ? 200
            : src === 'fatsecret' || src === 'usda' || src === 'usdafdc'
              ? 80
              : 0;
      // Score with name+brand for family signals so junk serving labels cannot flip family.
      const scoreText = nameBrand || text;
      return {
        row,
        score: scoreFoodSearchRelevance(scoreText, query) + sourceBoost,
        hits: countTokenHits(text, need),
      };
    })
    .sort((a, b) => b.score - a.score || b.hits - a.hits);

  return scored.slice(0, cap).map((e) => e.row);
}

function isRetailFoodNoise(text) {
  const t = String(text || '').toLowerCase();
  return (
    /\bpizza\s+sauce\b|\bpizza\s*,\s*sauce\b|\bpizza\s+dough\b|\bpizza\s+crackers\b|\bpizza\s+paste\b/i.test(
      t,
    ) || /\b(bourekas|empanadas|pastelillos|bruschette)\b/i.test(t)
  );
}

module.exports = {
  normalizeQueryText,
  significantQueryTokens,
  isMenuStyleQuery,
  isGroceryIngredientQuery,
  itemMatchesQuery,
  scoreFoodSearchRelevance,
  filterFoodSearchRows,
  countTokenHits,
  isRetailFoodNoise,
  MENU_STYLE_PATTERN,
  menuItemTokensFromQuery,
  hasUnrequestedMenuModifiers,
  hasUnrequestedBeverageMismatch,
  hasUnrequestedVariantMismatch,
  hasUnrequestedFoodFamilyMismatch,
  rowNameBrandText,
  isBeverageStyleQuery,
  isCloseNameMatch,
  requiredQueryTokens,
};
