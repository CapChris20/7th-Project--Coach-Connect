/**
 * Serper fallback for barcodes missing from USDA / FatSecret / OFF.
 * Filters generic "barcode tracker" pages and prefers retailer hits with parseable nutrition.
 */

const axios = require('axios');
const { resolveBarcodeBrand: resolveFoodBrandLabel } = require('../../src/nutrition/food-details/cleanFoodBrandName');

const SERPER_JUNK_PATTERN =
  /barcode tracker|fooddata central|gs1 us|dietagram|calorie content of products|search by barcode/i;

const RETAILER_HOST_PATTERN =
  /kroger|walmart|target|heb|safeway|albertsons|qfc|instacart|ghostlifestyle|priceplow/i;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeBarcodeDigits(barcode) {
  return String(barcode || '').replace(/\D/g, '');
}

/** GTIN variants to try in OFF / search queries (UPC-A with leading zeros). */
function barcodeGtinVariants(barcode) {
  const d = normalizeBarcodeDigits(barcode);
  if (!d) return [];
  const variants = new Set([d]);
  if (d.length <= 12) variants.add(d.padStart(12, '0'));
  if (d.length <= 13) variants.add(d.padStart(13, '0'));
  if (d.length <= 14) variants.add(d.padStart(14, '0'));
  return [...variants];
}

