/**
 * AI Coach web-search routing (server). Keep in sync with src/ai/webSearchRouting.js.
 */

/** Explicit user intent to search the internet — not "this week" / normal coaching questions. */
function shouldUseWebAuto(userText) {
  const raw = String(userText || '');
  const t = raw.toLowerCase();
  if (!t.trim()) return false;

  const explicit = [
    'google',
    'go online',
    'on the web',
    'on the internet',
    'search the web',
    'search online',
    'search for',
    'look up online',
    'look this up',
    'find online',
    'browse the',
    'browse for',
    'latest research',
    'latest study',
    'latest studies',
    'recent research',
    'recent study',
    'recent studies',
    'meta-analysis',
    'what does the research say',
    'what do studies say',
    'cite sources',
    'with sources',
    'nutrition facts for',
    'calories in a',
    'calories in the',
    'near me',
    'restaurant menu',
  ];
  if (explicit.some((k) => t.includes(k))) return true;

  if (/\b(search|lookup|look up)\b/.test(t) && /\b(web|online|internet|google)\b/.test(t)) {
    return true;
  }

  const hasNumbers = /\d/.test(t);
  const long = t.length >= 120;
  const hasQuoted = /"[^"]{6,}"/.test(raw);
  return (long && hasNumbers) || hasQuoted;
}

function shouldUsePerplexity(userMessage) {
  const t = String(userMessage || '').toLowerCase();
  if (!t.trim()) return false;
  const keywords = [
    'hormone', 'trt', 'testosterone', 'inject', 'steroid', 'cycle', 'compound', 'gear', 'pct', 'hcg',
    'anavar', 'tren', 'nandrolone', 'pharmacology', 'doping', 'sarm', 'sarms',
    'growth hormone', 'insulin', 'hgh',
  ];
  return keywords.some((k) => t.includes(k));
}

/** @param {'auto'|'on'|'off'} webMode */
function shouldInvokeWebSearch(webMode, userMessage) {
  if (webMode === 'off') return false;
  if (webMode === 'on') return true;
  return shouldUseWebAuto(userMessage) || shouldUsePerplexity(userMessage);
}

/** Only for POST /api/ai-coach/web-search (forced live search). */
function shouldForceDedicatedWebSearchRoute(userMessage) {
  const t = String(userMessage || '').toLowerCase();
  if (!t.trim()) return false;
  return (
    /\b(search the web|search online|google it|look it up online|browse the web)\b/.test(t) ||
    (/\b(search|google)\b/.test(t) && /\b(web|online|internet)\b/.test(t))
  );
}

const WEB_SEARCH_SYSTEM_APPEND = `

WEB SEARCH MODE:
You have live web results in this prompt (Perplexity or Serper snippets). Use them for current facts, studies, products, and news.
Mention source names naturally in your sentences when you cite a specific claim — still no bullets, bold, or lists.
Do not say you cannot access the internet. Same coach voice: direct, casual, lead with the takeaway.`;

module.exports = {
  shouldUseWebAuto,
  shouldUsePerplexity,
  shouldInvokeWebSearch,
  shouldForceDedicatedWebSearchRoute,
  WEB_SEARCH_SYSTEM_APPEND,
};
