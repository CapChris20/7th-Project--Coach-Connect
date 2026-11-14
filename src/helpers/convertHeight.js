// US height input engine — one text field where the user types 5'11" (or 5,11 / 5-11 / 5 11).
// Flow: raw keystrokes → normalize odd punctuation → strip to digits + ' " → parse into { feet, inches }.
// Used by: onboarding and profile height fields. `height: null` means "keep typing, not valid yet".
// Read order: constants → helpers → numbered mains. Same return shapes as before.

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
 * @param {*} rawText
 * @returns {string}
 */
function turnOddSeparatorsIntoFootMarks(rawText) {
  return String(rawText || '')
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
 * @param {*} rawText
 * @returns {string}
 */
function cleanHeightDraftText(rawText) {
  const withNormalMarks = turnOddSeparatorsIntoFootMarks(rawText);
  return withNormalMarks.replace(/[^0-9'"]/g, '').slice(0, MAX_HEIGHT_DRAFT_LENGTH);
}

/**
 * Render { feet, inches } as `5'11"`.
 * @param {number} feet
 * @param {number} inches
 * @returns {string}
 */
function buildHeightDisplayText(feet, inches) {
  return `${feet}'${inches}"`;
}

/**
 * True when this value is a plain object (not null, not an array).
 * @param {*} heightValue
 * @returns {boolean}
 */
function heightValueIsPlainObject(heightValue) {
  if (heightValue == null) return false;
  if (typeof heightValue !== 'object') return false;
  if (Array.isArray(heightValue)) return false;
  return true;
}

/**
 * Split a legacy total-inches number into feet + leftover inches.
 * @param {number} totalInchesAsNumber
 * @returns {{ feet: number, inches: number }}
 */
function splitTotalInchesIntoFeetAndInches(totalInchesAsNumber) {
  const totalInches = Math.round(totalInchesAsNumber);
  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  const inches = totalInches % INCHES_PER_FOOT;
  return { feet, inches };
}

/**
 * Clamp a two-digit inch string into 0–11.
 * @param {string} inchDigits
 * @returns {number}
 */
function clampInchDigitsToValidRange(inchDigits) {
  const twoDigitSlice = inchDigits.slice(0, INCH_DIGITS_NEEDED_TO_COMMIT);
  const parsedInches = parseInt(twoDigitSlice, 10);
  const notBelowMin = Math.max(MIN_INCHES, parsedInches);
  return Math.min(MAX_INCHES, notBelowMin);
}

/**
 * On blur / Next: accept one-digit inches when the live parser still said "keep typing".
 * @param {string} draftText
 * @returns {{ feet: number, inches: number }|null}
 */
function tryCommitHeightOnBlur(draftText) {
  // vocab: ^...$ = whole-string match so trailing junk cannot sneak in
  const blurPattern = /^(\d{1,2})'(\d{1,2})"?$/;
  const match = draftText.match(blurPattern);
  if (!match) return null;

  const heightObject = {
    feet: parseInt(match[1], 10),
    inches: parseInt(match[2], 10),
  };
  if (!isHeightComplete(heightObject)) return null;
  return heightObject;
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

  // 1. Modern shape: { feet, inches } with partial drafts allowed while typing.
  if (heightValueIsPlainObject(heightValue)) {
    const feet = heightValue.feet;
    const inches = heightValue.inches;
    if (feet == null || feet === '') return '';
    if (inches == null || inches === '') return `${feet}'`;
    return buildHeightDisplayText(feet, inches);
  }

  // 2. Legacy shape: one number = total inches from older saves.
  const storedAsFiniteNumber =
    typeof heightValue === 'number' && Number.isFinite(heightValue);
  if (storedAsFiniteNumber) {
    const parts = splitTotalInchesIntoFeetAndInches(heightValue);
    return buildHeightDisplayText(parts.feet, parts.inches);
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
  // 1. Must be a real object with feet + inches fields.
  if (!heightValueIsPlainObject(heightValue)) return false;

  // 2. Both numbers finite and inside the accepted adult range.
  const feet = Number(heightValue.feet);
  const inches = Number(heightValue.inches);
  const feetIsValid =
    Number.isFinite(feet) && feet >= MIN_FEET_COMPLETE && feet <= MAX_FEET;
  const inchesIsValid =
    Number.isFinite(inches) && inches >= MIN_INCHES && inches <= MAX_INCHES;
  if (!feetIsValid) return false;
  if (!inchesIsValid) return false;
  return true;
}

/**
 * Parse height while typing. Returns the sanitized draft as `text` so ' and " stay visible.
 * Two return values because the field must keep showing a partial draft even when nothing is valid yet.
 * @param {*} raw
 * @returns {{ text: string, height: { feet: number, inches: number } | null }}
 */
export function parseHeightInputText(raw) {
  // 1. Strip junk but keep foot and inch marks so the field still looks like what they typed.
  const draft = cleanHeightDraftText(raw);
  if (!draft) return { text: '', height: null };

  // 2. Try a strict pattern first — feet, optional inches, optional closing quote.
  // vocab: (?:...) = group that isn't captured; ^ and $ anchor it so junk can't tag along
  const completePattern = /^(\d{1,2})(?:'(\d{0,2})?)?"?$/;
  const match = draft.match(completePattern);
  if (!match) {
    const leadingDigitsMatch = draft.match(/^(\d{1,2})/);
    if (leadingDigitsMatch) return { text: draft, height: null };
    return { text: '', height: null };
  }

  // 3. Reject feet outside the typing window before we bother with inches.
  const feet = parseInt(match[1], 10);
  const feetOutOfRange =
    !Number.isFinite(feet) ||
    feet < MIN_FEET_WHILE_TYPING ||
    feet > MAX_FEET;
  if (feetOutOfRange) return { text: draft, height: null };

  // 4. No inch digits yet → keep the draft visible, do not commit.
  const inchPart = match[2];
  if (inchPart == null || inchPart === '') {
    return { text: draft, height: null };
  }

  // 5. A single inch digit is ambiguous: "5'1" might still become 5'11".
  if (inchPart.length === 1) {
    return { text: draft, height: null };
  }

  // 6. Clamp inches, then run the same complete check as blur / save.
  const inches = clampInchDigitsToValidRange(inchPart);
  const height = { feet, inches };
  if (!isHeightComplete(height)) {
    return { text: draft, height: null };
  }

  return {
    text: buildHeightDisplayText(feet, inches),
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
  // 1. Reuse live parser when it already locked a complete height.
  const liveParse = parseHeightInputText(raw);
  if (liveParse.height) return liveParse.height;

  // 2. On blur, accept one-digit inches when the pattern is otherwise complete.
  const draft = cleanHeightDraftText(raw);
  if (!draft) return null;
  return tryCommitHeightOnBlur(draft);
}
