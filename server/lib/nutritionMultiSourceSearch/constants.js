/** Shared constants for multi-source nutrition search. */

const NUTRIENT_KEYS = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sodium_mg', 'sugar_g'];

const ALL_SOURCE_KEYS = [
  'fatSecret',
  'fastFoodNutrition',
  'calorieKing',
  'foodFacto',
  'openFoodFacts',
  'serper',
  'usdaFdc',
];

/** @deprecated use ALL_SOURCE_KEYS */
const PRIMARY_SOURCE_KEYS = ALL_SOURCE_KEYS;

const BACKUP_SOURCE_KEYS = [];

const SOURCE_DISPLAY_NAMES = {
  serper: 'Serper',
  fatSecret: 'FatSecret',
  calorieKing: 'CalorieKing',
  fastFoodNutrition: 'FastFoodNutrition',
  foodFacto: 'FoodFacto',
  openFoodFacts: 'OpenFoodFacts',
  usdaFdc: 'USDA FoodData Central',
};

const SCRAPE_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const USER_AGENT =
  'CoachConnect/1.0 (Mobile; nutrition-search; contact: support@coachconnect.app)';

module.exports = {
  NUTRIENT_KEYS,
  ALL_SOURCE_KEYS,
  PRIMARY_SOURCE_KEYS,
  BACKUP_SOURCE_KEYS,
  SOURCE_DISPLAY_NAMES,
  SCRAPE_TIMEOUT_MS,
  CACHE_TTL_MS,
  USER_AGENT,
};
