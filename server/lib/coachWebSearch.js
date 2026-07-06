/**
 * AI Coach web-search routing (server). Keep in sync with src/ai-coach/server-logic/chat-api/shouldUseWebSearch.js.
 */
const { COACH_WEB_SEARCH_FORMAT } = require('./coachVoice');

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

function hasExplicitWebIntent(userText) {
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
function isPersonalDataLookup(userText) {
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

/** Explicit user intent to search the internet — not "this week" / normal coaching questions. */
function shouldUseWebAuto(userText) {
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

function stripWebSearchPrefix(text) {
  return String(text || '')
    .replace(/^search the web:\s*/i, '')
    .replace(/^search online:\s*/i, '')
    .trim();
}

/** "Check the web" / "verify online" with no real topic in the same message. */
function isMetaOnlyWebCheck(userText) {
  const last = String(userText || '').trim();
  return /^(?:no[, ]*)?(?:bro[, ]*)?(?:please[, ]*)?(?:can u|can you|could you|would you|just|pls|ok|yeah|yes|so|did|do u|do you|have you|did you)?\s*(?:check|search|look up|verify|google)\s*(?:the\s*)?(?:damn\s*)?(?:web|online|internet|google|sources?)\s*(?:for me|just in case|to verify|again|now|please)?[.!?]*$/i.test(
    last,
  );
}

/** Follow-up asking for verbatim quotes from sources already used — not a new topic. */
function isWebSourceQuoteFollowUp(userText) {
  const t = String(userText || '').toLowerCase();
  if (!t.trim()) return false;
  const wantsQuotes =
    /\b(quote|quotes|quoting|excerpt|verbatim|direct quote|pull a quote|cite|cit(?:e|ing)|snippet|passage)\b/.test(
      t,
    );
  const aboutSources =
    /\b(source|sources|article|articles|study|studies|research|paper|papers|web|link|citation)\b/.test(t);
  const proveAnswer =
    /\b(prove|evidence|support|back up|justify)\b.*\b(answer|claim|point|that)\b/.test(t);
  const askWhatSourcesSaid =
    /\b(what did|what do|what were)\b.*\b(sources?|studies|research|articles?)\b.*\b(say|state|show|find)\b/.test(
      t,
    ) ||
    /\bwhat did the sources?\b/.test(t) ||
    /\bsources? say\b.*\b(exactly|about|your answer)\b/.test(t);
  const aboutPriorAnswer =
    /\b(your answer|you said|what you just|just now|in regards to this|about what you)\b/.test(t);
  return (
    (wantsQuotes && aboutSources) ||
    askWhatSourcesSaid ||
    (proveAnswer && aboutSources) ||
    (aboutSources && aboutPriorAnswer) ||
    /\bfrom the sources?\b/.test(t) ||
    /\bquote from\b/.test(t) ||
    /\b(saw|got|found)\b.*\bfrom the web\b/.test(t)
  );
}

/**
 * Follow-up asking the coach to elaborate on its PREVIOUS reply — not a new web lookup.
 */
function isWebThreadClarifyFollowUp(userText) {
  const t = String(userText || '').toLowerCase().trim();
  if (!t) return false;

  const referencesPrior =
    /\b(you found|what you found|what did you find|you said|your answer|your reply|your last|you just|what you just said|just now|in regards to this|from your (?:answer|reply|search|research)|based on (?:what )?you|that answer|previous answer|last answer|you told me|you mentioned|what you got|results you|about your answer)\b/.test(
      t,
    );

  const wantsSpecifics =
    /\b(be more specific|more specific|more detail|more details|go deeper|elaborate|expand on|clarify|break it down|don't be vague|do not be vague|not vague|no vague|specifically about|give me specifics|not fuzzy|not general|not broad|less vague|stop being vague)\b/.test(
      t,
    );

  if (!referencesPrior && !wantsSpecifics) return false;

  const hasFitnessTopic =
    /\b(protein|creatine|workout|exercise|macro|calorie|hypertrophy|cardio|sleep|supplement|weight loss|muscle|testosterone|squat|deadlift|bench|meal|nutrition)\b/.test(
      t,
    );
  if (hasFitnessTopic && !referencesPrior && t.length > 50) return false;

  return (
    referencesPrior ||
    (wantsSpecifics && t.length < 200) ||
    (/\b(specifically|specific)\b/.test(t) &&
      /\b(found|answer|said|research|sources?|results)\b/.test(t) &&
      t.length < 180)
  );
}

function hasRecentAssistantReply(messages) {
  const msgs = Array.isArray(messages) ? messages : [];
  for (let i = msgs.length - 1; i >= 0 && i >= msgs.length - 8; i -= 1) {
    const m = msgs[i];
    const role = m?.role;
    if ((role === 'assistant' || role === 'ai') && String(m.content || m.text || '').trim().length > 30) {
      return true;
    }
  }
  return false;
}

/** Short meta follow-up after the coach already replied — must not re-search the web. */
function isMetaSourceFollowUp(userText, messages = null) {
  const t = String(userText || '').toLowerCase().trim();
  if (!t || t.length > 300) return false;

  const aboutPrior =
    /\b(about that|about this|about it|your answer|you said|what you said|what you just|just now|that answer|previous answer|last answer|in regards to|regarding that|regarding this|from that|from what you|what you told|you told me|that reply|this reply)\b/.test(
      t,
    );
  const asksSources = /\b(sources?|studies|research|articles?|evidence|links?|citations?|the web|online)\b/.test(t);
  const asksSaid = /\b(say|said|state|stated|show|found|mean|meant|exactly)\b/.test(t);
  const researchPhrase = /\bwhat does the research say\b/.test(t) || /\bwhat did the research say\b/.test(t);
  const wantsDetail =
    /\b(specific|exactly|more detail|elaborate|clarify|break down|prove|back up|expand on)\b/.test(t);

  return (
    (aboutPrior && (asksSources || asksSaid || researchPhrase || wantsDetail)) ||
    (researchPhrase && aboutPrior) ||
    (hasRecentAssistantReply(messages) && asksSources && asksSaid && t.length < 220)
  );
}

function isSourceListFollowUp(userText, messages = null) {
  if (!hasRecentAssistantReply(messages)) return false;
  const t = String(userText || '').toLowerCase().trim();
  if (!t || t.length > 280) return false;

  const aboutSources =
    /\b(sources?|citations?|references?|links?|articles?|search results|results)\b/.test(t);
  if (!aboutSources && t.length > 40) return false;

  const wantsListOrLocation =
    /\b(where are|where'?s|what are|what were|which sources|show me|show the|show your|list the|list your|pull up|give me|got sources|any sources|your sources|the sources|those sources|sources you|sources for|links you|you used|you got|from the web|search results)\b/.test(
      t,
    );

  if (aboutSources && wantsListOrLocation) return true;
  if (aboutSources && t.length < 80) return true;
  return false;
}

/** Follow-up about the coach's prior answer/sources — never a fresh web search. */
function isWebAnswerFollowUp(userText, messages = null) {
  if (shouldUseWebAuto(userText) || shouldUsePerplexity(userText)) return false;
  if (isWebSourceQuoteFollowUp(userText) || isWebThreadClarifyFollowUp(userText)) return true;
  if (isMetaSourceFollowUp(userText, messages)) return true;
  if (isSourceListFollowUp(userText, messages)) return true;

  if (!hasRecentAssistantReply(messages)) return false;

  const t = String(userText || '').toLowerCase().trim();
  if (!t || t.length > 280) return false;

  if (/\bwhat does the research say\b/.test(t) && t.length < 140) return true;
  if (/\bwhat do studies say\b/.test(t) && t.length < 140) return true;
  if (/\bwhat did (?:the )?(?:sources?|studies|research)\b/.test(t)) return true;
  if (/\b(sources?|studies|research)\b/.test(t) && /\b(say|said|show|found|exactly|specific)\b/.test(t)) {
    return true;
  }
  if (t.length < 12) return true;

  return false;
}

function findPriorSubstantiveUserQuestion(messages, lastUserMsg = '') {
  const userLines = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || !m.role))
    .map((m) => String(m.content || m.text || '').trim())
    .filter(Boolean);
  const last = String(lastUserMsg || '').trim();
  const priorLines =
    last && userLines[userLines.length - 1] === last ? userLines.slice(0, -1) : userLines.slice(0, -1);

  for (let i = priorLines.length - 1; i >= 0; i -= 1) {
    const line = stripWebSearchPrefix(priorLines[i]) || priorLines[i];
    if (line.length < 20) continue;
    if (isWebAnswerFollowUp(line)) continue;
    if (isMetaOnlyWebCheck(line)) continue;
    return line;
  }
  return null;
}

/** True if any recent user text in the thread asks for web verification. */
function messagesRequestWebSearch(messages, lastUserMsg = '') {
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
    return shouldUseWebAuto(last) || shouldUsePerplexity(last);
  }

  const parts = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || !m.role))
    .map((m) => String(m.content || m.text || '').trim())
    .filter(Boolean)
    .slice(-6);
  if (last) parts.push(last);
  const blob = parts.join(' ');
  return shouldUseWebAuto(blob) || shouldUsePerplexity(blob) || parts.some((p) => shouldUseWebAuto(p) || shouldUsePerplexity(p));
}

