/**
 * perplexity Service
 *
 * Purpose: Data/service layer: perplexity Service. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/ai
 * Key exports: shouldRouteToPerplexity
 *
 * @file-header
 */
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

export function shouldRouteToPerplexity(userMessage) {
  const t = String(userMessage || '').toLowerCase();
  if (!t.trim()) return false;
  return PERPLEXITY_KEYWORDS.some((k) => t.includes(k));
}
