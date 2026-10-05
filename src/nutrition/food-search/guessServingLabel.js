/**
 * Infer human-readable serving labels for food search cards (all sources).
 * Systemic rules: food-family allowlists + cross-family conflict matrix.
 * Never attach nugget/wing/piece junk to bread/pizza/burger/etc.
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
  if (/^~\s*1\s+serving\b/.test(l)) return true;
  if (/^(1\s+)?serving$/.test(l)) return true;
  if (/^1$/.test(l)) return true;
  if (/^(1\s+)?portion$/.test(l)) return true;
  if (/^package$|^pack$/.test(l)) return true;
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

/**
 * Query-first category. Incidental words in scraper titles must not flip family
 * (e.g. "wing" in "buffalo wing pizza" → pizza when query says pizza).
 */
function inferFoodServingCategory(userQuery = '', foodName = '', restaurant = '') {
  const q = normalizeSpace(userQuery).toLowerCase();
  const name = normalizeSpace(foodName).toLowerCase();
  const place = normalizeSpace(restaurant).toLowerCase();
  // Prefer query; fall back to name+brand only when query has no food-family signal.
  const primary = q || `${name} ${place}`;
  const combined = normalizeSpace(`${q} ${name} ${place}`).toLowerCase();
  if (!combined) return 'generic';

  const hasPizza = /\bpizza\b/.test(primary) || (!q && /\bpizza\b/.test(combined));
  // Pizza beats wing/nugget when both appear ("buffalo wing pizza").
  if (hasPizza) return 'pizza';

  if (/\b(mcnuggets?|mc\s*nuggets?|chicken\s*nuggets?|nuggets?)\b/.test(primary) ||
      (!q && /\b(mcnuggets?|mc\s*nuggets?|chicken\s*nuggets?|nuggets?)\b/.test(combined))) {
    return 'nugget';
  }
  if (/\b(wings?|boneless\s+wings?)\b/.test(primary) ||
      (!q && /\b(wings?|boneless\s+wings?)\b/.test(combined))) {
    return 'wing';
  }
  if (/\b(tenders?|chicken\s+fingers?|strips?)\b/.test(primary) ||
      (!q && /\b(tenders?|chicken\s+fingers?|strips?)\b/.test(combined))) {
    return 'tender';
  }

  const breadRe =
    /\b(crazy\s*bread|breadsticks?|cheesy\s+bread|garlic\s+(cheese\s+)?bread|cheese\s+bread|cheese\s*sticks?|cheesesticks?|garlic\s+parmesan)\b/;
  if (
    breadRe.test(primary) ||
    (!q && breadRe.test(combined)) ||
    ((/\b(breadstick|bread)\b/.test(primary) || (!q && /\b(breadstick|bread)\b/.test(combined))) &&
      !/\b(pizza|burger|sandwich|nugget|wing|bowl|burrito)\b/.test(combined))
  ) {
    return 'bread';
  }

  if (/\b(burger|cheeseburger|hamburger|whopper|big\s*mac|quarter\s*pounder|baconator|slider)\b/.test(primary) ||
      (!q && /\b(burger|cheeseburger|hamburger|whopper|big\s*mac|quarter\s*pounder|baconator|slider)\b/.test(combined))) {
    return 'burger';
  }
  // Bowl before burrito so "burrito bowl" stays a bowl when the user asked for a bowl.
  if (/\b(bowl|salad)\b/.test(primary) || (!q && /\b(bowl|salad)\b/.test(combined))) return 'bowl';
  // Burrito before taco so "Taco Bell Burrito" is burrito, not taco.
  if (/\b(burrito)\b/.test(primary) || (!q && /\b(burrito)\b/.test(combined))) return 'burrito';
  if (/\b(quesadilla)\b/.test(primary) || (!q && /\b(quesadilla)\b/.test(combined))) return 'quesadilla';
  if (/\b(taco)\b/.test(primary) || (!q && /\b(taco)\b/.test(combined))) return 'taco';
  if (/\b(sandwich|wrap|sub|hoagie|panini|melt)\b/.test(primary) ||
      (!q && /\b(sandwich|wrap|sub|hoagie|panini|melt)\b/.test(combined))) {
    return 'sandwich';
  }
  if (/\b(fries|fry)\b/.test(primary) || (!q && /\b(fries|fry)\b/.test(combined))) return 'fries';
  if (
    /\b(frosty|shake|smoothie|latte|mocha|frappuccino|coffee|soda|cola|coke|drink|beverage|lemonade)\b/.test(
      primary,
    ) ||
    (!q &&
      /\b(frosty|shake|smoothie|latte|mocha|frappuccino|coffee|soda|cola|coke|drink|beverage|lemonade)\b/.test(
        combined,
      ))
  ) {
    return 'beverage';
  }
  return 'generic';
}

