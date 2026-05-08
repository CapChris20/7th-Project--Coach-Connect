import { useEffect, useMemo, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { getApiBaseCandidates } from '../../shared/services/baseUrl';

const YT_SEARCH = 'https://www.googleapis.com/youtube/v3/search';
const YT_VIDEOS = 'https://www.googleapis.com/youtube/v3/videos';

/**
 * Reads YouTube Data API v3 key from Expo extra or env (supports legacy REACT_NATIVE_ name).
 * Prefer restricting the key in Google Cloud Console to YouTube Data API + app bundle.
 */
export function getYouTubeApiKey() {
  const extra =
    Constants.expoConfig?.extra ||
    Constants.manifest?.extra ||
    Constants.manifest2?.extra ||
    Constants.manifest2?.expoClient?.extra ||
    {};
  return String(
    extra.youtubeApiKey ||
      process.env.EXPO_PUBLIC_YOUTUBE_API_KEY ||
      process.env.YOUTUBE_API_KEY ||
      process.env.REACT_NATIVE_YOUTUBE_API_KEY ||
      '',
  ).trim();
}

const cache = new Map();
const CACHE_MS = 25 * 60 * 1000;
/** Bust in-memory cache when search/filter logic changes. */
const CACHE_VER = 'v21';

/** Goal slugs → short YouTube-friendly tokens. */
const GOAL_QUERY_CHUNK = {
  lose_fat: 'fat loss cutting lean',
  build_muscle: 'muscle hypertrophy strength',
  body_recomp: 'body recomposition recomp lean bulk',
  recomp: 'body recomposition lean bulk',
  maintain_health: 'general fitness health',
  athletic_performance: 'athletic power performance',
  improve_mental_health: 'stress mood movement recovery',
  build_habits: 'consistency habits fundamentals',
};

/** Onboarding equipmentAccess values → search tokens */
const ONBOARDING_EQUIP_EXPAND = {
  full_gym: 'gym barbell dumbbell cable machine',
  dumbbells: 'dumbbell db weights',
  resistance_bands: 'resistance band',
  pull_up_bar: 'pull up chin up calisthenics',
  bodyweight: 'bodyweight calisthenics no equipment',
};

/** Library filter pills (when user picks one) — refines YouTube `q`, not post-filter. */
const FILTER_EQUIP_HINT = {
  Barbell: 'barbell',
  Dumbbell: 'dumbbell',
  Bodyweight: 'bodyweight calisthenics',
  Cable: 'cable',
  Machine: 'machine gym',
};

const MAX_SEARCH_Q = 180;
const QUERY_TAIL = 'form tutorial';

function isoNow() {
  try {
    return new Date().toISOString();
  } catch {
    return null;
  }
}

function cacheGet(key) {
  const e = cache.get(`${key}::${CACHE_VER}`);
  if (!e) return null;
  if (Date.now() - e.t > CACHE_MS) {
    cache.delete(`${key}::${CACHE_VER}`);
    return null;
  }
  return e.v;
}

function cacheSet(key, v) {
  cache.set(`${key}::${CACHE_VER}`, { t: Date.now(), v });
}

function equipmentFromOnboarding(data) {
  const arr = Array.isArray(data?.equipmentAccess) ? data.equipmentAccess : [];
  const parts = arr.map((e) => ONBOARDING_EQUIP_EXPAND[e] || String(e).replace(/_/g, ' '));
  return parts.join(' ').trim();
}

/** Shorter equipment string when combining with a typed search (full gym line dilutes YouTube). */
function equipmentFromOnboardingCompact(data, maxChars = 42) {
  const full = equipmentFromOnboarding(data);
  return takeCharsByWords(full, maxChars);
}

/** Onboarding fitnessLevel → query tokens (skipped when Difficulty pill overrides). */
function fitnessLevelQueryChunk(level) {
  if (level == null || level === '') return '';
  const s = String(level).toLowerCase();
  if (s.includes('begin')) return 'beginner friendly basics';
  if (s.includes('adv')) return 'advanced intensity technique';
  return 'intermediate progression';
}

/** Single-word level for broad empty-tab queries (full phrase over-narrows YouTube). */
function fitnessLevelOneWord(level) {
  if (level == null || level === '') return '';
  const s = String(level).toLowerCase();
  if (s.includes('begin')) return 'beginner';
  if (s.includes('adv')) return 'advanced';
  return 'intermediate';
}

/** Library Difficulty pill → same tokens as onboarding level (overrides profile level in `q`). */
function difficultyPillQueryChunk(pill) {
  if (!pill) return '';
  const p = String(pill);
  if (p === 'Beginner') return 'beginner friendly basics';
  if (p === 'Advanced') return 'advanced intensity technique';
  if (p === 'Intermediate') return 'intermediate progression';
  return '';
}

function takeCharsByWords(text, maxChars) {
  const s = String(text || '').trim();
  if (!s || maxChars <= 0) return '';
  if (s.length <= maxChars) return s;
  let acc = '';
  for (const w of s.split(/\s+/)) {
    if (!w) continue;
    const next = acc ? `${acc} ${w}` : w;
    if (next.length > maxChars) break;
    acc = next;
  }
  return acc;
}

/** Strip emails/URLs from free text used in `q`. */
function sanitizeIntentText(raw, maxWords = 10, maxChars = 160) {
  if (!raw || typeof raw !== 'string') return '';
  const cleaned = String(raw)
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  const words = cleaned.split(/\s+/).filter((w) => w.length > 1 && w.length < 36);
  return words.slice(0, maxWords).join(' ').slice(0, maxChars).trim();
}

/**
 * Normalize Journey / search text so shorthand typos match dictionary + regex intent.
 * e.g. "body recon" → "body recomp"
 */
function normalizeJourneyTextForKeywords(raw) {
  let d = String(raw || '').toLowerCase().replace(/\s+/g, ' ');
  d = d.replace(/\bbody\s*recon\b/g, 'body recomp');
  return d;
}

/** Labels for Exercise Library section subtitles (matches recommended-query intent). */
export function getExerciseLibraryJourneyHint(onboardingData) {
  const d = normalizeJourneyTextForKeywords(onboardingData?.situationDescription || '');
  const parts = [];
  if (/\b(body\s*)?recomp(ositions?)?\b|\bbody\s*recomp\b|\bbody\s*recomposition\b|\bmaingain\b/.test(d)) {
    parts.push('Body recomp');
  }
  if (/\bskinny[-\s]?fat\b|\bthin\s*fat\b|\bskinnyfat\b/.test(d)) {
    parts.push('Skinny-fat');
  }
  const goals = Array.isArray(onboardingData?.goals) ? onboardingData.goals : [];
  if (goals.some((g) => /recomp/i.test(String(g)))) {
    if (!parts.includes('Body recomp')) parts.push('Body recomp');
  }
  return parts.slice(0, 4).join(' · ');
}

/**
 * Map casual training phrases → extra tokens (typed search + first words of situation).
 * Injuries/limitations are intentionally not used in `q`.
 */
function expandFreestyleSearchQuery(raw) {
  const q = normalizeJourneyTextForKeywords(String(raw || '').trim());
  if (!q) return '';
  const lower = q.toLowerCase();
  const boosts = [];
  if (/\b(body\s*)?recomp(ositions?)?\b|\bbody\s*recomposition\b|\bmaingain\b/i.test(lower)) {
    boosts.push('body recomposition recomp lean bulk');
  }
  // Common shorthand typo: "body recon" → recomp keywords
  if (/\bbody\s*recon\b|\bbody\s*recon(p)?\b/i.test(lower)) {
    boosts.push('body recomposition recomp lean bulk');
  }
  if (/\bskinny[-\s]?fat\b|\bthin\s*fat\b|\bskinnyfat\b/i.test(lower)) {
    boosts.push('skinny fat recomposition lean bulk');
  }
  if (/\bcutting\b|^cut\b|\bcut\s+phase\b|\bshred/i.test(lower)) {
    boosts.push('cutting fat loss lean');
  }
  if (/\bbulk(?:ing)?\b|\bmass\s*gain\b|\bsurplus\b/i.test(lower)) {
    boosts.push('bulking muscle hypertrophy strength');
  }
  if (/\bhiit\b/i.test(lower)) {
    boosts.push('HIIT interval high intensity');
  }
  if (/\bcardio\b|\bconditioning\b/i.test(lower)) {
    boosts.push('cardio conditioning endurance');
  }
  if (/\bmobility\b|\bflexibility\b|\bstretch/i.test(lower)) {
    boosts.push('mobility flexibility stretching');
  }
  if (boosts.length) {
    const merged = `${q} ${boosts.join(' ')}`;
    return [...new Set(merged.split(/\s+/).filter(Boolean))].join(' ');
  }
  return q;
}

/** Longest-first so "body recomp" wins before "recomp". */
const SITUATION_DICTIONARY = [
  'body recomposition',
  'progressive overload',
  'intermittent fasting',
  'circuit training',
  'strength endurance',
  'carb cycling',
  'flexible diet',
  'meal prep',
  'push pull legs',
  'upper lower',
  'full body',
  'bro split',
  'powerlifting',
  'bodybuilding',
  'skinny fat',
  'body recomp',
  'lose fat',
  'build muscle',
  'muscle building',
  'caloric deficit',
  'caloric surplus',
  'maintenance calories',
  'olympic lifting',
  'crossfit',
  'maingain',
  'recomp',
  'shred',
  'cutting',
  'bulking',
  'hypertrophy',
  'explosive',
  'functional',
  'aesthetic',
  'calisthenics',
  'endurance',
  'strength',
  'tabata',
  'bench press',
  'overhead press',
  'romanian deadlift',
  'hip thrust',
  'lat pulldown',
  'leg press',
  'face pull',
  'calf raise',
  'hammer curl',
  'bicep curl',
  'tricep extension',
  'pull up',
  'chin up',
  'deadlift',
  'squat',
  'lunge',
  'plank',
  'curl',
  'bicep',
  'tricep',
  'chest',
  'shoulder',
  'hamstring',
  'forearm',
  'quad',
  'glute',
  'calf',
  'clean foods',
  'fun foods',
  'whole food',
  'macro cycling',
  'vegetarian',
  'paleo',
  'vegan',
  'keto',
  'tdee',
  'foam roll',
  'stretching',
  'meditation',
  'cold plunge',
  'yoga',
  'mobility',
  'personal record',
  'plateau',
  'max out',
  '2x per week',
  '3x per week',
  '4x per week',
  '5x per week',
  '6x per week',
  'twice a week',
  'three times a week',
  'days per week',
  'day split',
  'per week',
  'twice',
  'thrice',
  'cardio',
  'hiit',
];

const SITUATION_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'are',
  'but',
  'not',
  'you',
  'all',
  'can',
  'was',
  'our',
  'out',
  'get',
  'has',
  'how',
  'its',
  'may',
  'new',
  'now',
  'old',
  'see',
  'who',
  'did',
  'what',
  'with',
  'have',
  'this',
  'that',
  'from',
  'they',
  'into',
  'just',
  'like',
  'also',
  'only',
  'know',
  'take',
  'each',
  'want',
  'work',
  'well',
  'year',
  'your',
  'when',
  'will',
  'come',
  'about',
  'after',
  'again',
  'there',
  'their',
  'would',
  'could',
  'been',
  'being',
  'than',
  'then',
  'them',
  'very',
  'some',
  'such',
  'into',
  'just',
  'over',
  'more',
  'most',
  'much',
  'make',
  'many',
  'need',
  'help',
  'goal',
  'goals',
  'want',
  'really',
  'trying',
  'looking',
]);

