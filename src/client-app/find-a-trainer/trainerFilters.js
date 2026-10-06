// Filter chips, colors, and the rules that turn a Firestore trainer into a marketplace card.
// Flow: normalize each trainer doc into one card shape → drop cards that miss the
//       active filters → sort by price or by who joined most recently.
// Used by the find-a-trainer screens, the trainer card, and the filter popup.

// ===== NAMED CONSTANTS =====

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

const SORT_NEWEST = 'Newest';
const SORT_PRICE_LOW = 'Price: Low';
const SORT_PRICE_HIGH = 'Price: High';
const QUICK_SPECIALTY_ALL = 'All';
const SESSION_BOTH = 'Both';
const SESSION_REMOTE = 'Remote';
const SESSION_IN_PERSON = 'In-person';
const MODE_HYBRID = 'Hybrid';
const DEFAULT_COACH_NAME = 'Coach';
const DEFAULT_INITIAL = 'C';
const DEFAULT_LOCATION = 'Location TBD';
const DEFAULT_SPECIALTY = 'General Fitness';
const DEFAULT_RESPONSE_TIME = 'within 2 hours';
const DEFAULT_BIO = 'This coach is setting up their profile. Message them to learn more about their coaching style.';
// Manipulate here: trial length shown when the trainer doc does not set one.
const DEFAULT_TRIAL_DAYS = 5;
const WAITLIST_AVAILABILITY = 'Waitlist';

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

// Stored experience ranges, and the year count the filter bands compare against.
// A string that starts with a digit never reaches this map — parseInt wins first.
const EXPERIENCE_YEAR_VALUES = {
  less_than_1: 0,
  '1_2': 2,
  '3_5': 4,
  '5_8': 6,
  '6_10': 7,
  '8_plus': 9,
  '10_plus': 10,
};

// ===== HELPER FUNCTIONS =====

/**
 * @param {*} rawPrice
 * @returns {number|null}
 */
function finitePrice(rawPrice) {
  if (rawPrice == null || rawPrice === '') return null;
  const priceNumber = Number(rawPrice);
  return Number.isFinite(priceNumber) ? priceNumber : null;
}

/**
 * Years of experience from a number, a leading digit, or a stored range label.
 * "8+" returns 8, because parseInt stops at the plus before the later "8+" rule runs.
 * @param {*} rawExperience
 * @returns {number}
 */
function parseYears(rawExperience) {
  if (rawExperience == null || rawExperience === '') return 0;
  if (typeof rawExperience === 'number' && Number.isFinite(rawExperience)) return rawExperience;
  const experienceText = String(rawExperience);
  const leadingNumber = parseInt(experienceText, 10);
  if (Number.isFinite(leadingNumber)) return leadingNumber;
  for (const [rangeKey, years] of Object.entries(EXPERIENCE_YEAR_VALUES)) {
    const rangeAsWords = rangeKey.replace(/_/g, ' ');
    if (experienceText.includes(rangeKey) || experienceText.toLowerCase().includes(rangeAsWords)) {
      return years;
    }
  }
  if (experienceText.includes('1-2')) return 2;
  if (experienceText.includes('3-5')) return 4;
  if (experienceText.includes('5-8')) return 6;
  if (experienceText.includes('8+')) return 9;
  return 0;
}

/**
 * Remote / In-person / Hybrid, from whichever field the trainer doc happened to use.
 * @param {object} trainerDoc
 * @returns {string}
 */
function resolveMode(trainerDoc) {
  const sessionType = trainerDoc.sessionType || trainerDoc.coachingMode || trainerDoc.mode;
  if (sessionType === SESSION_BOTH || sessionType === MODE_HYBRID) return MODE_HYBRID;
  if (sessionType === SESSION_REMOTE || trainerDoc.isRemote === true) return SESSION_REMOTE;
  if (sessionType === SESSION_IN_PERSON || sessionType === 'In-Person' || sessionType === 'In Person') {
    return SESSION_IN_PERSON;
  }
  if (trainerDoc.isRemote === false && trainerDoc.location) return SESSION_IN_PERSON;
  if (trainerDoc.isRemote) return SESSION_REMOTE;
  return sessionType ? String(sessionType) : SESSION_REMOTE;
}

