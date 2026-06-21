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

/**
 * Infer a serving line from the user's query + food name (no scraper data).
 */
function servingLabelFromQueryStructure(userQuery, foodName = '', restaurant = '') {
  const combined = normalizeSpace(`${userQuery} ${foodName} ${restaurant}`).toLowerCase();
  if (!combined || combined.length < 2) return null;

  const size = extractCount(combined, /\b(small|medium|large|grande|venti|tall|regular)\b/);

  if (/\b(mcnugget|mc\s*nugget|chicken\s*nugget|nugget)/i.test(combined)) {
    const n =
      extractCount(combined, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/) ||
      extractCount(combined, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\s*(?:chicken\s*)?nugget/);
    if (n) return `${n} pc nuggets`;
    return '1 serving';
  }

  if (/\bpizza\b/i.test(combined)) {
    if (/\b(whole|entire|full)\s+(pizza)?\b/i.test(combined)) return 'Whole pizza';
    if (/\bhalf\s+(a\s+)?pizza\b/i.test(combined)) return 'Half pizza';
    const slices = extractCount(combined, /\b(\d+)\s*slices?\b/);
    if (slices) return `${slices} slice${slices === '1' ? '' : 's'}`;
    if (/\bslice\b/i.test(combined)) return '1 slice';
    return '1 slice';
  }

  if (/\b(wing|wings)\b/i.test(combined)) {
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

  if (
    /\b(bread|breadstick|cheesy\s+bread|garlic\s+bread|roll|biscuit|croissant|bagel|muffin)\b/i.test(
      combined,
    ) &&
    !/\bpizza\b/i.test(combined)
  ) {
    return '1 piece';
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
function extractServingLabelFromPageText(text) {
  const s = normalizeSpace(String(text || '').replace(/\u00a0/g, ' '));
  if (s.length < 8) return null;
  const low = s.toLowerCase();

  let m = s.match(/serving\s+size[:\s]+([^\n.;]{3,90})/i);
  if (m) {
    const line = normalizeSpace(m[1]);
    if (!isWeakServingLabel(line)) return line;
  }

  m = s.match(/there are\s+[^.]{0,40}?\bper\s+([^.(]{3,60})/i);
  if (m && !isWeakServingLabel(m[1])) return normalizeSpace(m[1]);

  if (/\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/i.test(low) && /\bnugget/i.test(low)) {
    const n = extractCount(low, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/);
    if (n) return `${n} pc nuggets`;
  }

  if (/\b1\s+slice\b|\bper\s+slice\b|\bone\s+slice\b/i.test(low) && /\bpizza|slice/i.test(low)) {
    return '1 slice';
  }

  if (/\b(\d+)\s*slices?\b/i.test(low) && /\bpizza/i.test(low)) {
    const n = extractCount(low, /\b(\d+)\s*slices?\b/);
    if (n) return `${n} slice${n === '1' ? '' : 's'}`;
  }

  if (/\bwhole\s+pizza\b|\bentire\s+pizza\b/i.test(low)) return 'Whole pizza';

  if (/\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/i.test(low)) {
    const n = extractCount(low, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/);
    if (n && /\bnugget|wing|tender|strip/i.test(low)) {
      const kind = /\bwing/i.test(low) ? 'wings' : /\bnugget/i.test(low) ? 'nuggets' : 'pieces';
      return `${n} pc ${kind}`;
    }
  }

  return null;
}

/**
 * Best serving label for a search row — scraper > page text > food name > query.
 */
function resolveFoodServingLabel({
  userQuery = '',
  foodName = '',
  restaurant = '',
  scraperLabel = null,
  displayName = '',
  pageText = '',
} = {}) {
  const candidates = [];

  for (const raw of [scraperLabel, extractServingLabelFromPageText(pageText)]) {
    const label = normalizeSpace(raw);
    if (label && !isWeakServingLabel(label)) candidates.push(label);
  }

  const fromStructure = servingLabelFromQueryStructure(
    userQuery,
    foodName || displayName,
    restaurant,
  );
  if (fromStructure) candidates.push(fromStructure);

  if (candidates.length > 0) return candidates[0];
  return '1 serving';
}

/** UI line under the food title on search cards. */
function formatServingDisplayLine(item, userQuery = '') {
  const existing = normalizeSpace(
    item?.portion_text || item?.serving_label || item?.servingLabel || '',
  );
  if (existing && !isWeakServingLabel(existing)) return existing;

  const resolved = resolveFoodServingLabel({
    userQuery,
    foodName: item?.food_name || item?.name,
    restaurant: item?.restaurant || item?.brand_name || item?.brand,
    scraperLabel: item?.serving_label || item?.servingLabel,
    pageText: item?.metadata?.sourceResult?.url || '',
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
  formatServingDisplayLine,
};
