// Keyword gate for coach messages that must leave the on-device model and hit web search (Perplexity path).
// Flow: normalize user text → scan pharmacology keyword list → any hit routes away from plain coach chat.
// Used right before send on the client; keep aligned with server/lib coach web routing.
// Key export: shouldRouteToPerplexity — other internet-lookup files call this, not the list directly.

// ===== NAMED CONSTANTS =====

// Manipulate here: add or remove terms when product policy changes — matching is substring, order does not matter.
// Grouping below is comments only; the array stays flat for a simple includes() scan.
const PERPLEXITY_TOPIC_KEYWORDS = [
  // hormones / TRT
  'hormone',
  'trt',
  'testosterone',
  'hcg',
  'growth hormone',
  'hgh',
  'insulin',
  // injectables / cycles (user slang + clinical names)
  'inject',
  'steroid',
  'cycle',
  'compound',
  'gear',
  'pct',
  'anavar',
  'tren',
  'nandrolone',
  // research / policy wording
  'pharmacology',
  'doping',
  // SARMs
  'sarm',
  'sarms',
];

// ===== HELPER FUNCTIONS =====

function lowerCaseMessageForScan(userMessage) {
  // vocab: String(x || '') avoids throws when the coach passes undefined from an empty draft.
  return String(userMessage || '').toLowerCase();
}

function messageContainsPerplexityKeyword(lowerMessage) {
  for (let keywordIndex = 0; keywordIndex < PERPLEXITY_TOPIC_KEYWORDS.length; keywordIndex += 1) {
    const keyword = PERPLEXITY_TOPIC_KEYWORDS[keywordIndex];
    // vocab: includes = substring match — "trt" hits when those letters appear contiguously.
    if (lowerMessage.includes(keyword)) {
      return true;
    }
  }
  return false;
}

// ===== MAIN FUNCTION =====

/**
 * True when the user message touches pharmacology or performance-drug topics that need web routing.
 * Flow: 1. lower-case normalize  2. empty → false  3. any keyword hit → Perplexity
 * @param {string} userMessage
 * @returns {boolean}
 */
export function shouldRouteToPerplexity(userMessage) {
  // 1. Normalize to lower-case so matching ignores case (and avoids throws on undefined drafts).
  const lowerMessage = lowerCaseMessageForScan(userMessage);

  // 2. Blank / whitespace-only drafts never leave the on-device path.
  if (!lowerMessage.trim()) return false;

  // 3. Any keyword hit means Perplexity, not the default coach model path.
  return messageContainsPerplexityKeyword(lowerMessage);
}
