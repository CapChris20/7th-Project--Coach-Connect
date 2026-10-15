// Curated restaurant cards (Big Mac, Crazy Bread) so famous items beat junk web hits.
// Flow: score the typed text against each catalog row → keep the best matches → return search cards.
// Used by food search as the first trusted hit. CommonJS so the food tests can require() it.

const { normalizeQueryText, significantQueryTokens, countTokenHits } = require('./rankFoodResults');

// ===== NAMED CONSTANTS =====

const CHERRY_COKE_SODIUM_MG = 60;
const BIG_MAC_CALORIES = 590;
const MCNUGGETS_10_CALORIES = 410;
const MCNUGGETS_10_PROTEIN_G = 24;
const MCNUGGETS_10_FAT_G = 24;
const DAVES_SINGLE_CALORIES = 590;
const CHICK_FIL_A_SANDWICH_CALORIES = 440;
const CRUNCHWRAP_CALORIES = 530;
const ORANGE_CHICKEN_CALORIES = 490;
const SUBWAY_TURKEY_CALORIES = 560;
const LATTE_FAT_G = 7;
const FROSTY_CARBS_G = 60;

const REGEX_MATCH_SCORE = 50;
const EXACT_ALIAS_SCORE = 100;
const PARTIAL_ALIAS_SCORE = 40;
const TOKEN_HIT_SCORE = 8;
const MIN_KEEP_SCORE = 40;
const DEFAULT_LOOKUP_LIMIT = 3;
const MIN_TOKEN_HITS_FOR_BONUS = 2;

/** @typedef {{ name: string, brand: string, calories: number, protein: number, carbs: number, fat: number, serving_label: string, match: RegExp, aliases?: string[] }} TrustedFood */

