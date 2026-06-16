/**
 * Food Brand Display
 *
 * Purpose:
 *   Serving size editor and nutrition facts detail views.
 *   Food Brand Display supports the `nutrition/food-details` feature area — helpers, parsers, or UI pieces used by nearby files.
 *   Logic module with exports: see file for exports.
 * Why it matters: Nutrition tracking — food logs, macros, search, barcode, meal planning. Check who imports this file before refactoring.
 * Area: nutrition/food-details
 * Key exports: see file for exports
 *
 * @file-header
 */

const SOURCE_LABEL_RE =
  /^(via\s+)?(google|serper|duckduckgo|web)\s*search$/i;

const RETAILER_SUFFIX_RE =
  /\s[-–|]\s*(Kroger|Walmart|Target|QFC|Safeway|Albertsons|HEB|ShopRite|Mariano'?s|Smith'?s|Harris Teeter|Instacart|Amazon(?: Fresh)?|Costco|Sam'?s Club)\b.*$/i;

const MANUFACTURER_PARENT_RE =
  /^(General Mills|Kellogg(?:'?s)?|PepsiCo|Nestl[eé]|Unilever|Mondelez|Kraft Heinz|Conagra|Post Consumer Brands|Mars,? Incorporated|The Coca-Cola Company|Campbell(?:'?s)?)\b/i;

/** Consumer-facing brands that should win over parent-company prefixes in titles. */
const KNOWN_CONSUMER_BRANDS = [
  'Ghost',
  'Optimum Nutrition',
  'Dymatize',
  'Quest',
  'Kind',
  'Clif',
  'RXBAR',
  'Premier Protein',
  'Fairlife',
  'Muscle Milk',
  'Orgain',
  'Alani Nu',
  'C4',
  'BSN',
  'Cellucor',
  'Lenny & Larry',
  'Built Bar',
  'One Bar',
  'Pure Protein',
  'Cinnamon Toast Crunch',
  'Cheerios',
  'Lucky Charms',
  'Frosted Flakes',
  'Nature Valley',
  'Fiber One',
];

const RESTAURANT_TWO_WORD =
  /^(Taco Bell|Burger King|Pizza Hut|Dairy Queen|Jack in the Box|In-N-Out|Carl's Jr|Hardee's|Tim Hortons|Popeyes|Chick-fil-A|Raising Cane's|Five Guys|Shake Shack|Red Robin|Olive Garden|Buffalo Wild Wings|Cottage Inn)\b/i;

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripTrademarkSymbols(text) {
  return String(text || '').replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim();
}

/** True when a brand string is really a search-provider label, not a food brand. */
function isSearchSourceLabel(brand) {
  const b = String(brand || '').trim();
  if (!b) return false;
  if (SOURCE_LABEL_RE.test(b)) return true;
  if (/^via\s+/i.test(b)) return true;
  return false;
}

/** Remove store names and trailing junk from retailer search titles. */
function stripRetailerSuffix(title) {
  let t = String(title || '').trim();
  if (!t) return t;
  t = t.split('|')[0].split(' · ')[0].trim();
  t = t.replace(RETAILER_SUFFIX_RE, '').trim();
  t = t.replace(/\s[-–]\s*\d+(?:\.\d+)?\s*(?:oz|lb|g|ml)\b.*$/i, '').trim();
  return t;
}

function titleCaseBrand(label) {
  const raw = stripTrademarkSymbols(String(label || '').trim());
  if (!raw) return '';
  if (raw === raw.toUpperCase() && raw.length <= 6) {
    return raw.charAt(0) + raw.slice(1).toLowerCase();
  }
  return raw
    .split(/\s+/)
    .map((w) => {
      if (!w) return w;
      if (w.length <= 3 && w === w.toUpperCase()) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

/** Clean "GENERAL MILLS, INC." → "General Mills". */
function normalizeBrandLabel(brand) {
  let b = String(brand || '').trim();
  if (!b || isSearchSourceLabel(b)) return '';

  b = b.split(',')[0].trim();
  b = b.replace(/\b(inc|llc|ltd|corp|co)\.?$/i, '').trim();
  b = stripTrademarkSymbols(b);
  b = titleCaseBrand(b);
  return b;
}

/** Open Food Facts often returns "General Mills, Ghost, US". */
function parseMultiBrandField(brands) {
  const raw = String(brands || '').trim();
  if (!raw) return '';

  const parts = raw
    .split(',')
    .map((p) => normalizeBrandLabel(p))
    .filter(Boolean);

  if (!parts.length) return '';

  const consumer = parts.find((p) =>
    KNOWN_CONSUMER_BRANDS.some((known) => p.toLowerCase() === known.toLowerCase()),
  );
  if (consumer) return consumer;

  const nonParent = parts.find((p) => !MANUFACTURER_PARENT_RE.test(p));
  if (nonParent) return nonParent;

  return parts[0];
}

function findKnownConsumerBrand(text) {
  const hay = stripTrademarkSymbols(String(text || ''));
  for (const known of KNOWN_CONSUMER_BRANDS) {
    const re = new RegExp(`\\b${escapeRegExp(stripTrademarkSymbols(known))}\\b`, 'i');
    if (re.test(hay)) return titleCaseBrand(known);
  }
  return '';
}

/** Wendy's, Taco Bell, Ghost, etc. from product titles. */
function inferBrandFromFoodName(foodName) {
  const name = stripRetailerSuffix(foodName);
  if (!name || isSearchSourceLabel(name)) return '';

  const consumer = findKnownConsumerBrand(name);
  if (consumer) return consumer;

  const possessive = name.match(/^([A-Za-z][A-Za-z0-9&\s.'-]*?'s)\b/);
  if (possessive) return titleCaseBrand(possessive[1].trim());

  const two = name.match(RESTAURANT_TWO_WORD);
  if (two) return two[1];

  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && MANUFACTURER_PARENT_RE.test(words[0])) {
    const third = words[2] ? stripTrademarkSymbols(words[2]) : '';
    if (third && /^[A-Za-z]/.test(third) && third.length > 2) {
      return titleCaseBrand(third);
    }
  }

  if (words.length >= 2 && /^[A-Z]/.test(words[0]) && /^[A-Z]/.test(words[1])) {
    const candidate = `${words[0]} ${words[1]}`;
    if (!MANUFACTURER_PARENT_RE.test(candidate)) return titleCaseBrand(candidate);
    return titleCaseBrand(words[0]);
  }

  if (words.length >= 1) {
    const first = stripTrademarkSymbols(words[0]);
    if (/^[A-Z]{2,}$/.test(first)) return titleCaseBrand(first);
    if (/^[A-Z]/.test(first) && first.length > 2) return titleCaseBrand(first);
  }

  return '';
}

/** Strip source labels; infer restaurant/brand from the food title when possible. */
function resolveFoodBrandLabel(foodName, brand) {
  const raw = normalizeBrandLabel(brand);
  if (raw && !isSearchSourceLabel(raw)) {
    if (MANUFACTURER_PARENT_RE.test(raw)) {
      const fromTitle = inferBrandFromFoodName(foodName);
      if (fromTitle && !MANUFACTURER_PARENT_RE.test(fromTitle)) return fromTitle;
    }
    return raw;
  }

  return inferBrandFromFoodName(foodName);
}

/** Barcode / retailer titles — normalize brand and product name together. */
function resolveBarcodeBrand(foodName, explicitBrand) {
  return resolveFoodBrandLabel(stripRetailerSuffix(foodName), explicitBrand);
}

function cleanBarcodeProductTitle(title, barcode) {
  const raw = stripRetailerSuffix(title);
  if (!raw) return `Product ${barcode || ''}`.trim();
  return raw;
}

/** Hide subtitle when it repeats the start of the food name (e.g. Wendy's under Wendy's Frosty). */
function shouldShowFoodBrandSubtitle(foodName, brand) {
  const b = String(brand || '').trim();
  if (!b) return false;
  const n = stripTrademarkSymbols(String(foodName || '').trim()).toLowerCase();
  if (!n) return true;
  const bl = stripTrademarkSymbols(b).toLowerCase();
  if (n === bl) return false;
  if (n.startsWith(`${bl} `) || n.startsWith(`${bl}'`) || n.startsWith(`${bl}-`)) return false;
  return true;
}

function findConsumerBrandInQuery(query) {
  const hit = findKnownConsumerBrand(query);
  return hit || null;
}

module.exports = {
  isSearchSourceLabel,
  stripRetailerSuffix,
  normalizeBrandLabel,
  parseMultiBrandField,
  resolveFoodBrandLabel,
  resolveBarcodeBrand,
  cleanBarcodeProductTitle,
  inferBrandFromFoodName,
  shouldShowFoodBrandSubtitle,
  findConsumerBrandInQuery,
  KNOWN_CONSUMER_BRANDS,
};
