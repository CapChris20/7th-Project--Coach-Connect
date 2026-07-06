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
import { shouldIncludeWeeklyContextInCoachPrompt } from '../context/buildCoachPromptData';

const EXPLICIT_WEB_PHRASES = [
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
  'any sources',
  'got sources',
  'show sources',
  'pull up sources',
  'pull sources',
  'nutrition facts for',
  'calories in a',
  'calories in the',
  'near me',
  'restaurant menu',
  'check the web',
  'check online',
  'check the internet',
  'verify online',
  'verify on the web',
  'double check online',
  'look it up online',
];

/** User clearly asked to search the public internet. */
export function hasExplicitWebIntent(userText) {
  const t = String(userText || '').toLowerCase().trim();
  if (!t) return false;
  if (EXPLICIT_WEB_PHRASES.some((k) => t.includes(k))) return true;
  if (/\b(check|verify|confirm)\b.*\b(the web|online|internet|google)\b/.test(t)) return true;
  if (/\b(the web|online|internet)\b.*\b(check|verify|confirm|search|look)\b/.test(t)) return true;
  if (/\bverify\b.*\b(web|online|internet|research|sources?|studies)\b/.test(t)) return true;
  if (/\b(search|lookup|look up|check)\b/.test(t) && /\b(web|online|internet|google|sources?)\b/.test(t)) {
    return true;
  }
  if (/\blook up\b/.test(t) && /\b(on the web|online|internet|google)\b/.test(t)) return true;
  return false;
}

/** User wants their CoachConnect logs — not a public web lookup. */
export function isPersonalDataLookup(userText) {
  const t = String(userText || '').toLowerCase().trim();
  if (!t) return false;
  if (hasExplicitWebIntent(t)) return false;
  return (
    /\blook up\b.*\b(my|log|logs|data|food|nutrition|meal|sleep|slept|water|steps|weight|workout|dashboard|history)\b/.test(
      t,
    ) ||
    /\blook up\b.*\b(my )?calories\b/.test(t) ||
    /\b(check|look at|see|show|pull up)\b.*\b(my )?(sleep|slept|logs|data|history|dashboard|food log|nutrition)\b/.test(
      t,
    ) ||
    /\b(how long|how much)\b.*\b(sleep|slept|water|steps|weight)\b/.test(t) ||
    /\b(how long|how much)\b.*\b(did i|have i)\b.*\b(sleep|slept|water|steps)\b/.test(t) ||
    /\b(sleep|slept)\b.*\b(last night|yesterday|before|this week|recently|ago)\b/.test(t)
  );
}

/** Explicit internet search — not routine coaching ("this week", sleep, streak, etc.). */
export function shouldUseWebAuto(userText) {
  const raw = String(userText || '');
  const t = raw.toLowerCase();
  if (!t.trim()) return false;

  if (hasExplicitWebIntent(t)) return true;
  if (isPersonalDataLookup(t)) return false;

  if (/\b(look up|lookup|look this up|google)\b/.test(t) && !/\b(my|log|logs|dashboard|history|data)\b/.test(t)) {
    return true;
  }

  const hasNumbers = /\d/.test(t);
  const long = t.length >= 120;
  const hasQuoted = /"[^"]{6,}"/.test(raw);
  return (long && hasNumbers) || hasQuoted;
}

function hasRecentAssistantReply(messages) {
  const msgs = Array.isArray(messages) ? messages : [];
  for (let i = msgs.length - 1; i >= 0 && i >= msgs.length - 8; i -= 1) {
    const m = msgs[i];
    if ((m?.role === 'assistant' || m?.role === 'ai') && String(m.content || m.text || '').trim().length > 30) {
      return true;
    }
  }
  return false;
}

function isWebSourceQuoteFollowUp(userText) {
  const t = String(userText || '').toLowerCase();
  if (!t.trim()) return false;
  const wantsQuotes =
    /\b(quote|quotes|quoting|excerpt|verbatim|direct quote|pull a quote|cite|cit(?:e|ing)|snippet|passage)\b/.test(
      t,
    );
  const aboutSources =
    /\b(source|sources|article|articles|study|studies|research|paper|papers|web|link|citation)\b/.test(t);
  return (
    (wantsQuotes && aboutSources) ||
    /\bfrom the sources?\b/.test(t) ||
    /\bquote from\b/.test(t) ||
    /\b(what did|what do)\b.*\b(sources?|studies)\b.*\b(say|state)\b/.test(t)
  );
}

