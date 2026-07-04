/** POST /api/nutrition/search — multi-source scrape + consensus. */
const admin = require('firebase-admin');
const logger = require('../lib/logger');
const { searchFoodNutrition } = require('../lib/nutritionMultiSourceSearch/scrapeNutritionSources');
const {
  getCachedNutritionSearch,
  setCachedNutritionSearch,
} = require('../lib/nutritionMultiSourceSearch/nutritionSearchCache');
const { enforceNutritionSearchDailyLimit } = require('../lib/nutritionSearchDailyLimit');

function filterConsensusForResponse(consensus) {
  const filtered = {};
  for (const [key, val] of Object.entries(consensus || {})) {
    if (val && val.value != null) filtered[key] = val;
  }
  return filtered;
}

function buildResponsePayload(result, { cacheHit = false, timestamp } = {}) {
  return {
    query: result.query,
    consensus: filterConsensusForResponse(result.consensus),
    sourceResults: result.sourceResults || [],
    excludedSources: result.excludedSources || [],
    sources_used: result.sources_used || [],
    siteLogs: result.siteLogs || [],
    timestamp: timestamp || new Date().toISOString(),
    cacheHit: Boolean(cacheHit),
    fallbackUsed: Boolean(result.fallbackUsed),
  };
}

async function verifyNutritionSearchUser(req, res, next) {
  const uid = String(req.firebaseAuth?.uid || '').trim();
  if (!uid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!admin.apps.length) {
    return res.status(503).json({ error: 'Service unavailable' });
  }
  try {
    const userSnap = await admin.firestore().collection('users').doc(uid).get();
    if (!userSnap.exists) {
      return res.status(403).json({ error: 'User profile not found' });
    }
    req.nutritionSearchUid = uid;
    return next();
  } catch (e) {
    logger.error('[Nutrition Search] user verification failed:', e?.message || e);
    return res.status(500).json({ error: 'Failed to verify user' });
  }
}

async function handleNutritionSearch(req, res, deps = {}) {
  const started = Date.now();
  const searchFn = deps.searchFoodNutrition || searchFoodNutrition;
  const uid = String(req.nutritionSearchUid || req.firebaseAuth?.uid || '').trim();

  try {
    if (uid && !deps.skipDailyLimit) {
      const usage = await enforceNutritionSearchDailyLimit(uid);
      if (!usage.allowed) {
        return res.status(429).json({
          error: 'Daily nutrition search limit reached',
          limit: usage.limit,
          remaining: 0,
          resetsAt: usage.resetsAt,
        });
      }
    }

    const { foodName, restaurant } = req.body || {};

    if (!foodName || !String(foodName).trim()) {
      return res.status(400).json({ error: 'foodName is required' });
    }

    const normalizedFood = String(foodName).trim();
    const normalizedRestaurant = restaurant ? String(restaurant).trim() : null;

    const cached = getCachedNutritionSearch(normalizedFood, normalizedRestaurant);
    if (cached) {
      const elapsed = Date.now() - started;
      logger.info(
        `[Nutrition Search] cache hit uid=${uid || 'unknown'} food="${normalizedFood}" restaurant="${normalizedRestaurant || ''}" ${elapsed}ms`,
      );
      return res.json({
        query: { foodName: normalizedFood, restaurant: normalizedRestaurant },
        consensus: filterConsensusForResponse(cached.consensus),
        sourceResults: cached.sourceResults || [],
        excludedSources: cached.excludedSources || [],
        sources_used: cached.sources_used,
        timestamp: cached.timestamp,
        cacheHit: true,
        fallbackUsed: Boolean(cached.fallbackUsed),
      });
    }

    const result = await searchFn({
      foodName: normalizedFood,
      restaurant: normalizedRestaurant,
      scrapers: deps.scrapers,
      timeoutMs: deps.timeoutMs,
    });

    const elapsed = Date.now() - started;
    const filteredConsensus = filterConsensusForResponse(result.consensus);
    const hasConsensus = Object.keys(filteredConsensus).length > 0;
    const hasSourceRows = (result.sourceResults || []).length > 0;

    logger.info(
      `[Nutrition Search] uid=${uid || 'unknown'} food="${normalizedFood}" restaurant="${normalizedRestaurant || ''}" sources=${result.sources_used?.length || 0} inliers=${result.sourceResults?.length || 0} consensus_nutrients=${Object.keys(filteredConsensus).length} ${elapsed}ms`,
    );

    if (result.successCount === 0) {
      const statusCode = result.allSourcesErrored ? 503 : 404;
      return res.status(statusCode).json({
        error:
          statusCode === 503
            ? 'All nutrition sources failed'
            : 'No nutrition data found for this food',
        query: result.query,
        sourceResults: [],
        excludedSources: [],
        siteLogs: result.siteLogs,
      });
    }

    if (!hasConsensus && !hasSourceRows) {
      return res.status(404).json({
        error: 'No nutrition data found for this food',
        query: result.query,
        sourceResults: [],
        excludedSources: result.excludedSources || [],
        sources_used: result.sources_used,
        siteLogs: result.siteLogs,
      });
    }

    const timestamp = new Date().toISOString();
    const payload = buildResponsePayload(result, { cacheHit: false, timestamp });

    setCachedNutritionSearch(normalizedFood, normalizedRestaurant, payload);

    return res.json(payload);
  } catch (err) {
    const elapsed = Date.now() - started;
    logger.error(`[Nutrition Search] failed after ${elapsed}ms:`, err?.message || err);
    return res.status(500).json({ error: 'Nutrition search failed' });
  }
}

function registerNutritionSearchRoutes(app, deps = {}) {
  const { verifyFirebaseBearerToken, sharedRateLimit } = deps;
  if (!verifyFirebaseBearerToken) {
    throw new Error('registerNutritionSearchRoutes requires verifyFirebaseBearerToken');
  }

  const rateLimitMw = sharedRateLimit || ((_req, _res, next) => next());

  app.post(
    '/api/nutrition/search',
    verifyFirebaseBearerToken,
    rateLimitMw,
    verifyNutritionSearchUser,
    (req, res) => handleNutritionSearch(req, res, deps),
  );
}

module.exports = {
  registerNutritionSearchRoutes,
  handleNutritionSearch,
  verifyNutritionSearchUser,
  filterConsensusForResponse,
  buildResponsePayload,
};
