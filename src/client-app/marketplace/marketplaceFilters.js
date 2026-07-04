/**
 * marketplace Filters
 *
 * Purpose: marketplace Filters — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/marketplace
 * Key exports: getGlass, specPillGradient, getTheme, trainerFirstName, gradColor, gradGradient, getTrainerPrice, normalizeTrainer
 *
 * @file-header
 */
/** Marketplace filter shape, theme tokens, and filter logic (reference UI spec; Firebase as source). */

export const SORT_OPTIONS = ['Newest', 'Price: Low', 'Price: High'];
export const FILTER_SPECIALTIES = [
  'Strength', 'Bodybuilding', 'HIIT', 'Cardio', 'Yoga', 'Pilates', 'CrossFit',
  'Nutrition', 'Rehab', 'Sports', 'Weight Loss', 'Mobility',
];
export const EXPERIENCE_OPTIONS = ['Any', '1-2 years', '3-5 years', '5-8 years', '8+ years'];
export const SESSION_TYPES = ['Remote', 'In-person', 'Both'];
export const QUICK_SPECIALTIES = ['All', 'Strength', 'Weight Loss', 'Bodybuilding', 'HIIT', 'Mobility', 'Nutrition'];

export const PRICE_FLOOR = 100;
export const PRICE_CEILING = 500;

export const DEFAULT_FILTERS = {
  sort: 'Newest',
  specialties: [],
  experience: 'Any',
  availableOnly: false,
  priceMin: '',
  priceMax: '',
  sessionType: 'Both',
};

export const BRAND = {
  pink: '#F06BA8',
  purple: '#C084FC',
  cyan: '#38BDF8',
  orange: '#FB923C',
};

/** Web --font-display / --font-sans (load in App.js via @expo-google-fonts) */
export const MP_FONT = {
  displayBold: 'SpaceGrotesk_700Bold',
  displaySemi: 'SpaceGrotesk_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
};

/** Web .glass-card / --glass-bg — baked color-mix equivalents */
export const GLASS = {
  dark: {
    surface: 'rgba(255, 255, 255, 0.04)',
    border: 'rgba(255, 255, 255, 0.08)',
    blur: 48,
    saturate: 1.4,
  },
  light: {
    surface: 'rgba(255, 255, 255, 0.65)',
    border: 'rgba(20, 20, 40, 0.08)',
    blur: 32,
    saturate: 1.4,
  },
};

export function getGlass(isDark) {
  return isDark ? GLASS.dark : GLASS.light;
}

export const THEMES = {
  light: {
    background: '#FAFAFC',
    foreground: '#18181F',
    card: '#FFFFFF',
    muted: '#F0F0F5',
    mutedForeground: '#6B6B7B',
    border: '#E2E2EA',
    glass: 'rgba(255,255,255,0.92)',
    heroGradient: ['#F8F4FF', '#FFFFFF', '#FFFFFF'],
    screenGradient: ['#FAFAFC', '#F5F5F8', '#FAFAFC'],
  },
  dark: {
    background: '#050508',
    foreground: '#F5F5F7',
    card: '#14141C',
    muted: '#1C1C26',
    mutedForeground: '#9B9BAA',
    border: 'rgba(255,255,255,0.1)',
    glass: 'rgba(20,20,28,0.88)',
    heroGradient: ['#2A1848', '#1A1028', '#14141C'],
    screenGradient: ['#1A0F2E', '#0C0814', '#050508'],
    accentLine: ['#F06BA8', '#FB923C'],
  },
};

const GRAD_KEYS = ['pink', 'orange', 'purple', 'cyan'];

/** 135° avatar / accent gradients — match elevate-connect trainer-card.tsx */
export const GRAD_GRADIENTS = {
  pink: [BRAND.pink, BRAND.orange],
  purple: [BRAND.purple, BRAND.pink],
  cyan: [BRAND.cyan, BRAND.purple],
  orange: [BRAND.orange, BRAND.pink],
};

