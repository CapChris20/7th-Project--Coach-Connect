// Curated restaurant cards (Big Mac, Crazy Bread, Starbucks latte, …) so famous items beat junk web hits.
// Flow: score the typed text against each catalog row → keep the best matches → return search cards.
// Used by food search as a trusted seed / never-blank fallback. CommonJS so the food tests can require() it.

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
    name: 'Pepperoni Pizza',
    brand: "Papa John's",
    calories: 300,
    protein: 12,
    carbs: 34,
    fat: 13,
    serving_label: '1 slice (large original)',
    match: /\bpapa\b.*\bpepperoni\b|\bpepperoni\b.*\bpapa\b/i,
    aliases: [
      "papa john's pepperoni pizza",
      'papa johns pepperoni pizza',
      "papa john's pepperoni",
      'papa johns pepperoni slice',
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
    calories: 170,
    protein: 9,
    carbs: 10,
    fat: 10,
    serving_label: '4 pc nuggets',
    match: /\b(4|four)\s*(pc|piece|pieces)?\s*(chicken\s*)?(mc)?(nuggets?|nuggs?|nugs?)\b|\b(mc)?(nuggets?|nuggs?|nugs?)\b.*\b(4|four)\b/i,
    aliases: [
      '4 piece mcnuggets',
      '4pc mcnuggets',
      "mcdonald's 4 piece nuggets",
      'mcdonalds 4 piece nuggets',
      "mcdonald's 4 nuggs",
      'mcdonalds 4 nuggs',
      '4 nuggs',
      '4 nugs',
      '4 piece nuggs',
      '4pc nuggs',
      '4 mcnuggets',
      '4 mcnuggs',
    ],
  },
  {
    name: 'Chicken McNuggets',
    brand: "McDonald's",
    calories: 250,
    protein: 14,
    carbs: 15,
    fat: 15,
    serving_label: '6 pc nuggets',
    match: /\b(6|six)\s*(pc|piece|pieces)?\s*(chicken\s*)?(mc)?(nuggets?|nuggs?|nugs?)\b|\b(mc)?(nuggets?|nuggs?|nugs?)\b.*\b(6|six)\b/i,
    aliases: [
      '6 piece mcnuggets',
      '6pc mcnuggets',
      "mcdonald's 6 piece nuggets",
      'mcdonalds 6 piece nuggets',
      "mcdonald's 6 nuggs",
      'mcdonalds 6 nuggs',
      '6 nuggs',
      '6 nugs',
      '6 piece nuggs',
      '6pc nuggs',
      '6 mcnuggets',
      '6 mcnuggs',
    ],
  },
  {
    name: 'Chicken McNuggets',
    brand: "McDonald's",
    calories: MCNUGGETS_10_CALORIES,
    protein: MCNUGGETS_10_PROTEIN_G,
    carbs: 26,
    fat: MCNUGGETS_10_FAT_G,
    serving_label: '10 pc nuggets',
    // Default size when the query names McNuggets but no piece count (4/6/20 stay on their own rows).
    // Manipulate here: do not add a catch-all that steals "20pc" / "4pc" queries.
    match: /\b(10|ten)\s*(pc|piece|pieces)?\s*(chicken\s*)?(mc)?(nuggets?|nuggs?|nugs?)\b|\b(mc)?(nuggets?|nuggs?|nugs?)\b.*\b(10|ten)\b|(?!.*\b(?:4|6|20|four|six|twenty)\b).*\b(?:chicken\s*)?(?:mc)?(?:nuggets?|nuggs?|nugs?)\b/i,
    aliases: [
      '10 piece mcnuggets',
      '10pc mcnuggets',
      "mcdonald's 10 piece nuggets",
      'mcdonalds 10 piece nuggets',
      "mcdonald's 10 nuggs",
      'mcdonalds 10 nuggs',
      '10 nuggs',
      '10 nugs',
      '10 piece nuggs',
      '10pc nuggs',
      '10 mcnuggets',
      '10 mcnuggs',
      'chicken mcnuggets',
      'mcnuggets',
      'mcdonalds mcnuggets',
      "mcdonald's mcnuggets",
      'mcdonalds nuggets',
      "mcdonald's nuggets",
      'mcdonalds nuggs',
      "mcdonald's nuggs",
    ],
  },
  {
    name: 'Chicken McNuggets',
    brand: "McDonald's",
    calories: 830,
    protein: 47,
    carbs: 51,
    fat: 49,
    serving_label: '20 pc nuggets',
    match: /\b(20|twenty)\s*(pc|piece|pieces)?\s*(chicken\s*)?(mc)?(nuggets?|nuggs?|nugs?)\b|\b(mc)?(nuggets?|nuggs?|nugs?)\b.*\b(20|twenty)\b/i,
    aliases: [
      '20 piece mcnuggets',
      '20pc mcnuggets',
      "mcdonald's 20 piece nuggets",
      'mcdonalds 20 piece nuggets',
      "mcdonald's 20 nuggs",
      'mcdonalds 20 nuggs',
      '20 nuggs',
      '20 nugs',
      '20 piece nuggs',
      '20pc nuggs',
      '20 mcnuggets',
      '20 mcnuggs',
    ],
  },
  {
    name: 'Crispy Chicken Nuggets',
    brand: "Wendy's",
    calories: 420,
    protein: 22,
    carbs: 23,
    fat: 27,
    serving_label: '10 pc nuggets',
    match: /\bwendy'?s?\b.*\b(10|ten)\s*(pc|piece|pieces)?\s*(chicken\s*)?(nuggets?|nuggs?|nugs?)\b|\b(10|ten)\s*(pc|piece|pieces)?\s*(chicken\s*)?(nuggets?|nuggs?|nugs?)\b.*\bwendy'?s?\b/i,
    aliases: [
      'wendys 10 piece nuggets',
      "wendy's 10 piece nuggets",
      'wendys 10 nuggs',
      "wendy's 10 nuggs",
      '10 piece wendys nuggets',
      'wendys 10 nugs',
      "wendy's 10 nugs",
    ],
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
    match: /\bchick[\s-]?fil[\s-]?a\b.*\b(8|eight)\s*(pc|piece)?\s*(nuggets?|nuggs?|nugs?)\b|\b(8|eight)\s*(pc|piece)?\s*(nuggets?|nuggs?|nugs?)\b.*\bchick[\s-]?fil[\s-]?a\b/i,
    aliases: [
      'chick fil a 8 piece nuggets',
      'chick-fil-a 8pc nuggets',
      'chick fil a 8 nuggs',
      'chick fil a 8 nugs',
      'chick fil a nuggets',
      'chick fil a nuggs',
    ],
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
    name: 'Turkey Breast Sandwich',
    brand: 'Subway',
    calories: 280,
    protein: 18,
    carbs: 46,
    fat: 3.5,
    serving_label: '6-inch',
    match: /\bsubway\b.*\b(6[\s-]*inch|six[\s-]*inch)\b.*\bturkey\b|\bsubway\b.*\bturkey\b(?!.*\b(footlong|12[\s-]*inch)\b)/i,
    aliases: [
      'subway turkey breast sandwich',
      'subway turkey sandwich',
      'subway turkey breast',
      'subway 6 inch turkey',
      'subway six inch turkey breast',
    ],
  },
  {
    name: 'Footlong Turkey Breast',
    brand: 'Subway',
    calories: SUBWAY_TURKEY_CALORIES,
    protein: 36,
    carbs: 92,
    fat: 8,
    serving_label: '1 footlong',
    match: /\bsubway\b.*\b(footlong|12[\s-]*inch)\b.*\bturkey\b|\bturkey\s*breast\b.*\b(footlong|12[\s-]*inch)\b/i,
    aliases: [
      'subway footlong turkey',
      'subway turkey breast footlong',
      'subway footlong turkey breast sandwich',
      'subway 12 inch turkey',
    ],
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
    aliases: [
      'starbucks grande latte',
      'starbucks latte',
      'starbucks caffe latte',
      'starbucks café latte',
      'grande caffe latte starbucks',
    ],
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
  // --- Expanded US chain catalog (B): common searches that used to wait on scrapers ---
  {
    name: 'Cheese Pizza',
    brand: 'Pizza Hut',
    calories: 230,
    protein: 10,
    carbs: 26,
    fat: 9,
    serving_label: '1 slice (medium pan)',
    match: /\bpizza\s*hut\b.*\bcheese\b|\bcheese\b.*\bpizza\s*hut\b/i,
    aliases: ['pizza hut cheese pizza', 'pizza hut cheese pizza slice', 'pizza hut cheese slice'],
  },
  {
    name: 'Crunchy Taco',
    brand: 'Taco Bell',
    calories: 170,
    protein: 8,
    carbs: 13,
    fat: 9,
    serving_label: '1 taco',
    match: /\btaco\s*bell\b.*\bcrunchy\s*taco\b|\bcrunchy\s*taco\b/i,
    aliases: ['taco bell crunchy taco', 'taco bell hard shell taco', 'taco bell taco'],
  },
  {
    name: 'Cheeseburger',
    brand: 'Five Guys',
    calories: 840,
    protein: 47,
    carbs: 40,
    fat: 55,
    serving_label: '1 burger (regular)',
    match: /\bfive\s*guys\b.*\bcheeseburger\b|\bcheeseburger\b.*\bfive\s*guys\b/i,
    aliases: ['five guys cheeseburger', 'five guys cheese burger'],
  },
  {
    name: 'Original Recipe Chicken Breast',
    brand: 'KFC',
    calories: 390,
    protein: 39,
    carbs: 11,
    fat: 21,
    serving_label: '1 piece',
    match: /\bkfc\b.*\b(original\s*)?(recipe\s*)?chicken\s*breast\b|\boriginal\s*recipe\s*chicken\s*breast\b/i,
    aliases: [
      'kfc original recipe chicken breast',
      'kfc chicken breast',
      'kfc original chicken breast',
    ],
  },
  {
    name: 'Chow Mein',
    brand: 'Panda Express',
    calories: 510,
    protein: 13,
    carbs: 80,
    fat: 16,
    serving_label: '1 serving (side)',
    match: /\bpanda\b.*\bchow\s*mein\b|\bchow\s*mein\b.*\bpanda\b/i,
    aliases: ['panda express chow mein', 'panda chow mein'],
  },
  {
    name: 'Iced Coffee',
    brand: 'Dunkin',
    calories: 15,
    protein: 1,
    carbs: 3,
    fat: 0,
    serving_label: 'Medium (black)',
    match: /\bdunkin'?\b.*\b(medium\s*)?iced\s*coffee\b|\biced\s*coffee\b.*\bdunkin/i,
    aliases: [
      'dunkin medium iced coffee',
      "dunkin' medium iced coffee",
      'dunkin iced coffee',
      'dunkin donuts iced coffee',
    ],
  },
  {
    name: 'Fettuccine Alfredo',
    brand: 'Olive Garden',
    calories: 1310,
    protein: 45,
    carbs: 98,
    fat: 81,
    serving_label: '1 dinner entree',
    match: /\bolive\s*garden\b.*\bfettuccine\s*alfredo\b|\bfettuccine\s*alfredo\b.*\bolive\s*garden\b/i,
    aliases: ['olive garden fettuccine alfredo', 'olive garden alfredo'],
  },
  {
    name: 'Original Cheesecake',
    brand: 'The Cheesecake Factory',
    calories: 830,
    protein: 13,
    carbs: 68,
    fat: 56,
    serving_label: '1 slice',
    match: /\bcheesecake\s*factory\b.*\b(original\s*)?cheesecake\b|\boriginal\s*cheesecake\b/i,
    aliases: [
      'cheesecake factory original cheesecake',
      'cheesecake factory cheesecake',
      'original cheesecake factory',
    ],
  },
  {
    name: 'Plain Wings',
    brand: 'Wingstop',
    calories: 80,
    protein: 8,
    carbs: 0,
    fat: 5,
    serving_label: '1 classic wing',
    match: /\bwingstop\b.*\b(plain\s*)?wings?\b|\bplain\s*wings?\b.*\bwingstop\b/i,
    aliases: ['wingstop plain wings', 'wingstop wings', 'wingstop classic wings'],
  },
  {
    name: 'Traditional Wings',
    brand: 'Buffalo Wild Wings',
    calories: 100,
    protein: 9,
    carbs: 0,
    fat: 7,
    serving_label: '1 traditional wing (plain)',
    match: /\b(buffalo\s*wild\s*wings|bww)\b.*\b(traditional\s*)?wings?\b|\btraditional\s*wings?\b.*\b(buffalo|bww)\b/i,
    aliases: [
      'buffalo wild wings traditional wings',
      'buffalo wild wings wings',
      'bww traditional wings',
      'bww plain wings',
    ],
  },
  {
    name: 'Caramel Macchiato',
    brand: 'Starbucks',
    calories: 250,
    protein: 10,
    carbs: 37,
    fat: 7,
    serving_label: 'Grande',
    match: /\bstarbucks\b.*\bcaramel\s*macchiato\b|\bcaramel\s*macchiato\b/i,
    aliases: ['starbucks grande caramel macchiato', 'starbucks caramel macchiato'],
  },
  {
    name: 'Cold Brew',
    brand: 'Starbucks',
    calories: 5,
    protein: 0,
    carbs: 0,
    fat: 0,
    serving_label: 'Grande',
    match: /\bstarbucks\b.*\bcold\s*brew\b|\bcold\s*brew\b.*\bstarbucks\b/i,
    aliases: ['starbucks cold brew', 'starbucks grande cold brew'],
  },
  {
    name: 'Quarter Pounder with Cheese',
    brand: "McDonald's",
    calories: 520,
    protein: 30,
    carbs: 42,
    fat: 26,
    serving_label: '1 sandwich',
    match: /\bquarter\s*pounder\b/i,
    aliases: [
      "mcdonald's quarter pounder",
      'mcdonalds quarter pounder with cheese',
      'quarter pounder with cheese',
    ],
  },
  {
    name: 'Chicken Fingers',
    brand: "Raising Cane's",
    calories: 600,
    protein: 62,
    carbs: 18,
    fat: 30,
    serving_label: '3-finger combo (fingers only)',
    match: /\b(raising\s*)?cane'?s?\b.*\b(chicken\s*)?(fingers?|tenders?)\b|\bcane'?s?\b.*\bbox\s*combo\b/i,
    aliases: [
      "raising cane's chicken fingers",
      'raising canes chicken fingers',
      "cane's chicken fingers",
      "raising cane's box combo",
    ],
  },
  {
    name: 'ShackBurger',
    brand: 'Shake Shack',
    calories: 500,
    protein: 28,
    carbs: 38,
    fat: 29,
    serving_label: '1 single',
    match: /\bshack\s*burger\b|\bshake\s*shack\b.*\bburger\b/i,
    aliases: ['shake shack shackburger', 'shake shack burger', 'shackburger'],
  },
  {
    name: 'Classic Roast Beef',
    brand: "Arby's",
    calories: 360,
    protein: 23,
    carbs: 37,
    fat: 14,
    serving_label: '1 sandwich',
    match: /\barbys?\b.*\b(classic\s*)?roast\s*beef\b|\broast\s*beef\b.*\barbys?\b/i,
    aliases: ["arby's roast beef", 'arbys classic roast beef', "arby's classic roast beef"],
  },
  {
    name: 'Broccoli Cheddar Soup',
    brand: 'Panera Bread',
    calories: 360,
    protein: 13,
    carbs: 30,
    fat: 21,
    serving_label: '1 bowl',
    match: /\bpanera\b.*\bbroccoli\s*(cheddar|cheese)\b|\bbroccoli\s*(cheddar|cheese)\s*soup\b.*\bpanera\b/i,
    aliases: [
      'panera broccoli cheddar',
      'panera broccoli cheddar soup',
      'panera broccoli cheese soup bowl',
    ],
  },
  {
    name: 'ButterBurger',
    brand: "Culver's",
    calories: 460,
    protein: 24,
    carbs: 39,
    fat: 24,
    serving_label: '1 single with cheese',
    match: /\bculver'?s?\b.*\bbutter\s*burger\b|\bbutter\s*burger\b.*\bculver/i,
    aliases: ["culver's butterburger", 'culvers butter burger', "culver's single butterburger"],
  },
  {
    name: 'Number One Combo Burger',
    brand: 'Whataburger',
    calories: 590,
    protein: 29,
    carbs: 62,
    fat: 25,
    serving_label: '1 burger (patty only macros approx)',
    match: /\bwhataburger\b.*\b(number\s*one|#\s*1|burger)\b/i,
    aliases: ['whataburger number one', 'whataburger #1', 'whataburger burger'],
  },
  {
    name: 'Spicy Chicken Sandwich',
    brand: "Wendy's",
    calories: 500,
    protein: 30,
    carbs: 42,
    fat: 23,
    serving_label: '1 sandwich',
    match: /\bwendy'?s?\b.*\bspicy\s*chicken\b|\bspicy\s*chicken\s*sandwich\b.*\bwendy/i,
    aliases: ["wendy's spicy chicken sandwich", 'wendys spicy chicken'],
  },
  {
    name: 'Vanilla Ice Cream',
    brand: 'Häagen-Dazs',
    calories: 250,
    protein: 5,
    carbs: 21,
    fat: 17,
    serving_label: '2/3 cup',
    match: /\bh[aä]agen[\s-]*dazs\b.*\bvanilla\b|\bhaagen\s*dazs\b.*\bvanilla\b/i,
    aliases: [
      'haagen dazs vanilla',
      'häagen-dazs vanilla ice cream',
      'haagen-dazs vanilla ice cream',
    ],
  },
  {
    name: 'Chocolate Fudge Brownie',
    brand: "Ben & Jerry's",
    calories: 280,
    protein: 4,
    carbs: 33,
    fat: 15,
    serving_label: '2/3 cup',
    match: /\bben\s*(and|&)\s*jerry'?s?\b.*\b(chocolate\s*)?fudge\s*brownie\b|\bchocolate\s*fudge\s*brownie\b/i,
    aliases: [
      'ben and jerry chocolate fudge brownie',
      "ben & jerry's chocolate fudge brownie",
      'ben jerrys fudge brownie',
    ],
  },
  {
    name: 'Chocolate Ice Cream',
    brand: 'Baskin-Robbins',
    calories: 170,
    protein: 3,
    carbs: 19,
    fat: 10,
    serving_label: '2.5 oz scoop',
    match: /\bbaskin[\s-]*robbins?\b.*\bchocolate\b|\bchocolate\s*ice\s*cream\b.*\bbaskin/i,
    aliases: [
      'baskin robbins chocolate ice cream',
      'baskin-robbins chocolate',
      'baskin robbins chocolate',
    ],
  },
  {
    name: 'Bean Burrito',
    brand: 'Taco Bell',
    calories: 380,
    protein: 13,
    carbs: 55,
    fat: 11,
    serving_label: '1 burrito',
    match: /\btaco\s*bell\b.*\bbean\s*burrito\b|\bbean\s*burrito\b.*\btaco\s*bell\b/i,
    aliases: ['taco bell bean burrito'],
  },
  {
    name: 'Chicken Sandwich',
    brand: 'Sonic Drive-In',
    calories: 630,
    protein: 30,
    carbs: 55,
    fat: 32,
    serving_label: '1 sandwich',
    match: /\bsonic\b.*\bchicken\s*sandwich\b/i,
    aliases: ['sonic chicken sandwich'],
  },
  {
    name: 'Hook & Ladder',
    brand: 'Firehouse Subs',
    calories: 700,
    protein: 46,
    carbs: 77,
    fat: 22,
    serving_label: 'Medium sub',
    match: /\bfirehouse\b.*\bhook\b|\bhook\s*(and|&)\s*ladder\b/i,
    aliases: ['firehouse hook and ladder', 'firehouse hook & ladder', 'hook and ladder firehouse'],
  },
  {
    name: 'Turkey & Provolone',
    brand: "Jersey Mike's",
    calories: 770,
    protein: 48,
    carbs: 77,
    fat: 29,
    serving_label: 'Regular sub',
    match: /\bjersey\s*mike'?s?\b.*\bturkey\b|\bturkey\s*(and|&)\s*provolone\b.*\bjersey\b/i,
    aliases: [
      "jersey mike's turkey and provolone",
      'jersey mikes turkey provolone',
      'jersey mikes turkey',
    ],
  },
  {
    name: 'Hot Chicken Bowl',
    brand: 'Cava',
    calories: 675,
    protein: 42,
    carbs: 58,
    fat: 30,
    serving_label: '1 bowl (typical build)',
    match: /\bcava\b.*\b(hot\s*)?chicken\b.*\bbowl\b|\bcava\b.*\bbowl\b/i,
    aliases: ['cava chicken bowl', 'cava hot chicken bowl', 'cava bowl'],
  },
  {
    name: 'Harvest Bowl',
    brand: 'Sweetgreen',
    calories: 620,
    protein: 27,
    carbs: 65,
    fat: 28,
    serving_label: '1 bowl',
    match: /\bsweetgreen\b.*\bharvest\b|\bharvest\s*bowl\b.*\bsweetgreen\b|\bsweetgreen\b.*\bbowl\b/i,
    aliases: ['sweetgreen harvest bowl', 'sweetgreen bowl'],
  },
  {
    name: 'Mongolian Beef',
    brand: "P.F. Chang's",
    calories: 480,
    protein: 32,
    carbs: 40,
    fat: 22,
    serving_label: '1 serving (lunch)',
    match: /\b(p\.?\s*f\.?\s*)?chang'?s?\b.*\bmongol/i,
    aliases: [
      'pf chang mongolia beef',
      "p.f. chang's mongolian beef",
      'pf changs mongolian beef',
    ],
  },
  {
    name: 'Chicken Lettuce Wraps',
    brand: "P.F. Chang's",
    calories: 340,
    protein: 22,
    carbs: 25,
    fat: 17,
    serving_label: '1 order (appetizer)',
    match: /\b(p\.?\s*f\.?\s*)?chang'?s?\b.*\blettuce\s*wrap/i,
    aliases: [
      'pf chang chicken lettuce wraps',
      "p.f. chang's chicken lettuce wraps",
      'pf changs lettuce wraps',
    ],
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

/** Piece counts that must not cross-match other McNugget size rows via short aliases. */
const NUGGET_SIZE_TOKEN_RE = /\b(4|6|10|20|four|six|ten|twenty)\b/i;

function aliasConflictsWithSizedQuery(typedText, alias) {
  const queryHasSize = NUGGET_SIZE_TOKEN_RE.test(typedText);
  const aliasHasSize = NUGGET_SIZE_TOKEN_RE.test(alias);
  if (!queryHasSize) return false;
  // "mcnuggets" must not beat "20pc mcnuggets" just because it is a substring.
  if (!aliasHasSize && /\b(mc)?nuggets?\b/i.test(alias)) return true;
  if (aliasHasSize) {
    const querySize = typedText.match(NUGGET_SIZE_TOKEN_RE)?.[1];
    const aliasSize = alias.match(NUGGET_SIZE_TOKEN_RE)?.[1];
    if (querySize && aliasSize && catalogKey(querySize) !== catalogKey(aliasSize)) return true;
  }
  return false;
}

function scoreTrustedFoodMatch(food, typedText, typedKey) {
  let score = 0;
  if (food.match.test(typedText)) score += REGEX_MATCH_SCORE;
  for (const alias of food.aliases || []) {
    if (aliasConflictsWithSizedQuery(typedText, alias)) continue;
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
