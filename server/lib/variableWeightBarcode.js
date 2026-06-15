/**
 * US grocery store scale barcodes (prefix 2) encode price or weight per package.
 * They are NOT manufacturer GTINs — USDA/FatSecret/OFF will never match them.
 */

function normalizeBarcodeDigits(barcode) {
  return String(barcode || '').replace(/\D/g, '');
}

/** UPC-A variable-weight item (number system 2). */
function isVariableWeightBarcode(barcode) {
  const d = normalizeBarcodeDigits(barcode);
  if (!d) return false;
  const upc =
    d.length === 13 && d.startsWith('0') ? d.slice(1)
    : d.length === 12 ? d
    : d.length === 11 ? `2${d}`
    : '';
  return upc.length === 12 && upc[0] === '2';
}

function parseVariableWeightBarcode(barcode) {
  const d = normalizeBarcodeDigits(barcode);
  if (!d) return null;

  let upc = d;
  if (d.length === 13 && d.startsWith('0')) upc = d.slice(1);
  if (upc.length !== 12 || upc[0] !== '2') return null;

  const itemPlu = upc.slice(1, 6);
  const valueField = upc.slice(6, 11);
  const checkDigit = upc.slice(11, 12);
  const valueNum = parseInt(valueField, 10);

  const embeddedPriceCents = Number.isFinite(valueNum) ? valueNum : null;
  const embeddedPriceDollars =
    embeddedPriceCents != null ? Math.round(embeddedPriceCents) / 100 : null;

  return {
    type: 'variable_weight',
    prefix: upc[0],
    itemPlu,
    valueField,
    embeddedPriceCents,
    embeddedPriceDollars,
    encoding: 'price',
    checkDigit,
    scannedDigits: d,
  };
}

function variableWeightBarcodeHint(barcode) {
  const parsed = parseVariableWeightBarcode(barcode);
  if (!parsed) return null;

  return {
    notFound: true,
    variableWeightBarcode: true,
    ...parsed,
    message:
      'This is a grocery store scale barcode (unique to this package). It is not in USDA, FatSecret, or Open Food Facts. Search using the product name printed on the label.',
    suggestedSearchQueries: [
      'boneless skinless chicken breast',
      'chicken breast raw',
    ],
  };
}

module.exports = {
  normalizeBarcodeDigits,
  isVariableWeightBarcode,
  parseVariableWeightBarcode,
  variableWeightBarcodeHint,
};
