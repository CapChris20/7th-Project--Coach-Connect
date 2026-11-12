// Strip banned coach “honesty” openers from displayed replies.
// Flow: run opener regexes → collapse leftover whitespace → return clean prose.
// Used by: CoachReplyText and InternetAnswerReply (also covers older stored chats).
//
// vocab: honesty opener = “I didn’t search / based on fitness knowledge” preamble

// Manipulate here: add any new nag phrases the model starts with
const HONESTY_OPENERS = [
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

const LEGACY_INJECTED_PREFIX =
  /\s*Live search wasn't available this turn — here's what I know from coaching knowledge, not cited web results\.\s*/gi;

/**
 * Remove banned “didn’t search / coaching knowledge” preambles.
 * @param {string} text
 * @returns {string}
 */
export function stripHonestyOpeners(text) {
  let next = String(text || '').trim();
  if (!next) return '';
  for (let i = 0; i < HONESTY_OPENERS.length; i += 1) {
    next = next.replace(HONESTY_OPENERS[i], '');
  }
  next = next.replace(LEGACY_INJECTED_PREFIX, ' ');
  return next.replace(/\s{2,}/g, ' ').trim();
}
