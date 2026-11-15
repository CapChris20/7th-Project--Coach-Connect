#!/usr/bin/env node
/**
 * NO LIVE NETWORK.
 * Invokes the real POST /api/food/barcode handler and resolveBarcodeLookup
 * with axios and Firestore stubbed. Inputs are constructed to exercise the
 * control flow. They are not a recorded scan and not a claimed nutrition label.
 *
 *   node scripts/traceBarcodeMismatch.js
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');

const OUT_PATH = path.join(__dirname, 'data/barcodeMismatchTrace.json');
const FOOD_ROUTES_PATH = path.join(__dirname, '../server/routes/foodRoutes.js');

const calls = [];
const state = {
  organic: [],
  gtinFoods: [],
  nameFoods: [],
};

function blankUrl(url) {
  return String(url || '').split('?')[0];
}

const axiosMock = {
  post: async (url, body) => {
    const urlPath = blankUrl(url);
    calls.push({ method: 'POST', url: urlPath });
    if (urlPath.includes('serper.dev')) return { data: { organic: state.organic } };
    if (urlPath.includes('nal.usda.gov')) {
      const query = String(body?.query || '');
      if (/[a-z]/i.test(query)) return { data: { foods: state.nameFoods } };
      return { data: { foods: state.gtinFoods } };
    }
    return { data: {} };
  },
  get: async (url) => {
    const urlPath = blankUrl(url);
    calls.push({ method: 'GET', url: urlPath });
    if (urlPath.includes('openfoodfacts.org')) return { data: {} };
    if (urlPath.includes('upcitemdb.com')) return { data: { items: [] } };
    return { data: {} };
  },
  create() {
    return axiosMock;
  },
  isAxiosError() {
    return false;
  },
};

const adminMock = {
  apps: [],
  initializeApp() {},
  firestore() {
    return {
      collection() {
        return {
          doc() {
            return {
              get: async () => ({ exists: false, data: () => null }),
              set: async () => {},
            };
          },
        };
      },
    };
  },
};
adminMock.firestore.FieldValue = { serverTimestamp() { return null; }, increment(n) { return n; } };

const originalRequire = Module.prototype.require;
Module.prototype.require = function requireWithStubs(id) {
  if (id === 'axios') return axiosMock;
  if (id === 'firebase-admin') return adminMock;
  return originalRequire.apply(this, arguments);
};

process.env.USDA_API_KEY = process.env.USDA_API_KEY || 'trace-stub-key';
process.env.SERPER_API_KEY = process.env.SERPER_API_KEY || 'trace-stub-key';

function gs1CheckDigit(body) {
  let sum = 0;
  for (let index = 0; index < body.length; index += 1) {
    const fromRight = body.length - index;
    const weight = fromRight % 2 === 1 ? 3 : 1;
    sum += Number(body[index]) * weight;
  }
  return (10 - (sum % 10)) % 10;
}

function withBadCheckDigit(body) {
  const good = gs1CheckDigit(body);
  const bad = (good + 1) % 10;
  return `${body}${bad}`;
}

function usdaSoupFood() {
  return {
    fdcId: 900001,
    description: 'BROCCOLI CHEDDAR SOUP, CONDENSED',
    brandOwner: 'STORE LABEL',
    gtinUpc: '999999999993',
    servingSize: 100,
    servingSizeUnit: 'g',
    foodNutrients: [
      { nutrientId: 1008, value: 90 },
      { nutrientId: 1003, value: 2 },
      { nutrientId: 1005, value: 12 },
      { nutrientId: 1004, value: 4 },
    ],
  };
}

function organicHit({ title, barcode, calories, protein, carbs, fat }) {
  return {
    title,
    snippet: `${barcode} ${calories} calories ${protein}g protein ${carbs}g carbs ${fat}g fat`,
    link: `https://example.com/search?q=${barcode}`,
  };
}

function summarizeFood(body) {
  if (!body || typeof body !== 'object') return null;
  return {
    notFound: Boolean(body.notFound),
    name: body.name || body.food_name || null,
    source: body.source || null,
    gtinUpc: body.gtinUpc || null,
    scannedBarcode: body.scannedBarcode || null,
    barcodeConfidence: body.barcodeConfidence || null,
    needsVerification: body.needsVerification == null ? null : Boolean(body.needsVerification),
    variableWeightBarcode: Boolean(body.variableWeightBarcode),
  };
}

function gtinMismatch(summary) {
  if (!summary || summary.notFound || !summary.gtinUpc || !summary.scannedBarcode) return null;
  return summary.gtinUpc.replace(/\D/g, '') !== summary.scannedBarcode.replace(/\D/g, '');
}

async function invokeBarcode(handler, barcode) {
  const started = calls.length;
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  await handler({ body: { barcode } }, response);
  return {
    statusCode: response.statusCode,
    food: summarizeFood(response.body),
    gtinDiffersFromScan: gtinMismatch(summarizeFood(response.body)),
    networkCalls: calls.length - started,
    urls: calls.slice(started).map((call) => `${call.method} ${call.url}`),
  };
}

function fakeApp() {
  const routes = {};
  return {
    routes,
    get(routePath, ...handlers) {
      routes[`GET ${routePath}`] = handlers;
    },
    post(routePath, ...handlers) {
      routes[`POST ${routePath}`] = handlers;
    },
  };
}

async function main() {
  const foodRoutesSource = fs.readFileSync(FOOD_ROUTES_PATH, 'utf8');
  const { registerFoodRoutes } = require(FOOD_ROUTES_PATH);
  const app = fakeApp();
  registerFoodRoutes(app, {
    verifyFirebaseBearerToken: (_req, _res, next) => next(),
  });
  const handlers = app.routes['POST /api/food/barcode'];
  const handler = handlers[handlers.length - 1];

  const soupBarcode = '111111111117';
  state.organic = [organicHit({
    title: 'Broccoli Cheddar Soup',
    barcode: soupBarcode,
    calories: 90,
    protein: 2,
    carbs: 12,
    fat: 4,
  })];
  state.gtinFoods = [];
  state.nameFoods = [usdaSoupFood()];
  const soupViaName = await invokeBarcode(handler, soupBarcode);

  const serperBarcode = '111111111124';
  state.organic = [organicHit({
    title: 'Frozen cooked poultry pieces',
    barcode: serperBarcode,
    calories: 180,
    protein: 16,
    carbs: 8,
    fat: 9,
  })];
  state.gtinFoods = [];
  state.nameFoods = [];
  const serperOnly = await invokeBarcode(handler, serperBarcode);

  const badBody = '11111111111';
  const badBarcode = withBadCheckDigit(badBody);
  state.organic = [];
  state.gtinFoods = [];
  state.nameFoods = [];
  const badChecksum = await invokeBarcode(handler, badBarcode);

  const { resolveBarcodeLookup } = require('../server/lib/resolveBarcodeLookup');
  const resolveStarted = calls.length;
  state.organic = [organicHit({
    title: 'Frozen cooked poultry pieces',
    barcode: '111111111148',
    calories: 180,
    protein: 16,
    carbs: 8,
    fat: 9,
  })];
  const resolveSerper = summarizeFood(await resolveBarcodeLookup('111111111148'));
  const resolveSerperCalls = calls.length - resolveStarted;

  const resolveSoupStarted = calls.length;
  state.organic = [organicHit({
    title: 'Broccoli Cheddar Soup',
    barcode: '111111111155',
    calories: 90,
    protein: 2,
    carbs: 12,
    fat: 4,
  })];
  const resolveSoup = summarizeFood(await resolveBarcodeLookup('111111111155'));
  const resolveSoupCalls = calls.length - resolveSoupStarted;

  const trace = {
    inputOrigin: 'constructed-to-exercise-control-flow',
    notARecordedScan: true,
    liveRoute: 'POST /api/food/barcode',
    liveRouteFile: 'server/routes/foodRoutes.js',
    resolveBarcodeLookupRequiredByFoodRoutes: foodRoutesSource.includes('resolveBarcodeLookup'),
    clientCaller: 'src/nutrition/food-search/searchFoods.js lookupBarcode posts /api/food/barcode',
    badChecksum: {
      barcode: badBarcode,
      checkDigitValid: false,
      networkCalls: badChecksum.networkCalls,
      urls: badChecksum.urls,
    },
    foodRoutesSoupReplacedByUsdaName: soupViaName,
    foodRoutesSerperOnlyAutoFill: serperOnly,
    resolveBarcodeLookupSerperAutoFill: {
      food: resolveSerper,
      networkCalls: resolveSerperCalls,
    },
    resolveBarcodeLookupSoup: {
      food: resolveSoup,
      networkCalls: resolveSoupCalls,
    },
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(trace, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    soupName: soupViaName.food?.name || null,
    soupSource: soupViaName.food?.source || null,
    soupGtinDiffers: soupViaName.gtinDiffersFromScan,
    serperName: serperOnly.food?.name || null,
    serperSource: serperOnly.food?.source || null,
    serperConfidence: serperOnly.food?.barcodeConfidence || null,
    badChecksumCalls: badChecksum.networkCalls,
    resolveSerperName: resolveSerper?.name || null,
    resolveSoupNotFound: Boolean(resolveSoup?.notFound),
    resolveWired: trace.resolveBarcodeLookupRequiredByFoodRoutes,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
