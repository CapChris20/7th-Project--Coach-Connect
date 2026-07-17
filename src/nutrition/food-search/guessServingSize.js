/**
 * Infer human-readable serving labels for food search cards (all sources).
 * Avoids generic "100g serving" for restaurant/menu items when we can do better.
 */

function normalizeSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/** Labels too vague to show on a menu card. */
function isWeakServingLabel(label) {
  const l = normalizeSpace(label).toLowerCase();
  if (!l) return true;
  if (/^(per\s+)?100\s*g(?:rams?)?$/.test(l)) return true;
  if (/^100\s*g(?:rams?)?\s*(serving)?$/.test(l)) return true;
  if (/^per\s+100\s*g/.test(l)) return true;
  if (/^(1\s+)?serving$/.test(l)) return true;
  if (/^each$/.test(l)) return true;
  if (/^grams?$/.test(l)) return true;
  if (/^per\s+serving$/.test(l)) return true;
  return false;
}

function titleCaseSize(word) {
  const w = String(word || '').toLowerCase();
  if (!w) return '';
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function extractCount(text, re) {
  const m = String(text || '').match(re);
  return m ? m[1] : null;
}

/** Coarse food-type bucket used to reject mismatched serving labels. */
function inferFoodServingCategory(userQuery = '', foodName = '', restaurant = '') {
  const combined = normalizeSpace(`${userQuery} ${foodName} ${restaurant}`).toLowerCase();
  if (!combined) return 'generic';

  if (/\b(mcnugget|mc\s*nugget|chicken\s*nugget|nuggets?)\b/.test(combined)) return 'nugget';
  if (/\b(wings?|boneless\s+wings?)\b/.test(combined)) return 'wing';
  if (/\b(tenders?|chicken\s+fingers?|strips?)\b/.test(combined)) return 'tender';
  if (
    /\b(crazy\s*bread|breadsticks?|cheesy\s+bread|garlic\s+(cheese\s+)?bread|cheese\s+bread)\b/.test(
      combined,
    ) ||
    (/\b(breadstick|bread)\b/.test(combined) &&
      !/\b(pizza|burger|sandwich|nugget|wing|bowl|burrito)\b/.test(combined))
  ) {
    return 'bread';
  }
  if (/\bpizza\b/.test(combined)) return 'pizza';
  if (/\b(burger|cheeseburger|hamburger|whopper|big\s*mac|quarter\s*pounder|baconator|slider)\b/.test(combined)) {
    return 'burger';
  }
  if (/\b(bowl|burrito|taco|quesadilla)\b/.test(combined)) return 'mexican';
  if (/\b(sandwich|wrap|sub|hoagie|panini|melt)\b/.test(combined)) return 'sandwich';
  if (/\b(fries|fry)\b/.test(combined)) return 'fries';
  if (/\b(frosty|shake|smoothie|latte|mocha|frappuccino|coffee|soda|drink)\b/.test(combined)) {
    return 'beverage';
  }
  return 'generic';
}

function labelLooksLikeNuggetOrWing(label) {
  const l = normalizeSpace(label).toLowerCase();
  return /\b(nuggets?|mcnuggets?|wings?|tenders?|chicken\s+fingers?)\b/.test(l);
}

function labelLooksLikeBread(label) {
  const l = normalizeSpace(label).toLowerCase();
  return /\b(breadstick|bread\s*stick|crazy\s*bread|garlic\s+bread|cheesy\s+bread|stick)\b/.test(l);
}

function labelLooksLikePizzaMeal(label) {
  const l = normalizeSpace(label).toLowerCase();
  return /\b(pizza\s+meal|whole\s+pizza|pizza\s+combo|slice\s+of\s+pizza)\b/.test(l);
}

/**
 * True when a serving line belongs to a different food family than the card name/query.
 * e.g. Crazy Bread card labeled "10 pc nuggets".
 */
function servingConflictsWithFood({ userQuery = '', foodName = '', restaurant = '', servingLabel = '' } = {}) {
  const label = normalizeSpace(servingLabel);
  if (!label || isWeakServingLabel(label)) return false;
  const category = inferFoodServingCategory(userQuery, foodName, restaurant);
  const low = label.toLowerCase();

  if (category === 'bread') {
    if (labelLooksLikeNuggetOrWing(label)) return true;
    if (labelLooksLikePizzaMeal(label)) return true;
    if (/\b(burger|sandwich|bowl|burrito|taco)\b/.test(low) && !/\bbread\b/.test(low)) return true;
  }
  if (category === 'nugget' || category === 'wing' || category === 'tender') {
    if (labelLooksLikeBread(label) && !labelLooksLikeNuggetOrWing(label)) return true;
  }
  if (category === 'burger' || category === 'sandwich') {
    if (labelLooksLikeNuggetOrWing(label) || labelLooksLikeBread(label)) return true;
  }
  if (category === 'pizza') {
    if (labelLooksLikeNuggetOrWing(label)) return true;
  }
  if (category === 'mexican') {
    if (labelLooksLikeNuggetOrWing(label) || labelLooksLikeBread(label)) return true;
  }
  return false;
}

/** High-cal bread/breadstick macros sold as a single stick/piece → treat as multi/order. */
function looksLikeMultiBreadOrder(calories, label, category) {
  if (category !== 'bread') return false;
  const cal = Number(calories) || 0;
  if (cal < 700) return false;
  const l = normalizeSpace(label).toLowerCase();
  if (!l) return true;
  if (/\b(order|full\s+order|multi|pack|sticks?|pieces?)\b/.test(l) && !/^1\s+(piece|stick|breadstick)\b/.test(l)) {
    return false;
  }
  return /^1\s+(piece|stick|breadstick|serving)\b/.test(l) || /^(piece|stick|breadstick)$/.test(l);
}

function defaultBreadServingLabel(userQuery = '', foodName = '') {
  const combined = normalizeSpace(`${userQuery} ${foodName}`).toLowerCase();
  if (/\bcrazy\s*bread|breadsticks?\b/.test(combined)) return '1 breadstick';
  return '1 piece';
}

/**
 * Infer a serving line from the user's query + food name (no scraper data).
 */
function servingLabelFromQueryStructure(userQuery, foodName = '', restaurant = '') {
  const combined = normalizeSpace(`${userQuery} ${foodName} ${restaurant}`).toLowerCase();
  if (!combined || combined.length < 2) return null;

  const size = extractCount(combined, /\b(small|medium|large|grande|venti|tall|regular)\b/);
  const category = inferFoodServingCategory(userQuery, foodName, restaurant);

  // Bread / breadsticks first so nugget piece-counts from scrapers never win via query mix-ups.
  if (category === 'bread') {
    return defaultBreadServingLabel(userQuery, foodName);
  }

  if (category === 'nugget' || /\b(mcnugget|mc\s*nugget|chicken\s*nugget|nugget)/i.test(combined)) {
    const n =
      extractCount(combined, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/) ||
      extractCount(combined, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\s*(?:chicken\s*)?nugget/);
    if (n) return `${n} pc nuggets`;
    return '1 serving';
  }

  if (category === 'pizza' || /\bpizza\b/i.test(combined)) {
    if (/\b(whole|entire|full)\s+(pizza)?\b/i.test(combined)) return 'Whole pizza';
    if (/\bhalf\s+(a\s+)?pizza\b/i.test(combined)) return 'Half pizza';
    const slices = extractCount(combined, /\b(\d+)\s*slices?\b/);
    if (slices) return `${slices} slice${slices === '1' ? '' : 's'}`;
    if (/\bslice\b/i.test(combined)) return '1 slice';
    return '1 slice';
  }

  if (category === 'wing' || /\b(wing|wings)\b/i.test(combined)) {
    const n = extractCount(combined, /\b(\d+)\s*wing/);
    if (n) return `${n} wings`;
    return '1 serving';
  }

  if (/\b(burger|cheeseburger|hamburger|whopper|big\s*mac|quarter\s*pounder|slider|baconator|dave'?s?\s*single|frosty)\b/i.test(combined)) {
    if (/\bfrosty\b/i.test(combined)) {
      return size ? titleCaseSize(size) : '1 medium';
    }
    return '1 sandwich';
  }

  if (/\b(sandwich|wrap|sub|hoagie|panini|melt)\b/i.test(combined)) {
    return '1 sandwich';
  }

  if (/\b(bowl|salad)\b/i.test(combined)) return '1 bowl';

  if (/\b(taco)\b/i.test(combined)) return '1 taco';
  if (/\b(burrito|quesadilla)\b/i.test(combined)) return '1 burrito';

  if (/\b(fries|fry)\b/i.test(combined)) {
    return size ? `${titleCaseSize(size)} fries` : 'Medium fries';
  }

  if (/\b(frosty|shake|smoothie|latte|mocha|frappuccino|coffee|soda|cola|drink|beverage|lemonade)\b/i.test(combined)) {
    return size ? titleCaseSize(size) : '1 medium';
  }

  if (/\b(chips|crisps|crackers|pretzel|popcorn|snack|doritos|cheetos|lays|pringles)\b/i.test(combined)) {
    return '1 serving';
  }

  if (/\b(egg|eggs)\b/i.test(combined)) {
    const sz = extractCount(combined, /\b(large|medium|small|extra\s+large)\s+egg/);
    if (sz) return `1 ${sz} egg`;
    return '1 egg';
  }

  if (/\b(apple|banana|orange|avocado|potato)\b/i.test(combined)) {
    return '1 medium';
  }

  if (/\b(chicken\s+breast|salmon|steak|pork\s+chop)\b/i.test(combined)) {
    return '1 serving';
  }

  if (size && /\b(combo|meal)\b/i.test(combined)) {
    return `${titleCaseSize(size)} combo`;
  }

  return null;
}

/** Pull serving language from scraper page text when present. */
function extractServingLabelFromPageText(text, foodContext = {}) {
  const s = normalizeSpace(String(text || '').replace(/\u00a0/g, ' '));
  if (s.length < 8) return null;
  const low = s.toLowerCase();
  const category = inferFoodServingCategory(
    foodContext.userQuery,
    foodContext.foodName,
    foodContext.restaurant,
  );

  let m = s.match(/serving\s+size[:\s]+([^\n.;]{3,90})/i);
  if (m) {
    const line = normalizeSpace(m[1]);
    if (
      !isWeakServingLabel(line) &&
      !servingConflictsWithFood({ ...foodContext, servingLabel: line })
    ) {
      return line;
    }
  }

  m = s.match(/there are\s+[^.]{0,40}?\bper\s+([^.(]{3,60})/i);
  if (m && !isWeakServingLabel(m[1])) {
    const line = normalizeSpace(m[1]);
    if (!servingConflictsWithFood({ ...foodContext, servingLabel: line })) return line;
  }

  // Never attach nugget/wing piece counts to bread foods.
  if (category !== 'bread') {
    if (/\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/i.test(low) && /\bnugget/i.test(low)) {
      const n = extractCount(low, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/);
      if (n) return `${n} pc nuggets`;
    }
  }

  if (category === 'bread') {
    if (/\bfull\s+order\b|\bentire\s+order\b/i.test(low)) {
      const stick = s.match(/(\d+)\s*sticks?\b/i);
      if (stick) return `Full order (${stick[1]} sticks)`;
      return 'Full order';
    }
    if (/\b(\d+)\s*(?:bread)?sticks?\b/i.test(low) && !/\bnugget|wing/i.test(low)) {
      const n = extractCount(low, /\b(\d+)\s*(?:bread)?sticks?\b/);
      if (n && Number(n) >= 2) return `${n}-piece order`;
    }
    if (/\b1\s+breadstick\b|\bone\s+breadstick\b|\bper\s+breadstick\b/i.test(low)) {
      return '1 breadstick';
    }
  }

  if (/\b1\s+slice\b|\bper\s+slice\b|\bone\s+slice\b/i.test(low) && /\bpizza|slice/i.test(low)) {
    return '1 slice';
  }

  if (/\b(\d+)\s*slices?\b/i.test(low) && /\bpizza/i.test(low)) {
    const n = extractCount(low, /\b(\d+)\s*slices?\b/);
    if (n) return `${n} slice${n === '1' ? '' : 's'}`;
  }

  if (/\bwhole\s+pizza\b|\bentire\s+pizza\b/i.test(low)) return 'Whole pizza';

  if (category !== 'bread' && /\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/i.test(low)) {
    const n = extractCount(low, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/);
    if (n && /\bnugget|wing|tender|strip/i.test(low)) {
      const kind = /\bwing/i.test(low) ? 'wings' : /\bnugget/i.test(low) ? 'nuggets' : 'pieces';
      return `${n} pc ${kind}`;
    }
  }

  return null;
}

function finalizeServingLabel(label, { userQuery, foodName, restaurant, calories } = {}) {
  let out = normalizeSpace(label);
  const category = inferFoodServingCategory(userQuery, foodName, restaurant);

  if (!out || isWeakServingLabel(out) || servingConflictsWithFood({ userQuery, foodName, restaurant, servingLabel: out })) {
    out = servingLabelFromQueryStructure(userQuery, foodName, restaurant) || '1 serving';
  }

  if (looksLikeMultiBreadOrder(calories, out, category)) {
    return {
      label: 'Full order (multi-serving)',
      nutrition_unverified: true,
      multiServingFallback: true,
    };
  }

  return { label: out, nutrition_unverified: false, multiServingFallback: false };
}

/**
 * Best serving label for a search row — scraper only when it matches food type, else structure.
 */
function resolveFoodServingLabel({
  userQuery = '',
  foodName = '',
  restaurant = '',
  scraperLabel = null,
  displayName = '',
  pageText = '',
  calories = null,
} = {}) {
  const name = foodName || displayName;
  const ctx = { userQuery, foodName: name, restaurant };
  const candidates = [];

  for (const raw of [scraperLabel, extractServingLabelFromPageText(pageText, ctx)]) {
    const label = normalizeSpace(raw);
    if (!label || isWeakServingLabel(label)) continue;
    if (servingConflictsWithFood({ ...ctx, servingLabel: label })) continue;
    candidates.push(label);
  }

  const fromStructure = servingLabelFromQueryStructure(userQuery, name, restaurant);
  if (fromStructure) candidates.push(fromStructure);

  const picked = candidates[0] || '1 serving';
  const finalized = finalizeServingLabel(picked, {
    userQuery,
    foodName: name,
    restaurant,
    calories,
  });
  return finalized.label;
}

/** Same as resolveFoodServingLabel but also returns multi/unverified flags for presentation. */
function resolveFoodServingLabelDetailed(opts = {}) {
  const name = opts.foodName || opts.displayName || '';
  const ctx = {
    userQuery: opts.userQuery || '',
    foodName: name,
    restaurant: opts.restaurant || '',
  };
  const candidates = [];
  for (const raw of [opts.scraperLabel, extractServingLabelFromPageText(opts.pageText || '', ctx)]) {
    const label = normalizeSpace(raw);
    if (!label || isWeakServingLabel(label)) continue;
    if (servingConflictsWithFood({ ...ctx, servingLabel: label })) continue;
    candidates.push(label);
  }
  const fromStructure = servingLabelFromQueryStructure(opts.userQuery, name, opts.restaurant);
  if (fromStructure) candidates.push(fromStructure);
  return finalizeServingLabel(candidates[0] || '1 serving', {
    ...ctx,
    calories: opts.calories,
  });
}

/** UI line under the food title on search cards. */
function formatServingDisplayLine(item, userQuery = '') {
  const foodName = item?.food_name || item?.name;
  const restaurant = item?.restaurant || item?.brand_name || item?.brand;
  const calories = item?.nf_calories ?? item?.calories;
  const existing = normalizeSpace(
    item?.portion_text || item?.serving_label || item?.servingLabel || '',
  );
  if (
    existing &&
    !isWeakServingLabel(existing) &&
    !servingConflictsWithFood({ userQuery, foodName, restaurant, servingLabel: existing })
  ) {
    const finalized = finalizeServingLabel(existing, {
      userQuery,
      foodName,
      restaurant,
      calories,
    });
    return finalized.label;
  }

  const resolved = resolveFoodServingLabel({
    userQuery,
    foodName,
    restaurant,
    scraperLabel: item?.serving_label || item?.servingLabel,
    pageText: item?.metadata?.sourceResult?.url || '',
    calories,
  });
  if (resolved) return resolved;

  const unit = normalizeSpace(item?.serving_unit || item?.servingUnit || '');
  if (unit && !isWeakServingLabel(unit) && !/^(grams?|g|ml)$/i.test(unit)) {
    const qty = item?.serving_size ?? item?.serving_qty ?? 1;
    return qty > 1 ? `${qty} ${unit}` : unit;
  }

  if (item?.source === 'serper' || item?.source === 'mixed') {
    return 'Estimated serving — adjust after adding';
  }

  return '1 serving';
}

module.exports = {
  isWeakServingLabel,
  servingLabelFromQueryStructure,
  extractServingLabelFromPageText,
  resolveFoodServingLabel,
  resolveFoodServingLabelDetailed,
  formatServingDisplayLine,
  inferFoodServingCategory,
  servingConflictsWithFood,
  looksLikeMultiBreadOrder,
};
