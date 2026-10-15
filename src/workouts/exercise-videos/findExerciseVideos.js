// Build YouTube search queries from onboarding + filters, then fetch videos for the Exercise Library.
// Flow: onboarding keywords → recommended/search `q` → cache → server /api/youtube/search → long-form + Shorts.
// Used by: ExerciseVideosTab.jsx (recommended feed + typed search).
// Key exports: getExerciseLibraryJourneyHint, findExerciseVideos

import { useEffect, useMemo, useRef, useState } from 'react';
import { getResilientApiBases } from '../../for-both/online-connection/whereToConnect';
import { getApiAuthHeaders } from '../../for-both/online-connection/attachLoginProof';

// ===== NAMED CONSTANTS =====

/** Bust in-memory cache when search/filter logic changes. */
const CACHE_VERSION = 'v21';

// Manipulate here: how long a query’s results stay in the in-memory Map
const MS_PER_MINUTE = 60000;
const CACHE_TTL_MINUTES = 25;
const CACHE_TTL_MS = CACHE_TTL_MINUTES * MS_PER_MINUTE;

// Manipulate here: delay before a new search fires (lets typing settle)
const SEARCH_DEBOUNCE_MS = 380;

/** Soft target for recommended-feed size before we run broad fallback queries. */
const RECOMMENDED_MIN_RESULTS = 22;

const MAX_SEARCH_QUERY_CHARS = 180;
const QUERY_TAIL = 'form tutorial';

const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_IMPLEMENTED = 501;

const MAX_MERGED_YOUTUBE_ITEMS = 50;
const MAX_YOUTUBE_RESULTS_PARAM = '50';

/** Shorts heuristic: treat as Short when duration is this many seconds or less. */
const SHORTS_MAX_DURATION_SECONDS = 75;

const MAX_JOURNEY_HINT_PARTS = 4;
const MAX_ONBOARDING_KEYWORDS = 16;
const MAX_GOAL_SLUGS_SCANNED = 3;
const MAX_KEYWORD_PUSH_FROM_GOALS = 24;
const MAX_RESIDUAL_WORDS = 6;
const MAX_RECOMMENDED_JOURNEY_KEYWORDS = 8;

const COMPACT_EQUIP_CHARS_TYPED = 42;
const COMPACT_EQUIP_CHARS_EMPTY = 28;
const COMPACT_EQUIP_CHARS_RECOMMENDED = 26;
const GOALS_CHARS_TYPED = 36;
const GOALS_CHARS_EMPTY = 28;
const GOALS_CHARS_RECOMMENDED = 40;
const JOURNEY_FALLBACK_MAX_CHARS = 80;
const JOURNEY_FALLBACK_MIN_HEAD = 40;
const JOURNEY_FALLBACK_TAIL_PAD = 8;

const SITUATION_SIG_CHARS = 200;
const SUPPLEMENTS_SIG_CHARS = 120;
const SANITIZE_JOURNEY_MAX_WORDS = 400;
const SANITIZE_JOURNEY_MAX_CHARS = 2800;
const SANITIZE_INTENT_DEFAULT_WORDS = 10;
const SANITIZE_INTENT_DEFAULT_CHARS = 160;
const SANITIZE_RESIDUAL_MAX_WORDS = 22;
const SANITIZE_RESIDUAL_MAX_CHARS = 200;
const MIN_KEYWORD_LENGTH = 2;
const MIN_RESIDUAL_WORD_LENGTH = 3;
const MAX_SINGLE_WORD_LENGTH = 36;
const MIN_TRAINING_DAYS_PER_WEEK = 1;
const MAX_TRAINING_DAYS_PER_WEEK = 7;

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
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'was', 'our', 'out',
  'get', 'has', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'who', 'did', 'what',
  'with', 'have', 'this', 'that', 'from', 'they', 'into', 'just', 'like', 'also', 'only',
  'know', 'take', 'each', 'want', 'work', 'well', 'year', 'your', 'when', 'will', 'come',
  'about', 'after', 'again', 'there', 'their', 'would', 'could', 'been', 'being', 'than',
  'then', 'them', 'very', 'some', 'such', 'over', 'more', 'most', 'much', 'make', 'many',
  'need', 'help', 'goal', 'goals', 'really', 'trying', 'looking',
]);

const youtubeResultCache = new Map();

// ===== HELPER FUNCTIONS =====

function isoTimestampNow() {
  try {
    return new Date().toISOString();
  } catch {
    return null;
  }
}

