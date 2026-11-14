// Turns the snake_case onboarding answers stored in Firestore into display text.
// Flow: 'lose_fat' → lookup table → "Lose Fat"; unknown tokens fall back to auto Title Case.
// Used by profile screens and trainer client cards, which must never show raw ids like "full_gym".
// Read order: constants → numbered mains → helper / PLUMBING at the bottom.

// ===== NAMED CONSTANTS =====

// Manipulate here: placeholder shown for missing / "no answer" values.
const EMPTY_ANSWER_PLACEHOLDER = '—';
// Older writes stored these literal strings as "no answer". Treat them as empty so the
// UI shows one consistent placeholder instead of three different phrasings.
// Manipulate here: add any other legacy "no answer" sentinel string to this list.
const LEGACY_EMPTY_SENTINELS = ['Not set', 'None selected', 'None reported'];
const DAY_WORD_SINGULAR = 'day';
const DAY_WORD_PLURAL = 'days';
const DAYS_PER_WEEK_SUFFIX = 'per week';
const TOKEN_LIST_JOINER = ', ';

// The curated dictionary. It exists because auto-casing gets these wrong:
// "1_2" would become "1 2" instead of "1–2 years", and "bands" should read "Resistance Bands".
// Manipulate here: every user-visible onboarding label lives here. Add a key for any new
//                  onboarding option whose auto Title Case version reads badly.
const TOKEN_LABELS = {
  lose_fat: 'Lose Fat',
  build_muscle: 'Build Muscle',
  maintain_health: 'Maintain Health',
  athletic_performance: 'Athletic Performance',
  improve_mental_health: 'Improve Mental Health',
  build_habits: 'Build Consistency & Habits',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  full_gym: 'Full Gym',
  home_gym: 'Home Gym',
  dumbbells: 'Dumbbells',
  barbell: 'Barbell',
  machines: 'Machines',
  bands: 'Resistance Bands',
  resistance_bands: 'Resistance Bands',
  pull_up_bar: 'Pull-up Bar',
  bodyweight: 'Bodyweight Only',
  gym: 'Gym',
  male: 'Male',
  female: 'Female',
  prefer_not_to_say: 'Prefer not to say',
  less_than_1: 'Less than 1 year',
  '1_2': '1–2 years',
  '3_5': '3–5 years',
  '6_10': '6–10 years',
  '10_plus': '10+ years',
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  no_preference: 'No preference',
};

// ===== MAIN FUNCTION =====

/**
 * Single token → label. Dictionary first, generic Title Case as the safety net so a
 * brand-new onboarding option still renders acceptably instead of leaking the raw id.
 * @param {string|number|null|undefined} token
 * @returns {string}
 */
export function humanizeOnboardingToken(token) {
  // 1. Normalize to a lowercase snake_case lookup key; ?? keeps a legit numeric 0.
  // vocab/symbol: ?? = nullish coalescing — use '' only when token is null/undefined
  const tokenKey = String(token ?? '').trim().toLowerCase();
  if (!tokenKey) return '';

  // 2. Curated label wins when we have one.
  const curatedLabel = TOKEN_LABELS[tokenKey];
  if (curatedLabel) return curatedLabel;

  // 3. Unknown token → underscores to spaces, then Title Case each word.
  return titleCaseUnknownToken(tokenKey);
}

/**
 * The public formatter. Handles every shape onboarding answers get stored in over the years:
 * null, number, single token, array of tokens, or a comma-joined string of tokens.
 * @param {string|string[]|number|null|undefined} raw
 * @param {string} [emptyFallback='—']
 * @returns {string}
 */
export function showSetupAnswers(raw, emptyFallback = EMPTY_ANSWER_PLACEHOLDER) {
  // 1. Null, undefined, or blank string → placeholder.
  if (raw == null || raw === '') return emptyFallback;

  // 2. Multi-select array → humanize each token and join with commas.
  if (Array.isArray(raw)) {
    return labelListOrFallback(raw, emptyFallback);
  }

  // 3. Plain number (e.g. daysPerWeek) → show as digits; nothing to humanize.
  const rawIsFiniteNumber = typeof raw === 'number' && Number.isFinite(raw);
  if (rawIsFiniteNumber) return String(raw);

  const trimmedText = String(raw).trim();
  if (!trimmedText || trimmedText === EMPTY_ANSWER_PLACEHOLDER) return emptyFallback;
  if (textIsLegacyEmptySentinel(trimmedText)) return emptyFallback;

  // 4. Comma-joined token string like "dumbbells,pull_up_bar".
  if (shouldSplitAsTokenList(trimmedText)) {
    const tokensFromCommas = splitCommaTokenList(trimmedText);
    const joinedFromCommas = joinHumanizedTokenList(tokensFromCommas);
    if (joinedFromCommas) return joinedFromCommas;
  }

  // 5. Lone snake_case token (underscore required so "Bench" passes through untouched).
  if (textIsSingleSnakeCaseToken(trimmedText)) {
    return humanizeOnboardingToken(trimmedText);
  }

  // 6. Free-text the user wrote — show it exactly as they entered it.
  return trimmedText;
}