/** @type {TrustedFood[]} */
const TRUSTED_FOODS = [
  {
    name: 'Cherry Coke',
    brand: 'Coca-Cola',
    calories: 260,
    protein: 0,
    carbs: 70,
    fat: 0,
    sugar: 70,
    sodium: CHERRY_COKE_SODIUM_MG,
    fiber: 0,
    serving_label: '1 bottle (20 fl oz)',
    match: /\bcherry\s*(coke|cola)\b.*\b20\s*(fl\s*)?oz\b|\b20\s*(fl\s*)?oz\b.*\bcherry\s*(coke|cola)\b/i,
    aliases: [
      'cherry coke 20oz',
      'cherry coke 20 oz',
      'cherry coke 20 fl oz',
      'cherry cola 20oz',
      'coca cola cherry 20oz',
      'coca-cola cherry 20 oz',
    ],
  },
  {
    name: 'Garlic Parmesan Cheese Sticks',
    brand: "Papa John's",
    calories: 340,
    protein: 8,
    carbs: 54,
    fat: 10,
    sugar: 4,
    sodium: 720,
    fiber: 2,
    serving_label: '2 cheese sticks',
    match: /\bpapa\b.*\b(garlic\s*)?(parmesan\s*)?(cheese\s*)?sticks?\b|\bgarlic\s+parmesan\s+(cheese\s*)?sticks?\b/i,
    aliases: [
      'papa johns cheese sticks',
      "papa john's cheese sticks",
      'papa johns garlic parmesan cheese sticks',
      'garlic parmesan cheese sticks',
      'papa johns garlic breadsticks',
    ],
  },
  {
    name: 'Garlic Parmesan Breadstick',
    brand: "Papa John's",
    calories: 170,
    protein: 4,
    carbs: 27,
    fat: 5,
    sugar: 2,
    sodium: 360,
    fiber: 1,
    serving_label: '1 breadstick',
    match: /\bpapa\b.*\bgarlic\s+parmesan\s+breadsticks?\b|\bgarlic\s+parmesan\s+breadsticks?\b/i,
    aliases: [
      'papa johns garlic parmesan breadstick',
      "papa john's garlic parmesan breadstick",
      'garlic parmesan breadstick without dipping sauce',
      'papa johns garlic parmesan breadstick without dipping',
    ],
  },
  {
    name: 'Cheese Pizza',
    brand: "Domino's",
    calories: 290,
    protein: 11,
    carbs: 36,
    fat: 10,
    serving_label: '1 slice (large hand tossed)',
    match: /\bdomino'?s?\b.*\b(large\s*)?cheese\s*pizza\b|\b(large\s*)?cheese\s*pizza\b.*\bdomino/i,
    aliases: [
      'dominos large cheese pizza',
      "domino's large cheese pizza",
      'dominos cheese pizza',
      "domino's cheese pizza",
      'large cheese pizza dominos',
    ],
  },
  {
    name: 'Crazy Bread',
    brand: 'Little Caesars',
    calories: 100,
    protein: 3,
    carbs: 16,
    fat: 3,
    serving_label: '1 breadstick',
    match: /\bcrazy\s*bread\b/i,
    aliases: ['little caesars crazy bread', 'little caesar crazy bread', 'crazy bread'],
  },
  {
    name: 'Stuffed Crazy Bread',
    brand: 'Little Caesars',
    calories: 980,
    protein: 36,
    carbs: 126,
    fat: 38,
    serving_label: '3-piece order with sauce',
    match: /\bstuffed\s*crazy\s*bread\b/i,
    aliases: ['stuffed crazy bread', 'little caesars stuffed crazy bread'],
  },
  {
    name: 'Big Mac',
    brand: "McDonald's",
    calories: BIG_MAC_CALORIES,
    protein: 25,
    carbs: 46,
    fat: 34,
    serving_label: '1 sandwich',
    match: /\bbig\s*mac\b/i,
    aliases: ["mcdonald's big mac", 'mcdonalds big mac', 'big mac'],
  },
  {
    name: 'Chicken McNuggets',
    brand: "McDonald's",
    calories: MCNUGGETS_10_CALORIES,
    protein: MCNUGGETS_10_PROTEIN_G,
    carbs: 26,
    fat: MCNUGGETS_10_FAT_G,
    serving_label: '10 pc nuggets',
    match: /\b(10|ten)\s*(pc|piece|pieces)?\s*(chicken\s*)?(mc)?nuggets?\b/i,
    aliases: ['10 piece mcnuggets', '10pc mcnuggets', "mcdonald's 10 piece nuggets"],
  },
  {
    name: 'Chicken McNuggets',
    brand: "McDonald's",
    calories: 830,
    protein: 47,
    carbs: 51,
    fat: 49,
    serving_label: '20 pc nuggets',
    match: /\b(20|twenty)\s*(pc|piece|pieces)?\s*(chicken\s*)?(mc)?nuggets?\b/i,
    aliases: ['20 piece mcnuggets', '20pc mcnuggets'],
  },
  {
    name: 'Chicken Bowl',
    brand: 'Chipotle',
    calories: 720,
    protein: 47,
    carbs: 72,
    fat: 25,
    serving_label: '1 bowl (typical build)',
    match: /\bchipotle\b.*\bchicken\b.*\bbowl\b|\bchicken\b.*\bbowl\b.*\bchipotle\b/i,
    aliases: ['chipotle chicken bowl', 'chipotle chicken burrito bowl'],
  },
  {
    name: 'Whopper',
    brand: 'Burger King',
    calories: 670,
    protein: 31,
    carbs: 51,
    fat: 39,
    serving_label: '1 sandwich',
    match: /\bwhopper\b/i,
    aliases: ['burger king whopper', 'bk whopper'],
  },
  {
    name: "Dave's Single",
    brand: "Wendy's",
    calories: DAVES_SINGLE_CALORIES,
    protein: 30,
    carbs: 39,
    fat: 34,
    serving_label: '1 sandwich',
    match: /\bdave'?s?\s*single\b/i,
    aliases: ["wendy's dave's single", 'wendys daves single'],
  },
  {
    name: 'Baconator',
    brand: "Wendy's",
    calories: 950,
    protein: 58,
    carbs: 38,
    fat: 64,
    serving_label: '1 sandwich',
    match: /\bbaconator\b/i,
    aliases: ["wendy's baconator", 'wendys baconator'],
  },
  {
    name: 'Original Chicken Sandwich',
    brand: 'Chick-fil-A',
    calories: CHICK_FIL_A_SANDWICH_CALORIES,
    protein: 29,
    carbs: 41,
    fat: 18,
    serving_label: '1 sandwich',
    match: /\bchick[\s-]?fil[\s-]?a\b.*\b(original\s*)?chicken\s*sandwich\b|\boriginal\s*chicken\s*sandwich\b/i,
    aliases: ['chick fil a chicken sandwich', 'chick-fil-a original chicken sandwich'],
  },
  {
    name: 'Nuggets',
    brand: 'Chick-fil-A',
    calories: 250,
    protein: 27,
    carbs: 11,
    fat: 11,
    serving_label: '8 pc nuggets',
    match: /\bchick[\s-]?fil[\s-]?a\b.*\b(8|eight)\s*(pc|piece)?\s*nuggets?\b/i,
    aliases: ['chick fil a 8 piece nuggets', 'chick-fil-a 8pc nuggets'],
  },
  {
    name: 'Crunchwrap Supreme',
    brand: 'Taco Bell',
    calories: CRUNCHWRAP_CALORIES,
    protein: 16,
    carbs: 71,
    fat: 21,
    serving_label: '1 item',
    match: /\bcrunchwrap\b/i,
    aliases: ['taco bell crunchwrap supreme', 'crunchwrap supreme'],
  },
  {
    name: 'Orange Chicken',
    brand: 'Panda Express',
    calories: ORANGE_CHICKEN_CALORIES,
    protein: 25,
    carbs: 51,
    fat: 23,
    serving_label: '1 serving (entree)',
    match: /\borange\s*chicken\b/i,
    aliases: ['panda express orange chicken', 'panda orange chicken'],
  },
  {
    name: 'Footlong Turkey Breast',
    brand: 'Subway',
    calories: SUBWAY_TURKEY_CALORIES,
    protein: 36,
    carbs: 92,
    fat: 8,
    serving_label: '1 footlong',
    match: /\bsubway\b.*\b(footlong\s*)?turkey\b|\bturkey\s*breast\b.*\bfootlong\b/i,
    aliases: ['subway footlong turkey', 'subway turkey breast footlong'],
  },
  {
    name: 'Caffè Latte',
    brand: 'Starbucks',
    calories: 190,
    protein: 13,
    carbs: 18,
    fat: LATTE_FAT_G,
    serving_label: 'Grande',
    match: /\bstarbucks\b.*\b(grande\s*)?latte\b|\bgrande\s+latte\b/i,
    aliases: ['starbucks grande latte', 'starbucks latte'],
  },
  {
    name: 'Frosty',
    brand: "Wendy's",
    calories: 350,
    protein: 9,
    carbs: FROSTY_CARBS_G,
    fat: 9,
    serving_label: 'Small',
    match: /\b(small\s+)?frosty\b/i,
    aliases: ["wendy's small frosty", 'wendys frosty small'],
  },
  {
    name: 'Pepperoni Pizza',
    brand: "Domino's",
    calories: 300,
    protein: 12,
    carbs: 32,
    fat: 13,
    serving_label: '1 slice (medium hand tossed)',
    match: /\bdomino'?s?\b.*\bpepperoni\b|\bpepperoni\b.*\bdomino/i,
    aliases: ["domino's pepperoni pizza", 'dominos pepperoni slice'],
  },
  {
    name: 'French Fries',
    brand: "McDonald's",
    calories: 320,
    protein: 5,
    carbs: 43,
    fat: 15,
    serving_label: 'Medium fries',
    match: /\bmcdonald'?s?\b.*\b(medium\s*)?fries\b|\bmedium\s+(french\s*)?fries\b/i,
    aliases: ["mcdonald's medium fries", 'mcdonalds french fries medium'],
  },
  {
    name: 'Double-Double',
    brand: 'In-N-Out',
    calories: 670,
    protein: 37,
    carbs: 41,
    fat: 41,
    serving_label: '1 sandwich',
    match: /\bdouble[\s-]*double\b/i,
    aliases: ['in n out double double', 'innout double double'],
  },
  {
    name: 'Chicken Sandwich',
    brand: 'Popeyes',
    calories: 700,
    protein: 28,
    carbs: 50,
    fat: 42,
    serving_label: '1 sandwich',
    match: /\bpopeyes?\b.*\bchicken\s*sandwich\b/i,
    aliases: ['popeyes chicken sandwich'],
  },
];