function cacheKeyWithVersion(key) {
  return `${key}::${CACHE_VERSION}`;
}

function cacheGet(key) {
  const fullKey = cacheKeyWithVersion(key);
  const entry = youtubeResultCache.get(fullKey);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > CACHE_TTL_MS) {
    youtubeResultCache.delete(fullKey);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  youtubeResultCache.set(cacheKeyWithVersion(key), { savedAt: Date.now(), value });
}

function equipmentFromOnboarding(data) {
  const accessList = Array.isArray(data?.equipmentAccess) ? data.equipmentAccess : [];
  const parts = accessList.map(
    (equipSlug) => ONBOARDING_EQUIP_EXPAND[equipSlug] || String(equipSlug).replace(/_/g, ' '),
  );
  return parts.join(' ').trim();
}

/** Keep whole words until we hit maxChars (YouTube `q` has a length budget). */
function takeCharsByWords(text, maxChars) {
  const trimmed = String(text || '').trim();
  if (!trimmed || maxChars <= 0) return '';
  if (trimmed.length <= maxChars) return trimmed;

  let kept = '';
  for (const word of trimmed.split(/\s+/)) {
    if (!word) continue;
    const next = kept ? `${kept} ${word}` : word;
    if (next.length > maxChars) break;
    kept = next;
  }
  return kept;
}

/** Shorter equipment string when combining with typed search (full gym line dilutes YouTube). */
function equipmentFromOnboardingCompact(data, maxChars = COMPACT_EQUIP_CHARS_TYPED) {
  return takeCharsByWords(equipmentFromOnboarding(data), maxChars);
}

/** Onboarding fitnessLevel → query tokens (skipped when Difficulty pill overrides). */
function fitnessLevelQueryChunk(level) {
  if (level == null || level === '') return '';
  const lower = String(level).toLowerCase();
  if (lower.includes('begin')) return 'beginner friendly basics';
  if (lower.includes('adv')) return 'advanced intensity technique';
  return 'intermediate progression';
}

/** Single-word level for broad empty-tab queries (full phrase over-narrows YouTube). */
function fitnessLevelOneWord(level) {
  if (level == null || level === '') return '';
  const lower = String(level).toLowerCase();
  if (lower.includes('begin')) return 'beginner';
  if (lower.includes('adv')) return 'advanced';
  return 'intermediate';
}

/** Library Difficulty pill → same tokens as onboarding level (overrides profile level in `q`). */
function difficultyPillQueryChunk(pill) {
  if (!pill) return '';
  const label = String(pill);
  if (label === 'Beginner') return 'beginner friendly basics';
  if (label === 'Advanced') return 'advanced intensity technique';
  if (label === 'Intermediate') return 'intermediate progression';
  return '';
}

/** Strip emails/URLs from free text used in `q`. */
function sanitizeIntentText(
  raw,
  maxWords = SANITIZE_INTENT_DEFAULT_WORDS,
  maxChars = SANITIZE_INTENT_DEFAULT_CHARS,
) {
  if (!raw || typeof raw !== 'string') return '';

  const cleaned = String(raw)
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';

  const words = cleaned
    .split(/\s+/)
    .filter((word) => word.length > 1 && word.length < MAX_SINGLE_WORD_LENGTH);
  return words.slice(0, maxWords).join(' ').slice(0, maxChars).trim();
}

/**
 * Normalize Journey / search text so shorthand typos match dictionary + regex intent.
 * e.g. "body recon" → "body recomp"
 */
function normalizeJourneyTextForKeywords(raw) {
  let text = String(raw || '').toLowerCase().replace(/\s+/g, ' ');
  text = text.replace(/\bbody\s*recon\b/g, 'body recomp');
  return text;
}

/**
 * Map casual training phrases → extra tokens (typed search + first words of situation).
 * Injuries/limitations are intentionally not used in `q`.
 */
function expandFreestyleSearchQuery(raw) {
  const queryText = normalizeJourneyTextForKeywords(String(raw || '').trim());
  if (!queryText) return '';

  const lower = queryText.toLowerCase();
  const boosts = [];

  if (/\b(body\s*)?recomp(ositions?)?\b|\bbody\s*recomposition\b|\bmaingain\b/i.test(lower)) {
    boosts.push('body recomposition recomp lean bulk');
  }
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

  if (!boosts.length) return queryText;

  const merged = `${queryText} ${boosts.join(' ')}`;
  return [...new Set(merged.split(/\s+/).filter(Boolean))].join(' ');
}

