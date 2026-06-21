const { scrapeCalorieKing } = require('./calorieKing');
const { scrapeSerperNutrition } = require('./serperNutrition');
const { scrapeFatSecret } = require('./fatSecret');
const { scrapeFastFoodNutrition } = require('./fastFoodNutrition');
const { scrapeFoodFacto } = require('./foodFacto');
const { scrapeOpenFoodFacts } = require('./openFoodFacts');
const { scrapeUsdaFdc } = require('./usdaFdc');

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

module.exports = {
  ALL_SCRAPERS,
  PRIMARY_SCRAPERS,
  BACKUP_SCRAPERS,
};