/**
 * Pull fitness-relevant tokens from onboarding (Journey text first), goals, supplements,
 * recovery, environment, frequency. Used for recommended `q` and optional empty-tab merges.
 * Injuries are not auto-added to `q`.
 * @returns {string[]} deduped keywords in priority order
 */
function extractKeywordsFromOnboarding(onboardingData) {
  if (!onboardingData || typeof onboardingData !== 'object') return [];

  const out = [];
  const seen = new Set();

  const push = (kw) => {
    const k = String(kw || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (k.length < 2 || seen.has(k)) return;
    seen.add(k);
    out.push(k);
  };

  const descRaw = String(onboardingData.situationDescription || '');
  const description = normalizeJourneyTextForKeywords(descRaw);

  // High-intent phrases first so they survive the ~8-token cap in recommended queries.
  if (/\b(body\s*)?recomp(ositions?)?\b|\bbody\s*recomp\b|\bbody\s*recomposition\b|\bmaingain\b/.test(description)) {
    push('body recomposition');
    push('recomp');
  }
  if (/\bskinny[-\s]?fat\b|\bthin\s*fat\b|\bskinnyfat\b/.test(description)) {
    push('skinny fat');
    push('recomposition');
  }

  for (const term of [...SITUATION_DICTIONARY].sort((a, b) => b.length - a.length)) {
    if (description.includes(term)) push(term);
  }

  // Full journey scan (not just first N words) — "body recon" often appears mid-paragraph.
  const journeyForBoost = sanitizeIntentText(descRaw, 400, 2800);
  const boosted = journeyForBoost ? expandFreestyleSearchQuery(journeyForBoost) : '';
  if (boosted && boosted !== journeyForBoost) {
    for (const w of boosted.split(/\s+/)) {
      if (w.length > 1 && !SITUATION_STOPWORDS.has(w.toLowerCase())) push(w.toLowerCase());
    }
  }

  const nx = descRaw.match(/\b(\d)\s*x\b/i);
  if (nx) push(`${nx[1]}x week`);

  // Goals: compact tokens (deduped); phrase-level goals also added in `buildRecommendedQuery` via `topGoalsQueryChunk`
  const goalArr = Array.isArray(onboardingData.goals) ? onboardingData.goals.filter(Boolean).map((g) => String(g).trim()) : [];
  for (const g of goalArr.slice(0, 3)) {
    const expanded = GOAL_QUERY_CHUNK[g] || String(g).replace(/_/g, ' ');
    for (const tok of String(expanded).split(/\s+/).filter(Boolean)) {
      push(tok);
      if (out.length >= 24) break;
    }
  }
  const pg = onboardingData.primaryGoal || onboardingData.goal;
  if (pg && !goalArr.length) {
    const expanded = GOAL_QUERY_CHUNK[String(pg).trim()] || String(pg).replace(/_/g, ' ');
    for (const tok of String(expanded).split(/\s+/).filter(Boolean)) {
      push(tok);
    }
  }

  const sup = String(onboardingData.supplementsCurrentlyTaking || '').toLowerCase();
  if (sup.includes('creatine')) push('creatine');
  if (sup.includes('protein')) push('protein');
  if (sup.includes('whey')) push('whey');
  if (sup.includes('vitamin')) push('vitamins');
  if (sup.includes('pre workout') || sup.includes('preworkout')) push('pre workout');
  if (sup.includes('bcaa')) push('bcaa');

  if (String(onboardingData.currentStressLevel || '').toLowerCase() === 'high') {
    push('stress');
    push('recovery');
  }
  if (String(onboardingData.sleepQuality || '').toLowerCase() === 'poor') {
    push('poor sleep');
    push('recovery');
  }
  if (String(onboardingData.energyLevels || '').toLowerCase() === 'low') {
    push('low energy');
  }

  const te = String(onboardingData.trainingEnvironment || '').toLowerCase();
  if (te && te !== 'both') push(te);

  // equipmentAccess is applied separately in buildSearchQuery (pill or full join) — omit here to avoid duplicate tokens.

  const rawDays = onboardingData.daysPerWeek ?? onboardingData.frequency ?? onboardingData.workoutsPerWeek;
  const n = Number(rawDays);
  if (Number.isFinite(n) && n >= 1 && n <= 7) push(`${n} day`);

  const residual = sanitizeIntentText(descRaw, 22, 200).toLowerCase();
  if (residual) {
    let added = 0;
    for (const w of residual.split(/\s+/)) {
      if (w.length < 3 || SITUATION_STOPWORDS.has(w) || seen.has(w)) continue;
      if (/^\d+$/.test(w) && w.length > 2) continue;
      push(w);
      added += 1;
      if (added >= 6) break;
    }
  }

  return out.slice(0, 16);
}

/** Join extracted keywords with a char budget (caps bloat for YouTube). */
function keywordsChunkForQuery(onboardingData, maxChars) {
  const arr = extractKeywordsFromOnboarding(onboardingData);
  if (!arr.length) return '';
  return takeCharsByWords(arr.join(' '), maxChars);
}

/** Goals only (expanded slugs) — kept separate from Journey keyword scan. */
function topGoalsQueryChunk(data, maxChars) {
  if (!data || typeof data !== 'object') return '';
  const arr = Array.isArray(data.goals) ? data.goals.filter(Boolean).map((g) => String(g).trim()) : [];
  const expand = (slug) => GOAL_QUERY_CHUNK[slug] || String(slug).replace(/_/g, ' ');
  if (arr.length >= 2) {
    return takeCharsByWords(`${expand(arr[0])} ${expand(arr[1])}`, maxChars);
  }
  if (arr.length === 1) {
    return takeCharsByWords(expand(arr[0]), maxChars);
  }
  const pg = data.primaryGoal || data.goal;
  if (pg) return takeCharsByWords(expand(String(pg).trim()), maxChars);
  return '';
}

/**
 * Builds YouTube `q`.
 * - Empty tab: very broad base + short goals + compact equip + one-word level (Journey keywords
 *   are merged in via extra searches in the hook so we still get volume + personalization).
 * - Typed search: user text + pills + level phrase + Journey keyword tail.
 */
function buildSearchQuery({ debouncedQuery, muscleGroup, equipmentHint, difficultyHint, onboardingData }) {
  const data = onboardingData && typeof onboardingData === 'object' ? onboardingData : null;
  const maxHead = Math.max(0, MAX_SEARCH_Q - QUERY_TAIL.length - 1);

  const rawSearch = String(debouncedQuery || '').trim();
  const hasTypedSearch = rawSearch.length > 0;

  const searchText = expandFreestyleSearchQuery(rawSearch).trim();
  const muscle = String(muscleGroup || '').trim();

  // IMPORTANT: Typed searches should stay broad.
  // Only apply onboarding-derived equipment/level when the tab is empty.
  const equip = equipmentHint
    ? (FILTER_EQUIP_HINT[equipmentHint] || String(equipmentHint).toLowerCase()).trim()
    : hasTypedSearch
      ? ''
      : equipmentFromOnboardingCompact(data, 28);

  const levelPhrase = difficultyHint
    ? difficultyPillQueryChunk(difficultyHint)
    : hasTypedSearch
      ? ''
      : fitnessLevelQueryChunk(data?.fitnessLevel).trim();
  const levelWord = difficultyHint
    ? fitnessLevelOneWord(
        difficultyHint === 'Beginner' ? 'beginner' : difficultyHint === 'Advanced' ? 'advanced' : 'intermediate',
      )
    : fitnessLevelOneWord(data?.fitnessLevel);

  const extracted = hasTypedSearch ? '' : keywordsChunkForQuery(data, 0);
  const goalsLine = topGoalsQueryChunk(data, hasTypedSearch ? 36 : 28);

  let parts;
  if (hasTypedSearch) {
    parts = [searchText, muscle, equip, levelPhrase].filter(Boolean);
  } else {
    parts = ['workout', 'exercise', 'strength', goalsLine, equip, levelWord].filter(Boolean);
  }

  const headJoined = parts.join(' ').replace(/\s+/g, ' ').trim();
  const headCapped = takeCharsByWords(headJoined, maxHead);

  if (!headCapped) {
    return `workout exercise ${QUERY_TAIL}`;
  }
  return `${headCapped} ${QUERY_TAIL}`.trim();
}

/**
 * Recommended feed query: onboarding-only (journey keywords + goals + equip + full level phrase).
 * No typed user input. Caps total `q` at MAX_SEARCH_Q via head budget before `form tutorial`.
 */
function buildRecommendedQuery({ onboardingData }) {
  const data = onboardingData && typeof onboardingData === 'object' ? onboardingData : null;
  const maxHead = Math.max(0, MAX_SEARCH_Q - QUERY_TAIL.length - 1);

  const goalsLine = topGoalsQueryChunk(data, 40);
  const journeyKeywords = extractKeywordsFromOnboarding(data)
    .slice(0, 8)
    .join(' ')
    .trim();
  const equip = equipmentFromOnboardingCompact(data, 26);
  const levelPhrase = fitnessLevelQueryChunk(data?.fitnessLevel).trim();

  const headJoined = ['workout', 'exercise', goalsLine, journeyKeywords, equip, levelPhrase]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const headCapped = takeCharsByWords(headJoined, maxHead);
  return `${headCapped || 'workout exercise'} ${QUERY_TAIL}`.trim();
}

function mergeYoutubeLists(a, b, max = 50) {
  const m = new Map();
  for (const it of [...(a || []), ...(b || [])]) {
    if (it?.videoId && !m.has(it.videoId)) m.set(it.videoId, it);
  }
  return [...m.values()].slice(0, max);
}

async function fetchYoutubeItemsMerged(qStr, signal) {
  let usedServer = false;
  let usedDirect = false;

  let m = await fetchYoutubeItemsViaServer(qStr, signal);
  if (Array.isArray(m) && m.length) usedServer = true;

  // Server results often lack durationSeconds. If we have a key, enrich durations via videos.list.
  const k0 = getYouTubeApiKey();
  if (Array.isArray(m) && m.length && k0 && m.some((it) => typeof it?.durationSeconds !== 'number')) {
    m = await enrichWithDurations(m, k0, signal);
  }

  if (!m || m.length === 0) {
    const k = getYouTubeApiKey();
    if (k) {
      m = await fetchYoutubeItemsDirect(qStr, k, signal);
      if (Array.isArray(m) && m.length) usedDirect = true;
    }
  }

  const apiSource = usedServer ? 'server' : usedDirect ? 'direct' : 'unknown';

  // Split merged list into Shorts vs long-form using durationSeconds / isShort.
  const shorts = [];
  const longForm = [];
  for (const it of m || []) {
    const dur = typeof it.durationSeconds === 'number' ? it.durationSeconds : undefined;
    const explicitShort = it.isShort === true;
    const isShortByTag =
      /\bshorts?\b|#shorts\b/i.test(String(it?.title || '')) || /\bshorts?\b|#shorts\b/i.test(String(it?.description || ''));
    const isShort = explicitShort || (dur != null && dur > 0 && dur <= 75) || (dur == null && isShortByTag); // fallback tag heuristic
    const base = {
      videoId: it.videoId,
      title: it.title,
      channel: it.channel,
      description: it.description,
      publishedAt: it.publishedAt,
      durationSeconds: dur,
    };
    if (isShort) shorts.push(base);
    else longForm.push(base);
  }

  return { items: longForm, shorts, apiSource };
}

/** Cache fingerprint when onboarding fields that affect `q` change. */
function onboardingSearchRelevanceKey(data) {
  if (!data || typeof data !== 'object') return '';
  try {
    return JSON.stringify({
      goals: Array.isArray(data.goals) ? [...data.goals].sort() : [],
      primaryGoal: data.primaryGoal || '',
      goal: data.goal || '',
      fitnessLevel: data.fitnessLevel || '',
      equipmentAccess: Array.isArray(data.equipmentAccess) ? [...data.equipmentAccess].sort() : [],
      trainingEnvironment: data.trainingEnvironment || '',
      daysPerWeek: data.daysPerWeek ?? data.frequency ?? data.workoutsPerWeek ?? '',
      currentStressLevel: data.currentStressLevel || '',
      sleepQuality: data.sleepQuality || '',
      energyLevels: data.energyLevels || '',
      situationSig: String(data.situationDescription || '')
        .trim()
        .slice(0, 200)
        .replace(/\s+/g, ' '),
      supplementsSig: String(data.supplementsCurrentlyTaking || '')
        .trim()
        .slice(0, 120)
        .replace(/\s+/g, ' '),
    });
  } catch {
    return '';
  }
}

async function fetchYoutubeItemsViaServer(q, signal) {
  const bases = getApiBaseCandidates();
  for (const base of bases) {
    const baseNorm = String(base || '').replace(/\/+$/, '');
    if (!baseNorm) continue;
    try {
      const u = new URL('/api/youtube/search', `${baseNorm}/`);
      u.searchParams.set('q', q);
      u.searchParams.set('maxResults', '50');
      const res = await fetch(u.toString(), { signal, headers: { Accept: 'application/json' } });
      const json = await res.json().catch(() => ({}));
      if (res.status === 501) continue;
      if (!res.ok) continue;
      if (Array.isArray(json.items)) {
        return json.items
          .map((it) => ({
            videoId: it.videoId,
            title: it.title || '',
            channel: it.channel || '',
            description: it.description || '',
            publishedAt: it.publishedAt || '',
            // server can optionally attach durationSeconds and isShort flags
            durationSeconds: typeof it.durationSeconds === 'number' ? it.durationSeconds : undefined,
            isShort: typeof it.isShort === 'boolean' ? it.isShort : undefined,
          }))
          .filter((it) => it.videoId);
      }
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
    }
  }
  return null;
}

async function fetchYoutubeItemsDirect(q, apiKey, signal) {
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '50',
    order: 'relevance',
    q,
    key: apiKey,
  });
  const res = await fetch(`${YT_SEARCH}?${params.toString()}`, { signal });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  const base = (json.items || [])
    .map((it) => ({
      videoId: it.id?.videoId,
      title: it.snippet?.title || '',
      channel: it.snippet?.channelTitle || '',
      description: it.snippet?.description || '',
      publishedAt: it.snippet?.publishedAt || '',
    }))
    .filter((it) => it.videoId);

  return await enrichWithDurations(base, apiKey, signal);
}

