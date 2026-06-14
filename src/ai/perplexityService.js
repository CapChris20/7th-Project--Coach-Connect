/**
 * Client-side Perplexity routing heuristics (mirrors server shouldUsePerplexity).
 */
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
  'test',
  'tren',
  'nandrolone',
  'pharmacology',
  'doping',
  'sarm',
  'sarms',
  'gh',
  'growth hormone',
  'insulin',
  'hgh',
];

export function shouldRouteToPerplexity(userMessage) {
  const t = String(userMessage || '').toLowerCase();
  if (!t.trim()) return false;
  return PERPLEXITY_KEYWORDS.some((k) => t.includes(k));
}