function labelLooksLikeNuggetOrWing(label) {
  const l = normalizeSpace(label).toLowerCase();
  return /\b(nuggets?|mcnuggets?|wings?|tenders?|chicken\s+fingers?|buff\b|buffalo)\b/.test(l);
}

function labelLooksLikeBread(label) {
  const l = normalizeSpace(label).toLowerCase();
  return /\b(breadstick|bread\s*stick|crazy\s*bread|garlic\s+bread|cheesy\s+bread|cheese\s*sticks?|cheesesticks?)\b/.test(
    l,
  );
}

function labelLooksLikePizzaSlice(label) {
  const l = normalizeSpace(label).toLowerCase();
  return /\b(slice|slices|whole\s+pizza|half\s+pizza|pizza)\b/.test(l);
}

function labelLooksLikeSandwich(label) {
  const l = normalizeSpace(label).toLowerCase();
  return /\b(sandwich|burger|wrap|sub\b|hoagie)\b/.test(l);
}

function labelLooksLikePieceCountJunk(label) {
  const l = normalizeSpace(label).toLowerCase();
  // Bare "10 pc" / "10 pc buff" without a matching food noun
  if (/\b\d+\s*(pc|pcs|piece|pieces)\b/.test(l) && !/\b(nugget|wing|tender|stick|breadstick|strip)\b/.test(l)) {
    return true;
  }
  return false;
}

function labelHasBarePcCount(label) {
  const l = normalizeSpace(label).toLowerCase();
  return /\b\d+\s*(pc|pcs|piece|pieces)\b/.test(l);
}

/**
 * Cross-family conflict matrix — hard reject wrong serving language for ANY food family.
 */