/** Aurora blob tints (styles.css .hero-aurora / :root .hero-glow-*) */
export const AURORA_GLOWS = {
  dark: {
    pink: 'rgba(255, 107, 157, 0.28)',
    purple: 'rgba(192, 132, 252, 0.28)',
    cyan: 'rgba(6, 182, 212, 0.22)',
  },
  light: {
    pink: 'rgba(255, 107, 157, 0.18)',
    purple: 'rgba(192, 132, 252, 0.18)',
    cyan: 'rgba(6, 182, 212, 0.14)',
  },
};

/** Specialty pill wash — web trainer-card color-mix on brand-{grad} + purple */
export function specPillGradient(grad) {
  const g = gradGradient(grad);
  return [`${g[0]}2E`, `${BRAND.purple}24`];
}

export function getTheme(isDark) {
  return isDark ? THEMES.dark : THEMES.light;
}

export function trainerFirstName(name) {
  const n = String(name || 'Coach').trim();
  return n.split(/\s+/)[0] || n;
}

/** Human-readable label for stored enum/snake_case values (e.g. weight_loss → Weight Loss). */
export function formatMarketplaceLabel(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/i.test(s)) {
    return s
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
  return s;
}

export function gradColor(grad) {
  return BRAND[grad] ?? BRAND.pink;
}

export function gradGradient(grad) {
  return GRAD_GRADIENTS[grad] || GRAD_GRADIENTS.pink;
}

