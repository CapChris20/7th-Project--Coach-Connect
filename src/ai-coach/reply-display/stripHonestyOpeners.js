// Strip banned coach “honesty” openers from displayed replies.
// Flow: trim reply → peel regex openers → peel legacy injected prefix → collapse spaces.
// Used by: CoachReplyText and InternetAnswerReply (also covers older stored chats).
//
// vocab: honesty opener = “I didn’t search / based on fitness knowledge” preamble

// ===== NAMED CONSTANTS =====

// Manipulate here: add any new nag phrases the model starts with
const HONESTY_OPENER_PATTERNS = [
  /^live search (?:wasn't|was not|isn't|is not) available[^.!?]*[.!?]\s*/i,
  /^here(?:'s| is) what i know from (?:coaching|fitness) knowledge[^.!?]*[.!?]\s*/i,
  /^based on (?:my )?(?:general )?(?:coaching|fitness) knowledge[^.!?]*[.!?]\s*/i,
  /^i(?:'m| am) answering from (?:built-in )?(?:coaching|fitness) knowledge[^.!?]*[.!?]\s*/i,
  /^answering from (?:built-in )?(?:coaching|fitness) knowledge[^.!?]*[.!?]\s*/i,
  /^i (?:did not|didn't) (?:run a )?live search[^.!?]*[.!?]\s*/i,
  /^i (?:did not|didn't) search the web[^.!?]*[.!?]\s*/i,
  /^i (?:could not|couldn't) (?:search|look (?:that )?up) (?:online|the web)[^.!?]*[.!?]\s*/i,
  /^no live (?:web )?search (?:this turn|available)[^.!?]*[.!?]\s*/i,
  /^note:?\s*(?:i )?(?:did not|didn't) search[^.!?]*[.!?]\s*/i,
];

// Older chats may still carry this exact injected sentence from an earlier client build.
const LEGACY_INJECTED_HONESTY_SENTENCE =
  /\s*Live search wasn't available this turn — here's what I know from coaching knowledge, not cited web results\.\s*/gi;

// ===== MAIN FUNCTION =====

/**
 * Remove banned “didn’t search / coaching knowledge” preambles from visible reply text.
 * Flow: 1. empty guard  2. peel start-of-reply patterns  3. peel legacy inject  4. collapse spaces
 * @param {string} text
 * @returns {string}
 */
export function stripHonestyOpeners(text) {
  // 1. Empty / whitespace-only replies stay empty.
  if (text == null) {
    return '';
  }
  const trimmedReply = String(text).trim();
  if (!trimmedReply) {
    return '';
  }

  // 2. Peel every start-of-reply honesty regex.
  const afterPatterns = peelHonestyOpenerPatterns(trimmedReply);

  // 3. Older stored chats may still carry the exact injected legacy sentence mid-body.
  const afterLegacy = peelLegacyInjectedHonestySentence(afterPatterns);

  // 4. Collapse leftover double spaces from the peels.
  return collapseExtraSpaces(afterLegacy);
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless a new honesty preamble sneaks into the bubble.

function collapseExtraSpaces(replyText) {
  const withoutRuns = replyText.replace(/\s{2,}/g, ' ');
  return withoutRuns.trim();
}

function peelLegacyInjectedHonestySentence(replyText) {
  return replyText.replace(LEGACY_INJECTED_HONESTY_SENTENCE, ' ');
}

function peelHonestyOpenerPatterns(replyText) {
  let withoutOpeners = replyText;
  for (
    let patternIndex = 0;
    patternIndex < HONESTY_OPENER_PATTERNS.length;
    patternIndex += 1
  ) {
    const pattern = HONESTY_OPENER_PATTERNS[patternIndex];
    withoutOpeners = withoutOpeners.replace(pattern, '');
  }
  return withoutOpeners;
}
