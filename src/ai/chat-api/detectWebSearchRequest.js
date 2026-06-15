/**
 * web Search Routing
 *
 * Purpose: web Search Routing — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/ai
 * Key exports: shouldUseWebAuto, shouldShowWebSearchUI, shouldInvokeWebSearch, shouldForceDedicatedWebSearchRoute
 *
 * @file-header
 */
/**
 * AI Coach web-search routing (client). Keep in sync with server/lib/coachWebSearch.js.
 */
import { shouldRouteToPerplexity } from '../perplexityService';

/** Explicit internet search — not routine coaching ("this week", sleep, streak, etc.). */
export function shouldUseWebAuto(userText) {
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

/** UI hint: show "Searching the web…" (slightly broader than server auto-route). */
export function shouldShowWebSearchUI(userText) {
  return shouldUseWebAuto(userText) || shouldRouteToPerplexity(userText);
}

/** @param {'auto'|'on'|'off'} [webMode='auto'] */
export function shouldInvokeWebSearch(userText, webMode = 'auto') {
  if (webMode === 'off') return false;
  if (webMode === 'on') return true;
  return shouldUseWebAuto(userText) || shouldRouteToPerplexity(userText);
}

/** Dedicated /web-search endpoint — only when user clearly asks to search the web. */
export function shouldForceDedicatedWebSearchRoute(userText) {
  const t = String(userText || '').toLowerCase();
  if (!t.trim()) return false;
  return (
    /\b(search the web|search online|google it|look it up online|browse the web)\b/.test(t) ||
    (/\b(search|google)\b/.test(t) && /\b(web|online|internet)\b/.test(t))
  );
}
