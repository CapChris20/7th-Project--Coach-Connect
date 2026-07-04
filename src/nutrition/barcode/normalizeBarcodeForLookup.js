/**
 * Normalize camera/manual barcode digits before server lookup.
 * Handles common 11-digit UPC-A truncations from mobile scanners.
 */
export function normalizeBarcodeForLookup(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 11) return d.padStart(12, '0');
  if (d.length >= 8 && d.length <= 14) return d;
  if (d.length < 8) return d.padStart(12, '0');
  return d.slice(0, 14);
}
