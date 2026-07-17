/**
 * Trusted curated catalog for high-traffic restaurant searches.
 * Used as an authoritative first hit so Serper junk cannot crowd out famous items.
 *
 * Macros sourced from public chain nutrition pages / FastFoodNutrition (approx 2024–2026).
 * Ranges are intentional — restaurant formulas change; we store a representative serving.
 */

const { normalizeQueryText, significantQueryTokens, countTokenHits } = require('./sortBestFoodMatches');

/** @typedef {{ name: string, brand: string, calories: number, protein: number, carbs: number, fat: number, serving_label: string, match: RegExp, aliases?: string[] }} TrustedFood */

/** @type {TrustedFood[]} */
const TRUSTED_FOODS = [
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
    calories: 590,
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
    calories: 410,
    protein: 24,
    carbs: 26,
    fat: 24,
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
    calories: 590,
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
    calories: 440,
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
    calories: 530,
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
    calories: 490,
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
    calories: 560,
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
    fat: 7,
    serving_label: 'Grande',
    match: /\bstarbucks\b.*\b(grande\s*)?latte\b|\bgrande\s+latte\b/i,
    aliases: ['starbucks grande latte', 'starbucks latte'],
  },
  {
    name: 'Frosty',
    brand: "Wendy's",
    calories: 350,
    protein: 9,
    carbs: 60,
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

function catalogKey(query) {
  return normalizeQueryText(query);
}

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
    nf_calories: food.calories,
    nf_protein: food.protein,
    nf_total_carbohydrate: food.carbs,
    nf_total_fat: food.fat,
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

/**
 * Find curated foods that match the user query. Most specific match first.
 * @returns {object[]} zero or more search rows (usually 1)
 */
function lookupTrustedFoods(query, limit = 3) {
  const q = String(query || '').trim();
  if (!q) return [];
  const qNorm = catalogKey(q);
  const scored = [];

  for (const food of TRUSTED_FOODS) {
    let score = 0;
    if (food.match.test(q)) score += 50;
    for (const alias of food.aliases || []) {
      const a = catalogKey(alias);
      if (qNorm === a) score += 100;
      else if (qNorm.includes(a) || a.includes(qNorm)) score += 40;
    }
    const tokens = significantQueryTokens(`${food.brand} ${food.name}`);
    const hits = countTokenHits(q, tokens);
    if (hits >= Math.min(2, tokens.length)) score += hits * 8;
    if (score > 0) scored.push({ food, score });
  }

  scored.sort((a, b) => b.score - a.score);
  // Prefer stuffed crazy bread over plain when query says stuffed
  const out = [];
  const seen = new Set();
  for (const { food, score } of scored) {
    if (score < 40) continue;
    const key = `${food.brand}|${food.name}|${food.serving_label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(toSearchRow(food, q));
    if (out.length >= limit) break;
  }
  return out;
}

module.exports = {
  TRUSTED_FOODS,
  lookupTrustedFoods,
  toSearchRow,
};
