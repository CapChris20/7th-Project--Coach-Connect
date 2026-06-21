/**
 * FatSecret Platform API — barcode + text search + branded food lookup.
 * Env: FATSECRET_CLIENT_ID + FATSECRET_CLIENT_SECRET (OAuth 2.0 or OAuth 1.0 Consumer Key/Secret)
 */
const axios = require('axios');
const { resolveFoodBrandLabel } = require('../../src/nutrition/food-details/cleanFoodBrandName');
const { fatSecretOAuth1Get } = require('./fatSecretOAuth1');

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  const clientId = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60_000) return cachedToken;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'basic',
  });

  const res = await axios.post('https://oauth.fatsecret.com/connect/token', body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    timeout: 12000,
  });

  cachedToken = res.data?.access_token || null;
  const expiresIn = Number(res.data?.expires_in || 3600);
  tokenExpiresAt = now + expiresIn * 1000;
  return cachedToken;
}

function parseFatSecretNumber(v) {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function normalizeFatSecretFood(food, barcode) {
  if (!food) return null;
  const servings = food.servings?.serving;
  const servingList = Array.isArray(servings) ? servings : servings ? [servings] : [];
  const primary = servingList[0] || {};
  const grams = parseFatSecretNumber(primary.metric_serving_amount) || 100;
  const unit = String(primary.metric_serving_unit || primary.measurement_description || 'serving').trim();
  const perServingKcal = parseFatSecretNumber(primary.calories);
  const per100Kcal = grams > 0 ? (perServingKcal / grams) * 100 : perServingKcal;

  const name = String(food.food_name || food.brand_name || `Product ${barcode}`).trim();
  if (!name) return null;

  return {
    id: `fatsecret_${food.food_id || barcode}`,
    name,
    food_name: name,
    brand: String(food.brand_name || '').trim() || null,
    brand_name: String(food.brand_name || '').trim() || null,
    barcode: String(barcode || food.food_id || '').trim(),
    source: 'fatsecret',
    servingAmount: grams,
    servingGrams: grams,
    servingSize: grams,
    servingUnit: unit.toLowerCase().includes('ml') ? 'ml' : 'g',
    serving_label: primary.serving_description || `${grams}${unit}`,
    calories: Math.round(per100Kcal),
    kcalPer100Unit: Math.round(per100Kcal),
    protein: parseFatSecretNumber(primary.protein),
    carbs: parseFatSecretNumber(primary.carbohydrate),
    fat: parseFatSecretNumber(primary.fat),
    fiber: parseFatSecretNumber(primary.fiber) || null,
    sodium: parseFatSecretNumber(primary.sodium) || null,
    sugar: parseFatSecretNumber(primary.sugar) || null,
    nf_calories: Math.round(perServingKcal),
    nf_protein: parseFatSecretNumber(primary.protein),
    nf_total_carbohydrate: parseFatSecretNumber(primary.carbohydrate),
    nf_total_fat: parseFatSecretNumber(primary.fat),
    serving_qty: 1,
    serving_unit: primary.serving_description || 'serving',
  };
}

function trimEnv(name) {
  const v = process.env[name];
  return v ? String(v).trim().replace(/^["']|["']$/g, '') : '';
}

function getFatSecretCredentials() {
  const key =
    trimEnv('FATSECRET_CLIENT_ID')
    || trimEnv('FATSECRET_CONSUMER_KEY');
  const secret =
    trimEnv('FATSECRET_CLIENT_SECRET')
    || trimEnv('FATSECRET_CONSUMER_SECRET');
  return { key, secret };
}

function fatSecretConfigured() {
  const { key, secret } = getFatSecretCredentials();
  return !!(key && secret);
}

function parseFatSecretFoodDescription(desc) {
  const t = String(desc || '');
  const perMatch = t.match(/Per\s+(.+?)\s*[-–|]/i);
  return {
    calories: parseFatSecretNumber(t.match(/Calories:\s*(\d+(?:\.\d+)?)/i)?.[1]),
    fat: parseFatSecretNumber(t.match(/Fat:\s*(\d+(?:\.\d+)?)\s*g/i)?.[1]),
    carbs: parseFatSecretNumber(t.match(/Carb(?:ohydrate)?s?:\s*(\d+(?:\.\d+)?)\s*g/i)?.[1]),
    protein: parseFatSecretNumber(t.match(/Protein:\s*(\d+(?:\.\d+)?)\s*g/i)?.[1]),
    servingLabel: perMatch?.[1]?.trim() || null,
  };
}

function mapFatSecretSearchHitToRow(food) {
  if (!food?.food_name) return null;
  const parsed = parseFatSecretFoodDescription(food.food_description);
  if (parsed.calories <= 0 && !parsed.protein && !parsed.carbs && !parsed.fat) return null;

  const name = String(food.food_name).trim();
  const brand = food.brand_name
    ? resolveFoodBrandLabel(name, food.brand_name)
    : null;
  const servingLabel = parsed.servingLabel || 'serving';
  const servingGrams = /100\s*g/i.test(servingLabel) ? 100 : null;

  return {
    id: `fs_${food.food_id}`,
    food_name: name,
    name,
    brand_name: brand,
    brand,
    nf_calories: parsed.calories,
    nf_protein: parsed.protein,
    nf_total_carbohydrate: parsed.carbs,
    nf_total_fat: parsed.fat,
    calories: parsed.calories,
    protein: parsed.protein,
    carbs: parsed.carbs,
    fat: parsed.fat,
    serving_qty: 1,
    serving_unit: servingLabel,
    serving_label: servingLabel,
    servingGrams,
    source: 'fatsecret',
    fatsecretFoodId: String(food.food_id),
    food_type: food.food_type || null,
  };
}

/** Text search — OAuth 1.0 foods.search (branded grocery + US restaurant menus). */
async function searchFoodsFatSecret(query, limit = 20) {
  if (!fatSecretConfigured()) return [];

  const { key, secret } = getFatSecretCredentials();
  const q = String(query || '').trim();
  if (!q) return [];

  try {
    const data = await fatSecretOAuth1Get(
      {
        method: 'foods.search',
        search_expression: q,
        format: 'json',
        max_results: Math.min(Math.max(limit, 1), 50),
        page_number: 0,
      },
      key,
      secret,
    );
    const raw = data?.foods?.food;
    const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    return list.map(mapFatSecretSearchHitToRow).filter(Boolean);
  } catch (e) {
    console.warn('[FatSecret] foods.search failed:', e.message);
    return [];
  }
}

async function lookupBarcodeFatSecret(barcode) {
  const token = await getAccessToken();
  if (!token || !String(barcode || '').trim()) return null;

  const clean = String(barcode).replace(/\D/g, '');
  if (!clean) return null;

  try {
    const res = await axios.get('https://platform.fatsecret.com/rest/server.api', {
      params: {
        method: 'food.find_id_for_barcode',
        barcode: clean,
        format: 'json',
      },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 12000,
    });

    const foodId = res.data?.food_id?.value || res.data?.food_id;
    if (!foodId) return null;

    const detail = await axios.get('https://platform.fatsecret.com/rest/server.api', {
      params: {
        method: 'food.get.v4',
        food_id: foodId,
        format: 'json',
      },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 12000,
    });

    const food = detail.data?.food;
    return normalizeFatSecretFood(food, clean);
  } catch (e) {
    console.warn('FatSecret barcode lookup failed:', e?.message || e);
    return null;
  }
}

module.exports = {
  getAccessToken,
  getFatSecretCredentials,
  fatSecretConfigured,
  searchFoodsFatSecret,
  mapFatSecretSearchHitToRow,
  lookupBarcodeFatSecret,
  normalizeFatSecretFood,
};
