// Client-side check for topics that should go to a web lookup instead of the normal coach reply.
// Flow: lowercase the message → see if any keyword is in it.
// Used by: the coach before it sends a message. This list mirrors the server check.

// ===== NAMED CONSTANTS =====

const PERPLEXITY_KEYWORDS = [
  'hormone',
  'trt',
  'testosterone',
  'inject',
  'steroid',
  'cycle',
  'compound',
  'gear',
  'pct',
  'hcg',
  'anavar',
  'tren',
  'nandrolone',
  'pharmacology',
  'doping',
  'sarm',
  'sarms',
  'growth hormone',
  'insulin',
  'hgh',
];

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} messageText
 * @param {string} keyword
 * @returns {boolean}
 */
function messageIncludesKeyword(messageText, keyword) {
  return messageText.includes(keyword);
}

// ===== MAIN FUNCTION =====

/**
 * @param {string} userMessage
 * @returns {boolean}
 */
export function shouldRouteToPerplexity(userMessage) {
  const messageText = String(userMessage || '').toLowerCase();
  if (!messageText.trim()) return false;
  return PERPLEXITY_KEYWORDS.some((keyword) => messageIncludesKeyword(messageText, keyword));
}