function servingConflictsWithFood({ userQuery = '', foodName = '', restaurant = '', servingLabel = '' } = {}) {
  const label = normalizeSpace(servingLabel);
  if (!label || isWeakServingLabel(label)) return false;
  const category = inferFoodServingCategory(userQuery, foodName, restaurant);
  const low = label.toLowerCase();

  const rejectNuggetWing = () => labelLooksLikeNuggetOrWing(label) || labelLooksLikePieceCountJunk(label);
  const rejectBread = () => labelLooksLikeBread(label);
  const rejectPizza = () => labelLooksLikePizzaSlice(label) && !/\b(taco|burrito|bowl)\b/.test(low);
  const rejectSandwich = () => labelLooksLikeSandwich(label);

  switch (category) {
    case 'bread':
      if (rejectNuggetWing()) return true;
      if (labelHasBarePcCount(label) && !/\b(stick|breadstick|bread)\b/.test(low)) return true;
      if (/\b(whole\s+pizza|pizza\s+meal|pizza\s+combo)\b/.test(low)) return true;
      if (/\b(burger|sandwich|bowl|burrito|taco)\b/.test(low) && !/\b(stick|bread)\b/.test(low)) return true;
      return false;

    case 'nugget':
      if (rejectBread() && !/\bnugget/i.test(low)) return true;
      if (/\bwings?\b/.test(low) && !/\bnugget/i.test(low)) return true;
      if (rejectSandwich() || (rejectPizza() && !/\bnugget/i.test(low))) return true;
      return false;

    case 'wing':
    case 'tender':
      if (rejectBread()) return true;
      if (/\bnuggets?\b/.test(low) && !/\bwing/i.test(low)) return true;
      if (rejectSandwich() || rejectPizza()) return true;
      if (labelLooksLikePieceCountJunk(label)) return true;
      return false;

    case 'pizza':
      if (rejectNuggetWing()) return true;
      if (rejectBread()) return true;
      if (labelHasBarePcCount(label)) return true;
      if (rejectSandwich()) return true;
      return false;

    case 'burger':
    case 'sandwich':
      if (rejectNuggetWing()) return true;
      if (rejectBread()) return true;
      if (/\b\d+\s*slices?\b/.test(low) || /\b1\s+slice\b/.test(low)) return true;
      if (labelHasBarePcCount(label)) return true;
      return false;

    case 'taco':
      if (rejectNuggetWing()) return true;
      if (rejectBread()) return true;
      if (/\b(burrito|quesadilla|bowl)\b/.test(low)) return true;
      if (/\b\d+\s*slices?\b/.test(low)) return true;
      if (labelHasBarePcCount(label)) return true;
      return false;

    case 'burrito':
      if (rejectNuggetWing()) return true;
      if (rejectBread()) return true;
      if (/\b(taco|quesadilla)\b/.test(low) && !/\bburrito\b/.test(low)) return true;
      if (/\b\d+\s*slices?\b/.test(low)) return true;
      if (labelHasBarePcCount(label)) return true;
      return false;

    case 'quesadilla':
    case 'bowl':
    case 'mexican':
      if (rejectNuggetWing()) return true;
      if (rejectBread()) return true;
      if (/\b\d+\s*slices?\b/.test(low)) return true;
      if (labelHasBarePcCount(label)) return true;
      return false;

    case 'fries':
      if (rejectNuggetWing() || rejectBread() || rejectSandwich()) return true;
      if (labelHasBarePcCount(label)) return true;
      return false;

    case 'beverage':
      if (rejectNuggetWing() || rejectBread() || rejectSandwich()) return true;
      if (labelHasBarePcCount(label) || /\bslice\b/.test(low)) return true;
      return false;

    default:
      // Generic: still block obvious cross-family piece-count junk when name says otherwise.
      if (labelLooksLikePieceCountJunk(label)) return true;
      return false;
  }
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

function defaultBreadServingLabel(userQuery = '', foodName = '', calories = null) {
  const combined = normalizeSpace(`${userQuery} ${foodName}`).toLowerCase();
  const cal = Number(calories) || 0;
  const isCheeseStick =
    /\bcheese\s*sticks?|cheesesticks?\b/.test(combined) && !/\bbreadsticks?\b/.test(combined);
  const isBreadstick = /\b(crazy\s*bread|breadsticks?|garlic\s+parmesan\s+bread|garlic\s+bread|cheesy\s+bread)\b/.test(
    combined,
  );

  // ~170/stick products; ~340 ≈ two sticks (common logged amount).
  if (isCheeseStick) {
    if (cal >= 300 && cal <= 400) return '2 cheese sticks';
    return '1 cheese stick';
  }
  if (isBreadstick || /\bbreadsticks?\b/.test(combined)) {
    if (cal >= 300 && cal <= 400) return '2 breadsticks';
    if (/\bcrazy\s*bread\b/.test(combined)) return '1 breadstick';
    return '1 breadstick';
  }
  if (/\b(garlic|parmesan)\b/.test(combined) && /\bsticks?\b/.test(combined)) {
    if (cal >= 300 && cal <= 400) return '2 cheese sticks';
    return '1 cheese stick';
  }
  return '1 piece';
}

/**
 * Infer a serving line from the user's query + food name (no scraper data).
 */
function servingLabelFromQueryStructure(userQuery, foodName = '', restaurant = '', calories = null) {
  const combined = normalizeSpace(`${userQuery} ${foodName} ${restaurant}`).toLowerCase();
  if (!combined || combined.length < 2) return null;

  const size = extractCount(combined, /\b(small|medium|large|grande|venti|tall|regular)\b/);
  const category = inferFoodServingCategory(userQuery, foodName, restaurant);

  if (category === 'bread') {
    return defaultBreadServingLabel(userQuery, foodName, calories);
  }

  if (category === 'nugget') {
    const n =
      extractCount(combined, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/) ||
      extractCount(combined, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\s*(?:chicken\s*)?nugget/) ||
      extractCount(combined, /\b(\d+)\s*pc\b/) ||
      extractCount(combined, /\b(\d+)pc\b/);
    if (n) return `${n} pc nuggets`;
    return 'nuggets (1 serving)';
  }

  if (category === 'pizza') {
    if (/\b(whole|entire|full)\s+(pizza)?\b/i.test(combined)) return 'Whole pizza';
    if (/\bhalf\s+(a\s+)?pizza\b/i.test(combined)) return 'Half pizza';
    const slices = extractCount(combined, /\b(\d+)\s*slices?\b/);
    if (slices) return `${slices} slice${slices === '1' ? '' : 's'}`;
    if (/\bslice\b/i.test(combined)) return '1 slice';
    return '1 slice';
  }

  if (category === 'wing') {
    const n =
      extractCount(combined, /\b(\d+)\s*wings?\b/) ||
      extractCount(combined, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/);
    if (n) return `${n} wings`;
    return 'wings (1 serving)';
  }

  if (category === 'tender') {
    const n = extractCount(combined, /\b(\d+)\s*(?:pc|pcs|piece|pieces|tenders?)\b/);
    if (n) return `${n} tenders`;
    return 'tenders (1 serving)';
  }

  if (category === 'burger') {
    return '1 sandwich';
  }

  if (category === 'sandwich') {
    return '1 sandwich';
  }

  if (category === 'bowl') return '1 bowl';
  if (category === 'taco') return '1 taco';
  if (category === 'burrito') return '1 burrito';
  if (category === 'quesadilla') return '1 quesadilla';

  if (category === 'fries') {
    return size ? `${titleCaseSize(size)} fries` : 'Medium fries';
  }

  if (category === 'beverage') {
    const oz = extractCount(combined, /\b(\d+)\s*(?:fl\s*)?oz\b/);
    if (oz) return `${oz} fl oz`;
    if (/\bfrosty\b/.test(combined)) return size ? titleCaseSize(size) : '1 medium';
    return size ? titleCaseSize(size) : '1 medium';
  }

  // Legacy keyword paths when category is generic
  if (/\b(frosty|shake|smoothie|latte|mocha|frappuccino|coffee|soda|cola|drink|beverage|lemonade)\b/i.test(combined)) {
    const oz = extractCount(combined, /\b(\d+)\s*(?:fl\s*)?oz\b/);
    if (oz) return `${oz} fl oz`;
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

  // Piece counts only for nugget/wing/tender families.
  if (category === 'nugget' || category === 'wing' || category === 'tender') {
    if (/\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/i.test(low)) {
      const n = extractCount(low, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/);
      if (n && category === 'nugget' && /\bnugget/i.test(low)) return `${n} pc nuggets`;
      if (n && category === 'wing' && /\bwing/i.test(low)) return `${n} wings`;
      if (n && category === 'tender' && /\b(tender|strip)/i.test(low)) return `${n} tenders`;
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

  if (category === 'pizza' || /\bpizza/i.test(low)) {
    if (/\b1\s+slice\b|\bper\s+slice\b|\bone\s+slice\b/i.test(low)) return '1 slice';
    if (/\b(\d+)\s*slices?\b/i.test(low)) {
      const n = extractCount(low, /\b(\d+)\s*slices?\b/);
      if (n) return `${n} slice${n === '1' ? '' : 's'}`;
    }
    if (/\bwhole\s+pizza\b|\bentire\s+pizza\b/i.test(low)) return 'Whole pizza';
  }

  return null;
}

function finalizeServingLabel(label, { userQuery, foodName, restaurant, calories } = {}) {
  let out = normalizeSpace(label);
  const category = inferFoodServingCategory(userQuery, foodName, restaurant);

  if (!out || isWeakServingLabel(out) || servingConflictsWithFood({ userQuery, foodName, restaurant, servingLabel: out })) {
    out =
      servingLabelFromQueryStructure(userQuery, foodName, restaurant, calories) || '1 serving';
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

  const fromStructure = servingLabelFromQueryStructure(userQuery, name, restaurant, calories);
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
  const fromStructure = servingLabelFromQueryStructure(
    opts.userQuery,
    name,
    opts.restaurant,
    opts.calories,
  );
  if (fromStructure) candidates.push(fromStructure);
  return finalizeServingLabel(candidates[0] || '1 serving', {
    ...ctx,
    calories: opts.calories,
  });
}

/** UI line under the food title on search cards — single authority for display. */
function formatServingDisplayLine(item, userQuery = '') {
  const foodName = item?.food_name || item?.name;
  const restaurant = item?.restaurant || item?.brand_name || item?.brand;
  const calories = item?.nf_calories ?? item?.calories;
  const existing = normalizeSpace(
    item?.serving_label || item?.servingLabel || item?.portion_text || '',
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
    scraperLabel: item?.serving_label || item?.servingLabel || item?.portion_text,
    pageText: item?.metadata?.sourceResult?.url || '',
    calories,
  });
  if (resolved && !isWeakServingLabel(resolved)) return resolved;

  const unit = normalizeSpace(item?.serving_unit || item?.servingUnit || '');
  if (
    unit &&
    !isWeakServingLabel(unit) &&
    !/^(grams?|g|ml)$/i.test(unit) &&
    !servingConflictsWithFood({ userQuery, foodName, restaurant, servingLabel: unit })
  ) {
    const qty = item?.serving_size ?? item?.serving_qty ?? 1;
    return qty > 1 ? `${qty} ${unit}` : unit;
  }

  if (item?.source === 'serper' || item?.source === 'mixed') {
    return 'Estimated serving — adjust after adding';
  }

  return resolved || '1 serving';
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
