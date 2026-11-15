const { scrapeCalorieKing, adaptCalorieKingResult } = require('./calorieKing');
const { scrapeSerperNutrition, adaptSerperNutritionResult } = require('./serperNutrition');
const { scrapeFatSecret, adaptFatSecretFood } = require('./fatSecret');
const {
  scrapeFastFoodNutrition,
  adaptFastFoodNutritionResult,
} = require('./fastFoodNutrition');
const { scrapeFoodFacto, adaptFoodFactoResult } = require('./foodFacto');
const { scrapeOpenFoodFacts, adaptOpenFoodFactsProduct } = require('./openFoodFacts');
const { scrapeUsdaFdc, adaptUsdaFood } = require('./usdaFdc');
const { scrapeMenuStat, adaptMenuStatResult } = require('./menuStat');
const { scrapeYazio, adaptYazioResult } = require('./yazio');
const { scrapeCronometer, adaptCronometerResult } = require('./cronometer');
const { scrapeMyFitnessPal, adaptMyFitnessPalResult } = require('./myFitnessPal');

const ALL_SCRAPERS = {
  fatSecret: scrapeFatSecret,
  fastFoodNutrition: scrapeFastFoodNutrition,
  calorieKing: scrapeCalorieKing,
  foodFacto: scrapeFoodFacto,
  openFoodFacts: scrapeOpenFoodFacts,
  serper: scrapeSerperNutrition,
  usdaFdc: scrapeUsdaFdc,
};

/** @deprecated use ALL_SCRAPERS */
const PRIMARY_SCRAPERS = ALL_SCRAPERS;

const BACKUP_SCRAPERS = {};

// Candidate adapters — not wired into scrapeAllNutritionSources yet (P1).
const CANDIDATE_ADAPTERS = {
  fatSecret: adaptFatSecretFood,
  usdaFdc: adaptUsdaFood,
  openFoodFacts: adaptOpenFoodFactsProduct,
  calorieKing: adaptCalorieKingResult,
  menuStat: adaptMenuStatResult,
  fastFoodNutrition: adaptFastFoodNutritionResult,
  foodFacto: adaptFoodFactoResult,
  serper: adaptSerperNutritionResult,
  yazio: adaptYazioResult,
  cronometer: adaptCronometerResult,
  myFitnessPal: adaptMyFitnessPalResult,
};

module.exports = {
  ALL_SCRAPERS,
  PRIMARY_SCRAPERS,
  BACKUP_SCRAPERS,
  CANDIDATE_ADAPTERS,
  // Keep unused scrapers importable without changing the live scrape map.
  scrapeMenuStat,
  scrapeYazio,
  scrapeCronometer,
  scrapeMyFitnessPal,
};
