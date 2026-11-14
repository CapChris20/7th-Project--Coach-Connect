// Turn casual restaurant searches ("mcdonalds big mac") into extra Serper queries + a friendly title.
// Flow: detect chain → leftover item words → aliases / pizza-slice phrases → ranking context.
// Used only on the server. The user's typed query in the UI is never rewritten.
// Read order: constants → mains → PLUMBING (chain tables + regex helpers).

const { normalizeQueryText, significantQueryTokens } = require('../food-search/rankFoodResults');
const { servingLabelFromQueryStructure } = require('../food-search/guessServingLabel');

// ===== NAMED CONSTANTS =====

const SIZE_WORDS = [
  'large',
  'medium',
  'small',
  'personal',
  'family',
  'regular',
  'mini',
  'grande',
  'venti',
  'tall',
];
const DEFAULT_PIZZA_TOPPING = 'pepperoni';
const DEFAULT_PIZZA_SIZE = 'large';
const DEFAULT_COFFEE_SIZE = 'grande';
const PIZZA_KIND = 'pizza';
const COFFEE_KIND = 'coffee';
const SUB_KIND = 'sub';
const MEXICAN_KIND = 'mexican';
const BURGER_KIND = 'burger';

const PIZZA_TOPPINGS = [
  'pepperoni',
  'cheese',
  'sausage',
  'mushroom',
  'veggie',
  'vegetable',
  'hawaiian',
  'meat',
  'supreme',
  'buffalo',
  'bbq',
  'chicken',
  'ham',
  'bacon',
  'margherita',
  'plain',
];

const MENU_ITEM_SIGNAL =
  /\b(burger|cheeseburger|sandwich|wrap|bowl|salad|taco|burrito|wing|nugget|combo|meal|latte|mocha|frappuccino|sub|hoagie|slice|fries|frosty|slider|crunchwrap|quesadilla|nachos|pizza|chicken|beef|pork|fish|pasta|bread|biscuit|croissant|burrito|orange|italian|turkey|pepperoni|sausage|cheese|mac|pounder|baconator|whopper|shackburger|blizzard|fingers|breast|thigh|drumstick|tender)\b/i;

// ===== HELPER FUNCTIONS =====

/** Chains users search by name — covers specs + common US chains; not exhaustive. */
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
  // jets / jet's alone — users type "Jets bread", not always "Jets pizza"
  { re: /\bjets\b|\bjet'?s\b/i, label: "Jet's Pizza", serper: 'jets pizza', kind: 'pizza' },
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
  { chainRe: /\bjets\b|\bjet'?s\b/i, itemRe: /\b(crazy\s*)?bread(sticks?)?\b/i, serper: ['jets pizza breadsticks', 'jets pizza bread nutrition'] },
  { chainRe: /\blittle\s*caesars?\b/i, itemRe: /\bcrazy\s*bread\b/i, serper: ['little caesars crazy bread', 'little caesars crazy bread nutrition'] },
  { chainRe: /\blittle\s*caesars?\b/i, itemRe: /\bstuffed\s*crazy\s*bread\b/i, serper: ['little caesars stuffed crazy bread'] },
];

const CHAIN_RE_SOURCE = RESTAURANT_CHAINS.map((chain) => chain.re.source).join('|');
const ANY_CHAIN_RE = new RegExp(CHAIN_RE_SOURCE, 'i');

function escapeRegexSpecialChars(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordBoundaryRegex(word) {
  return new RegExp(`\\b${escapeRegexSpecialChars(word)}\\b`, 'i');
}

function titleCase(text) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const titled = [];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    titled.push(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }
  return titled.join(' ');
}

function firstMatchingListItem(queryText, words) {
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (wordBoundaryRegex(word).test(queryText)) return word;
  }
  return null;
}

function detectRestaurantChain(queryText) {
  for (let index = 0; index < RESTAURANT_CHAINS.length; index += 1) {
    const chain = RESTAURANT_CHAINS[index];
    if (chain.re.test(queryText)) return chain;
  }
  return null;
}

function detectSize(queryText) {
  return firstMatchingListItem(queryText, SIZE_WORDS);
}

function detectTopping(queryText) {
  return firstMatchingListItem(queryText, PIZZA_TOPPINGS);
}

/** Item words left after stripping the chain name from the query. */
function extractItemPhrase(queryText, chain) {
  let phrase = queryText;
  if (chain?.re) phrase = phrase.replace(chain.re, ' ');
  phrase = phrase.replace(/\s+/g, ' ').trim();
  if (phrase) return phrase;
  return queryText;
}

function itemTokensFromPhrase(itemPhrase) {
  return significantQueryTokens(itemPhrase);
}