export function getTrainerPrice(t) {
  if (!t) return null;
  if (t.price != null && t.price !== '') {
    const n = Number(t.price);
    return Number.isFinite(n) ? n : null;
  }
  const pm = t.pricing?.perMonth ?? t.rate;
  if (pm != null && pm !== '') {
    const n = Number(pm);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseYears(raw) {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw);
  const n = parseInt(s, 10);
  if (Number.isFinite(n)) return n;
  const map = {
    less_than_1: 0,
    '1_2': 2,
    '3_5': 4,
    '5_8': 6,
    '6_10': 7,
    '8_plus': 9,
    '10_plus': 10,
  };
  for (const [k, v] of Object.entries(map)) {
    if (s.includes(k) || s.toLowerCase().includes(k.replace(/_/g, ' '))) return v;
  }
  if (s.includes('1-2')) return 2;
  if (s.includes('3-5')) return 4;
  if (s.includes('5-8')) return 6;
  if (s.includes('8+')) return 9;
  return 0;
}

function resolveMode(t) {
  const st = t.sessionType || t.coachingMode || t.mode;
  if (st === 'Both' || st === 'Hybrid') return 'Hybrid';
  if (st === 'Remote' || t.isRemote === true) return 'Remote';
  if (st === 'In-person' || st === 'In-Person' || st === 'In Person') return 'In-person';
  if (t.isRemote === false && t.location) return 'In-person';
  if (t.isRemote) return 'Remote';
  return st ? String(st) : 'Remote';
}

function collectSpecialties(t) {
  const list = [
    ...(Array.isArray(t.specialties) ? t.specialties : []),
    ...(Array.isArray(t.specializations) ? t.specializations : []),
    ...(Array.isArray(t.categories) ? t.categories : []),
    t.specialty || '',
  ]
    .map((s) => String(s).trim())
    .filter(Boolean);
  const seen = new Set();
  return list.filter((s) => {
    const k = s.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Map Firestore trainer doc → reference UI shape (keeps raw on `_firebase`). */
export function normalizeTrainer(raw, index = 0) {
  const name = raw.displayName || raw.name || 'Coach';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    raw.initials ||
    (parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : (parts[0]?.[0] || 'C')
    ).toUpperCase();
  const specialties = collectSpecialties(raw);
  const price = getTrainerPrice(raw);
  const years = parseYears(raw.years ?? raw.yearsExperience ?? raw.experienceRange);
  const grad = GRAD_KEYS[index % GRAD_KEYS.length];
  const location = String(raw.location || raw.city || '').trim() || 'Location TBD';
  const available = raw.available !== false && raw.availability !== 'Waitlist';
  const verified = raw.verified !== false;
  const trialDays = raw.trialDays ?? raw.trialPeriodDays ?? 5;
  const bio = String(
    raw.bio ||
      raw.trainerProfileBio ||
      raw.about ||
      raw.description ||
      raw.trainingPhilosophy ||
      ''
  ).trim();
  const responds = raw.responds || raw.responseTime || 'within 2 hours';
  const memberSince =
    raw.memberSince ||
    (raw.joinedAt?.toDate?.()
      ? raw.joinedAt.toDate().toLocaleString('en-US', { month: 'long', year: 'numeric' })
      : '') ||
    '';

  return {
    id: raw.id,
    _firebase: raw,
    name,
    initials,
    location,
    mode: resolveMode(raw),
    specialties: specialties.length
      ? specialties.map((spec) => formatMarketplaceLabel(spec))
      : ['General Fitness'],
    price: price ?? 0,
    years,
    bio: bio || 'This coach is setting up their profile. Message them to learn more about their coaching style.',
    verified,
    available,
    responds,
    memberSince,
    grad: raw.grad || grad,
    trialDays,
    photoURL: raw.photoURL || raw.photoUrl || null,
  };
}

function parseJoinedAt(memberSince, raw) {
  if (raw?.joinedAt?.toMillis) return raw.joinedAt.toMillis();
  if (raw?.createdAt?.toMillis) return raw.createdAt.toMillis();
  const ts = Date.parse(memberSince);
  return Number.isNaN(ts) ? 0 : ts;
}

function matchesExperience(years, experience) {
  switch (experience) {
    case '1-2 years':
      return years >= 1 && years <= 2;
    case '3-5 years':
      return years >= 3 && years <= 5;
    case '5-8 years':
      return years >= 5 && years <= 8;
    case '8+ years':
      return years >= 8;
    default:
      return true;
  }
}

function matchesSessionType(mode, sessionType) {
  if (sessionType === 'Both') return true;
  if (sessionType === 'Remote') return mode === 'Remote';
  if (sessionType === 'In-person') return mode === 'In-person' || mode === 'Hybrid';
  return true;
}

function specialtyMatches(trainerSpecs, filterSpec) {
  const f = filterSpec.toLowerCase();
  return trainerSpecs.some((s) => s.toLowerCase().includes(f) || f.includes(s.toLowerCase()));
}

export function filterTrainers(trainers, filters, { query = '', quickSpecialty = 'All' } = {}) {
  const minPrice = filters.priceMin.trim() ? Number(filters.priceMin) : null;
  const maxPrice = filters.priceMax.trim() ? Number(filters.priceMax) : null;
  const q = query.trim().toLowerCase();

  let list = trainers.filter((t) => {
    if (q) {
      const hay = `${t.name} ${t.location} ${t.specialties.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (quickSpecialty !== 'All' && !specialtyMatches(t.specialties, quickSpecialty)) return false;
    if (filters.specialties.length > 0 && !filters.specialties.some((s) => specialtyMatches(t.specialties, s))) {
      return false;
    }
    if (filters.availableOnly && !t.available) return false;
    const price = getTrainerPrice(t) ?? t.price ?? 0;
    if (minPrice !== null && !Number.isNaN(minPrice) && price < minPrice) return false;
    if (maxPrice !== null && !Number.isNaN(maxPrice) && price > maxPrice) return false;
    if (!matchesSessionType(t.mode, filters.sessionType)) return false;
    if (!matchesExperience(t.years, filters.experience)) return false;
    return true;
  });

  if (filters.sort === 'Price: Low') {
    list = [...list].sort((a, b) => (getTrainerPrice(a._firebase) ?? a.price) - (getTrainerPrice(b._firebase) ?? b.price));
  } else if (filters.sort === 'Price: High') {
    list = [...list].sort((a, b) => (getTrainerPrice(b._firebase) ?? b.price) - (getTrainerPrice(a._firebase) ?? a.price));
  } else {
    list = [...list].sort(
      (a, b) =>
        parseJoinedAt(b.memberSince, b._firebase) - parseJoinedAt(a.memberSince, a._firebase)
    );
  }

  return list;
}