/** When user says "check the web", search their actual question — not only those words. */
function buildWebSearchQuery(messages, lastUserMsg = '') {
  const userLines = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || !m.role))
    .map((m) => String(m.content || m.text || '').trim())
    .filter(Boolean);
  let last = String(lastUserMsg || '').trim() || userLines[userLines.length - 1] || '';
  last = stripWebSearchPrefix(last) || String(lastUserMsg || '').trim() || userLines[userLines.length - 1] || '';

  if (isWebSourceQuoteFollowUp(last)) {
    const prior = findPriorSubstantiveUserQuestion(messages, lastUserMsg);
    if (prior) {
      return `${prior} — direct quotes from research sources with citations`;
    }
  }

  if (isMetaOnlyWebCheck(last) && userLines.length >= 2) {
    const prior = stripWebSearchPrefix(userLines[userLines.length - 2]) || userLines[userLines.length - 2];
    if (prior && prior.length > 20) return prior;
  }
  if (last.length < 60 && userLines.length >= 2) {
    const prior = stripWebSearchPrefix(userLines[userLines.length - 2]) || userLines[userLines.length - 2];
    if (prior && !shouldUseWebAuto(prior) && shouldUseWebAuto(last)) {
      return `${prior} ${last}`.trim();
    }
  }
  const built = stripWebSearchPrefix(last) || last;
  return scopeWebSearchQueryForCoach(built);
}