/**
 * Expand a goal slug (or free text) into YouTube tokens.
 * @param {string} slug
 * @returns {string}
 */
function expandGoalSlug(slug) {
  return GOAL_QUERY_CHUNK[slug] || String(slug).replace(/_/g, ' ');
}

/**
 * Mutable keyword bag used while scanning onboarding fields.
 * @returns {{ list: string[], push: (kw: string) => void, has: (kw: string) => boolean }}
 */
function makeKeywordBag() {
  const list = [];
  const seen = new Set();

  function push(keyword) {
    const normalized = String(keyword || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (normalized.length < MIN_KEYWORD_LENGTH || seen.has(normalized)) return;
    seen.add(normalized);
    list.push(normalized);
  }

  return {
    list,
    push,
    has: (keyword) => seen.has(keyword),
  };
}

function pushHighIntentJourneyPhrases(description, push) {
  if (/\b(body\s*)?recomp(ositions?)?\b|\bbody\s*recomp\b|\bbody\s*recomposition\b|\bmaingain\b/.test(description)) {
    push('body recomposition');
    push('recomp');
  }
  if (/\bskinny[-\s]?fat\b|\bthin\s*fat\b|\bskinnyfat\b/.test(description)) {
    push('skinny fat');
    push('recomposition');
  }
}

function pushDictionaryMatches(description, push) {
  const termsLongestFirst = [...SITUATION_DICTIONARY].sort(
    (left, right) => right.length - left.length,
  );
  for (const term of termsLongestFirst) {
    if (description.includes(term)) push(term);
  }
}

function pushBoostedJourneyWords(descRaw, push) {
  const journeyForBoost = sanitizeIntentText(
    descRaw,
    SANITIZE_JOURNEY_MAX_WORDS,
    SANITIZE_JOURNEY_MAX_CHARS,
  );
  const boosted = journeyForBoost ? expandFreestyleSearchQuery(journeyForBoost) : '';
  if (!boosted || boosted === journeyForBoost) return;

  for (const word of boosted.split(/\s+/)) {
    if (word.length > 1 && !SITUATION_STOPWORDS.has(word.toLowerCase())) {
      push(word.toLowerCase());
    }
  }
}

/**
 * Push space-split tokens from one expanded goal string; stop when bag is full.
 * @param {string} expanded
 * @param {{ push: Function, list: string[] }} bag
 * @returns {boolean} true when the bag hit its cap
 */
function pushExpandedGoalTokens(expanded, bag) {
  const tokens = String(expanded).split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    bag.push(token);
    if (bag.list.length >= MAX_KEYWORD_PUSH_FROM_GOALS) return true;
  }
  return false;
}

function pushGoalTokens(onboardingData, bag) {
  const goalArr = Array.isArray(onboardingData.goals)
    ? onboardingData.goals.filter(Boolean).map((goal) => String(goal).trim())
    : [];

  for (const goalSlug of goalArr.slice(0, MAX_GOAL_SLUGS_SCANNED)) {
    const bagIsFull = pushExpandedGoalTokens(expandGoalSlug(goalSlug), bag);
    if (bagIsFull) return;
  }

  const primaryGoal = onboardingData.primaryGoal || onboardingData.goal;
  if (primaryGoal && !goalArr.length) {
    pushExpandedGoalTokens(expandGoalSlug(String(primaryGoal).trim()), bag);
  }
}

function pushSupplementTokens(onboardingData, push) {
  const supplements = String(onboardingData.supplementsCurrentlyTaking || '').toLowerCase();
  if (supplements.includes('creatine')) push('creatine');
  if (supplements.includes('protein')) push('protein');
  if (supplements.includes('whey')) push('whey');
  if (supplements.includes('vitamin')) push('vitamins');
  if (supplements.includes('pre workout') || supplements.includes('preworkout')) {
    push('pre workout');
  }
  if (supplements.includes('bcaa')) push('bcaa');
}

function pushRecoveryTokens(onboardingData, push) {
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
}

function pushFrequencyAndEnvironment(onboardingData, push) {
  const environment = String(onboardingData.trainingEnvironment || '').toLowerCase();
  if (environment && environment !== 'both') push(environment);

  // equipmentAccess is applied separately in buildSearchQuery — omit here to avoid duplicate tokens.
  const rawDays =
    onboardingData.daysPerWeek ?? onboardingData.frequency ?? onboardingData.workoutsPerWeek;
  const daysNumber = Number(rawDays);
  if (
    Number.isFinite(daysNumber) &&
    daysNumber >= MIN_TRAINING_DAYS_PER_WEEK &&
    daysNumber <= MAX_TRAINING_DAYS_PER_WEEK
  ) {
    push(`${daysNumber} day`);
  }
}

