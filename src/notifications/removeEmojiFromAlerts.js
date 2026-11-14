// Strips emoji from push notification titles and bodies before send.
// Flow: coerce to string → pictograph pass → flag/keycap/joiner cleanup → collapse spaces.
// Used by alert sending; keep in sync with server/removeEmojiFromAlerts.js (emoji break in some trays).
// Read order: constants → exported recipe → strip-step PLUMBING.

// ===== NAMED CONSTANTS =====

// Manipulate here: regex list — must stay aligned with the server copy of this file.
// vocab: \p{Extended_Pictographic} = Unicode property escape for standard emoji pictures (needs the u flag)
const PICTOGRAPH_PATTERN = /\p{Extended_Pictographic}/gu;
// Flag emoji = two regional-indicator letters; pictographs alone miss these.
const FLAG_PAIR_PATTERN = /(?:\uD83C[\uDDE6-\uDDFF]){2}/g;
// Phone-style #️⃣ keycaps (digit/symbol + optional variation selector + combining enclosing keycap).
const KEYCAP_PATTERN = /[#*0-9]\uFE0F\u20E3|[#*0-9]\u20E3/g;
// Variation selector that forces emoji rendering of the previous character.
const VARIATION_SELECTOR_PATTERN = /\uFE0F/g;
// Zero-width joiner glues family / multi-part emoji sequences together.
const ZERO_WIDTH_JOINER_PATTERN = /\u200D/g;
const RUN_OF_SPACES_PATTERN = /\s{2,}/g;

// ===== HELPER FUNCTIONS =====
// (strip steps live under PLUMBING)

// ===== MAIN FUNCTION =====

/**
 * Remove emoji (and leftover double spaces) from alert title/body text.
 * @param {string} input
 * @returns {string}
 */
export function removeEmojiFromAlerts(input) {
  // 1. Coerce null/undefined to a string; empty stays empty.
  // vocab/symbol: ?? = if left is null/undefined, use the right side instead
  let alertText = String(input ?? '');
  if (!alertText) return '';

  // 2. Strip standard emoji pictures (safe on older engines — see tryStrip below).
  alertText = tryStripExtendedPictographs(alertText);

  // 3. Strip flag pairs that pictographs do not catch.
  alertText = stripFlagPairs(alertText);

  // 4. Strip keycaps and variation selectors that force emoji rendering.
  alertText = stripKeycapsAndVariationSelectors(alertText);

  // 5. Drop zero-width joiners left after the pictograph pass.
  alertText = stripZeroWidthJoiners(alertText);

  // 6. Collapse double spaces left behind and trim the ends.
  return collapseRunOfSpaces(alertText);
}

// ===== PLUMBING — skip unless debugging =====

/**
 * Older JavaScript engines throw on Unicode property escapes; return original text on failure.
 * @param {string} alertText
 * @returns {string}
 */
function tryStripExtendedPictographs(alertText) {
  try {
    return alertText.replace(PICTOGRAPH_PATTERN, '');
  } catch (unicodeEngineError) {
    return alertText;
  }
}

/**
 * @param {string} alertText
 * @returns {string}
 */
function stripFlagPairs(alertText) {
  return alertText.replace(FLAG_PAIR_PATTERN, '');
}

/**
 * @param {string} alertText
 * @returns {string}
 */
function stripKeycapsAndVariationSelectors(alertText) {
  const withoutKeycaps = alertText.replace(KEYCAP_PATTERN, '');
  return withoutKeycaps.replace(VARIATION_SELECTOR_PATTERN, '');
}

/**
 * @param {string} alertText
 * @returns {string}
 */
function stripZeroWidthJoiners(alertText) {
  return alertText.replace(ZERO_WIDTH_JOINER_PATTERN, '');
}

/**
 * @param {string} alertText
 * @returns {string}
 */
function collapseRunOfSpaces(alertText) {
  return alertText.replace(RUN_OF_SPACES_PATTERN, ' ').trim();
}
