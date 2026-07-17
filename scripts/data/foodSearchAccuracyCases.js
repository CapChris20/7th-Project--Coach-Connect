/**
 * Must-pass + ~100 restaurant food accuracy cases for Coach Connect search.
 * expectedCal / calTolerance used by scripts/testFoodSearchPipelineAccuracy.js
 * Sources: FastFoodNutrition, chain nutrition PDFs, public menu calculators (approx 2024–2026).
 */
function c(id, query, category, opts = {}) {
  return {
    id,
    query,
    category,
    notes: opts.notes || `${category} — confirm serving on official nutrition.`,
    expectedName: opts.expectedName || null,
    expectedCal: opts.expectedCal ?? null,
    calTolerance: opts.calTolerance ?? 0.25,
    mustIncludeTokens: opts.mustIncludeTokens || null,
    forbidTokens: opts.forbidTokens || null,
    forbidServing: opts.forbidServing || null,
    ...(opts.googleHint ? { googleHint: opts.googleHint } : {}),
  };
}

/** High-priority regressions from production screenshots + web research. */
const MUST_PASS_CASES = [
  c('lc-crazy-bread', "Little Caesar's crazy bread", 'sides', {
    expectedName: /crazy\s*bread/i,
    expectedCal: 100,
    calTolerance: 0.35,
    mustIncludeTokens: ['crazy', 'bread'],
    forbidTokens: ['nugget', 'pizza', 'soda', 'pineapple'],
    forbidServing: /nugget/i,
    notes: '1 breadstick ≈ 100 cal (FastFoodNutrition). Full order ≈ 800.',
    googleHint: 'https://fastfoodnutrition.org/little-caesars/crazy-bread',
  }),
  c('crazy-bread-short', 'Crazy Bread', 'sides', {
    expectedName: /crazy\s*bread/i,
    expectedCal: 100,
    calTolerance: 0.4,
    mustIncludeTokens: ['crazy', 'bread'],
    forbidTokens: ['nugget'],
    forbidServing: /nugget/i,
  }),
  c('mcd-big-mac', "McDonald's Big Mac", 'burger', {
    expectedName: /big\s*mac/i,
    expectedCal: 590,
    calTolerance: 0.2,
    mustIncludeTokens: ['big', 'mac'],
    forbidTokens: ['nugget', 'fries'],
  }),
  c('mcd-10-nuggets', "McDonald's 10 piece nuggets", 'chicken', {
    expectedName: /nugget/i,
    expectedCal: 410,
    calTolerance: 0.25,
    mustIncludeTokens: ['nugget'],
    forbidTokens: ['big mac'],
  }),
  c('chipotle-chicken-bowl', 'Chipotle chicken bowl', 'mexican', {
    expectedName: /bowl|chicken/i,
    expectedCal: 720,
    calTolerance: 0.35,
    mustIncludeTokens: ['chicken'],
    forbidTokens: ['taco'],
  }),
  c('bk-whopper', 'Burger King Whopper', 'burger', {
    expectedName: /whopper/i,
    expectedCal: 670,
    calTolerance: 0.2,
  }),
  c('wendys-baconator', "Wendy's Baconator", 'burger', {
    expectedName: /baconator/i,
    expectedCal: 950,
    calTolerance: 0.2,
  }),
  c('cfa-chicken-sandwich', 'Chick-fil-A chicken sandwich', 'chicken', {
    expectedName: /chicken\s*sandwich/i,
    expectedCal: 440,
    calTolerance: 0.25,
  }),
  c('panda-orange-chicken', 'Panda Express orange chicken', 'asian', {
    expectedName: /orange\s*chicken/i,
    expectedCal: 490,
    calTolerance: 0.25,
  }),
  c('starbucks-grande-latte', 'Starbucks grande latte', 'coffee', {
    expectedName: /latte/i,
    expectedCal: 190,
    calTolerance: 0.35,
    forbidTokens: ['keurig', 'ground', 'k-cup'],
  }),
  c('tb-crunchwrap', 'Taco Bell Crunchwrap Supreme', 'mexican', {
    expectedName: /crunchwrap/i,
    expectedCal: 530,
    calTolerance: 0.25,
  }),
  c('subway-turkey-footlong', 'Subway footlong turkey', 'sandwich', {
    expectedName: /turkey/i,
    expectedCal: 560,
    calTolerance: 0.3,
  }),
  c('innout-double-double', 'In-N-Out Double-Double', 'burger', {
    expectedName: /double/i,
    expectedCal: 670,
    calTolerance: 0.2,
  }),
  c('popeyes-chicken-sandwich', 'Popeyes chicken sandwich', 'chicken', {
    expectedName: /chicken\s*sandwich/i,
    expectedCal: 700,
    calTolerance: 0.25,
  }),
  c('dominos-pepperoni-slice', "Domino's pepperoni pizza", 'pizza', {
    expectedName: /pepperoni|pizza/i,
    expectedCal: 300,
    calTolerance: 0.4,
  }),
  c('wendys-small-frosty', "Wendy's small frosty", 'dessert', {
    expectedName: /frosty/i,
    expectedCal: 350,
    calTolerance: 0.35,
  }),
  c('mcd-medium-fries', "McDonald's medium fries", 'sides', {
    expectedName: /fries/i,
    expectedCal: 320,
    calTolerance: 0.25,
  }),
  c('cfa-8-nuggets', 'Chick-fil-A 8 piece nuggets', 'chicken', {
    expectedName: /nugget/i,
    expectedCal: 250,
    calTolerance: 0.3,
  }),
  c('lc-stuffed-crazy-bread', 'Little Caesars stuffed crazy bread', 'sides', {
    expectedName: /stuffed|crazy\s*bread/i,
    expectedCal: 980,
    calTolerance: 0.35,
    mustIncludeTokens: ['crazy', 'bread'],
    forbidServing: /nugget/i,
  }),
  c('wendys-daves-single', "Wendy's Dave's Single", 'burger', {
    expectedName: /dave|single/i,
    expectedCal: 590,
    calTolerance: 0.25,
  }),
];