function pushResidualJourneyWords(descRaw, bag) {
  const residual = sanitizeIntentText(
    descRaw,
    SANITIZE_RESIDUAL_MAX_WORDS,
    SANITIZE_RESIDUAL_MAX_CHARS,
  ).toLowerCase();
  if (!residual) return;

  let added = 0;
  for (const word of residual.split(/\s+/)) {
    if (word.length < MIN_RESIDUAL_WORD_LENGTH) continue;
    if (SITUATION_STOPWORDS.has(word) || bag.has(word)) continue;
    if (/^\d+$/.test(word) && word.length > 2) continue;
    bag.push(word);
    added += 1;
    if (added >= MAX_RESIDUAL_WORDS) break;
  }
}

/**
 * Pull fitness-relevant tokens from onboarding (Journey text first), goals, supplements,
 * recovery, environment, frequency. Used for recommended `q` and optional empty-tab merges.
 * Injuries are not auto-added to `q`.
 * @returns {string[]} deduped keywords in priority order
 */
function extractKeywordsFromOnboarding(onboardingData) {
  if (!onboardingData || typeof onboardingData !== 'object') return [];

  const bag = makeKeywordBag();
  const descRaw = String(onboardingData.situationDescription || '');
  const description = normalizeJourneyTextForKeywords(descRaw);

  // High-intent phrases first so they survive the token cap in recommended queries.
  pushHighIntentJourneyPhrases(description, bag.push);
  pushDictionaryMatches(description, bag.push);
  pushBoostedJourneyWords(descRaw, bag.push);

  const timesPerWeek = descRaw.match(/\b(\d)\s*x\b/i);
  if (timesPerWeek) bag.push(`${timesPerWeek[1]}x week`);

  pushGoalTokens(onboardingData, bag);
  pushSupplementTokens(onboardingData, bag.push);
  pushRecoveryTokens(onboardingData, bag.push);
  pushFrequencyAndEnvironment(onboardingData, bag.push);
  pushResidualJourneyWords(descRaw, bag);

  return bag.list.slice(0, MAX_ONBOARDING_KEYWORDS);
}

/** Join extracted keywords with a char budget (caps bloat for YouTube). */
function keywordsChunkForQuery(onboardingData, maxChars) {
  const keywords = extractKeywordsFromOnboarding(onboardingData);
  if (!keywords.length) return '';
  return takeCharsByWords(keywords.join(' '), maxChars);
}

/** Goals only (expanded slugs) — kept separate from Journey keyword scan. */
function topGoalsQueryChunk(data, maxChars) {
  if (!data || typeof data !== 'object') return '';

  const goals = Array.isArray(data.goals)
    ? data.goals.filter(Boolean).map((goal) => String(goal).trim())
    : [];

  if (goals.length >= 2) {
    return takeCharsByWords(`${expandGoalSlug(goals[0])} ${expandGoalSlug(goals[1])}`, maxChars);
  }
  if (goals.length === 1) {
    return takeCharsByWords(expandGoalSlug(goals[0]), maxChars);
  }

  const primaryGoal = data.primaryGoal || data.goal;
  if (primaryGoal) return takeCharsByWords(expandGoalSlug(String(primaryGoal).trim()), maxChars);
  return '';
}

/**
 * Builds YouTube `q`.
 * - Empty tab: broad base + short goals + compact equip + one-word level.
 * - Typed search: user text + pills + level phrase + Journey keyword tail.
 */