/**
 * Specialties from every field name we have stored, with duplicates removed.
 * @param {object} trainerDoc
 * @returns {string[]}
 */
function collectSpecialties(trainerDoc) {
  const list = [
    ...(Array.isArray(trainerDoc.specialties) ? trainerDoc.specialties : []),
    ...(Array.isArray(trainerDoc.specializations) ? trainerDoc.specializations : []),
    ...(Array.isArray(trainerDoc.categories) ? trainerDoc.categories : []),
    trainerDoc.specialty || '',
  ]
    .map((specialty) => String(specialty).trim())
    .filter(Boolean);
  const seen = new Set();
  return list.filter((specialty) => {
    const specialtyKey = specialty.toLowerCase();
    if (seen.has(specialtyKey)) return false;
    seen.add(specialtyKey);
    return true;
  });
}

/**
 * Two initials from the name. A stored initials string is kept as written.
 * @param {string} name
 * @param {string} [storedInitials]
 * @returns {string}
 */
function trainerInitials(name, storedInitials) {
  if (storedInitials) return storedInitials;
  const nameParts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (nameParts.length >= 2) {
    return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
  }
  return (nameParts[0]?.[0] || DEFAULT_INITIAL).toUpperCase();
}

/**
 * @param {object} trainerDoc
 * @returns {string}
 */
function trainerBio(trainerDoc) {
  const bio = String(
    trainerDoc.bio ||
      trainerDoc.trainerProfileBio ||
      trainerDoc.about ||
      trainerDoc.description ||
      trainerDoc.trainingPhilosophy ||
      '',
  ).trim();
  return bio || DEFAULT_BIO;
}

/**
 * "March 2024" from a Firestore timestamp, or whatever string was already stored.
 * vocab: toDate() = Firestore Timestamp → JavaScript Date
 * @param {object} trainerDoc
 * @returns {string}
 */
function memberSinceLabel(trainerDoc) {
  if (trainerDoc.memberSince) return trainerDoc.memberSince;
  if (trainerDoc.joinedAt?.toDate?.()) {
    return trainerDoc.joinedAt.toDate().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }
  return '';
}

/**
 * Milliseconds for "newest" sort. A missing date sorts as 0 (oldest).
 * @param {string} memberSince
 * @param {object} trainerDoc
 * @returns {number}
 */
