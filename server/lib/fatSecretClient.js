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

  try {
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
  } catch (e) {
    // Many apps only have OAuth 1.0 consumer keys — not OAuth 2.0 client credentials.
    console.warn('[FatSecret] OAuth2 token failed (will use OAuth1 where needed):', e.response?.data?.error || e.message);
    return null;
  }
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
    dataBasis: 'label_serving',
    servingAmount: grams,
    servingGrams: grams,
    servingSize: 1,
    servingUnit: unit.toLowerCase().includes('ml') ? 'ml' : 'g',
    serving_label: primary.serving_description || `${grams}${unit}`,
    // Label-serving totals (package panel), not per-100g
    calories: Math.round(perServingKcal),
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
  let servingGrams = null;
  const gMatch = String(servingLabel).match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (gMatch) servingGrams = Math.round(Number(gMatch[1]));
  else if (/100\s*g/i.test(servingLabel)) servingGrams = 100;
  else {
    const tbsp = String(servingLabel).match(/(\d+(?:\.\d+)?)\s*(tbsp|tablespoons?)\b/i);
    if (tbsp) servingGrams = Math.round(Number(tbsp[1]) * 15);
    const cup = String(servingLabel).match(/(\d+(?:\.\d+)?)\s*cups?\b/i);
    if (cup) servingGrams = Math.round(Number(cup[1]) * 240);
  }
  if (!servingGrams || servingGrams <= 0) servingGrams = 100;

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
    labelServingGrams: servingGrams,
    dataBasis: 'label_serving',
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
  if (!fatSecretConfigured() || !String(barcode || '').trim()) return null;

  const clean = String(barcode).replace(/\D/g, '');
  if (!clean) return null;

  const { key, secret } = getFatSecretCredentials();
  // Prefer OAuth 1.0 — FatSecret barcode keys are typically consumer key/secret.
  // Fall back to OAuth 2.0 Bearer only when OAuth 1.0 fails.
  const variants = [clean];
  if (clean.length < 13) variants.push(clean.padStart(13, '0'));
  if (clean.length < 14) variants.push(clean.padStart(14, '0'));

  try {
    let foodId = null;
    for (const code of variants) {
      try {
        const data = await fatSecretOAuth1Get(
          { method: 'food.find_id_for_barcode', barcode: code, format: 'json' },
          key,
          secret,
        );
        foodId = data?.food_id?.value || data?.food_id || null;
        if (foodId) break;
      } catch {
        /* try next GTIN pad */
      }
    }

    if (!foodId) {
      // OAuth 2.0 path (Premier/barcode scope apps)
      const token = await getAccessToken().catch(() => null);
      if (!token) return null;
      for (const code of variants) {
        try {
          const res = await axios.get('https://platform.fatsecret.com/rest/server.api', {
            params: { method: 'food.find_id_for_barcode', barcode: code, format: 'json' },
            headers: { Authorization: `Bearer ${token}` },
            timeout: 12000,
          });
          foodId = res.data?.food_id?.value || res.data?.food_id || null;
          if (foodId) break;
        } catch {
          /* try next */
        }
      }
    }

    if (!foodId) return null;

    let food = null;
    try {
      const detail = await fatSecretOAuth1Get(
        { method: 'food.get.v4', food_id: foodId, format: 'json' },
        key,
        secret,
      );
      food = detail?.food || null;
    } catch {
      const token = await getAccessToken().catch(() => null);
      if (token) {
        const detail = await axios.get('https://platform.fatsecret.com/rest/server.api', {
          params: { method: 'food.get.v4', food_id: foodId, format: 'json' },
          headers: { Authorization: `Bearer ${token}` },
          timeout: 12000,
        });
        food = detail.data?.food || null;
      }
    }

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
