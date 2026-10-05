// Spreadsheet value formatting: guess a cell's type from what was typed, and render it back out.
// Flow: detectFormat(raw) runs on entry/paste to tag the cell → formatValue(value, cell) runs on
// render to turn the stored value into display text using that tag.
// Used by the display cache and the paste pipeline in the spreadsheet editor.

// Auto-detect: "what did the user just type?" Returns null when nothing matches, meaning
// "leave it as plain text". `normalized` is the clean value we STORE; the original string is
// only for display. Order matters — the most specific patterns are tested first, because a
// currency string like "$1,200" would also loosely resemble a number.
export function detectFormat(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;

  // Currency: a leading symbol, optional space, optional minus, thousands commas, optional decimals.
  // vocab: /^...$/ = anchored regex — must match the WHOLE string, not just part of it
  // vocab: .exec() returns null on no-match, or an array where [1], [2] are the ( ) capture groups
  // Manipulate here: add a symbol to [$€£¥] to recognize another currency.
  const cm = /^([$€£¥])\s*(-?[\d,]+(?:\.\d+)?)$/.exec(s);
  if (cm) return { format: 'currency', normalized: cm[2].replace(/,/g, ''), currency: cm[1] };

  // Percent: we store the MATH value, not the typed one — "50%" is saved as 0.5 so SUM/AVG
  // work correctly. formatValue multiplies by 100 again on the way out.
  const pm = /^(-?[\d,]+(?:\.\d+)?)\s*%$/.exec(s);
  if (pm) return { format: 'percent', normalized: String(parseFloat(pm[1].replace(/,/g, '')) / 100) };

  // Email / URL: deliberately loose "good enough for a spreadsheet" checks, not RFC validation.
  // Their only job is to decide whether the cell renders as a tappable link.
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(s)) return { format: 'email', normalized: s };
  if (/^https?:\/\/\S+$/i.test(s)) return { format: 'url', normalized: s };

  // Phone: the regex allows spaces, dashes, dots and parens, then we count the DIGITS only.
  // Manipulate here: 7–15 digits is the accepted range (short local numbers up to the E.164
  // maximum). Without that digit count, a long dash-separated ID would be mistaken for a phone.
  if (/^\+?[\d][\d\s\-().]{6,}\d$/.test(s) && s.replace(/\D/g, '').length >= 7 && s.replace(/\D/g, '').length <= 15) {
    return { format: 'phone', normalized: s };
  }

  // Date: only two shapes are accepted (M/D/YYYY and YYYY-M-D) to avoid guessing wildly.
  // We then hand it to Date to confirm it's a REAL date — the regex would happily accept 99/99/2024.
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s) || /^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const d = new Date(s);
    // vocab: an invalid Date's getTime() is NaN — that's the standard "did this parse?" test
    // Stored as YYYY-MM-DD (slice(0,10) of the ISO string) so dates sort correctly as strings.
    if (!Number.isNaN(d.getTime())) return { format: 'date', normalized: d.toISOString().slice(0, 10) };
  }

  // Formatted number, e.g. "1,234.5". Bare digits are NOT tagged here — they're already numeric,
  // so they fall through to the default branch of formatValue with no format at all.
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return { format: 'number', normalized: s.replace(/,/g, '') };
  return null;
}

// Render side: stored value + the cell's format tag → the string shown in the grid.
// Every branch defensively falls back to String(value) when the value doesn't match its format,
// so bad data shows the raw text instead of "NaN" or a crash.
export function formatValue(value, cell) {
  if (value == null || value === '') return '';
  // vocab: ?. = optional chaining — `cell` may be undefined when formatting a formula result
  const fmt = cell?.format;
  // Booleans come from formulas (e.g. =A1>5). Uppercase TRUE/FALSE is the spreadsheet convention.
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  switch (fmt) {
    case 'currency': {
      const n = Number(value);
      if (Number.isNaN(n)) return String(value);
      // Manipulate here: '$' is the fallback symbol when the cell didn't record one.
      const sym = cell?.currency || '$';
      // vocab: toLocaleString = format a number using the device's locale (comma/period rules).
      // Passing `undefined` as the locale means "use the device's". Forcing min AND max to 2
      // is what makes money always show cents — "5" renders as "$5.00".
      return sym + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    case 'percent': {
      const n = Number(value);
      if (Number.isNaN(n)) return String(value);
      // Undo the /100 that detectFormat applied when storing.
      // Manipulate here: maximumFractionDigits 2 = how many decimals a percent may show.
      return (n * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + '%';
    }
    case 'number': {
      const n = Number(value);
      if (Number.isNaN(n)) return String(value);
      // Re-inserts locale thousands separators that were stripped on store.
      return n.toLocaleString();
    }
    case 'date': {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      // Displayed in the device's local date style even though it's stored as ISO.
      return d.toLocaleDateString();
    }
    // These three are stored and shown verbatim — the format tag only affects tap behavior
    // and styling elsewhere, not the text itself.
    case 'phone':
    case 'email':
    case 'url':
      return String(value);
    case 'checkbox':
      // Handles both a real boolean and the string "true", since either can reach here.
      // Manipulate here: '☑' / '☐' are the checked/unchecked glyphs.
      return String(value).toLowerCase() === 'true' || value === true ? '☑' : '☐';
    default:
      // Untagged numbers: keep small whole numbers exactly as typed (no thousands separator on
      // "1234", which would look wrong for things like a year or a rep count), and only switch
      // to locale formatting for large or fractional values.
      if (typeof value === 'number') {
        // Manipulate here: 1e6 is the "big enough to deserve separators" threshold.
        if (Number.isInteger(value) && Math.abs(value) < 1e6) return String(value);
        // Manipulate here: 8 decimals is the cap that stops float noise (0.30000000000000004)
        // from leaking into the grid.
        return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
      }
      return String(value);
  }
}

// Formatter for numbers shown OUTSIDE cells (status bar totals, SUM previews, etc).
// Big or whole numbers get 2 decimals; small fractions get 4 so a value like 0.0125 doesn't
// collapse to "0.01" and look like zero movement.
// Manipulate here: the 1000 threshold and the 2 / 4 decimal caps.
export function formatNumberNice(n) {
  // vocab: Number.isFinite = a real number, excluding NaN and Infinity
  if (!Number.isFinite(n)) return String(n);
  if (Math.abs(n) >= 1000 || Number.isInteger(n)) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