/** Training, nutrition, recovery, supplements — web search is fitness-coach scoped only. */
function isFitnessNutritionQuery(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return false;

  const fitness = [
    'workout', 'work out', 'training', 'lift', 'lifting', 'gym', 'exercise', 'cardio', 'hiit',
    'strength', 'hypertrophy', 'sets', 'reps', 'pr', 'progressive overload', 'deload',
    'squat', 'bench', 'deadlift', 'press', 'pull-up', 'pull up', 'form', 'technique',
    'mobility', 'stretch', 'warm up', 'cool down', 'recovery', 'soreness',
    'sleep', 'steps', 'heart rate', 'streak', 'progress', 'adherence',
    'body recomposition', 'recomposition', 'recomp', 'skinny fat', 'bodyfat', 'body fat', 'bf%',
    'cutting', 'cut', 'bulking', 'bulk', 'lean bulk', 'maintenance', 'caloric deficit', 'calorie deficit',
    'calorie surplus', 'caloric surplus', 'tone up', 'toning', 'fat loss', 'lose fat', 'build muscle',
    'shoulder', 'knee', 'back', 'hip', 'injury', 'hurt', 'pain', 'ache', 'sore',
    'trainer', 'coach', 'session', 'appointment', 'schedule',
    'swap', 'replace', 'modify', 'program', 'plan', 'routine', 'split',
    'overhead', 'fatigue', 'tired', 'plateau', 'lifter', 'lifters', 'athlete', 'athletes',
    'research', 'study', 'studies', 'evidence', 'meta-analysis', 'systematic review',
    'creatine', 'ashwagandha', 'magnesium', 'electrolyte', 'pre-workout', 'preworkout',
    'zone 2', 'zone2', 'vo2', 'testosterone', 'trt', 'hormone', 'cortisol',
  ];
  const nutrition = [
    'nutrition', 'diet', 'calories', 'macro', 'macros', 'protein', 'carbs', 'fat', 'fats',
    'meal', 'meals', 'meal plan', 'weight loss', 'gain muscle', 'weight',
    'supplement', 'supplements', 'whey', 'caffeine',
    'hydration', 'water', 'fiber', 'sodium', 'cholesterol', 'saturated fat',
    'calorie', 'caloric', 'tdee', 'bmr', 'metabolism', 'weigh', 'weigh-in',
    'chicken', 'rice', 'ate', 'eat', 'eating', 'food', 'hungry', 'hunger', 'log',
    'oz', 'cup', 'grams', 'kcal', 'chipotle', 'restaurant', 'menu',
  ];

  return [...fitness, ...nutrition].some((k) => t.includes(k));
}