function isWebThreadClarifyFollowUp(userText) {
  const t = String(userText || '').toLowerCase().trim();
  if (!t) return false;
  const referencesPrior =
    /\b(you found|what you found|you said|your answer|your reply|about your answer)\b/.test(t);
  const wantsSpecifics =
    /\b(be more specific|more specific|don't be vague|do not be vague|specifically about)\b/.test(t);
  return referencesPrior || (wantsSpecifics && t.length < 200);
}

function isMetaSourceFollowUp(userText) {
  const t = String(userText || '').toLowerCase().trim();
  if (!t || t.length > 300) return false;
  const aboutPrior =
    /\b(about that|about this|your answer|you said|what you just|that answer|previous answer)\b/.test(t);
  const asksSources = /\b(sources?|studies|research|links?)\b/.test(t);
  return aboutPrior && asksSources;
}

function isSourceListFollowUp(userText, messages = null) {
  if (!hasRecentAssistantReply(messages)) return false;
  const t = String(userText || '').toLowerCase().trim();
  if (!t || t.length > 280) return false;
  const aboutSources =
    /\b(sources?|citations?|references?|links?|articles?|search results)\b/.test(t);
  if (!aboutSources) return false;
  return (
    /\b(where are|what are|pull up|give me|show me|list|any sources|your sources)\b/.test(t) ||
    t.length < 80
  );
}

/** Follow-up about prior answer/sources — never a fresh web search. */
export function isWebAnswerFollowUp(userText, messages = null) {
  if (shouldUseWebAuto(userText) || shouldRouteToPerplexity(userText)) return false;
  if (isWebSourceQuoteFollowUp(userText) || isWebThreadClarifyFollowUp(userText)) return true;
  if (isMetaSourceFollowUp(userText)) return true;
  if (isSourceListFollowUp(userText, messages)) return true;
  if (!hasRecentAssistantReply(messages)) return false;
  const t = String(userText || '').toLowerCase().trim();
  if (!t || t.length > 280) return false;
  if (/\bwhat does the research say\b/.test(t) && t.length < 140) return true;
  if (/\b(sources?|studies|research)\b/.test(t) && /\b(say|said|show|found|exactly)\b/.test(t)) return true;
  return false;
}

/** True if any recent user text in the thread asks for web verification. */
export function messagesRequestWebSearch(messages, lastUserMsg = '') {
  let last = String(lastUserMsg || '').trim();
  if (!last) {
    const userLines = (Array.isArray(messages) ? messages : [])
      .filter((m) => m && (m.role === 'user' || !m.role))
      .map((m) => String(m.content || m.text || '').trim())
      .filter(Boolean);
    last = userLines[userLines.length - 1] || '';
  }
  if (isWebAnswerFollowUp(last, messages)) return false;

  if (hasRecentAssistantReply(messages)) {
    return shouldUseWebAuto(last) || shouldRouteToPerplexity(last);
  }

  const parts = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || !m.role))
    .map((m) => String(m.content || m.text || '').trim())
    .filter(Boolean)
    .slice(-6);
  if (last) parts.push(last);
  const blob = parts.join(' ');
  return shouldUseWebAuto(blob) || shouldRouteToPerplexity(blob) || parts.some((p) => shouldUseWebAuto(p) || shouldRouteToPerplexity(p));
}

/** @param {'auto'|'on'|'off'} [webMode='auto'] */
export function shouldInvokeWebSearch(userText, webMode = 'auto', messages = null) {
  if (webMode === 'off') return false;
  if (webMode === 'on') return !isWebAnswerFollowUp(userText, messages);
  return shouldUseWebAuto(userText) || shouldRouteToPerplexity(userText);
}

/** UI hint: show "Searching the web…" (slightly broader than server auto-route). */
export function shouldShowWebSearchUI(userText, messages = null) {
  return (
    shouldUseWebAuto(userText) ||
    shouldRouteToPerplexity(userText) ||
    (messages && messagesRequestWebSearch(messages, userText))
  );
}

/** Pick typing-indicator phase from the user's message (web vs logs vs general). */
export function inferCoachWaitPlan(userText, { hasImageAttachments = false, webMode = 'auto', messages = null } = {}) {
  const text = String(userText || '').trim();
  if (hasImageAttachments) return { initial: 'vision', followUp: 'drafting' };
  const wantsWeb =
    webMode === 'on' ||
    shouldInvokeWebSearch(text, webMode, messages) ||
    (messages && messagesRequestWebSearch(messages, text));
  if (wantsWeb) return { initial: 'web', followUp: 'drafting' };
  if (shouldIncludeWeeklyContextInCoachPrompt(text)) return { initial: 'data', followUp: 'drafting' };
  return { initial: 'thinking', followUp: 'drafting' };
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