function aliasRowMatches(aliasRow, queryText, itemPhrase) {
  if (!aliasRow.chainRe.test(queryText)) return false;
  if (aliasRow.itemRe.test(itemPhrase)) return true;
  if (aliasRow.itemRe.test(queryText)) return true;
  return false;
}

function matchItemAliases(chain, queryText, itemPhrase) {
  void chain;
  const aliases = [];
  for (let index = 0; index < CASUAL_ITEM_ALIASES.length; index += 1) {
    const aliasRow = CASUAL_ITEM_ALIASES[index];
    if (!aliasRowMatches(aliasRow, queryText, itemPhrase)) continue;
    for (let aliasIndex = 0; aliasIndex < aliasRow.serper.length; aliasIndex += 1) {
      aliases.push(aliasRow.serper[aliasIndex]);
    }
  }
  return aliases;
}

function buildPizzaSerperQueries(chain, intent) {
  const topping = intent.topping || DEFAULT_PIZZA_TOPPING;
  const size = intent.size || DEFAULT_PIZZA_SIZE;
  const brandSerperName = chain.serper;
  const queries = [
    `${brandSerperName} ${size} ${topping} slice`,
    `${brandSerperName} ${topping} 1 slice calories`,
    `${brandSerperName} medium ${topping} slice`,
  ];
  if (!intent.hasPizza) {
    queries.push(`${chain.label.toLowerCase()} ${size} ${topping} slice`);
  }
  if (!intent.hasSlice) {
    queries.push(`${brandSerperName} ${size} ${topping} pizza slice`);
  }
  return queries;
}

function isCasualPizzaSliceIntent({
  chain,
  wholePizza,
  hasSlice,
  topping,
  hasPizza,
  queryText,
}) {
  if (chain?.kind !== PIZZA_KIND) return false;
  if (wholePizza) return false;
  if (hasSlice || topping) return true;
  if (!hasPizza) return false;
  return !/\b(stick|bread|roll|sauce|dough)\b/.test(queryText);
}

function uniqueQueryCollector() {
  const out = [];
  const seenLowerKeys = new Set();

  const addQuery = (queryText) => {
    const key = String(queryText || '').toLowerCase().trim();
    if (!key) return;
    if (seenLowerKeys.has(key)) return;
    seenLowerKeys.add(key);
    out.push(queryText.trim());
  };

  return { out, addQuery };
}

function addKindSpecificSerperQueries(intent, addQuery) {
  const brandSerperName = intent.chain.serper;

  if (intent.kind === COFFEE_KIND && intent.itemPhrase) {
    addQuery(
      `${brandSerperName} ${intent.size || DEFAULT_COFFEE_SIZE} ${intent.itemPhrase} calories`,
    );
  }

  if (intent.kind === SUB_KIND && /\b(footlong|sub)\b/i.test(intent.itemPhrase)) {
    addQuery(`${brandSerperName} ${intent.itemPhrase.replace(/\bsub\b/i, 'footlong')}`);
  }

  if (intent.kind === MEXICAN_KIND && /\bbowl\b/i.test(intent.itemPhrase)) {
    addQuery(`${brandSerperName} ${intent.itemPhrase} calories protein`);
  }

  if (intent.kind === BURGER_KIND && intent.itemTokens.length === 1) {
    addQuery(`${brandSerperName} ${intent.itemTokens[0]} sandwich calories`);
  }
}