function buildSearchQuery({
  debouncedQuery,
  muscleGroup,
  equipmentHint,
  difficultyHint,
  onboardingData,
}) {
  const data = onboardingData && typeof onboardingData === 'object' ? onboardingData : null;
  const maxHead = Math.max(0, MAX_SEARCH_QUERY_CHARS - QUERY_TAIL.length - 1);

  const rawSearch = String(debouncedQuery || '').trim();
  const hasTypedSearch = rawSearch.length > 0;
  const searchText = expandFreestyleSearchQuery(rawSearch).trim();
  const muscle = String(muscleGroup || '').trim();

  // Typed searches stay broad — only apply onboarding equipment/level when the tab is empty.
  const equip = equipmentHint
    ? (FILTER_EQUIP_HINT[equipmentHint] || String(equipmentHint).toLowerCase()).trim()
    : hasTypedSearch
      ? ''
      : equipmentFromOnboardingCompact(data, COMPACT_EQUIP_CHARS_EMPTY);

  const levelPhrase = difficultyHint
    ? difficultyPillQueryChunk(difficultyHint)
    : hasTypedSearch
      ? ''
      : fitnessLevelQueryChunk(data?.fitnessLevel).trim();

  const levelWord = difficultyHint
    ? fitnessLevelOneWord(
        difficultyHint === 'Beginner'
          ? 'beginner'
          : difficultyHint === 'Advanced'
            ? 'advanced'
            : 'intermediate',
      )
    : fitnessLevelOneWord(data?.fitnessLevel);

  const goalsLine = topGoalsQueryChunk(
    data,
    hasTypedSearch ? GOALS_CHARS_TYPED : GOALS_CHARS_EMPTY,
  );

  const parts = hasTypedSearch
    ? [searchText, muscle, equip, levelPhrase].filter(Boolean)
    : ['workout', 'exercise', 'strength', goalsLine, equip, levelWord].filter(Boolean);

  const headJoined = parts.join(' ').replace(/\s+/g, ' ').trim();
  const headCapped = takeCharsByWords(headJoined, maxHead);

  if (!headCapped) {
    return `workout exercise ${QUERY_TAIL}`;
  }
  return `${headCapped} ${QUERY_TAIL}`.trim();
}

/**
 * Recommended feed query: onboarding-only (journey keywords + goals + equip + full level phrase).
 * No typed user input. Caps total `q` at MAX_SEARCH_QUERY_CHARS via head budget before `form tutorial`.
 */
function buildRecommendedQuery({ onboardingData }) {
  const data = onboardingData && typeof onboardingData === 'object' ? onboardingData : null;
  const maxHead = Math.max(0, MAX_SEARCH_QUERY_CHARS - QUERY_TAIL.length - 1);

  const goalsLine = topGoalsQueryChunk(data, GOALS_CHARS_RECOMMENDED);
  const journeyKeywords = extractKeywordsFromOnboarding(data)
    .slice(0, MAX_RECOMMENDED_JOURNEY_KEYWORDS)
    .join(' ')
    .trim();
  const equip = equipmentFromOnboardingCompact(data, COMPACT_EQUIP_CHARS_RECOMMENDED);
  const levelPhrase = fitnessLevelQueryChunk(data?.fitnessLevel).trim();

  const headJoined = ['workout', 'exercise', goalsLine, journeyKeywords, equip, levelPhrase]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const headCapped = takeCharsByWords(headJoined, maxHead);
  return `${headCapped || 'workout exercise'} ${QUERY_TAIL}`.trim();
}

function mergeYoutubeLists(listA, listB, max = MAX_MERGED_YOUTUBE_ITEMS) {
  const byVideoId = new Map();
  for (const item of [...(listA || []), ...(listB || [])]) {
    if (item?.videoId && !byVideoId.has(item.videoId)) {
      byVideoId.set(item.videoId, item);
    }
  }
  return [...byVideoId.values()].slice(0, max);
}

/**
 * Split raw YouTube items into long-form vs Shorts using duration / isShort / title tags.
 * @param {Array} items
 * @returns {{ longForm: Array, shorts: Array }}
 */
function splitLongFormAndShorts(items) {
  const shorts = [];
  const longForm = [];

  for (const item of items || []) {
    const durationSeconds =
      typeof item.durationSeconds === 'number' ? item.durationSeconds : undefined;
    const explicitShort = item.isShort === true;
    const isShortByTag =
      /\bshorts?\b|#shorts\b/i.test(String(item?.title || '')) ||
      /\bshorts?\b|#shorts\b/i.test(String(item?.description || ''));
    const isShort =
      explicitShort ||
      (durationSeconds != null &&
        durationSeconds > 0 &&
        durationSeconds <= SHORTS_MAX_DURATION_SECONDS) ||
      (durationSeconds == null && isShortByTag);

    const base = {
      videoId: item.videoId,
      title: item.title,
      channel: item.channel,
      description: item.description,
      publishedAt: item.publishedAt,
      durationSeconds,
    };

    if (isShort) shorts.push(base);
    else longForm.push(base);
  }

  return { longForm, shorts };
}