const FITNESS_WEB_ASK_TOPIC_REPLY =
  "I'm your fitness coach — I only look things up on the web for training, nutrition, recovery, supplements, and your fitness goals. What should I search? For example: protein targets for lifters, creatine dosing, or body recomposition research.";

const FITNESS_WEB_OFF_TOPIC_REPLY =
  "I'm your fitness coach — I can only search the web for training, nutrition, recovery, and supplements. That topic is outside what I cover here. What fitness or nutrition question should I look up?";

function normalizeWebIntentText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Can you search the web for me?" with no fitness topic — ask what to search. */
function isGenericWebSearchRequest(text) {
  const t = normalizeWebIntentText(text);
  if (!t) return false;
  const generic = [
    'can you search the web for me',
    'can you search the web',
    'can u search the web',
    'search the web for me',
    'search the web',
    'can you search online for me',
    'can you search online',
    'search online for me',
    'look up on the web',
    'look up the web',
    'can you look up on the web',
    'can you google for me',
    'can you google something for me',
    'browse the web for me',
    'can you check the web for me',
  ];
  if (generic.includes(t)) return true;
  if (isMetaOnlyWebCheck(t) && !isFitnessNutritionQuery(t)) return true;
  return false;
}

/** Bias Serper/Perplexity toward exercise-science results, not generic "how to Google" pages. */
function scopeWebSearchQueryForCoach(query) {
  const q = String(query || '').trim();
  if (!q) return '';
  const stripped = stripWebSearchPrefix(q) || q;
  if (isFitnessNutritionQuery(stripped) && stripped.length >= 28) return stripped;
  if (isFitnessNutritionQuery(stripped)) {
    return `${stripped} evidence-based fitness exercise science`.replace(/\s+/g, ' ').trim();
  }
  return `${stripped} fitness training nutrition exercise science evidence-based`.replace(/\s+/g, ' ').trim();
}

const JUNK_WEB_SOURCE_PATTERNS = [
  /how to search the web/i,
  /search the web in chrome/i,
  /advanced search\s*-\s*google/i,
  /support\.google\.com/i,
  /google\.com\/intl\/.*\/search/i,
  /youtube\.com.*how to search/i,
  /how to use google/i,
];

const TRUSTED_FITNESS_HOST_FRAGMENTS = [
  'pubmed', 'ncbi.nlm', 'examine.com', 'strongerbyscience', 'nsca.com', 'acefitness.org',
  'precisionnutrition', 'healthline.com', 'bodybuilding.com', 'barbellmedicine', 'jissn',
  'nutrition.org', 'nih.gov', 'cdc.gov', 'who.int', 'mayoclinic', 'sciencedirect',
  'springer.com', 'nature.com', 'frontiersin.org', 'bmj.com', 'cochrane.org',
];

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (_) {
    return '';
  }
}

function isTrustedFitnessHost(url) {
  const host = hostFromUrl(url);
  if (!host) return false;
  return TRUSTED_FITNESS_HOST_FRAGMENTS.some((frag) => host.includes(frag));
}

