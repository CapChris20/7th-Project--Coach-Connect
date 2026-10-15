// Client-side keyword list for messages that should use web lookup (Perplexity route).
// Flow: normalize text → scan keyword list → match means route away from plain coach.
// Used before send; mirrors server/lib coach web routing.

// ===== NAMED CONSTANTS =====

const PERPLEXITY_TOPIC_KEYWORDS = [
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

// ===== MAIN FUNCTION =====

/**
 * True when the user message touches pharmacology / PED topics that need web routing.
 * @param {string} userMessage
 * @returns {boolean}
 */
export function shouldRouteToPerplexity(userMessage) {
  const lowerMessage = String(userMessage || '').toLowerCase();
  if (!lowerMessage.trim()) return false;
  return anyPerplexityKeywordMatches(lowerMessage);
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function anyPerplexityKeywordMatches(lowerMessage) {
  for (let keywordIndex = 0; keywordIndex < PERPLEXITY_TOPIC_KEYWORDS.length; keywordIndex += 1) {
    const keyword = PERPLEXITY_TOPIC_KEYWORDS[keywordIndex];
    if (lowerMessage.includes(keyword)) return true;
  }
  return false;
}