function parseJoinedAt(memberSince, trainerDoc) {
  if (trainerDoc?.joinedAt?.toMillis) return trainerDoc.joinedAt.toMillis();
  if (trainerDoc?.createdAt?.toMillis) return trainerDoc.createdAt.toMillis();
  const timestamp = Date.parse(memberSince);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

/**
 * @param {number} years
 * @param {string} experience
 * @returns {boolean}
 */
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

/**
 * "In-person" also keeps Hybrid, because a hybrid coach can meet in person.
 * @param {string} mode
 * @param {string} sessionType
 * @returns {boolean}
 */
function matchesSessionType(mode, sessionType) {
  if (sessionType === SESSION_BOTH) return true;
  if (sessionType === SESSION_REMOTE) return mode === SESSION_REMOTE;
  if (sessionType === SESSION_IN_PERSON) return mode === SESSION_IN_PERSON || mode === MODE_HYBRID;
  return true;
}

/**
 * @param {string[]} trainerSpecialties
 * @param {string} filterSpecialty
 * @returns {boolean}
 */
function specialtyMatches(trainerSpecialties, filterSpecialty) {
  const filterText = filterSpecialty.toLowerCase();
  return trainerSpecialties.some((specialty) => {
    const specialtyText = specialty.toLowerCase();
    return specialtyText.includes(filterText) || filterText.includes(specialtyText);
  });
}

/**
 * Every active filter is an AND. One miss drops the card.
 * @param {object} trainer
 * @param {object} filters
 * @param {string} searchText
 * @param {string} quickSpecialty
 * @param {number|null} minPrice
 * @param {number|null} maxPrice
 * @returns {boolean}
 */
function doesTrainerMatchFilters(trainer, filters, searchText, quickSpecialty, minPrice, maxPrice) {
  if (searchText) {
    const searchableText = `${trainer.name} ${trainer.location} ${trainer.specialties.join(' ')}`.toLowerCase();
    if (!searchableText.includes(searchText)) return false;
  }
  if (quickSpecialty !== QUICK_SPECIALTY_ALL && !specialtyMatches(trainer.specialties, quickSpecialty)) {
    return false;
  }
  if (
    filters.specialties.length > 0 &&
    !filters.specialties.some((specialty) => specialtyMatches(trainer.specialties, specialty))
  ) {
    return false;
  }
  if (filters.availableOnly && !trainer.available) return false;
  const price = getTrainerPrice(trainer) ?? trainer.price ?? 0;
  if (minPrice !== null && !Number.isNaN(minPrice) && price < minPrice) return false;
  if (maxPrice !== null && !Number.isNaN(maxPrice) && price > maxPrice) return false;
  if (!matchesSessionType(trainer.mode, filters.sessionType)) return false;
  if (!matchesExperience(trainer.years, filters.experience)) return false;
  return true;
}

/**
 * Price sorts read the raw Firestore doc. Newest uses the joined-at timestamp.
 * @param {object[]} trainers
 * @param {string} sortOption
 * @returns {object[]}
 */
function sortTrainers(trainers, sortOption) {
  if (sortOption === SORT_PRICE_LOW) {
    return [...trainers].sort((first, second) => {
      const firstPrice = getTrainerPrice(first._firebase) ?? first.price;
      const secondPrice = getTrainerPrice(second._firebase) ?? second.price;
      return firstPrice - secondPrice;
    });
  }
  if (sortOption === SORT_PRICE_HIGH) {
    return [...trainers].sort((first, second) => {
      const firstPrice = getTrainerPrice(first._firebase) ?? first.price;
      const secondPrice = getTrainerPrice(second._firebase) ?? second.price;
      return secondPrice - firstPrice;
    });
  }
  return [...trainers].sort(
    (first, second) =>
      parseJoinedAt(second.memberSince, second._firebase) - parseJoinedAt(first.memberSince, first._firebase),
  );
}

// ===== MAIN FUNCTION =====

/**
 * Glass surface for the current theme.
 * @param {boolean} isDark
 * @returns {object}
 */
export function getGlass(isDark) {
  return isDark ? GLASS.dark : GLASS.light;
}

/**
 * Specialty pill wash — web trainer-card color-mix on brand-{grad} + purple.
 * The "2E" and "24" are hex alpha glued onto the color, not separate opacity props.
 * @param {string} grad
 * @returns {string[]}
 */
export function specPillGradient(grad) {
  const gradient = gradGradient(grad);
  return [`${gradient[0]}2E`, `${BRAND.purple}24`];
}

/**
 * @param {boolean} isDark
 * @returns {object}
 */
export function getTheme(isDark) {
  return isDark ? THEMES.dark : THEMES.light;
}

/**
 * First word of the coach's name, for the short label on a card.
 * @param {string} name
 * @returns {string}
 */
export function trainerFirstName(name) {
  const fullName = String(name || DEFAULT_COACH_NAME).trim();
  return fullName.split(/\s+/)[0] || fullName;
}

/**
 * Human-readable label for stored enum/snake_case values (weight_loss → Weight Loss).
 * A value that is not snake_case is returned unchanged.
 * @param {string} value
 * @returns {string}
 */
export function formatMarketplaceLabel(value) {
  const labelText = String(value || '').trim();
  if (!labelText) return '';
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/i.test(labelText)) {
    return labelText
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
  return labelText;
}

/**
 * @param {string} grad
 * @returns {string}
 */
export function gradColor(grad) {
  return BRAND[grad] ?? BRAND.pink;
}

/**
 * @param {string} grad
 * @returns {string[]}
 */
export function gradGradient(grad) {
  return GRAD_GRADIENTS[grad] || GRAD_GRADIENTS.pink;
}

/**
 * Monthly price from price, then pricing.perMonth, then rate. Null when none of those are numbers.
 * @param {object} trainer
 * @returns {number|null}
 */
export function getTrainerPrice(trainer) {
  if (!trainer) return null;
  const directPrice = finitePrice(trainer.price);
  if (trainer.price != null && trainer.price !== '') return directPrice;
  // vocab: ?? = use the right side only when the left side is null or undefined
  const monthlyPrice = trainer.pricing?.perMonth ?? trainer.rate;
  if (monthlyPrice != null && monthlyPrice !== '') return finitePrice(monthlyPrice);
  return null;
}

/**
 * Map a Firestore trainer doc onto the card shape. The raw doc stays on `_firebase`.
 * @param {object} raw
 * @param {number} [index] Used to rotate the accent color when the doc has no grad
 * @returns {object}
 */
export function normalizeTrainer(raw, index = 0) {
  const name = raw.displayName || raw.name || DEFAULT_COACH_NAME;
  const specialties = collectSpecialties(raw);
  const price = getTrainerPrice(raw);
  const years = parseYears(raw.years ?? raw.yearsExperience ?? raw.experienceRange);
  const grad = GRAD_KEYS[index % GRAD_KEYS.length];
  const location = String(raw.location || raw.city || '').trim() || DEFAULT_LOCATION;
  // available: false or a Waitlist flag hides the "available" badge. Anything else counts as open.
  const available = raw.available !== false && raw.availability !== WAITLIST_AVAILABILITY;
  // Face / manual verification badge — only when explicitly verified.
  const isVerified = raw.isVerified === true || raw.verified === true;
  const trialDays = raw.trialDays ?? raw.trialPeriodDays ?? DEFAULT_TRIAL_DAYS;

  return {
    id: raw.id,
    _firebase: raw,
    name,
    initials: trainerInitials(name, raw.initials),
    location,
    mode: resolveMode(raw),
    specialties: specialties.length
      ? specialties.map((specialty) => formatMarketplaceLabel(specialty))
      : [DEFAULT_SPECIALTY],
    price: price ?? 0,
    years,
    bio: trainerBio(raw),
    verified: isVerified,
    available,
    responds: raw.responds || raw.responseTime || DEFAULT_RESPONSE_TIME,
    memberSince: memberSinceLabel(raw),
    grad: raw.grad || grad,
    trialDays,
    photoURL: raw.photoURL || raw.photoUrl || null,
  };
}

/**
 * Cards that match the search box, the quick chip, and the filter sheet, in sort order.
 * @param {object[]} trainers
 * @param {object} filters
 * @param {{ query?: string, quickSpecialty?: string }} [options]
 * @returns {object[]}
 */
export function filterTrainers(trainers, filters, { query = '', quickSpecialty = 'All' } = {}) {
  const minPrice = filters.priceMin.trim() ? Number(filters.priceMin) : null;
  const maxPrice = filters.priceMax.trim() ? Number(filters.priceMax) : null;
  const searchText = query.trim().toLowerCase();

  const matching = trainers.filter((trainer) =>
    doesTrainerMatchFilters(trainer, filters, searchText, quickSpecialty, minPrice, maxPrice),
  );

  return sortTrainers(matching, filters.sort || SORT_NEWEST);
}