function isJunkWebSource(source = {}) {
  const blob = `${source.title || ''} ${source.snippet || ''} ${source.url || ''}`;
  return JUNK_WEB_SOURCE_PATTERNS.some((re) => re.test(blob));
}

/** Drop generic Google-help / YouTube tutorial hits from coach web results. */
function filterFitnessWebSources(sources = []) {
  const list = Array.isArray(sources) ? sources : [];
  const filtered = list.filter((s) => {
    if (!s?.url) return false;
    if (isJunkWebSource(s)) return false;
    const blob = `${s.title || ''} ${s.snippet || ''} ${s.url || ''}`.toLowerCase();
    return isFitnessNutritionQuery(blob) || isTrustedFitnessHost(s.url);
  });
  if (filtered.length) return filtered.slice(0, 8);
  const salvage = list.filter((s) => s?.url && !isJunkWebSource(s));
  return salvage.slice(0, 4);
}

/**
 * Before calling Serper/Perplexity: block generic web requests; scope queries to fitness.
 * @returns {{ action: 'search'|'ask_topic'|'off_topic', query?: string, reply?: string }}
 */
function resolveCoachWebSearchGate({ lastUserMsg, messages, rawQuery }) {
  const last = String(lastUserMsg || '').trim();
  const query = String(rawQuery || '').trim() || last;
  const prior = findPriorSubstantiveUserQuestion(messages, lastUserMsg);
  const priorFitness = prior ? isFitnessNutritionQuery(prior) : false;
  const topicFitness = isFitnessNutritionQuery(query) || isFitnessNutritionQuery(last);

  if (isGenericWebSearchRequest(last)) {
    if (priorFitness) {
      return { action: 'search', query: scopeWebSearchQueryForCoach(stripWebSearchPrefix(prior) || query) };
    }
    return { action: 'ask_topic', reply: FITNESS_WEB_ASK_TOPIC_REPLY };
  }

  if (isMetaOnlyWebCheck(last)) {
    if (priorFitness) {
      return { action: 'search', query: scopeWebSearchQueryForCoach(stripWebSearchPrefix(prior) || query) };
    }
    return { action: 'ask_topic', reply: FITNESS_WEB_ASK_TOPIC_REPLY };
  }

  const wantsWeb = shouldUseWebAuto(last) || shouldUsePerplexity(last);
  if (wantsWeb && !topicFitness && !priorFitness) {
    return { action: 'off_topic', reply: FITNESS_WEB_OFF_TOPIC_REPLY };
  }

  return { action: 'search', query: scopeWebSearchQueryForCoach(query) };
}