// ===== HELPER FUNCTIONS =====

function catalogKey(query) {
  return normalizeQueryText(query);
}

function scoreAliasMatch(typedKey, alias) {
  const aliasKey = catalogKey(alias);
  if (typedKey === aliasKey) return EXACT_ALIAS_SCORE;
  if (typedKey.includes(aliasKey) || aliasKey.includes(typedKey)) return PARTIAL_ALIAS_SCORE;
  return 0;
}

function scoreTrustedFoodMatch(food, typedText, typedKey) {
  let score = 0;
  if (food.match.test(typedText)) score += REGEX_MATCH_SCORE;
  for (const alias of food.aliases || []) {
    score += scoreAliasMatch(typedKey, alias);
  }
  const tokens = significantQueryTokens(`${food.brand} ${food.name}`);
  const hits = countTokenHits(typedText, tokens);
  if (hits >= Math.min(MIN_TOKEN_HITS_FOR_BONUS, tokens.length)) score += hits * TOKEN_HIT_SCORE;
  return score;
}

function foodCatalogKey(food) {
  return `${food.brand}|${food.name}|${food.serving_label}`;
}

function pickBestTrustedFoods(scored, limit) {
  const out = [];
  const seen = new Set();
  for (const { food, score } of scored) {
    if (score < MIN_KEEP_SCORE) continue;
    const key = foodCatalogKey(food);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(food);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * @param {TrustedFood} food
 * @param {string} query
 * @returns {object}
 */
function toSearchRow(food, query) {
  const id = `trusted_${catalogKey(food.name + '_' + food.brand).replace(/\s+/g, '_')}`;
  return {
    id,
    name: food.name,
    food_name: food.name,
    brand: food.brand,
    brand_name: food.brand,
    restaurant: food.brand,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    sugar: food.sugar ?? null,
    sodium: food.sodium ?? null,
    fiber: food.fiber ?? null,
    nf_calories: food.calories,
    nf_protein: food.protein,
    nf_total_carbohydrate: food.carbs,
    nf_total_fat: food.fat,
    nf_sugars: food.sugar ?? null,
    serving_label: food.serving_label,
    servingLabel: food.serving_label,
    serving_unit: food.serving_label,
    portion_text: food.serving_label,
    servingSize: 1,
    servingGrams: 100,
    source: 'trusted_catalog',
    source_subtitle: 'via trusted catalog',
    nutrition_unverified: false,
    metadata: {
      source: 'trusted_catalog',
      matchedQuery: query,
    },
  };
}

// ===== MAIN FUNCTION =====

/**
 * Find curated foods that match the user query. Most specific match first.
 * @param {string} query
 * @param {number} [limit]
 * @returns {object[]} zero or more search rows (usually 1)
 */
function lookupTrustedFoods(query, limit = DEFAULT_LOOKUP_LIMIT) {
  const typedText = String(query || '').trim();
  if (!typedText) return [];
  const typedKey = catalogKey(typedText);
  const scored = [];

  for (const food of TRUSTED_FOODS) {
    const score = scoreTrustedFoodMatch(food, typedText, typedKey);
    if (score > 0) scored.push({ food, score });
  }

  scored.sort((left, right) => right.score - left.score);
  const matchedFoods = pickBestTrustedFoods(scored, limit);
  const out = [];
  for (const food of matchedFoods) {
    out.push(toSearchRow(food, typedText));
  }
  return out;
}

module.exports = {
  TRUSTED_FOODS,
  lookupTrustedFoods,
  toSearchRow,
};