function pizzaSliceDisplayName(intent) {
  const parts = [intent.chain.label];
  if (intent.size) parts.push(titleCase(intent.size));
  if (intent.topping) parts.push(titleCase(intent.topping));
  parts.push('Pizza Slice');
  return parts.join(' ');
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

// ===== MAIN FUNCTION =====

/**
 * Parse casual intent for any chain + short item query.
 * Return keys stay stable for ranking: chain, kind, itemPhrase, itemTokens, size, topping, flags, serperAliases.
 * Flow: 1. normalize + chain  2. item phrase  3. size/topping flags  4. aliases + return
 * @param {string} userQuery
 * @returns {object}
 */
function parseCasualMenuIntent(userQuery) {
  // 1. Normalize the typed text and detect a known chain.
  const queryText = normalizeQueryText(userQuery);
  const chain = detectRestaurantChain(queryText);

  // 2. Leftover words after the chain name = the menu item.
  let itemPhrase = queryText;
  if (chain) {
    itemPhrase = extractItemPhrase(queryText, chain);
  }

  // 3. Size / topping / pizza flags for ranking.
  const tokens = itemTokensFromPhrase(itemPhrase);
  const size = detectSize(queryText);
  const topping = detectTopping(queryText);
  const hasSlice = /\b(slice|slices)\b/.test(queryText);
  const hasPizza = /\bpizza\b/.test(queryText);
  const wholePizza = /\b(whole|entire|full)\s*(pizza)?\b/.test(queryText);

  const isCasualPizzaSlice = isCasualPizzaSliceIntent({
    chain,
    wholePizza,
    hasSlice,
    topping,
    hasPizza,
    queryText,
  });

  // 4. Casual menu query = chain + some menu signal (or pizza-slice shorthand).
  const hasMenuSignal =
    MENU_ITEM_SIGNAL.test(itemPhrase) || MENU_ITEM_SIGNAL.test(queryText);
  let isCasualMenuQuery = false;
  if (chain) {
    if (hasMenuSignal || tokens.length >= 1 || isCasualPizzaSlice) {
      isCasualMenuQuery = true;
    }
  }

  let kind = null;
  if (chain) kind = chain.kind;

  let impliesSingleSlice = false;
  if (isCasualPizzaSlice && !wholePizza) {
    if (hasSlice || topping) impliesSingleSlice = true;
  }

  let serperAliases = [];
  if (chain) {
    serperAliases = matchItemAliases(chain, queryText, itemPhrase);
  }

  return {
    chain,
    kind,
    itemPhrase,
    itemTokens: tokens,
    size,
    topping,
    hasSlice,
    hasPizza,
    wholePizza,
    isCasualPizzaSlice,
    isCasualMenuQuery,
    impliesSingleSlice,
    serperAliases,
  };
}

/**
 * True when the typed text is a casual pizza-slice ask (not whole pie / breadsticks).
 * @param {string} query
 * @returns {boolean}
 */
function isCasualPizzaMenuQuery(query) {
  return parseCasualMenuIntent(query).isCasualPizzaSlice;
}

/**
 * True when the typed text looks like chain + menu item (burgers, bowls, subs, …).
 * @param {string} query
 * @returns {boolean}
 */
function isCasualMenuQuery(query) {
  return parseCasualMenuIntent(query).isCasualMenuQuery;
}

/**
 * Extra Serper queries for any casual chain search (pizza, burgers, bowls, subs, coffee, etc.).
 * Flow: 1. parse intent  2. brand + item phrases  3. aliases / pizza / kind extras
 * @param {string} userQuery
 * @returns {string[]}
 */
function buildCasualMenuSerperQueries(userQuery) {
  // 1. Need a known chain that looks like a casual menu ask.
  const intent = parseCasualMenuIntent(userQuery);
  const { out: uniqueQueries, addQuery } = uniqueQueryCollector();
  if (!intent.chain || !intent.isCasualMenuQuery) return uniqueQueries;

  // 2. Brand + leftover item words (nutrition / menu facts phrasing).
  const chain = intent.chain;
  const itemPhrase = intent.itemPhrase;
  const serperAliases = intent.serperAliases;
  const brandSerperName = chain.serper;

  if (itemPhrase) {
    addQuery(`${brandSerperName} ${itemPhrase} nutrition calories`);
    addQuery(`${brandSerperName} ${itemPhrase} menu nutrition facts`);
  }

  // 3. Casual aliases + pizza-slice expansions + kind-specific extras.
  for (let index = 0; index < serperAliases.length; index += 1) {
    addQuery(serperAliases[index]);
  }

  if (intent.isCasualPizzaSlice) {
    const pizzaQueries = buildPizzaSerperQueries(chain, intent);
    for (let index = 0; index < pizzaQueries.length; index += 1) {
      addQuery(pizzaQueries[index]);
    }
  }

  addKindSpecificSerperQueries(intent, addQuery);
  return uniqueQueries;
}

/**
 * Friendly card title from casual query — e.g. "Chick-fil-A Sandwich", "Domino's Large Pepperoni Slice".
 * @param {string} userQuery
 * @returns {string|null}
 */
function displayNameFromCasualQuery(userQuery) {
  const intent = parseCasualMenuIntent(userQuery);
  if (!intent.chain || !intent.isCasualMenuQuery) return null;
  if (intent.isCasualPizzaSlice) return pizzaSliceDisplayName(intent);

  const itemTitle = titleCase(intent.itemPhrase);
  if (!itemTitle) return intent.chain.label;
  return `${intent.chain.label} ${itemTitle}`;
}

/**
 * Ranking context for server search — intent fields plus query tokens.
 * @param {string} userQuery
 * @returns {object}
 */
function casualMenuRankingContext(userQuery) {
  const intent = parseCasualMenuIntent(userQuery);
  return {
    ...intent,
    queryTokens: significantQueryTokens(userQuery),
  };
}