function stripInlineWebCitations(text) {
  return String(text || '')
    .replace(/\s*\[\d+\]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

const WEB_SEARCH_SYSTEM_APPEND = `${COACH_WEB_SEARCH_FORMAT}

WEB SEARCH MODE (FITNESS COACH ONLY):
You have live web results in this prompt (Perplexity or Serper snippets). Use them ONLY for training, nutrition, recovery, supplements, and exercise-science topics.
IGNORE generic pages about "how to search the web", Google Help, YouTube tutorials, or anything unrelated to fitness/nutrition.
You DID search the web for this reply — you may say so briefly in the Takeaway (one short phrase max).
Do not mention reviewing their app logs, weekly summary, or personal tracking unless they explicitly asked about their own data in the same message.
Follow COACH_WEB_SEARCH_FORMAT exactly: opening line, ## What it is, ## Key findings, ## Practical notes, ## What this means for you, ## Next steps, ## Suggested follow-ups (3 questions).
Cite sources as [Source Name] after claims — not numbered [1][2] footnotes.`;

const NO_WEB_SEARCH_HONESTY_APPEND = `

WEB SEARCH STATUS (THIS TURN):
You do NOT have live web search results in this prompt. You MUST NOT say you checked the web, googled it, pulled it up, searched online, or describe "what you're seeing from research" as if you browsed.
Never say "let me check" / "fair enough let me pull that up" and then answer as if you searched.
If they asked to verify online, be honest: you are answering from built-in coaching knowledge, not a live search. Say that plainly in one short sentence, then give your answer and label it as general exercise-science guidance — not cited studies or links you did not receive.
If you cannot verify with sources this turn, do not invent citations or pretend you have links.`;

const WEB_SOURCE_QUOTE_SYSTEM_APPEND = `

SOURCE QUOTE MODE:
The user is asking for DIRECT QUOTES from the research sources about the ORIGINAL topic — not instructions on how to cite sources academically.
Pull verbatim excerpts from studies/articles about the research topic. Name each source.
Do NOT explain citation rules, referencing guidelines, or how to write bibliographies.`;

const THREAD_CLARIFY_SYSTEM_APPEND = `

THREAD FOLLOW-UP — CONTINUE THE SAME CONVERSATION (NO NEW WEB SEARCH):
The user is asking about YOUR PREVIOUS reply in this chat — not a new lookup.
Read the full conversation. Stay on the SAME fitness/nutrition/training topic as the original question.
If they ask what sources said: explain what your prior answer was based on, name those sources, and give specifics about THAT topic only.
FORBIDDEN: unrelated topics, citation rules, or random transcripts.
If the thread lacks source detail, say that honestly and expand from your prior answer — do NOT invent unrelated sources or run a new topic.`;

const WEB_SEARCH_FAILED_APPEND = `

WEB SEARCH FAILED THIS TURN:
Live search did not complete. You MUST NOT say you searched, googled, ran a live search, or describe current web research.
Open with ONE short sentence that live search was not available, then answer from general coaching knowledge only.
Do NOT cite studies, links, or "what research says" as if you browsed. No fake sources.`;

const FAKE_WEB_SEARCH_OPENERS = [
  /^i ran a live search[^.!?]*[.!?]\s*/i,
  /^i (?:just )?searched the web[^.!?]*[.!?]\s*/i,
  /^i (?:just )?looked (?:that )?up online[^.!?]*[.!?]\s*/i,
  /^after searching the web[^.!?]*[.!?]\s*/i,
  /^based on (?:my )?(?:live )?web search[^.!?]*[.!?]\s*/i,
  /^here(?:'s| is) what (?:the )?(?:current )?(?:research|web) says[^.!?]*[.!?]\s*/i,
];

function stripFakeWebSearchClaims(text) {
  let t = String(text || '').trim();
  if (!t) return t;
  for (const re of FAKE_WEB_SEARCH_OPENERS) {
    t = t.replace(re, '');
  }
  return t.trim();
}

function userRequestedWebSearchTurn({ webMode, lastUserMsg, messages, hasImages }) {
  if (hasImages) return false;
  return (
    webMode === 'on' ||
    shouldUseWebAuto(lastUserMsg) ||
    shouldUsePerplexity(lastUserMsg) ||
    messagesRequestWebSearch(messages, lastUserMsg)
  );
}

module.exports = {
  shouldUseWebAuto,
  shouldUsePerplexity,
  shouldInvokeWebSearch,
  shouldForceDedicatedWebSearchRoute,
  isFitnessNutritionQuery,
  isGenericWebSearchRequest,
  scopeWebSearchQueryForCoach,
  filterFitnessWebSources,
  resolveCoachWebSearchGate,
  WEB_SEARCH_FAILED_APPEND,
  stripFakeWebSearchClaims,
  userRequestedWebSearchTurn,
  WEB_SEARCH_SYSTEM_APPEND,
  WEB_SOURCE_QUOTE_SYSTEM_APPEND,
  THREAD_CLARIFY_SYSTEM_APPEND,
  NO_WEB_SEARCH_HONESTY_APPEND,
  messagesRequestWebSearch,
  buildWebSearchQuery,
  stripWebSearchPrefix,
  isWebSourceQuoteFollowUp,
  isWebThreadClarifyFollowUp,
  isWebAnswerFollowUp,
  isSourceListFollowUp,
  findPriorSubstantiveUserQuestion,
  isMetaOnlyWebCheck,
  stripInlineWebCitations,
  isPersonalDataLookup,
};