async function fetchYoutubeItemsMerged(queryString, signal) {
  let items = await fetchYoutubeItemsViaServer(queryString, signal);
  let apiSource = Array.isArray(items) && items.length ? 'server' : 'unknown';

  if (!items?.length) {
    items = await fetchYoutubeItemsDirect(queryString, signal);
    if (items?.length) apiSource = 'direct';
  }

  const { longForm, shorts } = splitLongFormAndShorts(items);
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
      equipmentAccess: Array.isArray(data.equipmentAccess)
        ? [...data.equipmentAccess].sort()
        : [],
      trainingEnvironment: data.trainingEnvironment || '',
      daysPerWeek: data.daysPerWeek ?? data.frequency ?? data.workoutsPerWeek ?? '',
      currentStressLevel: data.currentStressLevel || '',
      sleepQuality: data.sleepQuality || '',
      energyLevels: data.energyLevels || '',
      situationSig: String(data.situationDescription || '')
        .trim()
        .slice(0, SITUATION_SIG_CHARS)
        .replace(/\s+/g, ' '),
      supplementsSig: String(data.supplementsCurrentlyTaking || '')
        .trim()
        .slice(0, SUPPLEMENTS_SIG_CHARS)
        .replace(/\s+/g, ' '),
    });
  } catch {
    return '';
  }
}

/** Client must not bundle YouTube API keys — server proxy only (see /api/youtube/search). */
function readYoutubeApiKeyFallback() {
  return '';
}

