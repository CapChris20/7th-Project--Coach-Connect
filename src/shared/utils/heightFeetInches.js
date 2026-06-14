/**
 * US height input: single field like 5'11" or 5,11 → { feet, inches }.
 */

/** iOS / Android often insert curly quotes — map every variant to ASCII ' and ". */
const SMART_FOOT_MARKS = /[\u2018\u2019\u201A\u201B\u2032\u2035\u0060\u00B4′´`ˈ]/g;
const SMART_INCH_MARKS = /[\u201C\u201D\u201E\u201F\u2033\u2036\u00AB\u00BB„"]/g;

function normalizeHeightRawInput(raw) {
  return String(raw || '')
    .replace(SMART_FOOT_MARKS, "'")
    .replace(SMART_INCH_MARKS, '"')
    .replace(/,/g, "'")
    .replace(/-/g, "'")
    .replace(/(\d)\s+(\d)/g, "$1'$2");
}

/** Normalize first, then keep digits + foot/inch marks only. */
function sanitizeHeightDraft(raw) {
  const normalized = normalizeHeightRawInput(raw);
  return normalized.replace(/[^0-9'"]/g, '').slice(0, 8);
}

export function formatHeightInputDisplay(h) {
  if (h == null) return '';
  if (typeof h === 'object' && !Array.isArray(h)) {
    const ft = h.feet;
    const inch = h.inches;
    if (ft == null || ft === '') return '';
    if (inch == null || inch === '') {
      return `${ft}'`;
    }
    return `${ft}'${inch}"`;
  }
  if (typeof h === 'number' && Number.isFinite(h)) {
    const total = Math.round(h);
    const feet = Math.floor(total / 12);
    const inches = total % 12;
    return `${feet}'${inches}"`;
  }
  return '';
}

export function isHeightComplete(h) {
  if (!h || typeof h !== 'object' || Array.isArray(h)) return false;
  const feet = Number(h.feet);
  const inches = Number(h.inches);
  return (
    Number.isFinite(feet) &&
    Number.isFinite(inches) &&
    feet >= 3 &&
    feet <= 8 &&
    inches >= 0 &&
    inches <= 11
  );
}

/**
 * Parse height while typing. Returns the sanitized draft as `text` so ' and " stay visible.
 * @returns {{ text: string, height: { feet: number, inches: number } | null }}
 */
export function parseHeightInputText(raw) {
  const draft = sanitizeHeightDraft(raw);
  if (!draft) return { text: '', height: null };

  const match = draft.match(/^(\d{1,2})(?:'(\d{0,2})?)?"?$/);
  if (!match) {
    // Partial typing — show exactly what we kept (digits + ' ")
    const loose = draft.match(/^(\d{1,2})/);
    if (loose) return { text: draft, height: null };
    return { text: '', height: null };
  }

  const feet = parseInt(match[1], 10);
  if (!Number.isFinite(feet) || feet < 1 || feet > 8) {
    return { text: draft, height: null };
  }

  const inchPart = match[2];
  if (inchPart == null || inchPart === '') {
    return { text: draft, height: null };
  }

  if (inchPart.length === 1) {
    return { text: draft, height: null };
  }

  const inches = Math.min(11, Math.max(0, parseInt(inchPart.slice(0, 2), 10)));
  const height = { feet, inches };
  if (!isHeightComplete(height)) {
    return { text: draft, height: null };
  }

  return {
    text: `${feet}'${inches}"`,
    height,
  };
}

/**
 * Commit height from a draft when the user finished typing (e.g. 5'9 or 5'11).
 * parseHeightInputText intentionally waits for two inch digits while typing 5'11".
 */
export function finalizeHeightFromDraft(raw) {
  const { height } = parseHeightInputText(raw);
  if (height) return height;

  const draft = sanitizeHeightDraft(raw);
  if (!draft) return null;

  const match = draft.match(/^(\d{1,2})'(\d{1,2})"?$/);
  if (!match) return null;

  const heightObj = {
    feet: parseInt(match[1], 10),
    inches: parseInt(match[2], 10),
  };
  return isHeightComplete(heightObj) ? heightObj : null;
}
