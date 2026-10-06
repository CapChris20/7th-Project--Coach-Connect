// Strips emoji out of a push notification title or body before it is sent.
// Flow: one Unicode pass removes most emoji → older engines get extra passes → leftover double spaces collapse.
// Used by: alert sending. Keep this in step with server/removeEmojiFromAlerts.js. Emoji render badly in some trays.

// ===== NAMED CONSTANTS =====

const PICTOGRAPH_PATTERN = /\p{Extended_Pictographic}/gu;
const FLAG_PAIR_PATTERN = /(?:\uD83C[\uDDE6-\uDDFF]){2}/g;
const KEYCAP_PATTERN = /[#*0-9]\uFE0F\u20E3|[#*0-9]\u20E3/g;
const VARIATION_SELECTOR = /\uFE0F/g;
const ZERO_WIDTH_JOINER = /\u200D/g;
const DOUBLE_SPACE_PATTERN = /\s{2,}/g;

// ===== HELPER FUNCTIONS =====

/**
 * Older JavaScript engines throw when they see a Unicode property escape.
 * @param {string} alertText
 * @returns {string}
 */
function stripPictographs(alertText) {
  try {
    return alertText.replace(PICTOGRAPH_PATTERN, '');
  } catch (_) {
    return alertText;
  }
}

// ===== MAIN FUNCTION =====

/**
 * @param {string} input
 * @returns {string}
 */
export function removeEmojiFromAlerts(input) {
  let alertText = String(input ?? '');
  if (!alertText) return '';

  // vocab: Extended_Pictographic is the Unicode name for emoji pictures. The u flag is required.
  alertText = stripPictographs(alertText);
  // Flag emoji are two regional letters, not pictographs, so the first pass leaves them.
  alertText = alertText.replace(FLAG_PAIR_PATTERN, '');
  alertText = alertText.replace(KEYCAP_PATTERN, '');
  // vocab: FE0F means "draw the previous character as emoji". 200D glues a family emoji together.
  alertText = alertText.replace(VARIATION_SELECTOR, '');
  alertText = alertText.replace(ZERO_WIDTH_JOINER, '');
  return alertText.replace(DOUBLE_SPACE_PATTERN, ' ').trim();
}
