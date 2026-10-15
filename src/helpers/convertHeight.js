// US height input engine — one text field where the user types 5'11" (or 5,11 / 5-11 / 5 11).
// Flow: raw keystrokes → normalize odd punctuation → strip to digits + ' " → parse into { feet, inches }.
// Used by: onboarding and profile height fields. `height: null` means "keep typing, not valid yet".

// ===== NAMED CONSTANTS =====

// Phone keyboards auto-substitute curly/typographic quotes, and users type commas, dashes, or a space.
// vocab: /[...]/g = character-class regex; the \uXXXX entries are curly-quote/prime code points
// vocab: primes = ′ (foot) and ″ (inch) marks that look like quotes but are different characters
const SMART_FOOT_MARKS = /[\u2018\u2019\u201A\u201B\u2032\u2035\u0060\u00B4′´`ˈ]/g;
const SMART_INCH_MARKS = /[\u201C\u201D\u201E\u201F\u2033\u2036\u00AB\u00BB„"]/g;
// Manipulate here: 8 is the max draft length — enough for 5'11" plus stray marks.
const MAX_HEIGHT_DRAFT_LENGTH = 8;
const INCHES_PER_FOOT = 12;
const MIN_FEET_COMPLETE = 3;
const MAX_FEET = 8;
const MIN_FEET_WHILE_TYPING = 1;
const MIN_INCHES = 0;
const MAX_INCHES = 11;
const INCH_DIGITS_NEEDED_TO_COMMIT = 2;

// ===== HELPER FUNCTIONS =====

/**
 * Make every separator the user might produce mean "feet mark".
 * Manipulate here: add another `.replace(/X/g, "'")` line to accept a new separator character.
 * @param {*} raw
 * @returns {string}
 */
function normalizeHeightRawInput(raw) {
  return String(raw || '')
    .replace(SMART_FOOT_MARKS, "'")
    .replace(SMART_INCH_MARKS, '"')
    .replace(/,/g, "'")
    .replace(/-/g, "'")
    .replace(/(\d)\s+(\d)/g, "$1'$2");
}

/**
 * Normalize first, then keep digits + foot/inch marks only.
 * Order matters: normalize BEFORE stripping, or curly quotes would be deleted as junk
 * and "5’11”" would collapse to the meaningless "511".
 * @param {*} raw
 * @returns {string}
 */
function sanitizeHeightDraft(raw) {
  const normalized = normalizeHeightRawInput(raw);
  return normalized.replace(/[^0-9'"]/g, '').slice(0, MAX_HEIGHT_DRAFT_LENGTH);
}

/**
 * Render { feet, inches } as `5'11"`.
 * @param {number} feet
 * @param {number} inches
 * @returns {string}
 */
function heightDisplayString(feet, inches) {
  return `${feet}'${inches}"`;
}

// ===== MAIN FUNCTION =====

/**
 * Renders a stored height back into the field.
 * Handles both { feet, inches } and legacy total-inches numbers.
 * @param {*} heightValue
 * @returns {string}
 */
export function formatHeightInputDisplay(heightValue) {
  // vocab/symbol: == null = true for BOTH null and undefined (the one place loose equality is useful)
  if (heightValue == null) return '';
  if (typeof heightValue === 'object' && !Array.isArray(heightValue)) {
    const feet = heightValue.feet;
    const inches = heightValue.inches;
    if (feet == null || feet === '') return '';
    if (inches == null || inches === '') {
      return `${feet}'`;
    }
    return heightDisplayString(feet, inches);
  }
  if (typeof heightValue === 'number' && Number.isFinite(heightValue)) {
    const totalInches = Math.round(heightValue);
    const feet = Math.floor(totalInches / INCHES_PER_FOOT);
    const inches = totalInches % INCHES_PER_FOOT;
    return heightDisplayString(feet, inches);
  }
  return '';
}

/**
 * The validity gate. Nothing below commits a height until this passes.
 * Manipulate here: 3–8 feet is the accepted range; inches must stay 0–11.
 * @param {*} heightValue
 * @returns {boolean}
 */
export function isHeightComplete(heightValue) {
  if (!heightValue || typeof heightValue !== 'object' || Array.isArray(heightValue)) return false;
  const feet = Number(heightValue.feet);
  const inches = Number(heightValue.inches);
  return (
    Number.isFinite(feet) &&
    Number.isFinite(inches) &&
    feet >= MIN_FEET_COMPLETE &&
    feet <= MAX_FEET &&
    inches >= MIN_INCHES &&
    inches <= MAX_INCHES
  );
}

/**
 * Parse height while typing. Returns the sanitized draft as `text` so ' and " stay visible.
 * Two return values because the field must keep showing a partial draft even when nothing is valid yet.
 * @param {*} raw
 * @returns {{ text: string, height: { feet: number, inches: number } | null }}
 */
export function parseHeightInputText(raw) {
  const draft = sanitizeHeightDraft(raw);
  if (!draft) return { text: '', height: null };

  // vocab: (?:...) = group that isn't captured; ^ and $ anchor it so junk can't tag along
  const match = draft.match(/^(\d{1,2})(?:'(\d{0,2})?)?"?$/);
  if (!match) {
    const leadingDigitsMatch = draft.match(/^(\d{1,2})/);
    if (leadingDigitsMatch) return { text: draft, height: null };
    return { text: '', height: null };
  }

  const feet = parseInt(match[1], 10);
  if (!Number.isFinite(feet) || feet < MIN_FEET_WHILE_TYPING || feet > MAX_FEET) {
    return { text: draft, height: null };
  }

  const inchPart = match[2];
  if (inchPart == null || inchPart === '') {
    return { text: draft, height: null };
  }

  // A single inch digit is ambiguous: "5'1" might still become 5'11".
  if (inchPart.length === 1) {
    return { text: draft, height: null };
  }

  const inches = Math.min(MAX_INCHES, Math.max(MIN_INCHES, parseInt(inchPart.slice(0, INCH_DIGITS_NEEDED_TO_COMMIT), 10)));
  const height = { feet, inches };
  if (!isHeightComplete(height)) {
    return { text: draft, height: null };
  }

  return {
    text: heightDisplayString(feet, inches),
    height,
  };
}

/**
 * Commit height from a draft when the user finished typing (e.g. 5'9 or 5'11).
 * parseHeightInputText waits for two inch digits while typing; call this on blur / Next.
 * @param {*} raw
 * @returns {{ feet: number, inches: number }|null}
 */
export function finalizeHeightFromDraft(raw) {
  const { height } = parseHeightInputText(raw);
  if (height) return height;

  const draft = sanitizeHeightDraft(raw);
  if (!draft) return null;

  const match = draft.match(/^(\d{1,2})'(\d{1,2})"?$/);
  if (!match) return null;

  const heightObject = {
    feet: parseInt(match[1], 10),
    inches: parseInt(match[2], 10),
  };
  return isHeightComplete(heightObject) ? heightObject : null;
}