function parseMacroGrams(text, labels) {
  const t = String(text || '');
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*[:\\-]?\\s*(\\d+(?:\\.\\d+)?)\\s*g`, 'i');
    const m = t.match(re);
    if (m) return num(m[1]);
  }
  return 0;
}

function parseBarcodeNutritionText(text) {
  const t = String(text || '');
  const cals = num(
    t.match(/(\d+(?:\.\d+)?)\s*cal(?:ories)?/i)?.[1]
    || t.match(/calories\s*[:\\-]?\s*(\d+(?:\.\d+)?)/i)?.[1]
    || 0,
  );
  const protein = parseMacroGrams(t, ['protein']) || num(t.match(/(\d+(?:\.\d+)?)\s*g\s*protein/i)?.[1]);
  const carbs =
    parseMacroGrams(t, ['total carbohydrate', 'carbohydrates', 'carbs', 'total carbs'])
    || num(t.match(/(\d+(?:\.\d+)?)\s*g\s*carb/i)?.[1]);
  const fat =
    parseMacroGrams(t, ['total fat', 'fat'])
    || num(t.match(/(\d+(?:\.\d+)?)\s*g\s*fat/i)?.[1]);
  return { cals, protein, carbs, fat };
}

function estimateCaloriesFromMacros(protein, carbs, fat) {
  const derived = 4 * num(protein) + 4 * num(carbs) + 9 * num(fat);
  return derived > 0 ? Math.round(derived) : 0;
}

function cleanSerperProductName(title, barcode) {
  const raw = String(title || '').trim();
  if (!raw) return `Product ${barcode}`;
  return raw.split('|')[0].split(' · ')[0].trim();
}

function isSerperBarcodeNoise(title, link) {
  const hay = `${title || ''} ${link || ''}`.toLowerCase();
  return SERPER_JUNK_PATTERN.test(hay);
}

function serperResultMatchesBarcode(result, barcode) {
  const digits = normalizeBarcodeDigits(barcode);
  const link = String(result?.link || '');
  const text = `${result?.title || ''} ${result?.snippet || ''} ${link}`;
  const linkTail = link.split('/').pop()?.replace(/\D/g, '') || '';
  return (
    text.includes(digits)
    || barcodeGtinVariants(barcode).some((v) => link.includes(v) || linkTail === v)
  );
}

function scoreSerperOrganicResult(result, barcode) {
  if (!result?.title) return -999;
  if (isSerperBarcodeNoise(result.title, result.link)) return -999;

  let score = 0;
  const link = String(result.link || '').toLowerCase();
  const text = `${result.title || ''} ${result.snippet || ''}`;
  const macros = parseBarcodeNutritionText(text);

  if (serperResultMatchesBarcode(result, barcode)) score += 45;
  if (RETAILER_HOST_PATTERN.test(link)) score += 25;
  if (macros.protein >= 5) score += 18;
  if (macros.cals >= 50 && macros.cals <= 900) score += 12;
  if (macros.carbs > 0 || macros.fat > 0) score += 8;
  if (/cereal|protein|ghost|whey|snack|bar\b/i.test(text)) score += 6;

  return score;
}

function serperOrganicToFood(result, barcode) {
  const text = `${result.title || ''} ${result.snippet || ''}`;
  const { cals, protein, carbs, fat } = parseBarcodeNutritionText(text);
  const calories = cals > 0 ? cals : estimateCaloriesFromMacros(protein, carbs, fat);
  const name = cleanSerperProductName(result.title, barcode);

  if (!name || isSerperBarcodeNoise(name, result.link)) return null;
  if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return null;

  return {
    id: `serper_barcode_${normalizeBarcodeDigits(barcode) || barcode}`,
    name,
    brand: resolveFoodBrandLabel(name, ''),
    restaurant: null,
    calories,
    protein,
    carbs,
    fat,
    fiber: null,
    sodium: null,
    sugar: null,
    servingSize: 1,
    servingUnit: 'serving',
    servingGrams: 41,
    source: 'serper',
    needsVerification: true,
    barcodeConfidence: 'low',
  };
}

function extractSuggestedSearchNames(organic, barcode) {
  const names = [];
  for (const row of organic || []) {
    if (!row?.title || isSerperBarcodeNoise(row.title, row.link)) continue;
    const name = cleanSerperProductName(row.title, barcode);
    if (name && !names.includes(name)) names.push(name);
    if (names.length >= 3) break;
  }
  return names;
}

async function runSerperSearch(apiKey, query, num = 6) {
  const res = await axios.post(
    'https://google.serper.dev/search',
    { q: query, num },
    {
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      timeout: 12000,
    },
  );
  return res.data || {};
}

/**
 * @returns {Promise<{ food: object|null, suggestedSearchQueries: string[] }>}
 */
async function lookupBarcodeWithSerper(barcode) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey || !String(barcode || '').trim()) {
    return { food: null, suggestedSearchQueries: [] };
  }

  const clean = String(barcode).trim();
  const gtin = barcodeGtinVariants(clean).find((v) => v.length >= 12) || normalizeBarcodeDigits(clean);

  try {
    const queries = [
      `${gtin} ghost OR cereal OR protein nutrition facts`,
      `${clean} UPC kroger OR walmart nutrition`,
    ];

    const mergedOrganic = [];
    const seenLinks = new Set();
    for (const q of queries) {
      const data = await runSerperSearch(apiKey, q);
      for (const row of data.organic || []) {
        const key = row.link || row.title;
        if (!key || seenLinks.has(key)) continue;
        seenLinks.add(key);
        mergedOrganic.push(row);
      }
      if (data.answerBox?.title) {
        mergedOrganic.unshift({
          title: data.answerBox.title,
          snippet: data.answerBox.answer || data.answerBox.snippet || '',
          link: data.answerBox.link || '',
        });
      }
    }

    const ranked = mergedOrganic
      .map((row) => ({ row, score: scoreSerperOrganicResult(row, clean) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const suggestedSearchQueries = extractSuggestedSearchNames(mergedOrganic, clean);

    for (const { row } of ranked) {
      const food = serperOrganicToFood(row, clean);
      if (food) {
        return { food, suggestedSearchQueries };
      }
    }

    return { food: null, suggestedSearchQueries };
  } catch (e) {
    console.warn('Serper barcode lookup failed:', e.message);
    return { food: null, suggestedSearchQueries: [] };
  }
}

module.exports = {
  barcodeGtinVariants,
  parseBarcodeNutritionText,
  isSerperBarcodeNoise,
  scoreSerperOrganicResult,
  serperOrganicToFood,
  lookupBarcodeWithSerper,
};
