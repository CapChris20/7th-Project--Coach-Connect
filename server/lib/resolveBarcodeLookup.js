/**
 * Shared barcode resolution: USDA + FatSecret + OFF → merge → Serper → validate.
 */
const axios = require('axios');
const { normalizeOpenFoodFactsProduct } = require('../../src/nutrition/food-details/normalizeNutritionData');
const { finalizeBarcodeFood } = require('../../src/nutrition/food-details/calculateServingSize');
const { servingUnitGuard, usdaDescriptionLooksLiquid } = require('../../src/nutrition/food-search/normalizeFoodQuery');
const { resolveFoodBrandLabel } = require('../../src/nutrition/food-details/formatFoodBrand');
const { pickBestBarcodeCandidate } = require('./barcodeMerge');
const { lookupBarcodeFatSecret } = require('./fatSecretFood');
const { lookupBarcodeWithSerper, barcodeGtinVariants } = require('./barcodeSerperLookup');
const { variableWeightBarcodeHint } = require('./variableWeightBarcode');
const { isUsableBarcodeFood, barcodeNotFoundPayload } = require('../../src/nutrition/barcode/validateBarcodeFood');

function normalizeGtinDigits(barcode) {
  const d = String(barcode || '').replace(/\D/g, '');
  if (!d) return '';
  return d.replace(/^0+/, '') || '0';
}

function getFdcNutrientFromSearchFood(item, ...nutrientIds) {
  const nutrients = item.foodNutrients || [];
  for (const id of nutrientIds) {
    const n = nutrients.find((x) => x.nutrientId === id);
    if (n != null && n.value != null && !Number.isNaN(Number(n.value))) return Number(n.value);
  }
  return 0;
}

function usdaServingGramsFromHit(hit) {
  let servingG = Number(hit.servingSize);
  if (!Number.isFinite(servingG) || servingG <= 0) return 100;
  const unitRaw = String(hit.servingSizeUnit || 'g').toLowerCase();
  if (unitRaw === 'oz' || unitRaw === 'onz' || unitRaw === 'ounce' || unitRaw === 'ounces') {
    servingG = servingG * 28.3495;
  }
  return Math.min(10000, Math.max(1, Math.round(servingG)));
}

function mapUsdaBrandedHitToBarcodeFood(hit) {
  const kcal = getFdcNutrientFromSearchFood(hit, 1008);
  const protein = getFdcNutrientFromSearchFood(hit, 1003);
  const carbs = getFdcNutrientFromSearchFood(hit, 1005);
  const fat = getFdcNutrientFromSearchFood(hit, 1004);
  const servingG = usdaServingGramsFromHit(hit);
  const unitRaw = String(hit.servingSizeUnit || 'g').toLowerCase();
  const useMl = (unitRaw === 'ml' || unitRaw === 'milliliters')
    && usdaDescriptionLooksLiquid(hit.description);

  return servingUnitGuard(finalizeBarcodeFood({
    id: String(hit.fdcId),
    name: hit.description || 'Unknown',
    brand: resolveFoodBrandLabel(hit.description, hit.brandOwner || hit.brandName || ''),
    calories: kcal,
    protein,
    carbs,
    fat,
    servingSize: servingG / 100,
    servingUnit: useMl ? 'ml' : 'grams',
    servingGrams: servingG,
    servingAmount: servingG,
    source: 'usda',
    kcalPer100Unit: kcal,
  }));
}

async function lookupBarcodeUsda(barcode) {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey || !String(barcode || '').trim()) return null;

  const clean = String(barcode).trim();
  const target = normalizeGtinDigits(clean);

  try {
    const res = await axios.post(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`,
      { query: clean, pageSize: 25, dataType: ['Branded'] },
      { timeout: 12000, headers: { 'Content-Type': 'application/json' } },
    );

    const foods = res.data?.foods || [];
    const hit =
      foods.find((f) => normalizeGtinDigits(f.gtinUpc) === target)
      || foods.find((f) => String(f.gtinUpc || '').replace(/\D/g, '') === clean.replace(/\D/g, ''))
      || null;

    if (!hit) return null;
    return mapUsdaBrandedHitToBarcodeFood(hit);
  } catch (e) {
    console.warn('[Barcode] USDA lookup failed:', e.message);
    return null;
  }
}

async function lookupOffBarcode(barcode) {
  const variants = barcodeGtinVariants(barcode);
  for (const code of variants.length ? variants : [String(barcode || '').trim()]) {
    try {
      const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json`;
      const res = await axios.get(url, { timeout: 12000 });
      if (res.data?.product) {
        return finalizeBarcodeFood(normalizeOpenFoodFactsProduct(res.data.product));
      }
    } catch (e) {
      console.warn('[Barcode] OFF lookup failed:', code, e.message);
    }
  }
  return null;
}

/**
 * @returns {Promise<object>} food row, notFound payload, or variableWeight hint
 */
async function resolveBarcodeLookup(barcode) {
  const clean = String(barcode || '').trim();
  if (!clean) return { error: 'Barcode is required' };

  const [usdaResult, fatsecretResult, offResult] = await Promise.all([
    lookupBarcodeUsda(clean),
    lookupBarcodeFatSecret(clean),
    lookupOffBarcode(clean),
  ]);

  let result = pickBestBarcodeCandidate([usdaResult, fatsecretResult, offResult].filter(Boolean));
  let serperSuggestedSearch = [];

  if (!result && process.env.SERPER_API_KEY) {
    const serper = await lookupBarcodeWithSerper(clean);
    serperSuggestedSearch = serper.suggestedSearchQueries || [];
    if (serper.food) {
      result = {
        ...serper.food,
        barcodeConfidence: 'low',
        needsVerification: true,
      };
    }
  }

  if (result && (result.source === 'openfoodfacts' || result.source === 'usda' || result.source === 'fatsecret')) {
    const meta = {
      barcodeConfidence: result.barcodeConfidence,
      barcodeScore: result.barcodeScore,
      barcodeSourcesChecked: result.barcodeSourcesChecked,
      needsVerification: result.needsVerification,
    };
    result = { ...finalizeBarcodeFood(result), ...meta };
  }

  if (isUsableBarcodeFood(result)) {
    return result;
  }

  const vwHint = variableWeightBarcodeHint(clean);
  if (vwHint) return vwHint;

  return barcodeNotFoundPayload(clean, serperSuggestedSearch);
}

module.exports = {
  resolveBarcodeLookup,
  lookupBarcodeUsda,
  lookupOffBarcode,
  mapUsdaBrandedHitToBarcodeFood,
};