// YouTube ISO 8601 duration (e.g. "PT45S", "PT8M30S") → seconds.
function parseISODurationToSeconds(iso) {
  if (!iso || typeof iso !== 'string') return undefined;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return undefined;
  const h = parseInt(m[1] || '0', 10);
  const min = parseInt(m[2] || '0', 10);
  const s = parseInt(m[3] || '0', 10);
  const total = h * 3600 + min * 60 + s;
  return Number.isFinite(total) ? total : undefined;
}

async function enrichWithDurations(items, apiKey, signal) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length || !apiKey) return list;

  const ids = [...new Set(list.map((x) => x.videoId).filter(Boolean))].slice(0, 50);
  if (!ids.length) return list;

  try {
    const params = new URLSearchParams({
      part: 'contentDetails',
      id: ids.join(','),
      key: apiKey,
    });
    const res = await fetch(`${YT_VIDEOS}?${params.toString()}`, { signal });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return list;

    const durMap = new Map();
    for (const it of json.items || []) {
      const id = it?.id;
      const dur = parseISODurationToSeconds(it?.contentDetails?.duration);
      if (id && typeof dur === 'number') durMap.set(id, dur);
    }

    return list.map((x) => ({
      ...x,
      durationSeconds: durMap.get(x.videoId),
    }));
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    return list;
  }
}

