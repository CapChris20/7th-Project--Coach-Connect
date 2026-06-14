/**
 * 100 distinct US restaurant menu searches for scripts/testFoodSearchAccuracy.js
 * Each id/query is a different chain + item (no duplicate foods).
 */
function c(id, query, category, googleHint = '') {
  return {
    id,
    query,
    category,
    notes: `${category} — confirm serving size on Google / official nutrition.`,
    ...(googleHint ? { googleHint } : {}),
  };
}

const FOOD_SEARCH_ACCURACY_CASES = [
  // Burgers (12)
  c('smashburger-classic', 'smashburger classic smash', 'burger'),
  c('steak-n-shake-double', 'steak n shake double steakburger', 'burger'),
  c('freddys-steakburger', 'freddys steakburger single', 'burger'),
  c('cookout-cheddar', 'cookout cheddar burger', 'burger'),
  c('habit-charburger', 'habit charburger with cheese', 'burger'),
  c('fatburger-kingburger', 'fatburger kingburger', 'burger'),
  c('rallys-big-buford', 'rallys big buford', 'burger'),
  c('checkers-baconzilla', 'checkers baconzilla', 'burger'),
  c('white-castle-sliders', 'white castle cheese slider 4 pack', 'burger'),
  c('krystal-steamed', 'krystal steamed cheeseburger', 'burger'),
  c('portillos-italian-beef', 'portillos italian beef sandwich', 'burger'),
  c('applebees-classic-burger', 'applebees classic burger', 'burger'),

  // Sandwiches & subs (10)
  c('wawa-italian-hoagie', 'wawa italian hoagie shorti', 'sandwich'),
  c('schlotzskys-original', 'schlotzskys small original sandwich', 'sandwich'),
  c('quiznos-turkey-guac', 'quiznos turkey bacon guacamole sub', 'sandwich'),
  c('blimpie-turkey-sub', 'blimpie turkey sub 6 inch', 'sandwich'),
  c('mcalisters-club', 'mcalisters club sandwich', 'sandwich'),
  c('einstein-lox-bagel', 'einstein bros nova lox sandwich', 'sandwich'),
  c('corner-bakery-turkey', 'corner bakery cafe turkey harvest sandwich', 'sandwich'),
  c('pret-chicken-avocado', 'pret a manger chicken avocado sandwich', 'sandwich'),
  c('capriottis-bobbie', 'capriottis the bobbie sandwich', 'sandwich'),
  c('potbelly-mushroom', 'potbelly mushroom melt original', 'sandwich'),

  // Pizza (10)
  c('round-table-personal', 'round table personal pepperoni pizza', 'pizza'),
  c('cpk-bbq-chicken-slice', 'california pizza kitchen bbq chicken pizza slice', 'pizza'),
  c('donatos-pepperoni-thin', 'donatos pepperoni thin crust pizza slice', 'pizza'),
  c('godfathers-taco-slice', 'godfathers taco pizza slice', 'pizza'),
  c('jets-buffalo-slice', 'jets pizza buffalo chicken pizza slice', 'pizza'),
  c('east-of-chicago-pepperoni', 'east of chicago pepperoni pizza slice', 'pizza'),
  c('pagliacci-cheese-slice', 'pagliacci cheese pizza slice', 'pizza'),
  c('ledo-pepperoni-square', 'ledo pizza pepperoni square slice', 'pizza'),
  c('rosatis-thin-cheese', 'rosatis thin crust cheese pizza slice', 'pizza'),
  c('unos-deep-dish', 'unos deep dish cheese pizza slice', 'pizza'),

  // Chicken (10)
  c('kfc-pot-pie', 'kfc chicken pot pie', 'chicken'),
  c('kfc-mac-bowl', 'kfc mac and cheese bowl', 'chicken'),
  c('bojangles-cajun-biscuit', 'bojangles cajun chicken fillet biscuit', 'chicken'),
  c('golden-chick-2pc', 'golden chick 2 piece mixed chicken', 'chicken'),
  c('slim-chickens-tenders', 'slim chickens tenders 3 piece', 'chicken'),
  c('wingstop-mango-8', 'wingstop mango habanero wings 8 piece', 'chicken'),
  c('hooters-fried-pickles', 'hooters fried pickles basket', 'chicken'),
  c('jollibee-chickenjoy', 'jollibee chickenjoy 2 piece', 'chicken'),
  c('pollo-tropical-tropichop', 'pollo tropical tropichop original', 'chicken'),
  c('nandos-quarter', 'nandos medium chicken quarter', 'chicken'),

  // Mexican / Tex-Mex (10)
  c('del-taco-chicken-taco', 'del taco grilled chicken soft taco', 'mexican'),
  c('torchys-trailer-park', 'torchys tacos trailer park taco', 'mexican'),
  c('rubios-fish-taco-plate', 'rubios coastal grill fish taco plate', 'mexican'),
  c('chronic-tacos-burrito', 'chronic tacos carne asada burrito', 'mexican'),
  c('on-the-border-sampler', 'on the border grande sampler', 'mexican'),
  c('chilis-skillet-queso', 'chilis skillet queso with chips', 'mexican'),
  c('tgi-mozzarella', 'tgi fridays mozzarella sticks', 'mexican'),
  c('chilis-fajitas', 'chilis chicken fajitas', 'mexican'),
  c('baja-fresh-burrito', 'baja fresh burrito mexicano chicken', 'mexican'),
  c('taco-cabana-breakfast', 'taco cabana breakfast taco potato and egg', 'mexican'),

  // Coffee & beverages (8)
  c('peets-medium-latte', 'peets coffee medium latte', 'coffee'),
  c('caribou-northern-lite', 'caribou coffee northern lite latte medium', 'coffee'),
  c('dutch-bros-rebel', 'dutch bros rebel energy drink medium', 'coffee'),
  c('tim-hortons-double-double', 'tim hortons double double medium', 'coffee'),
  c('scooters-caramelicious', 'scooters coffee caramelicious medium', 'coffee'),
  c('philz-mint-mojito', 'philz coffee iced mint mojito', 'coffee'),
  c('blue-bottle-nola', 'blue bottle new orleans iced coffee', 'coffee'),
  c('jamba-strawberry-whirl', 'jamba juice strawberry whirl medium', 'coffee'),

  // Breakfast (8)
  c('cracker-barrel-fried-steak', 'cracker barrel country fried steak', 'breakfast'),
  c('waffle-house-hash', 'waffle house scattered smothered hash browns', 'breakfast'),
  c('bob-evans-biscuit', 'bob evans sausage gravy biscuit', 'breakfast'),
  c('first-watch-trifecta', 'first watch trifecta omelette', 'breakfast'),
  c('le-peep-western', 'le peep western omelette', 'breakfast'),
  c('another-broken-egg-benedict', 'another broken egg farm benedict', 'breakfast'),
  c('snooze-pancake-flight', 'snooze am pancake flight', 'breakfast'),
  c('huddle-house-omelette', 'huddle house meat lovers omelette', 'breakfast'),

  // Sides (8)
  c('rallys-fries-large', 'rallys seasoned fries large', 'sides'),
  c('arbys-jamocha-shake', 'arbys jamocha shake medium', 'sides'),
  c('popeyes-biscuits-3', 'popeyes buttermilk biscuits 3 piece', 'sides'),
  c('long-john-hush', 'long john silvers hush puppies', 'sides'),
  c('checkers-fries', 'checkers fries medium', 'sides'),
  c('del-taco-fries', 'del taco crinkle cut fries', 'sides'),
  c('capriottis-wings-6', 'capriottis wing order 6 piece', 'sides'),
  c('cookout-fries-tray', 'cookout fries tray', 'sides'),

  // Desserts (8)
  c('cold-stone-cake-batter', 'cold stone cake batter ice cream like it', 'dessert'),
  c('baskin-pralines', 'baskin robbins pralines n cream scoop', 'dessert'),
  c('marble-slab-shake', 'marble slab birthday cake shake', 'dessert'),
  c('carvel-flying-saucer', 'carvel flying saucer ice cream sandwich', 'dessert'),
  c('auntie-annes-pretzel', 'auntie anne pretzel bites', 'dessert'),
  c('wetzels-pretzel', 'wetzels pretzels original pretzel', 'dessert'),
  c('pinkberry-original', 'pinkberry original frozen yogurt small', 'dessert'),
  c('yogurtland-tart', 'yogurtland plain tart frozen yogurt small', 'dessert'),

  // Asian & bowls (8)
  c('teriyaki-madness-bowl', 'teriyaki madness chicken teriyaki bowl', 'asian'),
  c('wok-box-orange', 'wok box orange chicken', 'asian'),
  c('pei-wei-dynamite', 'pei wei dynamite shrimp', 'asian'),
  c('bibibop-spicy-chicken', 'bibibop spicy chicken bowl', 'asian'),
  c('genghis-grill-bowl', 'genghis grill create your own bowl chicken', 'asian'),
  c('flame-broiler-plate', 'flame broiler chicken plate white rice', 'asian'),
  c('ll-hawaiian-katsu', 'l and l hawaiian bbq chicken katsu', 'asian'),
  c('sarku-japan-chicken', 'sarku japan teriyaki chicken', 'asian'),

  // Seafood (4)
  c('red-lobster-bisque', 'red lobster lobster bisque cup', 'seafood'),
  c('bonefish-salmon', 'bonefish grill grilled salmon', 'seafood'),
  c('legal-sea-chowder', 'legal sea foods clam chowder cup', 'seafood'),
  c('captain-d-sandwich', "captain d's fish sandwich", 'seafood'),

  // Soup & salad (4)
  c('zoup-tomato-basil', 'zoup tomato basil soup cup', 'soup'),
  c('panera-ten-veg', 'panera ten vegetable soup cup', 'soup'),
  c('sweet-tomatoes-salad', 'sweet tomatoes garden salad', 'salad'),
  c('chopt-kale-caesar', 'chopt kale caesar salad', 'salad'),
];

if (FOOD_SEARCH_ACCURACY_CASES.length !== 100) {
  throw new Error(`Expected 100 food search cases, got ${FOOD_SEARCH_ACCURACY_CASES.length}`);
}

module.exports = { FOOD_SEARCH_ACCURACY_CASES };
