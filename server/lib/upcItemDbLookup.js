/**
 * Free UPCitemdb trial lookup — name/brand assist when USDA/OFF/FatSecret miss a GTIN.
 * Trial API is rate-limited; failures return null and are ignored.
 */
const axios = require('axios');
const { barcodeGtinVariants } = require('./barcodeSerperLookup');

async function lookupUpcItemDb(barcode) {
  const variants = barcodeGtinVariants(barcode);
  if (!variants.length) return null;

  for (const upc of variants) {
    if (upc.length < 8 || upc.length > 14) continue;
    try {
      const res = await axios.get('https://api.upcitemdb.com/prod/trial/lookup', {
        params: { upc },
        timeout: 8000,
        validateStatus: (s) => s < 500,
      });
      if (res.status === 429 || res.status === 400) return null;
      const item = res.data?.items?.[0];
      if (!item?.title) continue;
      return {
        name: String(item.title).trim(),
        brand: String(item.brand || '').trim() || null,
        source: 'upcitemdb',
        gtinUpc: upc,
      };
    } catch (e) {
      console.warn('[Barcode] UPCitemdb lookup failed:', e.message);
      return null;
    }
  }
  return null;
}

module.exports = { lookupUpcItemDb };
