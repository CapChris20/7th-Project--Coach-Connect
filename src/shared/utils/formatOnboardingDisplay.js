/**
 * Human-readable labels for onboarding tokens stored in Firestore (snake_case ids).
 */

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

export function humanizeOnboardingToken(token) {
  const key = String(token ?? '').trim().toLowerCase();
  if (!key) return '';
  if (TOKEN_LABELS[key]) return TOKEN_LABELS[key];
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * @param {string|string[]|number|null|undefined} raw
 * @param {string} [emptyFallback='—']
 */
export function formatOnboardingDisplay(raw, emptyFallback = '—') {
  if (raw == null || raw === '') return emptyFallback;
  if (Array.isArray(raw)) {
    const parts = raw.map((p) => humanizeOnboardingToken(p)).filter(Boolean);
    return parts.length ? parts.join(', ') : emptyFallback;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);

  let s = String(raw).trim();
  if (!s || s === '—') return emptyFallback;
  if (s === 'Not set' || s === 'None selected' || s === 'None reported') return emptyFallback;

  if (s.includes(',') || (s.includes('_') && /^[a-z0-9_,\s-]+$/i.test(s))) {
    const parts = s.split(',').map((p) => humanizeOnboardingToken(p.trim())).filter(Boolean);
    if (parts.length) return parts.join(', ');
  }

  if (/^[a-z0-9_]+$/i.test(s) && s.includes('_')) {
    return humanizeOnboardingToken(s);
  }

  return s;
}

export function formatEquipmentFromProfile(data) {
  if (!data) return '—';
  if (Array.isArray(data.equipmentAccess) && data.equipmentAccess.length > 0) {
    return formatOnboardingDisplay(data.equipmentAccess);
  }
  return formatOnboardingDisplay(data.equipment);
}

export function formatDaysPerWeek(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `${n} day${n === 1 ? '' : 's'} per week`;
}