const BROAD_CASES = [
  // Burgers
  c('smashburger-classic', 'smashburger classic smash', 'burger'),
  c('steak-n-shake-double', 'steak n shake double steakburger', 'burger'),
  c('freddys-steakburger', 'freddys steakburger single', 'burger'),
  c('cookout-cheddar', 'cookout cheddar burger', 'burger'),
  c('habit-charburger', 'habit charburger with cheese', 'burger'),
  c('white-castle-sliders', 'white castle cheese slider', 'burger'),
  c('portillos-italian-beef', 'portillos italian beef sandwich', 'burger'),
  c('five-guys-cheeseburger', 'five guys cheeseburger', 'burger', {
    expectedCal: 840,
    calTolerance: 0.35,
  }),
  c('shake-shack-shackburger', 'shake shack shackburger', 'burger'),
  c('whataburger', 'whataburger whataburger', 'burger'),

  // Sandwiches
  c('jersey-mikes-italian', 'jersey mikes original italian', 'sandwich'),
  c('firehouse-italian', 'firehouse subs italian', 'sandwich'),
  c('jimmy-johns-gargantuan', 'jimmy johns the gargantuan', 'sandwich'),
  c('arbys-roast-beef', 'arbys classic roast beef sandwich', 'sandwich', {
    expectedCal: 360,
    calTolerance: 0.3,
  }),
  c('panera-turkey', 'panera turkey sandwich', 'sandwich'),

  // Pizza
  c('pizza-hut-pepperoni', 'pizza hut pepperoni pizza slice', 'pizza'),
  c('papa-johns-pepperoni', 'papa johns pepperoni pizza slice', 'pizza'),
  c('jets-buffalo-slice', 'jets pizza buffalo chicken pizza slice', 'pizza'),
  c('jets-crazy-bread', 'jets pizza crazy bread', 'sides', {
    expectedName: /crazy\s*bread|breadstick/i,
    forbidTokens: ['nugget'],
  }),
  c('little-caesars-pepperoni', 'little caesars pepperoni pizza slice', 'pizza'),

  // Chicken
  c('kfc-original-breast', 'kfc original recipe chicken breast', 'chicken'),
  c('raising-canes-3-finger', 'raising canes 3 finger combo', 'chicken'),
  c('wingstop-classic-10', 'wingstop classic wings 10 piece', 'chicken'),
  c('bojangles-fillet', 'bojangles cajun chicken fillet biscuit', 'chicken'),
  c('pollo-tropichop', 'pollo tropical tropichop original', 'chicken'),

  // Mexican
  c('taco-bell-crunchy-taco', 'taco bell crunchy taco', 'mexican', {
    expectedCal: 170,
    calTolerance: 0.3,
  }),
  c('qdoba-chicken-bowl', 'qdoba chicken burrito bowl', 'mexican'),
  c('del-taco-chicken-taco', 'del taco grilled chicken soft taco', 'mexican'),
  c('chipotle-steak-burrito', 'chipotle steak burrito', 'mexican'),
  c('chipotle-carnitas-bowl', 'chipotle carnitas bowl', 'mexican'),

  // Coffee
  c('starbucks-pike', 'starbucks grande pike place roast', 'coffee', {
    expectedCal: 5,
    calTolerance: 2,
  }),
  c('dunkin-latte', 'dunkin medium latte', 'coffee'),
  c('starbucks-caramel-macchiato', 'starbucks grande caramel macchiato', 'coffee'),
  c('peets-latte', 'peets coffee medium latte', 'coffee'),

  // Breakfast
  c('mcdonalds-egg-mcmuffin', "mcdonald's egg mcmuffin", 'breakfast', {
    expectedCal: 310,
    calTolerance: 0.25,
  }),
  c('dunkin-sausage-egg', 'dunkin sausage egg and cheese croissant', 'breakfast'),
  c('waffle-house-hash', 'waffle house scattered smothered hash browns', 'breakfast'),
  c('starbucks-bacon-gouda', 'starbucks bacon gouda sandwich', 'breakfast'),

  // Sides / dessert
  c('mcdonalds-apple-pie', "mcdonald's baked apple pie", 'dessert'),
  c('dq-blizzard-oreo', 'dairy queen oreo blizzard medium', 'dessert'),
  c('cold-stone-cake-batter', 'cold stone cake batter ice cream like it', 'dessert'),
  c('popeyes-biscuit', 'popeyes buttermilk biscuit', 'sides'),
  c('chickfila-waffle-fries', 'chick fil a waffle fries medium', 'sides'),

  // Asian
  c('panda-beijing-beef', 'panda express beijing beef', 'asian'),
  c('panda-honey-walnut', 'panda express honey walnut shrimp', 'asian'),
  c('pei-wei-dynamite', 'pei wei dynamite shrimp', 'asian'),
  c('teriyaki-madness-bowl', 'teriyaki madness chicken teriyaki bowl', 'asian'),

  // Seafood / salad / soup
  c('red-lobster-bisque', 'red lobster lobster bisque cup', 'seafood'),
  c('panera-broccoli-cheddar', 'panera broccoli cheddar soup bowl', 'soup'),
  c('chipotle-guac', 'chipotle guacamole side', 'sides'),
  c('subway-tuna-6', 'subway 6 inch tuna', 'sandwich'),

  // More chains
  c('sonic-cheeseburger', 'sonic drive in cheeseburger', 'burger'),
  c('jack-in-the-box-jumbo', 'jack in the box jumbo jack', 'burger'),
  c('carls-jr-famous-star', "carl's jr famous star with cheese", 'burger'),
  c('hardees-thickburger', "hardee's thickburger", 'burger'),
  c('culvers-butterburger', "culver's butterburger", 'burger'),
  c('white-castle-crave', 'white castle crave case', 'burger'),
  c('krispy-kreme-original', 'krispy kreme original glazed doughnut', 'dessert'),
  c('dunkin-glazed', 'dunkin glazed donut', 'dessert'),
  c('starbucks-cake-pop', 'starbucks birthday cake pop', 'dessert'),
  c('mcdonalds-mcflurry-oreo', "mcdonald's oreo mcflurry", 'dessert'),
  c('wendys-spicy-chicken', "wendy's spicy chicken sandwich", 'chicken'),
  c('bk-chicken-fries', 'burger king chicken fries', 'chicken'),
  c('taco-bell-bean-burrito', 'taco bell bean burrito', 'mexican'),
  c('chipotle-sofritas-bowl', 'chipotle sofritas bowl', 'mexican'),
  c('dominos-garlic-bread', "domino's garlic bread twists", 'sides'),
  c('pizza-hut-breadsticks', 'pizza hut breadsticks', 'sides'),
  c('olive-garden-breadstick', 'olive garden breadstick', 'sides', {
    expectedCal: 140,
    calTolerance: 0.3,
  }),
  c('applebees-wings', 'applebees boneless wings', 'chicken'),
  c('buffalo-wild-wings-10', 'buffalo wild wings traditional wings 10', 'chicken'),
  c('chilis-queso', 'chilis skillet queso', 'mexican'),
  c('outback-bloom', 'outback bloomin onion', 'sides'),
  c('red-lobster-cheddar-bay', 'red lobster cheddar bay biscuit', 'sides'),
  c('ihop-pancake', 'ihop buttermilk pancake', 'breakfast'),
  c('dennys-grand-slam', 'dennys classic grand slam', 'breakfast'),
  c('starbucks-frappuccino', 'starbucks grande caramel frappuccino', 'coffee'),
  c('dutch-bros-rebel', 'dutch bros rebel medium', 'coffee'),
  c('tim-hortons-double-double', 'tim hortons double double medium', 'coffee'),
  c('jamba-smoothie', 'jamba juice strawberry whirl', 'coffee'),
  c('smoothie-king-angel', 'smoothie king angel food', 'coffee'),
];

const FOOD_SEARCH_ACCURACY_CASES = [...MUST_PASS_CASES, ...BROAD_CASES];

if (FOOD_SEARCH_ACCURACY_CASES.length < 100) {
  throw new Error(`Expected at least 100 food search cases, got ${FOOD_SEARCH_ACCURACY_CASES.length}`);
}

module.exports = {
  FOOD_SEARCH_ACCURACY_CASES,
  MUST_PASS_CASES,
};
