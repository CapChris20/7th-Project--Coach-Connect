/**
 * Casual restaurant search — users type short queries like:
 *   "mcdonalds big mac", "chick fil a sandwich", "chipotle chicken bowl",
 *   "dominos large pepperoni slice", "starbucks grande latte"
 *
 * Server-side only: enriches Serper + ranking. The user's typed query is unchanged in UI.
 */
const { normalizeQueryText, significantQueryTokens } = require('../food-search/sortBestFoodMatches');
const { servingLabelFromQueryStructure } = require('../food-search/guessServingSize');

const SIZE_WORDS = ['large', 'medium', 'small', 'personal', 'family', 'regular', 'mini', 'grande', 'venti', 'tall'];

const PIZZA_TOPPINGS = [
  'pepperoni', 'cheese', 'sausage', 'mushroom', 'veggie', 'vegetable', 'hawaiian',
  'meat', 'supreme', 'buffalo', 'bbq', 'chicken', 'ham', 'bacon', 'margherita', 'plain',
];

/** Chains users search by name — not an exhaustive directory, covers specs + common US chains. */
const RESTAURANT_CHAINS = [
  { re: /\bmcdonald'?s?\b/i, label: "McDonald's", serper: 'mcdonalds', kind: 'burger' },
  { re: /\bburger\s*king\b/i, label: 'Burger King', serper: 'burger king', kind: 'burger' },
  { re: /\bwendy'?s?\b/i, label: "Wendy's", serper: 'wendys', kind: 'burger' },
  { re: /\bfive\s*guys\b/i, label: 'Five Guys', serper: 'five guys', kind: 'burger' },
  { re: /\bshake\s*shack\b/i, label: 'Shake Shack', serper: 'shake shack', kind: 'burger' },
  { re: /\bin[\s-]?n[\s-]?out\b/i, label: 'In-N-Out', serper: 'in n out', kind: 'burger' },
  { re: /\bwhataburger\b/i, label: 'Whataburger', serper: 'whataburger', kind: 'burger' },
  { re: /\bculver'?s?\b/i, label: "Culver's", serper: 'culvers', kind: 'burger' },
  { re: /\bwhite\s*castle\b/i, label: 'White Castle', serper: 'white castle', kind: 'burger' },
  { re: /\bportillo'?s?\b/i, label: "Portillo's", serper: 'portillos', kind: 'burger' },
  { re: /\bchick[\s-]?fil[\s-]?a\b/i, label: 'Chick-fil-A', serper: 'chick fil a', kind: 'chicken' },
  { re: /\bpopeyes?\b/i, label: 'Popeyes', serper: 'popeyes', kind: 'chicken' },
  { re: /\bkfc\b/i, label: 'KFC', serper: 'kfc', kind: 'chicken' },
  { re: /\braising\s*cane'?s?\b/i, label: "Raising Cane's", serper: 'raising canes', kind: 'chicken' },
  { re: /\bwingstop\b/i, label: 'Wingstop', serper: 'wingstop', kind: 'chicken' },
  { re: /\bbuffalo\s*wild\s*wings?\b|\bbww\b/i, label: 'Buffalo Wild Wings', serper: 'buffalo wild wings', kind: 'chicken' },
  { re: /\bchipotle\b/i, label: 'Chipotle', serper: 'chipotle', kind: 'mexican' },
  { re: /\btaco\s*bell\b/i, label: 'Taco Bell', serper: 'taco bell', kind: 'mexican' },
  { re: /\bqdoba\b/i, label: 'Qdoba', serper: 'qdoba', kind: 'mexican' },
  { re: /\bmoe'?s?\b/i, label: "Moe's", serper: 'moes southwest grill', kind: 'mexican' },
  { re: /\bdel\s*taco\b/i, label: 'Del Taco', serper: 'del taco', kind: 'mexican' },
  { re: /\bdomino'?s?\b/i, label: "Domino's", serper: 'dominos pizza', kind: 'pizza' },
  { re: /\bpizza\s*hut\b/i, label: 'Pizza Hut', serper: 'pizza hut pizza', kind: 'pizza' },
  { re: /\bpapa\s*john'?s?\b/i, label: "Papa John's", serper: 'papa johns pizza', kind: 'pizza' },
  { re: /\blittle\s*caesars?\b/i, label: 'Little Caesars', serper: 'little caesars pizza', kind: 'pizza' },
  { re: /\bjets\s*pizza\b/i, label: "Jet's Pizza", serper: 'jets pizza', kind: 'pizza' },
  { re: /\bmarco'?s?\s*pizza\b/i, label: "Marco's Pizza", serper: 'marcos pizza', kind: 'pizza' },
  { re: /\bhungry\s*howie'?s?\b/i, label: "Hungry Howie's", serper: 'hungry howies pizza', kind: 'pizza' },
  { re: /\bround\s*table\b/i, label: 'Round Table', serper: 'round table pizza', kind: 'pizza' },
  { re: /\bblaze\s*pizza\b/i, label: 'Blaze Pizza', serper: 'blaze pizza', kind: 'pizza' },
  { re: /\bpanera\b/i, label: 'Panera', serper: 'panera bread', kind: 'cafe' },
  { re: /\bstarbucks\b/i, label: 'Starbucks', serper: 'starbucks', kind: 'coffee' },
  { re: /\bdunkin\b/i, label: 'Dunkin', serper: 'dunkin', kind: 'coffee' },
  { re: /\bsubway\b/i, label: 'Subway', serper: 'subway', kind: 'sub' },
  { re: /\bjersey\s*mike'?s?\b/i, label: "Jersey Mike's", serper: 'jersey mikes', kind: 'sub' },
  { re: /\bfirehouse\s*subs?\b/i, label: 'Firehouse Subs', serper: 'firehouse subs', kind: 'sub' },
  { re: /\bjimmy\s*john'?s?\b/i, label: "Jimmy John's", serper: 'jimmy johns', kind: 'sub' },
  { re: /\bwhich\s*wich\b/i, label: 'Which Wich', serper: 'which wich', kind: 'sub' },
  { re: /\bpanda\s*express\b/i, label: 'Panda Express', serper: 'panda express', kind: 'asian' },
  { re: /\bsonic\b/i, label: 'Sonic', serper: 'sonic drive in', kind: 'burger' },
  { re: /\barby'?s?\b/i, label: "Arby's", serper: 'arbys', kind: 'burger' },
  { re: /\bjack\s*in\s*the\s*box\b/i, label: 'Jack in the Box', serper: 'jack in the box', kind: 'burger' },
  { re: /\bcarl'?s?\s*jr\b/i, label: "Carl's Jr", serper: 'carls jr', kind: 'burger' },
  { re: /\bhardee'?s?\b/i, label: "Hardee's", serper: 'hardees', kind: 'burger' },
  { re: /\bdairy\s*queen\b|\bdq\b/i, label: 'Dairy Queen', serper: 'dairy queen', kind: 'dessert' },
  { re: /\bchili'?s?\b/i, label: "Chili's", serper: 'chilis', kind: 'casual' },
  { re: /\bapplebee'?s?\b/i, label: "Applebee's", serper: 'applebees', kind: 'casual' },
  { re: /\bolive\s*garden\b/i, label: 'Olive Garden', serper: 'olive garden', kind: 'casual' },
  { re: /\bcheddar'?s?\b/i, label: "Cheddar's", serper: 'cheddars', kind: 'casual' },
  { re: /\bcracker\s*barrel\b/i, label: 'Cracker Barrel', serper: 'cracker barrel', kind: 'casual' },
  { re: /\bnoodles?\s*(?:&|and)\s*company\b/i, label: 'Noodles & Company', serper: 'noodles and company', kind: 'casual' },
  { re: /\bpei\s*wei\b/i, label: 'Pei Wei', serper: 'pei wei', kind: 'asian' },
  { re: /\bwing\s*stop\b/i, label: 'Wingstop', serper: 'wingstop', kind: 'chicken' },
];

/** When users type the left side casually, also try these Serper phrases. */
const CASUAL_ITEM_ALIASES = [
  { chainRe: /\bchick[\s-]?fil[\s-]?a\b/i, itemRe: /\b(sandwich|chicken)\b/i, serper: ['chick fil a chicken sandwich', 'chick fil a original chicken sandwich'] },
  { chainRe: /\bchipotle\b/i, itemRe: /\b(bowl|burrito|chicken)\b/i, serper: ['chipotle chicken bowl', 'chipotle chicken burrito bowl calories'] },
  { chainRe: /\btaco\s*bell\b/i, itemRe: /\bcrunchwrap\b/i, serper: ['taco bell crunchwrap supreme'] },
  { chainRe: /\btaco\s*bell\b/i, itemRe: /\bcrunchy\s*taco\b/i, serper: ['taco bell crunchy taco beef'] },
  { chainRe: /\bqdoba\b/i, itemRe: /\b(bowl|burrito|chicken)\b/i, serper: ['qdoba chicken burrito bowl'] },
  { chainRe: /\bsubway\b/i, itemRe: /\b(footlong|turkey)\b/i, serper: ['subway footlong turkey breast', 'subway turkey footlong'] },
  { chainRe: /\bjersey\s*mike/i, itemRe: /\bitalian\b/i, serper: ['jersey mikes original italian sub'] },
  { chainRe: /\bstarbucks\b/i, itemRe: /\blatte\b/i, serper: ['starbucks grande caffe latte', 'starbucks grande latte 2% milk calories'] },
  { chainRe: /\bdunkin\b/i, itemRe: /\b(sausage|egg|cheese|croissant)\b/i, serper: ['dunkin sausage egg and cheese croissant'] },
  { chainRe: /\bkfc\b/i, itemRe: /\b(breast|chicken)\b/i, serper: ['kfc original recipe chicken breast'] },
  { chainRe: /\bpopeyes?\b/i, itemRe: /\bsandwich\b/i, serper: ['popeyes chicken sandwich'] },
  { chainRe: /\braising\s*cane/i, itemRe: /\b(finger|combo|box)\b/i, serper: ['raising canes 3 finger combo'] },
  { chainRe: /\bpanda\s*express\b/i, itemRe: /\borange\s*chicken\b/i, serper: ['panda express orange chicken'] },
  { chainRe: /\bmcdonald/i, itemRe: /\bbig\s*mac\b/i, serper: ['mcdonalds big mac'] },
  { chainRe: /\bmcdonald/i, itemRe: /\b(quarter|pounder)\b/i, serper: ['mcdonalds quarter pounder with cheese'] },
  { chainRe: /\bmcdonald/i, itemRe: /\bfries\b/i, serper: ['mcdonalds medium french fries'] },
  { chainRe: /\bwendy/i, itemRe: /\b(frosty|frosty)\b/i, serper: ['wendys large chocolate frosty'] },
  { chainRe: /\bwendy/i, itemRe: /\b(dave|single)\b/i, serper: ['wendys daves single with cheese'] },
  { chainRe: /\bin[\s-]?n[\s-]?out\b/i, itemRe: /\bdouble\b/i, serper: ['in n out double double'] },
  { chainRe: /\bfive\s*guys\b/i, itemRe: /\bcheeseburger\b/i, serper: ['five guys cheeseburger'] },
  { chainRe: /\bshake\s*shack\b/i, itemRe: /\bshackburger\b/i, serper: ['shake shack shackburger'] },
  { chainRe: /\bportillo/i, itemRe: /\bitalian\s*beef\b/i, serper: ['portillos italian beef sandwich'] },
  { chainRe: /\bwhite\s*castle\b/i, itemRe: /\b(slider|cheese)\b/i, serper: ['white castle cheese slider'] },
  { chainRe: /\bjets\s*pizza\b/i, itemRe: /\bcrazy\s*bread\b/i, serper: ['jets pizza crazy bread'] },
  { chainRe: /\blittle\s*caesars?\b/i, itemRe: /\bcrazy\s*bread\b/i, serper: ['little caesars crazy bread', 'little caesars crazy bread nutrition'] },
  { chainRe: /\blittle\s*caesars?\b/i, itemRe: /\bstuffed\s*crazy\s*bread\b/i, serper: ['little caesars stuffed crazy bread'] },
];

const MENU_ITEM_SIGNAL =
  /\b(burger|cheeseburger|sandwich|wrap|bowl|salad|taco|burrito|wing|nugget|combo|meal|latte|mocha|frappuccino|sub|hoagie|slice|fries|frosty|slider|crunchwrap|quesadilla|nachos|pizza|chicken|beef|pork|fish|pasta|bread|biscuit|croissant|burrito|orange|italian|turkey|pepperoni|sausage|cheese|mac|pounder|baconator|whopper|shackburger|blizzard|fingers|breast|thigh|drumstick|tender)\b/i;

const CHAIN_RE_SOURCE = RESTAURANT_CHAINS.map((c) => c.re.source).join('|');
const ANY_CHAIN_RE = new RegExp(CHAIN_RE_SOURCE, 'i');

function escapeRe(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function titleCase(s) {
  return String(s || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function detectRestaurantChain(q) {
  for (const chain of RESTAURANT_CHAINS) {
    if (chain.re.test(q)) return chain;
  }
  return null;
}

function detectSize(q) {
  for (const s of SIZE_WORDS) {
    if (new RegExp(`\\b${escapeRe(s)}\\b`, 'i').test(q)) return s;
  }
  return null;
}

function detectTopping(q) {
  for (const t of PIZZA_TOPPINGS) {
    if (new RegExp(`\\b${escapeRe(t)}\\b`, 'i').test(q)) return t;
  }
  return null;
}

/** Item words left after stripping the chain name from the query. */
function extractItemPhrase(q, chain) {
  let phrase = q;
  if (chain?.re) phrase = phrase.replace(chain.re, ' ');
  phrase = phrase.replace(/\s+/g, ' ').trim();
  return phrase || q;
}

function itemTokens(itemPhrase) {
  return significantQueryTokens(itemPhrase);
}

function matchItemAliases(chain, q, itemPhrase) {
  const out = [];
  for (const row of CASUAL_ITEM_ALIASES) {
    if (!row.chainRe.test(q)) continue;
    if (!row.itemRe.test(itemPhrase) && !row.itemRe.test(q)) continue;
    out.push(...row.serper);
  }
  return out;
}

function buildPizzaSerperQueries(chain, intent) {
  const out = [];
  const top = intent.topping || 'pepperoni';
  const sz = intent.size || 'large';
  const brand = chain.serper;
  out.push(`${brand} ${sz} ${top} slice`);
  out.push(`${brand} ${top} 1 slice calories`);
  out.push(`${brand} medium ${top} slice`);
  if (!intent.hasPizza) out.push(`${chain.label.toLowerCase()} ${sz} ${top} slice`);
  if (!intent.hasSlice) out.push(`${brand} ${sz} ${top} pizza slice`);
  return out;
}

/**
 * Parse casual intent for any chain + short item query.
 */
function parseCasualMenuIntent(userQuery) {
  const q = normalizeQueryText(userQuery);
  const chain = detectRestaurantChain(q);
  const itemPhrase = chain ? extractItemPhrase(q, chain) : q;
  const tokens = itemTokens(itemPhrase);
  const size = detectSize(q);
  const topping = detectTopping(q);
  const hasSlice = /\b(slice|slices)\b/.test(q);
  const hasPizza = /\bpizza\b/.test(q);
  const wholePizza = /\b(whole|entire|full)\s*(pizza)?\b/.test(q);

  const isCasualPizzaSlice =
    chain?.kind === 'pizza'
    && !wholePizza
    && (hasSlice || topping || (hasPizza && !/\b(stick|bread|roll|sauce|dough)\b/.test(q)));

  const hasMenuSignal = MENU_ITEM_SIGNAL.test(itemPhrase) || MENU_ITEM_SIGNAL.test(q);
  const isCasualMenuQuery =
    !!chain && (hasMenuSignal || tokens.length >= 1 || isCasualPizzaSlice);

  return {
    chain,
    kind: chain?.kind || null,
    itemPhrase,
    itemTokens: tokens,
    size,
    topping,
    hasSlice,
    hasPizza,
    wholePizza,
    isCasualPizzaSlice,
    isCasualMenuQuery,
    impliesSingleSlice: isCasualPizzaSlice && (hasSlice || !!topping) && !wholePizza,
    serperAliases: chain ? matchItemAliases(chain, q, itemPhrase) : [],
  };
}

function isCasualPizzaMenuQuery(query) {
  return parseCasualMenuIntent(query).isCasualPizzaSlice;
}

function isCasualMenuQuery(query) {
  return parseCasualMenuIntent(query).isCasualMenuQuery;
}

/**
 * Extra Serper queries for any casual chain search (pizza, burgers, bowls, subs, coffee, etc.).
 */
function buildCasualMenuSerperQueries(userQuery) {
  const intent = parseCasualMenuIntent(userQuery);
  const out = [];
  const seen = new Set();
  const add = (q) => {
    const k = String(q || '').toLowerCase().trim();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(q.trim());
  };

  if (!intent.chain || !intent.isCasualMenuQuery) return out;

  const { chain, itemPhrase, serperAliases } = intent;
  const brand = chain.serper;

  if (itemPhrase) {
    add(`${brand} ${itemPhrase} nutrition calories`);
    add(`${brand} ${itemPhrase} menu nutrition facts`);
  }
  for (const alias of serperAliases) add(alias);

  if (intent.isCasualPizzaSlice) {
    for (const q of buildPizzaSerperQueries(chain, intent)) add(q);
  }

  if (intent.kind === 'coffee' && intent.itemPhrase) {
    add(`${brand} ${intent.size || 'grande'} ${intent.itemPhrase} calories`);
  }
  if (intent.kind === 'sub' && /\b(footlong|sub)\b/i.test(intent.itemPhrase)) {
    add(`${brand} ${intent.itemPhrase.replace(/\bsub\b/i, 'footlong')}`);
  }
  if (intent.kind === 'mexican' && /\bbowl\b/i.test(intent.itemPhrase)) {
    add(`${brand} ${intent.itemPhrase} calories protein`);
  }
  if (intent.kind === 'burger' && intent.itemTokens.length === 1) {
    add(`${brand} ${intent.itemTokens[0]} sandwich calories`);
  }

  return out;
}

/** Friendly card title from casual query — e.g. "Chick-fil-A Sandwich", "Domino's Large Pepperoni Slice". */
function displayNameFromCasualQuery(userQuery) {
  const intent = parseCasualMenuIntent(userQuery);
  if (!intent.chain || !intent.isCasualMenuQuery) return null;

  if (intent.isCasualPizzaSlice) {
    const parts = [intent.chain.label];
    if (intent.size) parts.push(titleCase(intent.size));
    if (intent.topping) parts.push(titleCase(intent.topping));
    parts.push('Pizza Slice');
    return parts.join(' ');
  }

  const item = titleCase(intent.itemPhrase);
  if (!item) return intent.chain.label;
  return `${intent.chain.label} ${item}`;
}

function casualMenuRankingContext(userQuery) {
  const intent = parseCasualMenuIntent(userQuery);
  return {
    ...intent,
    queryTokens: significantQueryTokens(userQuery),
  };
}

module.exports = {
  RESTAURANT_CHAINS,
  PIZZA_TOPPINGS,
  ANY_CHAIN_RE,
  parseCasualMenuIntent,
  isCasualPizzaMenuQuery,
  isCasualMenuQuery,
  buildCasualMenuSerperQueries,
  displayNameFromCasualQuery,
  casualMenuRankingContext,
  servingLabelFromQueryStructure,
};