/**
 * Equipment lives under two different keys depending on when the profile was created:
 * the newer array `equipmentAccess`, or the older string `equipment`. Prefer the array.
 * @param {object|null|undefined} data
 * @returns {string}
 */
export function formatEquipmentFromProfile(data) {
  // 1. No profile object → placeholder.
  if (!data) return EMPTY_ANSWER_PLACEHOLDER;

  // 2. Prefer the newer multi-select array when it has answers.
  const equipmentAccessList = data.equipmentAccess;
  const hasEquipmentArray =
    Array.isArray(equipmentAccessList) && equipmentAccessList.length > 0;
  if (hasEquipmentArray) return showSetupAnswers(equipmentAccessList);

  // 3. Fall back to the legacy string field.
  return showSetupAnswers(data.equipment);
}

/**
 * "3 days per week", with correct singular for 1.
 * Zero (or less) is treated as unset, since zero training days isn't a real answer.
 * @param {string|number|null|undefined} value
 * @returns {string}
 */
export function formatDaysPerWeek(value) {
  if (value == null || value === '') return EMPTY_ANSWER_PLACEHOLDER;

  const daysCount = Number(value);
  const daysCountIsBad = !Number.isFinite(daysCount) || daysCount <= 0;
  if (daysCountIsBad) return EMPTY_ANSWER_PLACEHOLDER;

  // Manipulate here: change the "day(s) per week" copy; singular vs plural is named below.
  const dayWord = daysCount === 1 ? DAY_WORD_SINGULAR : DAY_WORD_PLURAL;
  return `${daysCount} ${dayWord} ${DAYS_PER_WEEK_SUFFIX}`;
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

// Fallback: underscores → spaces, then uppercase the first letter of each word.
function titleCaseUnknownToken(tokenKey) {
  // vocab: /\b\w/g = the first word character after each word boundary
  const withSpaces = tokenKey.replace(/_/g, ' ');
  return withSpaces.replace(/\b\w/g, (firstLetter) => firstLetter.toUpperCase());
}

function textIsLegacyEmptySentinel(trimmedText) {
  if (trimmedText === LEGACY_EMPTY_SENTINELS[0]) return true;
  if (trimmedText === LEGACY_EMPTY_SENTINELS[1]) return true;
  if (trimmedText === LEGACY_EMPTY_SENTINELS[2]) return true;
  return false;
}

// The regex guard restricts the split to strings that look like tokens
// (lowercase/digits/underscores), so real prose a user typed is left alone.
function shouldSplitAsTokenList(trimmedText) {
  if (trimmedText.includes(',')) return true;
  const hasUnderscore = trimmedText.includes('_');
  if (!hasUnderscore) return false;
  return /^[a-z0-9_,\s-]+$/i.test(trimmedText);
}

function textIsSingleSnakeCaseToken(trimmedText) {
  const looksLikeSnake = /^[a-z0-9_]+$/i.test(trimmedText);
  if (!looksLikeSnake) return false;
  return trimmedText.includes('_');
}

function splitCommaTokenList(trimmedText) {
  const pieces = trimmedText.split(',');
  const tokens = [];
  for (const piece of pieces) {
    tokens.push(piece.trim());
  }
  return tokens;
}

function joinHumanizedTokenList(tokens) {
  // Drop blanks so we never render a dangling ", " between items.
  const labels = [];
  for (const token of tokens) {
    const label = humanizeOnboardingToken(token);
    if (label) labels.push(label);
  }
  if (!labels.length) return null;
  return labels.join(TOKEN_LIST_JOINER);
}

function labelListOrFallback(tokens, emptyFallback) {
  const joined = joinHumanizedTokenList(tokens);
  if (joined) return joined;
  return emptyFallback;
}
