/**
 * Firestore cache of user-verified barcode → food rows (shared catalog).
 * Checked before USDA/FatSecret/OFF on /api/food/barcode.
 */
const admin = require('firebase-admin');

const COLLECTION = 'verifiedBarcodes';

function toGtin14(barcode) {
  const d = String(barcode || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length > 14) return d.slice(-14);
  return d.padStart(14, '0');
}

function verifiedBarcodeDocId(barcode) {
  return toGtin14(barcode) || String(barcode || '').replace(/\D/g, '');
}

async function getVerifiedBarcode(barcode) {
  const docId = verifiedBarcodeDocId(barcode);
  if (!docId) return null;
  try {
    const snap = await admin.firestore().collection(COLLECTION).doc(docId).get();
    if (!snap.exists) return null;
    const data = snap.data()?.food;
    if (!data || typeof data !== 'object') return null;
    return {
      ...data,
      verified: true,
      source: data.source || 'verified_cache',
      barcodeConfidence: 'high',
      needsVerification: false,
      gtinUpc: data.gtinUpc || docId,
    };
  } catch (e) {
    console.warn('[Barcode] verified cache read failed:', e.message);
    return null;
  }
}

async function saveVerifiedBarcode(barcode, food, uid = null) {
  const docId = verifiedBarcodeDocId(barcode);
  if (!docId || !food || typeof food !== 'object') return false;
  const name = String(food.name || food.food_name || '').trim();
  if (!name) return false;

  const payload = {
    gtin: docId,
    food: {
      ...food,
      verified: true,
      gtinUpc: food.gtinUpc || docId,
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastVerifiedBy: uid || null,
    verifyCount: admin.firestore.FieldValue.increment(1),
  };

  try {
    const ref = admin.firestore().collection(COLLECTION).doc(docId);
    const existing = await ref.get();
    if (!existing.exists) {
      payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
      payload.verifyCount = 1;
    }
    await ref.set(payload, { merge: true });
    console.log('[Barcode] Saved verified cache:', docId, name);
    return true;
  } catch (e) {
    console.warn('[Barcode] verified cache write failed:', e.message);
    return false;
  }
}

module.exports = {
  toGtin14,
  verifiedBarcodeDocId,
  getVerifiedBarcode,
  saveVerifiedBarcode,
};
