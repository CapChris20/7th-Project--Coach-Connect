// Turns the snake_case onboarding answers stored in Firestore into display text.
// Flow: 'lose_fat' → lookup table → "Lose Fat"; unknown tokens fall back to auto Title Case.
// Used by profile screens and trainer client cards, which must never show raw ids like "full_gym".

// ===== NAMED CONSTANTS =====

// Manipulate here: placeholder shown for missing / "no answer" values.
const EMPTY_ANSWER_PLACEHOLDER = '—';
// Older writes stored these literal strings as "no answer". Treat them as empty so the
// UI shows one consistent placeholder instead of three different phrasings.
// Manipulate here: add any other legacy "no answer" sentinel string to this list.
const LEGACY_EMPTY_SENTINELS = ['Not set', 'None selected', 'None reported'];

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

// ===== HELPER FUNCTIONS =====

// Fallback: underscores → spaces, then uppercase the first letter of each word.
function titleCaseUnknownToken(tokenKey) {
  // vocab: /\b\w/g = the first word character after each word boundary
  return tokenKey.replace(/_/g, ' ').replace(/\b\w/g, (firstLetter) => firstLetter.toUpperCase());
}

function isLegacyEmptySentinel(trimmedText) {
  return (
    trimmedText === LEGACY_EMPTY_SENTINELS[0] ||
    trimmedText === LEGACY_EMPTY_SENTINELS[1] ||
    trimmedText === LEGACY_EMPTY_SENTINELS[2]
  );
}

// The regex guard restricts the split to strings that look like tokens
// (lowercase/digits/underscores), so real prose a user typed is left alone.
function shouldSplitAsTokenList(trimmedText) {
  if (trimmedText.includes(',')) return true;
  return trimmedText.includes('_') && /^[a-z0-9_,\s-]+$/i.test(trimmedText);
}

function isSingleSnakeCaseToken(trimmedText) {
  return /^[a-z0-9_]+$/i.test(trimmedText) && trimmedText.includes('_');
}

function formatTokenList(tokens, emptyFallback) {
  const labels = tokens.map((token) => humanizeOnboardingToken(token)).filter(Boolean);
  return labels.length ? labels.join(', ') : emptyFallback;
}

// ===== MAIN FUNCTION =====

/**
 * Single token → label. Dictionary first, generic Title Case as the safety net so a
 * brand-new onboarding option still renders acceptably instead of leaking the raw id.
 * @param {string|number|null|undefined} token
 * @returns {string}
 */
export function humanizeOnboardingToken(token) {
  // vocab/symbol: ?? = nullish coalescing — use '' only when token is null/undefined
  //               (unlike ||, this would preserve a legit 0)
  const tokenKey = String(token ?? '').trim().toLowerCase();
  if (!tokenKey) return '';
  if (TOKEN_LABELS[tokenKey]) return TOKEN_LABELS[tokenKey];
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
  if (raw == null || raw === '') return emptyFallback;

  // Shape A — array (multi-select answers). filter(Boolean) drops blanks so we never
  // render a dangling ", " between items.
  if (Array.isArray(raw)) {
    return formatTokenList(raw, emptyFallback);
  }

  // Shape B — plain number (e.g. daysPerWeek). Nothing to humanize.
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);

  const trimmedText = String(raw).trim();
  if (!trimmedText || trimmedText === EMPTY_ANSWER_PLACEHOLDER) return emptyFallback;
  if (isLegacyEmptySentinel(trimmedText)) return emptyFallback;

  // Shape C — a comma-joined token string like "dumbbells,pull_up_bar".
  if (shouldSplitAsTokenList(trimmedText)) {
    const labels = trimmedText
      .split(',')
      .map((token) => humanizeOnboardingToken(token.trim()))
      .filter(Boolean);
    if (labels.length) return labels.join(', ');
  }

  // Shape D — a lone token. Requires an underscore, so a normal word the user typed
  // ("Bench") passes through untouched at the bottom rather than being re-cased.
  if (isSingleSnakeCaseToken(trimmedText)) {
    return humanizeOnboardingToken(trimmedText);
  }

  // Free-text the user wrote — show it exactly as they entered it.
  return trimmedText;
}

/**
 * Equipment lives under two different keys depending on when the profile was created:
 * the newer array `equipmentAccess`, or the older string `equipment`. Prefer the array.
 * @param {object|null|undefined} data
 * @returns {string}
 */
export function formatEquipmentFromProfile(data) {
  if (!data) return EMPTY_ANSWER_PLACEHOLDER;
  if (Array.isArray(data.equipmentAccess) && data.equipmentAccess.length > 0) {
    return showSetupAnswers(data.equipmentAccess);
  }
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
  if (!Number.isFinite(daysCount) || daysCount <= 0) return EMPTY_ANSWER_PLACEHOLDER;
  // Manipulate here: change the "day(s) per week" copy; the ternary handles pluralization
  return `${daysCount} day${daysCount === 1 ? '' : 's'} per week`;
}
