/**
 * FatSecret Platform API — barcode + branded food lookup.
 * Requires FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET in env (Cloud Run only).
 */
const axios = require('axios');

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
  lookupBarcodeFatSecret,
  normalizeFatSecretFood,
};
