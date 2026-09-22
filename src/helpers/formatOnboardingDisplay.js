// Turns the snake_case onboarding answers stored in Firestore into display text.
// Flow: 'lose_fat' → lookup table → "Lose Fat"; unknown tokens fall back to auto Title Case.
// Used by profile screens and trainer client cards, which must never show raw ids like "full_gym".

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

// Single token → label. Dictionary first, generic Title Case as the safety net so a
// brand-new onboarding option still renders acceptably instead of leaking the raw id.
export function humanizeOnboardingToken(token) {
  // vocab/symbol: ?? = nullish coalescing — use '' only when token is null/undefined
  //               (unlike ||, this would preserve a legit 0)
  const key = String(token ?? '').trim().toLowerCase();
  if (!key) return '';
  if (TOKEN_LABELS[key]) return TOKEN_LABELS[key];
  // Fallback: underscores → spaces, then uppercase the first letter of each word.
  // vocab: /\b\w/g = the first word character after each word boundary
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * @param {string|string[]|number|null|undefined} raw
 * @param {string} [emptyFallback='—']
 */
// The public formatter. Handles every shape onboarding answers get stored in over the years:
// null, number, single token, array of tokens, or a comma-joined string of tokens.
// Manipulate here: emptyFallback is the placeholder shown for missing answers
export function formatOnboardingDisplay(raw, emptyFallback = '—') {
  if (raw == null || raw === '') return emptyFallback;
  // Shape A — array (multi-select answers). filter(Boolean) drops blanks so we never
  // render a dangling ", " between items.
  if (Array.isArray(raw)) {
    const parts = raw.map((p) => humanizeOnboardingToken(p)).filter(Boolean);
    return parts.length ? parts.join(', ') : emptyFallback;
  }
  // Shape B — plain number (e.g. daysPerWeek). Nothing to humanize.
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);

  let s = String(raw).trim();
  if (!s || s === '—') return emptyFallback;
  // Older writes stored these literal strings as "no answer". Treat them as empty so the
  // UI shows one consistent placeholder instead of three different phrasings.
  // Manipulate here: add any other legacy "no answer" sentinel string to this list
  if (s === 'Not set' || s === 'None selected' || s === 'None reported') return emptyFallback;

  // Shape C — a comma-joined token string like "dumbbells,pull_up_bar".
  // The regex guard is the important part: it restricts the split to strings that look
  // like tokens (lowercase/digits/underscores), so real prose a user typed —
  // "I have bands, and a bench" — is left alone instead of being mangled.
  if (s.includes(',') || (s.includes('_') && /^[a-z0-9_,\s-]+$/i.test(s))) {
    const parts = s.split(',').map((p) => humanizeOnboardingToken(p.trim())).filter(Boolean);
    if (parts.length) return parts.join(', ');
  }

  // Shape D — a lone token. Requires an underscore, so a normal word the user typed
  // ("Bench") passes through untouched at the bottom rather than being re-cased.
  if (/^[a-z0-9_]+$/i.test(s) && s.includes('_')) {
    return humanizeOnboardingToken(s);
  }

  // Free-text the user wrote — show it exactly as they entered it.
  return s;
}

// Equipment lives under two different keys depending on when the profile was created:
// the newer array `equipmentAccess`, or the older string `equipment`. Prefer the array.
export function formatEquipmentFromProfile(data) {
  if (!data) return '—';
  if (Array.isArray(data.equipmentAccess) && data.equipmentAccess.length > 0) {
    return formatOnboardingDisplay(data.equipmentAccess);
  }
  return formatOnboardingDisplay(data.equipment);
}

// "3 days per week", with correct singular for 1.
// `n <= 0` is treated as unset, since zero training days isn't a real answer.
export function formatDaysPerWeek(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  // Manipulate here: change the "day(s) per week" copy; the ternary handles pluralization
  return `${n} day${n === 1 ? '' : 's'} per week`;
}
