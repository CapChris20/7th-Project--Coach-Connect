const { buildSearchQuery, withTimeout } = require('./scrapeHelpers');
const { validateScrapedMacros } = require('./validateScrapedMacros');
const {
  ALL_SOURCE_KEYS,
  SOURCE_DISPLAY_NAMES,
  SCRAPE_TIMEOUT_MS,
} = require('./constants');
const { ALL_SCRAPERS } = require('./scrapers');
const { getFoodNutritionConsensus } = require('./getFoodNutritionConsensus');
const { isRestaurantMenuQuery } = require('./resolveFoodDetail');

function sourceKeysForQuery(query, scraperMap) {
  return ALL_SOURCE_KEYS.filter((key) => {
    if (key === 'usdaFdc' && isRestaurantMenuQuery(query, null)) return false;
    return Boolean(scraperMap[key]);
  });
}

async function runScraperSafe(sourceKey, scraperFn, query, timeoutMs, siteLog) {
  const label = SOURCE_DISPLAY_NAMES[sourceKey] || sourceKey;
  const started = Date.now();
  try {
    const result = await withTimeout(
      Promise.resolve(scraperFn(query, timeoutMs)),
      timeoutMs,
      label,
    );
    const validated = validateScrapedMacros(result, query) ? result : null;
    siteLog.push({
      source: label,
      ok: validated != null,
      found: validated != null,
      errored: false,
      rejected: result != null && validated == null,
      ms: Date.now() - started,
      error: null,
      url: result?.url || null,
      calories: result?.calories ?? null,
    });
    return validated;
  } catch (err) {
    siteLog.push({
      source: label,
      ok: false,
      found: false,
      errored: true,
      ms: Date.now() - started,
      error: err?.message || String(err),
    });
    return null;
  }
}

async function scrapeAllNutritionSources(opts = {}) {
  const {
    foodName,
    restaurant,
    timeoutMs = SCRAPE_TIMEOUT_MS,
    scrapers = ALL_SCRAPERS,
  } = opts;

  const query = buildSearchQuery(foodName, restaurant);
  const siteLog = [];
  const keys = sourceKeysForQuery(query, scrapers);

  const entries = await Promise.all(
    keys.map(async (key) => {
      const scraperFn = scrapers[key];
      const result = await runScraperSafe(key, scraperFn, query, timeoutMs, siteLog);
      return [key, result];
    }),
  );

  const rawResults = Object.fromEntries(entries);
  const sourcesWithData = Object.entries(rawResults)
    .filter(([, v]) => v != null)
    .map(([k]) => SOURCE_DISPLAY_NAMES[k] || k);

  console.log(
    `[Nutrition Search] query="${query}" sites_with_data=[${sourcesWithData.join(', ')}]`,
  );

  return { query, rawResults, siteLogs: siteLog };
}

function logNutrientVariance(nutrientLogs) {
  for (const entry of nutrientLogs) {
    if (entry.included) {
      console.log(
        `[Nutrition Search] ${entry.nutrient} variance=${entry.variance} sources=${entry.rawValues.length}`,
      );
    }
  }
}

async function searchFoodNutrition(opts = {}) {
  const { rawResults, siteLogs, query } = await scrapeAllNutritionSources(opts);
  const { consensus, sources_used, nutrientLogs, sourceResults, excludedSources } =
    getFoodNutritionConsensus(rawResults);

  logNutrientVariance(nutrientLogs);

  const successCount = sources_used.length;
  const hasConsensus = Object.keys(consensus).length > 0;
  const hasSourceRows = sourceResults.length > 0;

  return {
    query: { foodName: opts.foodName, restaurant: opts.restaurant || null },
    rawResults,
    consensus,
    sourceResults,
    excludedSources,
    sources_used,
    siteLogs,
    nutrientLogs,
    successCount,
    hasConsensus,
    hasSourceRows,
    searchQuery: query,
    allSourcesErrored: siteLogs.length > 0 && siteLogs.every((log) => log.errored),
  };
}

module.exports = {
  scrapeAllNutritionSources,
  searchFoodNutrition,
  runScraperSafe,
  sourceKeysForQuery,
};