/**
 * Fetches YouTube search results (search.list), caches by query key.
 *
 * @param {object} opts
 * @param {string} opts.debouncedQuery - search text (already debounced by caller)
 * @param {string|null} opts.muscleGroup
 * @param {string|null} opts.equipmentHint - equipment pill label or null (onboarding equipment used if null)
 * @param {'Beginner'|'Intermediate'|'Advanced'|null|undefined} opts.difficultyHint - difficulty pill; overrides onboarding fitnessLevel in `q`
 * @param {object|null} opts.onboardingData
 * @param {boolean} [opts.enabled]
 */
export function useYouTubeAPI({
  mode = 'search', // 'recommended' | 'search'
  debouncedQuery,
  muscleGroup,
  equipmentHint,
  difficultyHint = null,
  onboardingData,
  enabled = true,
}) {
  const [items, setItems] = useState([]);
  const [shorts, setShorts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({
    mode,
    query: '',
    resultCount: 0,
    apiSource: 'unknown', // 'server' | 'direct' | 'unknown'
    timestamp: null,
    cacheHit: false,
  });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onboardFinger = useMemo(() => onboardingSearchRelevanceKey(onboardingData), [onboardingData]);

  const cacheKey = useMemo(() => {
    return [
      mode || 'search',
      debouncedQuery || '',
      muscleGroup || '',
      equipmentHint || '',
      difficultyHint || '',
      onboardFinger,
    ].join('::');
  }, [mode, debouncedQuery, muscleGroup, equipmentHint, difficultyHint, onboardFinger]);

  useEffect(() => {
    if (!enabled) return undefined;

    const q =
      mode === 'recommended'
        ? buildRecommendedQuery({ onboardingData })
        : buildSearchQuery({ debouncedQuery, muscleGroup, equipmentHint, difficultyHint, onboardingData });

    const hit = cacheGet(cacheKey);
    if (hit && Array.isArray(hit.items)) {
      setItems(hit.items);
      setShorts(Array.isArray(hit.shorts) ? hit.shorts : []);
      setError(null);
      setLoading(false);
      setDebugInfo({
        mode,
        query: q,
        resultCount: hit.items.length,
        apiSource: hit.apiSource || 'unknown',
        timestamp: hit.timestamp || null,
        cacheHit: true,
        shortsCount: hit.shorts ? hit.shorts.length : 0,
      });
      return undefined;
    }

    const ac = new AbortController();
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        let usedSource = 'unknown';
        let mergedRes = await fetchYoutubeItemsMerged(q, ac.signal);
        let mapped = mergedRes.items || [];
        const shortsList = mergedRes.shorts || [];
        usedSource = mergedRes.apiSource || 'unknown';

        const isRecommended = mode === 'recommended';

        // Top up recommended feed with a couple broad fallbacks if results are too small.
        if (isRecommended && mapped.length < 22) {
          const m2 = await fetchYoutubeItemsMerged('workout full body strength training exercises form tutorial', ac.signal);
          mapped = mergeYoutubeLists(mapped, m2.items || []);
          if (usedSource === 'unknown') usedSource = m2.apiSource || 'unknown';
        }
        if (isRecommended && mapped.length < 22) {
          const journey = keywordsChunkForQuery(onboardingData, 80);
          if (journey) {
            const qJ = `${takeCharsByWords(
              `${journey} workout fitness`,
              Math.max(40, MAX_SEARCH_Q - QUERY_TAIL.length - 8),
            )} ${QUERY_TAIL}`.trim();
            const m3 = await fetchYoutubeItemsMerged(qJ, ac.signal);
            mapped = mergeYoutubeLists(mapped, m3.items || []);
            if (usedSource === 'unknown') usedSource = m3.apiSource || 'unknown';
          }
        }
        if (isRecommended && mapped.length < 22) {
          const m4 = await fetchYoutubeItemsMerged('hypertrophy dumbbell gym workout tutorial', ac.signal);
          mapped = mergeYoutubeLists(mapped, m4.items || []);
          if (usedSource === 'unknown') usedSource = m4.apiSource || 'unknown';
        }

        cacheSet(cacheKey, { items: mapped, shorts: shortsList, apiSource: usedSource, timestamp: isoNow() });
        if (!cancelled && mounted.current) {
          setItems(mapped);
          setShorts(shortsList);
          setDebugInfo({
            mode,
            query: q,
            resultCount: mapped.length,
            apiSource: usedSource,
            timestamp: isoNow(),
            cacheHit: false,
            shortsCount: shortsList.length,
          });
          if (mapped.length === 0 && !getYouTubeApiKey()) {
            setError(
              'YouTube: start the API server (`npm run server`) with YOUTUBE_API_KEY or REACT_NATIVE_YOUTUBE_API_KEY in the project root .env, or add EXPO_PUBLIC_YOUTUBE_API_KEY for a direct client call.',
            );
          } else {
            setError(null);
          }
        }
      } catch (e) {
        if (e?.name === 'AbortError') return;
        if (!cancelled && mounted.current) {
          setError(e?.message || 'fetch_failed');
          setItems([]);
          setShorts([]);
          setDebugInfo({
            mode,
            query: q,
            resultCount: 0,
            apiSource: 'unknown',
            timestamp: isoNow(),
            cacheHit: false,
            shortsCount: 0,
          });
        }
      } finally {
        if (!cancelled && mounted.current) setLoading(false);
      }
    };

    const t = setTimeout(run, 380);
    return () => {
      cancelled = true;
      clearTimeout(t);
      ac.abort();
    };
  }, [cacheKey, enabled, mode, debouncedQuery, muscleGroup, equipmentHint, difficultyHint, onboardingData]);

  return { items, shorts, loading, error, debugInfo };
}