/** Deprecated direct path — always returns null; kept for call-site stability. */
async function fetchYoutubeItemsDirect(queryString, signal) {
  const apiKey = readYoutubeApiKeyFallback();
  if (!apiKey) return null;

  try {
    const requestUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    requestUrl.searchParams.set('part', 'snippet');
    requestUrl.searchParams.set('type', 'video');
    requestUrl.searchParams.set('maxResults', MAX_YOUTUBE_RESULTS_PARAM);
    requestUrl.searchParams.set('order', 'relevance');
    requestUrl.searchParams.set('q', queryString);
    requestUrl.searchParams.set('key', apiKey);

    const response = await fetch(requestUrl.toString(), {
      signal,
      headers: { Accept: 'application/json' },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) return null;

    return (data.items || [])
      .map((item) => ({
        videoId: item.id?.videoId,
        title: item.snippet?.title || '',
        channel: item.snippet?.channelTitle || '',
        description: item.snippet?.description || '',
        publishedAt: item.snippet?.publishedAt || '',
      }))
      .filter((item) => item.videoId);
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return null;
  }
}

/**
 * Try one API base for /api/youtube/search. Returns items or null.
 * @param {string} baseNorm
 * @param {string} queryString
 * @param {AbortSignal} signal
 * @param {object} authHeaders
 * @returns {Promise<Array|null>}
 */
async function fetchYoutubeItemsFromOneBase(baseNorm, queryString, signal, authHeaders) {
  const requestUrl = new URL('/api/youtube/search', `${baseNorm}/`);
  requestUrl.searchParams.set('q', queryString);
  requestUrl.searchParams.set('maxResults', MAX_YOUTUBE_RESULTS_PARAM);

  const response = await fetch(requestUrl.toString(), { signal, headers: authHeaders });
  const json = await response.json().catch(() => ({}));

  if (response.status === HTTP_NOT_IMPLEMENTED) return null;
  if (response.status === HTTP_UNAUTHORIZED) return null;
  if (!response.ok) return null;
  if (!Array.isArray(json.items)) return null;

  return json.items
    .map((item) => ({
      videoId: item.videoId,
      title: item.title || '',
      channel: item.channel || '',
      description: item.description || '',
      publishedAt: item.publishedAt || '',
      durationSeconds:
        typeof item.durationSeconds === 'number' ? item.durationSeconds : undefined,
      isShort: typeof item.isShort === 'boolean' ? item.isShort : undefined,
    }))
    .filter((item) => item.videoId);
}

/**
 * Try one API base; return items, or null to try the next base.
 * Re-throws AbortError so the hook can cancel cleanly.
 * @returns {Promise<Array|null>}
 */
async function tryYoutubeSearchOnBase(base, queryString, signal, authHeaders) {
  const baseNorm = String(base || '').replace(/\/+$/, '');
  if (!baseNorm) return null;

  try {
    return await fetchYoutubeItemsFromOneBase(baseNorm, queryString, signal, authHeaders);
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return null;
  }
}

async function fetchYoutubeItemsViaServer(queryString, signal) {
  const bases = getResilientApiBases();
  let authHeaders = { Accept: 'application/json' };
  try {
    authHeaders = await getApiAuthHeaders();
  } catch {
    /* signed-out or token refresh failure — server will 401 */
  }

  for (const base of bases) {
    const items = await tryYoutubeSearchOnBase(base, queryString, signal, authHeaders);
    if (items) return items;
  }

  return null;
}

/**
 * Top up a thin recommended feed with broad fallback YouTube queries.
 * @param {Array} mapped
 * @param {string} usedSource
 * @param {object|null} onboardingData
 * @param {AbortSignal} signal
 * @returns {Promise<{ mapped: Array, usedSource: string }>}
 */
async function topUpRecommendedFeed(mapped, usedSource, onboardingData, signal) {
  let nextMapped = mapped;
  let nextSource = usedSource;

  if (nextMapped.length >= RECOMMENDED_MIN_RESULTS) {
    return { mapped: nextMapped, usedSource: nextSource };
  }

  const broad = await fetchYoutubeItemsMerged(
    'workout full body strength training exercises form tutorial',
    signal,
  );
  nextMapped = mergeYoutubeLists(nextMapped, broad.items || []);
  if (nextSource === 'unknown') nextSource = broad.apiSource || 'unknown';

  if (nextMapped.length >= RECOMMENDED_MIN_RESULTS) {
    return { mapped: nextMapped, usedSource: nextSource };
  }

  const journey = keywordsChunkForQuery(onboardingData, JOURNEY_FALLBACK_MAX_CHARS);
  if (journey) {
    const journeyQuery = `${takeCharsByWords(
      `${journey} workout fitness`,
      Math.max(
        JOURNEY_FALLBACK_MIN_HEAD,
        MAX_SEARCH_QUERY_CHARS - QUERY_TAIL.length - JOURNEY_FALLBACK_TAIL_PAD,
      ),
    )} ${QUERY_TAIL}`.trim();
    const journeyResults = await fetchYoutubeItemsMerged(journeyQuery, signal);
    nextMapped = mergeYoutubeLists(nextMapped, journeyResults.items || []);
    if (nextSource === 'unknown') nextSource = journeyResults.apiSource || 'unknown';
  }

  if (nextMapped.length >= RECOMMENDED_MIN_RESULTS) {
    return { mapped: nextMapped, usedSource: nextSource };
  }

  const hypertrophy = await fetchYoutubeItemsMerged(
    'hypertrophy dumbbell gym workout tutorial',
    signal,
  );
  nextMapped = mergeYoutubeLists(nextMapped, hypertrophy.items || []);
  if (nextSource === 'unknown') nextSource = hypertrophy.apiSource || 'unknown';

  return { mapped: nextMapped, usedSource: nextSource };
}

// ===== MAIN FUNCTION =====

/**
 * Labels for Exercise Library section subtitles (matches recommended-query intent).
 * @param {object|null} onboardingData
 * @returns {string}
 */
export function getExerciseLibraryJourneyHint(onboardingData) {
  const description = normalizeJourneyTextForKeywords(
    onboardingData?.situationDescription || '',
  );
  const parts = [];

  if (/\b(body\s*)?recomp(ositions?)?\b|\bbody\s*recomp\b|\bbody\s*recomposition\b|\bmaingain\b/.test(description)) {
    parts.push('Body recomp');
  }
  if (/\bskinny[-\s]?fat\b|\bthin\s*fat\b|\bskinnyfat\b/.test(description)) {
    parts.push('Skinny-fat');
  }

  const goals = Array.isArray(onboardingData?.goals) ? onboardingData.goals : [];
  if (goals.some((goal) => /recomp/i.test(String(goal)))) {
    if (!parts.includes('Body recomp')) parts.push('Body recomp');
  }

  return parts.slice(0, MAX_JOURNEY_HINT_PARTS).join(' · ');
}

/**
 * Fetches YouTube search results, caches by query key.
 * Routes through the authenticated server endpoint (no client API key).
 *
 * @param {object} opts
 * @param {'recommended'|'search'} [opts.mode]
 * @param {string} opts.debouncedQuery
 * @param {string|null} opts.muscleGroup
 * @param {string|null} opts.equipmentHint
 * @param {'Beginner'|'Intermediate'|'Advanced'|null|undefined} opts.difficultyHint
 * @param {object|null} opts.onboardingData
 * @param {boolean} [opts.enabled]
 * @returns {{ items: Array, shorts: Array, loading: boolean, error: string|null, debugInfo: object }}
 */
export function findExerciseVideos({
  mode = 'search',
  debouncedQuery,
  muscleGroup,
  equipmentHint,
  difficultyHint = null,
  onboardingData,
  enabled = true,
}) {
  // vocab: useState = React state that re-renders when we set it
  const [items, setItems] = useState([]);
  const [shorts, setShorts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({
    mode,
    query: '',
    resultCount: 0,
    apiSource: 'unknown',
    timestamp: null,
    cacheHit: false,
  });
  // vocab: useRef = mutable box that survives re-renders without causing them
  const mounted = useRef(true);

  // vocab: useEffect = run after paint; cleanup when deps change or unmount
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // vocab: useMemo = remember a value until deps change
  const onboardFinger = useMemo(
    () => onboardingSearchRelevanceKey(onboardingData),
    [onboardingData],
  );

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

    const searchQuery =
      mode === 'recommended'
        ? buildRecommendedQuery({ onboardingData })
        : buildSearchQuery({
            debouncedQuery,
            muscleGroup,
            equipmentHint,
            difficultyHint,
            onboardingData,
          });

    const cacheHit = cacheGet(cacheKey);
    if (cacheHit && Array.isArray(cacheHit.items)) {
      setItems(cacheHit.items);
      setShorts(Array.isArray(cacheHit.shorts) ? cacheHit.shorts : []);
      setError(null);
      setLoading(false);
      setDebugInfo({
        mode,
        query: searchQuery,
        resultCount: cacheHit.items.length,
        apiSource: cacheHit.apiSource || 'unknown',
        timestamp: cacheHit.timestamp || null,
        cacheHit: true,
        shortsCount: cacheHit.shorts ? cacheHit.shorts.length : 0,
      });
      return undefined;
    }

    // vocab: AbortController = cancel in-flight fetch when the effect cleans up
    const abortController = new AbortController();
    let cancelled = false;

    const runSearch = async () => {
      setLoading(true);
      setError(null);

      try {
        const merged = await fetchYoutubeItemsMerged(searchQuery, abortController.signal);
        let mapped = merged.items || [];
        const shortsList = merged.shorts || [];
        let usedSource = merged.apiSource || 'unknown';

        if (mode === 'recommended') {
          const topped = await topUpRecommendedFeed(
            mapped,
            usedSource,
            onboardingData,
            abortController.signal,
          );
          mapped = topped.mapped;
          usedSource = topped.usedSource;
        }

        cacheSet(cacheKey, {
          items: mapped,
          shorts: shortsList,
          apiSource: usedSource,
          timestamp: isoTimestampNow(),
        });

        if (cancelled || !mounted.current) return;

        setItems(mapped);
        setShorts(shortsList);
        setDebugInfo({
          mode,
          query: searchQuery,
          resultCount: mapped.length,
          apiSource: usedSource,
          timestamp: isoTimestampNow(),
          cacheHit: false,
          shortsCount: shortsList.length,
        });

        if (mapped.length === 0) {
          setError(
            'No YouTube videos loaded. Sign in, enable YouTube Data API v3 on your Google key, and run ./scripts/syncCloudRunEnv.sh once (uses REACT_NATIVE_YOUTUBE_API_KEY from .env).',
          );
        } else {
          setError(null);
        }
      } catch (fetchError) {
        if (fetchError?.name === 'AbortError') return;
        if (cancelled || !mounted.current) return;

        setError(fetchError?.message || 'fetch_failed');
        setItems([]);
        setShorts([]);
        setDebugInfo({
          mode,
          query: searchQuery,
          resultCount: 0,
          apiSource: 'unknown',
          timestamp: isoTimestampNow(),
          cacheHit: false,
          shortsCount: 0,
        });
      } finally {
        if (!cancelled && mounted.current) setLoading(false);
      }
    };

    // Manipulate here: SEARCH_DEBOUNCE_MS — lower = snappier, higher = fewer API calls
    const debounceTimer = setTimeout(runSearch, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
      abortController.abort();
    };
  }, [
    cacheKey,
    enabled,
    mode,
    debouncedQuery,
    muscleGroup,
    equipmentHint,
    difficultyHint,
    onboardingData,
  ]);

  return { items, shorts, loading, error, debugInfo };
}
