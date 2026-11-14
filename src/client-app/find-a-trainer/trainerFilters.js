// Filter chips, Design Law tokens, and the rules that turn a Firestore trainer into a marketplace card.
// Flow: normalize each trainer doc into one card shape → drop cards that miss the
//       active filters → sort by best client match, price, or who joined most recently.
// Used by the find-a-trainer screens, the trainer card, and the filter popup.
// Key exports: filterTrainers, normalizeTrainer, DEFAULT_FILTERS, THEMES, scoreTrainerMatch

import { lightColors } from '../../look-and-feel/colorPalette';

// lightColors stays imported (freeze: do not change import paths). Design Law screens use nb* tokens instead.

// ===== NAMED CONSTANTS =====

export const SORT_OPTIONS = ['Best match', 'Newest', 'Price: Low', 'Price: High'];
export const FILTER_SPECIALTIES = [
  'Strength', 'Bodybuilding', 'HIIT', 'Cardio', 'Yoga', 'Pilates', 'CrossFit',
  'Nutrition', 'Rehab', 'Sports', 'Weight Loss', 'Mobility',
];
export const EXPERIENCE_OPTIONS = ['Any', '1-2 years', '3-5 years', '5-8 years', '8+ years'];
export const SESSION_TYPES = ['Remote', 'In-person', 'Both'];
export const AVAILABILITY_OPTIONS = ['Available', 'Waitlist'];
export const QUICK_SPECIALTIES = ['All', 'Strength', 'Weight Loss', 'Bodybuilding', 'HIIT', 'Mobility', 'Nutrition'];

export const PRICE_FLOOR = 100;
export const PRICE_CEILING = 500;

const SORT_BEST_MATCH = 'Best match';
const SORT_NEWEST = 'Newest';
const SORT_PRICE_LOW = 'Price: Low';
const SORT_PRICE_HIGH = 'Price: High';
const MATCH_SPECIALTY_HIT = 24;
const MATCH_GOAL_HIT = 18;
const MATCH_AVAILABLE = 12;
const MATCH_VERIFIED = 8;
const MATCH_SESSION = 10;
const MATCH_EXPERIENCE = 6;
const MATCH_LOCATION = 5;
const MATCH_RATING_UNIT = 2;
const MATCH_RATING_CAP = 10;

const GOAL_TO_SPECIALTIES = {
  lose_fat: ['Weight Loss', 'Cardio', 'HIIT', 'Nutrition'],
  build_muscle: ['Strength', 'Bodybuilding'],
  maintain_health: ['Nutrition', 'Mobility', 'Yoga', 'Pilates'],
  athletic_performance: ['Sports', 'HIIT', 'Strength', 'CrossFit'],
  improve_mental_health: ['Yoga', 'Mobility', 'Pilates'],
  build_habits: ['Nutrition', 'HIIT', 'Strength'],
};
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
const DEFAULT_TRIAL_DAYS = 5;
const WAITLIST_AVAILABILITY = 'Waitlist';
const YEARS_FOR_SIX_TO_TEN_RANGE = 7;
const EXPERIENCE_ANY = 'Any';
const EXPERIENCE_LABEL_1_2 = '1-2 years';
const EXPERIENCE_LABEL_3_5 = '3-5 years';
const EXPERIENCE_LABEL_5_8 = '5-8 years';
const EXPERIENCE_LABEL_8_PLUS = '8+ years';
const AVAILABILITY_AVAILABLE = 'Available';
const SESSION_IN_PERSON_ALT_DASH = 'In-Person';
const SESSION_IN_PERSON_ALT_SPACE = 'In Person';
const FORMAT_REMOTE_AND_IN_PERSON = 'Remote and in person';
const FORMAT_IN_PERSON = 'In person';
const FORMAT_REMOTE = 'Remote';

export const DEFAULT_FILTERS = {
  sort: SORT_BEST_MATCH,
  specialties: [],
  experience: EXPERIENCE_ANY,
  availableOnly: false,
  verifiedOnly: false,
  availability: null,
  priceMin: '',
  priceMax: '',
  sessionType: SESSION_BOTH,
};

export const BRAND = {
  pink: '#FF6B9D',
  purple: '#A78BFA',
  cyan: '#60A5FA',
  orange: '#FB923C',
};

export const MP_FONT = {
  displayBold: 'SpaceGrotesk_700Bold',
  displaySemi: 'SpaceGrotesk_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
};

export const AURORA_GLOWS = {
  dark: {
    pink: 'rgba(255, 107, 157, 0.18)',
    purple: 'rgba(167, 139, 250, 0.14)',
    cyan: 'rgba(96, 165, 250, 0.12)',
  },
  light: {
    pink: 'rgba(255, 107, 157, 0.12)',
    purple: 'rgba(167, 139, 250, 0.1)',
    cyan: 'rgba(96, 165, 250, 0.1)',
  },
};

export const THEMES = {
  light: {
    background: '#F2F2F0',
    foreground: '#0A0A0A',
    card: '#FFFFFF',
    muted: '#E3E3DF',
    mutedForeground: '#575757',
    border: '#0A0A0A',
    glass: '#FFFFFF',
    heroGradient: ['#F2F2F0', '#FFFFFF', '#FFFFFF'],
    screenGradient: ['#F2F2F0', '#F2F2F0', '#F2F2F0'],
  },
  dark: {
    background: '#0B0B0B',
    foreground: '#F2F2F2',
    card: '#161616',
    muted: '#262626',
    mutedForeground: '#A6A6A6',
    border: '#F2F2F2',
    glass: '#161616',
    heroGradient: ['#0B0B0B', '#161616', '#161616'],
    screenGradient: ['#0B0B0B', '#0B0B0B', '#0B0B0B'],
    accentLine: ['#FF6B9D', '#FB923C'],
  },
};

const ACCENT_GRAD_KEYS = ['pink', 'orange', 'purple', 'cyan'];

export const GRAD_GRADIENTS = {
  pink: [BRAND.pink, BRAND.orange],
  purple: [BRAND.purple, BRAND.pink],
  cyan: [BRAND.cyan, BRAND.purple],
  orange: [BRAND.orange, BRAND.pink],
};

const EXPERIENCE_YEAR_VALUES = {
  less_than_1: 0,
  '1_2': 2,
  '3_5': 4,
  '5_8': 6,
  '6_10': YEARS_FOR_SIX_TO_TEN_RANGE,
  '8_plus': 9,
  '10_plus': 10,
};

// ===== HELPER FUNCTIONS =====

function isSnakeCaseLabel(labelText) {
  return /^[a-z0-9]+(_[a-z0-9]+)+$/i.test(labelText);
}

function titleCaseSnakeParts(labelText) {
  const words = labelText.split('_').filter(Boolean);
  const titled = [];
  for (let index = 0; index < words.length; index += 1) {
    const part = words[index];
    const firstLetter = part.charAt(0).toUpperCase();
    const rest = part.slice(1).toLowerCase();
    titled.push(firstLetter + rest);
  }
  return titled.join(' ');
}

function priceNumberOrNull(rawPrice) {
  if (rawPrice == null) {
    return null;
  }
  if (rawPrice === '') {
    return null;
  }
  const priceNumber = Number(rawPrice);
  if (Number.isFinite(priceNumber)) {
    return priceNumber;
  }
  return null;
}

function pickFirstNonEmptyString(...candidates) {
  for (let index = 0; index < candidates.length; index += 1) {
    const value = candidates[index];
    if (value == null) {
      continue;
    }
    const trimmed = String(value).trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return '';
}

// ===== MAIN FUNCTION =====

/**
 * @param {boolean} isDark
 * @returns {object}
 */
export function getTheme(isDark) {
  if (isDark) {
    return THEMES.dark;
  }
  return THEMES.light;
}

/**
 * First word of the coach's name, for the short label on a card.
 * @param {string} name
 * @returns {string}
 */
export function trainerFirstName(name) {
  const fullName = String(name || DEFAULT_COACH_NAME).trim();
  const parts = fullName.split(/\s+/);
  const firstWord = parts[0];
  if (firstWord) {
    return firstWord;
  }
  return fullName;
}

/**
 * Human-readable label for stored enum/snake_case values (weight_loss → Weight Loss).
 * @param {string} value
 * @returns {string}
 */
export function formatMarketplaceLabel(value) {
  const labelText = String(value || '').trim();
  if (!labelText) {
    return '';
  }
  if (isSnakeCaseLabel(labelText)) {
    return titleCaseSnakeParts(labelText);
  }
  return labelText;
}

/**
 * Profile "Format" copy. Hybrid becomes the Design Law phrase from the PNG.
 * @param {string} mode
 * @returns {string}
 */
export function formatSessionLabel(mode) {
  if (mode === MODE_HYBRID || mode === SESSION_BOTH) {
    return FORMAT_REMOTE_AND_IN_PERSON;
  }
  if (mode === SESSION_IN_PERSON) {
    return FORMAT_IN_PERSON;
  }
  if (mode === SESSION_REMOTE) {
    return FORMAT_REMOTE;
  }
  const formatted = formatMarketplaceLabel(mode);
  if (formatted) {
    return formatted;
  }
  return FORMAT_REMOTE;
}

/**
 * @param {string} grad
 * @returns {string}
 */
export function gradColor(grad) {
  const brandColor = BRAND[grad];
  if (brandColor) {
    return brandColor;
  }
  return BRAND.pink;
}

/**
 * @param {string} grad
 * @returns {string[]}
 */
export function gradGradient(grad) {
  const gradient = GRAD_GRADIENTS[grad];
  if (gradient) {
    return gradient;
  }
  return GRAD_GRADIENTS.pink;
}

/**
 * Specialty pill wash — kept for callers that still paint soft specialty chips.
 * @param {string} grad
 * @returns {string[]}
 */
export function specPillGradient(grad) {
  const gradient = gradGradient(grad);
  return [gradient[0], gradient[1]];
}

/**
 * Monthly price from price, then pricing.perMonth, then rate. Null when none of those are numbers.
 * Firebase field keys stay as-is — do not rename for branding.
 * @param {object} trainer
 * @returns {number|null}
 */
export function getTrainerPrice(trainer) {
  if (!trainer) {
    return null;
  }

  if (trainer.price != null && trainer.price !== '') {
    return priceNumberOrNull(trainer.price);
  }

  let monthlyPrice = null;
  if (trainer.pricing && trainer.pricing.perMonth != null) {
    monthlyPrice = trainer.pricing.perMonth;
  } else if (trainer.rate != null) {
    monthlyPrice = trainer.rate;
  }

  if (monthlyPrice != null && monthlyPrice !== '') {
    return priceNumberOrNull(monthlyPrice);
  }
  return null;
}

/**
 * How many non-default filter knobs are active — drives the "Filter · 2" pill.
 * @param {object} filters
 * @returns {number}
 */
export function countActiveFilters(filters) {
  if (!filters) {
    return 0;
  }

  let count = 0;
  if (Array.isArray(filters.specialties) && filters.specialties.length > 0) {
    count += 1;
  }
  if (filters.experience && filters.experience !== EXPERIENCE_ANY) {
    count += 1;
  }
  if (filters.sessionType && filters.sessionType !== SESSION_BOTH) {
    count += 1;
  }
  if (filters.availableOnly) {
    count += 1;
  }
  if (filters.verifiedOnly) {
    count += 1;
  }
  if (filters.availability) {
    count += 1;
  }
  if (String(filters.priceMin || '').trim()) {
    count += 1;
  }
  if (String(filters.priceMax || '').trim()) {
    count += 1;
  }
  return count;
}

/**
 * Normalize client onboarding / userData into the prefs the match scorer reads.
 * @param {object|null|undefined} raw
 * @returns {{ goals: string[], fitnessLevel: string, preferredSessionType: string, location: string }|null}
 */
export function clientMatchPrefsFromProfile(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const goals = gatherGoalStringsFromProfile(raw);
  const uniqueGoals = [];
  const seenGoals = new Set();
  for (let index = 0; index < goals.length; index += 1) {
    const goal = goals[index];
    const normalizedGoal = goal.trim().toLowerCase();
    if (!normalizedGoal) {
      continue;
    }
    if (seenGoals.has(normalizedGoal)) {
      continue;
    }
    seenGoals.add(normalizedGoal);
    uniqueGoals.push(normalizedGoal);
  }

  const equipment = [];
  if (Array.isArray(raw.equipmentAccess)) {
    for (let index = 0; index < raw.equipmentAccess.length; index += 1) {
      const item = raw.equipmentAccess[index];
      equipment.push(String(item).toLowerCase());
    }
  }

  return {
    goals: uniqueGoals,
    fitnessLevel: String(raw.fitnessLevel || raw.experience || '').toLowerCase(),
    preferredSessionType: sessionTypeFromEquipmentList(equipment),
    location: String(raw.location || raw.city || '').trim().toLowerCase(),
  };
}

/**
 * Rule-based match score from client onboarding → trainer card.
 * Higher = better fit. Used by Best match sort.
 * @param {object} trainer
 * @param {object|null|undefined} clientPrefs
 * @returns {number}
 */
export function scoreTrainerMatch(trainer, clientPrefs) {
  if (!trainer) {
    return 0;
  }
  if (!clientPrefs) {
    return matchScoreWithoutClientPrefs(trainer);
  }

  let score = 0;
  let specialties = [];
  if (Array.isArray(trainer.specialties)) {
    specialties = trainer.specialties;
  }

  const specialtyLower = [];
  for (let index = 0; index < specialties.length; index += 1) {
    specialtyLower.push(String(specialties[index]).toLowerCase());
  }

  const goals = clientPrefs.goals || [];
  for (let index = 0; index < goals.length; index += 1) {
    score += pointsForOneClientGoal(goals[index], specialtyLower);
  }

  if (trainer.available) {
    score += MATCH_AVAILABLE;
  }
  if (trainer.verified) {
    score += MATCH_VERIFIED;
  }

  const preferred = clientPrefs.preferredSessionType;
  if (preferred && preferred !== SESSION_BOTH) {
    if (matchesSessionType(trainer.mode, preferred)) {
      score += MATCH_SESSION;
    }
  }

  score += experienceMatchPoints(clientPrefs.fitnessLevel, trainer.years);
  score += locationMatchPoints(clientPrefs.location, trainer.location);
  score += ratingBonusPoints(trainer.rating);
  return score;
}

/**
 * Map a Firestore trainer doc onto the card shape. The raw doc stays on `_firebase`.
 * @param {object} raw
 * @param {number} [index] Used to rotate the accent color when the doc has no grad
 * @returns {object}
 */
export function normalizeTrainer(raw, index = 0) {
  // 1. Pull display fields with the same fallbacks the marketplace cards already expect.
  let name = DEFAULT_COACH_NAME;
  if (raw.displayName) {
    name = raw.displayName;
  } else if (raw.name) {
    name = raw.name;
  }

  const specialties = specialtiesFromTrainerDoc(raw);
  const price = getTrainerPrice(raw);

  let experienceRaw = raw.years;
  if (experienceRaw == null) {
    experienceRaw = raw.yearsExperience;
  }
  if (experienceRaw == null) {
    experienceRaw = raw.experienceRange;
  }
  const years = yearsFromExperienceField(experienceRaw);

  const gradFallback = ACCENT_GRAD_KEYS[index % ACCENT_GRAD_KEYS.length];
  let location = String(raw.location || raw.city || '').trim();
  if (!location) {
    location = DEFAULT_LOCATION;
  }

  // 2. available: false or a Waitlist flag hides the "available" badge. Anything else counts as open.
  const available = raw.available !== false && raw.availability !== WAITLIST_AVAILABILITY;
  const isVerified = raw.isVerified === true || raw.verified === true;

  let trialDays = DEFAULT_TRIAL_DAYS;
  if (raw.trialDays != null) {
    trialDays = raw.trialDays;
  } else if (raw.trialPeriodDays != null) {
    trialDays = raw.trialPeriodDays;
  }

  const rawBio = pickFirstNonEmptyString(
    raw.bio,
    raw.trainerProfileBio,
    raw.about,
    raw.description,
    raw.trainingPhilosophy,
  );

  // 3. Card shape — field letters stay name / specialties / price / years / verified / available.
  const formattedSpecialties = [];
  if (specialties.length) {
    for (let specialtyIndex = 0; specialtyIndex < specialties.length; specialtyIndex += 1) {
      formattedSpecialties.push(formatMarketplaceLabel(specialties[specialtyIndex]));
    }
  } else {
    formattedSpecialties.push(DEFAULT_SPECIALTY);
  }

  let cardPrice = 0;
  if (price != null) {
    cardPrice = price;
  }

  let photoURL = null;
  if (raw.photoURL) {
    photoURL = raw.photoURL;
  } else if (raw.photoUrl) {
    photoURL = raw.photoUrl;
  }

  let rating = null;
  if (raw.averageRating != null) {
    rating = raw.averageRating;
  } else if (raw.rating != null) {
    rating = raw.rating;
  }

  let reviewCount = 0;
  if (raw.reviewCount != null) {
    reviewCount = raw.reviewCount;
  }

  let bioText = DEFAULT_BIO;
  if (rawBio) {
    bioText = rawBio;
  }

  let responds = DEFAULT_RESPONSE_TIME;
  if (raw.responds) {
    responds = raw.responds;
  } else if (raw.responseTime) {
    responds = raw.responseTime;
  }

  let grad = gradFallback;
  if (raw.grad) {
    grad = raw.grad;
  }

  return {
    id: raw.id,
    _firebase: raw,
    name,
    initials: initialsFromCoachName(name, raw.initials),
    location,
    mode: sessionModeFromTrainerDoc(raw),
    specialties: formattedSpecialties,
    price: cardPrice,
    years,
    bio: bioText,
    hasCustomBio: Boolean(rawBio),
    verified: isVerified,
    available,
    responds,
    memberSince: joinedMonthYearLabel(raw),
    grad,
    trialDays,
    photoURL,
    rating,
    reviewCount,
  };
}

/**
 * Cards that match the search box, the quick chip, and the filter sheet, in sort order.
 * Flow: 1. parse price bounds  2. keep matching cards  3. sort by the active option
 * @param {object[]} trainers
 * @param {object} filters
 * @param {{ query?: string, quickSpecialty?: string, clientPrefs?: object|null }} [options]
 * @returns {object[]}
 */
export function filterTrainers(
  trainers,
  filters,
  { query = '', quickSpecialty = 'All', clientPrefs = null } = {},
) {
  // 1. Turn the typed min/max into numbers. Blank stays null so that filter is skipped.
  let minPrice = null;
  if (String(filters.priceMin || '').trim()) {
    minPrice = Number(filters.priceMin);
  }
  let maxPrice = null;
  if (String(filters.priceMax || '').trim()) {
    maxPrice = Number(filters.priceMax);
  }
  const searchText = query.trim().toLowerCase();

  // 2. Drop any card that misses search, the quick chip, or the filter sheet (AND).
  const matching = [];
  for (let index = 0; index < trainers.length; index += 1) {
    const trainer = trainers[index];
    const passes = trainerPassesAllActiveFilters(
      trainer,
      filters,
      searchText,
      quickSpecialty,
      minPrice,
      maxPrice,
    );
    if (passes) {
      matching.push(trainer);
    }
  }

  // 3. Best match uses onboarding prefs; price / newest fall back as before.
  let sortOption = SORT_BEST_MATCH;
  if (filters.sort) {
    sortOption = filters.sort;
  }
  return sortTrainerCards(matching, sortOption, clientPrefs);
}

// ===== PLUMBING — skip unless debugging marketplace match / filter / sort =====

function appendGoalIfPresent(goals, goal) {
  if (!goal) {
    return;
  }
  goals.push(String(goal));
}

function gatherGoalStringsFromProfile(raw) {
  const goals = [];
  if (Array.isArray(raw.goals)) {
    for (let index = 0; index < raw.goals.length; index += 1) {
      appendGoalIfPresent(goals, raw.goals[index]);
    }
  }
  if (raw.primaryGoal) {
    goals.push(String(raw.primaryGoal));
  }
  if (raw.goal) {
    goals.push(String(raw.goal));
  }
  return goals;
}

function sessionTypeFromEquipmentList(equipment) {
  const hasBodyweight = equipment.includes('bodyweight');
  const hasFullGym = equipment.includes('full_gym');
  if (hasBodyweight && !hasFullGym) {
    return SESSION_REMOTE;
  }
  if (hasFullGym) {
    return SESSION_IN_PERSON;
  }
  return SESSION_BOTH;
}

function matchScoreWithoutClientPrefs(trainer) {
  let score = 0;
  if (trainer.available) {
    score += MATCH_AVAILABLE;
  }
  if (trainer.verified) {
    score += MATCH_VERIFIED;
  }
  return score + ratingBonusPoints(trainer.rating);
}

function specialtyListIncludesPhrase(specialtyLower, phrase) {
  const needle = phrase.toLowerCase();
  for (let index = 0; index < specialtyLower.length; index += 1) {
    const text = specialtyLower[index];
    if (text.includes(needle)) {
      return true;
    }
  }
  return false;
}

function pointsForOneClientGoal(goal, specialtyLower) {
  let points = 0;
  let mapped = GOAL_TO_SPECIALTIES[goal];
  if (!mapped) {
    mapped = [];
  }
  for (let index = 0; index < mapped.length; index += 1) {
    const specialty = mapped[index];
    if (!specialtyListIncludesPhrase(specialtyLower, specialty)) {
      continue;
    }
    points += MATCH_GOAL_HIT;
    break;
  }
  const directGoalText = goal.replace(/_/g, ' ');
  if (specialtyListIncludesPhrase(specialtyLower, directGoalText)) {
    points += MATCH_SPECIALTY_HIT;
  }
  return points;
}

function experienceMatchPoints(fitnessLevel, trainerYears) {
  const years = Number(trainerYears) || 0;
  const level = fitnessLevel;
  if (level === 'beginner' && years >= 1 && years <= 5) {
    return MATCH_EXPERIENCE;
  }
  if (level === 'intermediate' && years >= 3 && years <= 8) {
    return MATCH_EXPERIENCE;
  }
  if (level === 'advanced' && years >= 5) {
    return MATCH_EXPERIENCE;
  }
  return 0;
}

function locationMatchPoints(clientLocation, trainerLocation) {
  if (!clientLocation || !trainerLocation) {
    return 0;
  }
  const trainerText = String(trainerLocation).toLowerCase();
  const clientText = String(clientLocation).toLowerCase();
  const cityChunk = trainerText.split(',')[0].trim();
  if (trainerText.includes(clientText) || clientText.includes(cityChunk)) {
    return MATCH_LOCATION;
  }
  return 0;
}

function ratingBonusPoints(rating) {
  const ratingNumber = Number(rating);
  if (!Number.isFinite(ratingNumber) || ratingNumber <= 0) {
    return 0;
  }
  return Math.min(MATCH_RATING_CAP, Math.round(ratingNumber * MATCH_RATING_UNIT));
}

/**
 * Years of experience from a number, a leading digit, or a stored range label.
 * @param {*} rawExperience
 * @returns {number}
 */
function yearsFromExperienceField(rawExperience) {
  if (rawExperience == null || rawExperience === '') {
    return 0;
  }
  if (typeof rawExperience === 'number' && Number.isFinite(rawExperience)) {
    return rawExperience;
  }

  const experienceText = String(rawExperience);
  const leadingNumber = parseInt(experienceText, 10);
  if (Number.isFinite(leadingNumber)) {
    return leadingNumber;
  }

  const rangeKeys = Object.keys(EXPERIENCE_YEAR_VALUES);
  for (let index = 0; index < rangeKeys.length; index += 1) {
    const rangeKey = rangeKeys[index];
    const years = EXPERIENCE_YEAR_VALUES[rangeKey];
    const rangeAsWords = rangeKey.replace(/_/g, ' ');
    if (experienceText.includes(rangeKey)) {
      return years;
    }
    if (experienceText.toLowerCase().includes(rangeAsWords)) {
      return years;
    }
  }

  if (experienceText.includes('1-2')) {
    return 2;
  }
  if (experienceText.includes('3-5')) {
    return 4;
  }
  if (experienceText.includes('5-8')) {
    return 6;
  }
  if (experienceText.includes('8+')) {
    return 9;
  }
  return 0;
}

/**
 * Remote / In-person / Hybrid, from whichever field the trainer doc happened to use.
 * @param {object} trainerDoc
 * @returns {string}
 */
function sessionModeFromTrainerDoc(trainerDoc) {
  let sessionType = trainerDoc.sessionType;
  if (!sessionType) {
    sessionType = trainerDoc.coachingMode;
  }
  if (!sessionType) {
    sessionType = trainerDoc.mode;
  }

  if (sessionType === SESSION_BOTH || sessionType === MODE_HYBRID) {
    return MODE_HYBRID;
  }
  if (sessionType === SESSION_REMOTE || trainerDoc.isRemote === true) {
    return SESSION_REMOTE;
  }
  if (
    sessionType === SESSION_IN_PERSON ||
    sessionType === SESSION_IN_PERSON_ALT_DASH ||
    sessionType === SESSION_IN_PERSON_ALT_SPACE
  ) {
    return SESSION_IN_PERSON;
  }
  if (trainerDoc.isRemote === false && trainerDoc.location) {
    return SESSION_IN_PERSON;
  }
  if (trainerDoc.isRemote) {
    return SESSION_REMOTE;
  }
  if (sessionType) {
    return String(sessionType);
  }
  return SESSION_REMOTE;
}

/**
 * Specialties from every field name we have stored, with duplicates removed.
 * @param {object} trainerDoc
 * @returns {string[]}
 */
function specialtiesFromTrainerDoc(trainerDoc) {
  const rawList = [];
  if (Array.isArray(trainerDoc.specialties)) {
    for (let index = 0; index < trainerDoc.specialties.length; index += 1) {
      rawList.push(trainerDoc.specialties[index]);
    }
  }
  if (Array.isArray(trainerDoc.specializations)) {
    for (let index = 0; index < trainerDoc.specializations.length; index += 1) {
      rawList.push(trainerDoc.specializations[index]);
    }
  }
  if (Array.isArray(trainerDoc.categories)) {
    for (let index = 0; index < trainerDoc.categories.length; index += 1) {
      rawList.push(trainerDoc.categories[index]);
    }
  }
  if (trainerDoc.specialty) {
    rawList.push(trainerDoc.specialty);
  }

  const cleaned = [];
  for (let index = 0; index < rawList.length; index += 1) {
    const trimmed = String(rawList[index]).trim();
    if (trimmed) {
      cleaned.push(trimmed);
    }
  }

  const seen = new Set();
  const unique = [];
  for (let index = 0; index < cleaned.length; index += 1) {
    const specialty = cleaned[index];
    const specialtyKey = specialty.toLowerCase();
    if (seen.has(specialtyKey)) {
      continue;
    }
    seen.add(specialtyKey);
    unique.push(specialty);
  }
  return unique;
}

/**
 * Two initials from the name. A stored initials string is kept as written.
 * @param {string} name
 * @param {string} [storedInitials]
 * @returns {string}
 */
function initialsFromCoachName(name, storedInitials) {
  if (storedInitials) {
    return storedInitials;
  }
  const nameParts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (nameParts.length >= 2) {
    const firstLetter = nameParts[0][0];
    const lastLetter = nameParts[nameParts.length - 1][0];
    return `${firstLetter}${lastLetter}`.toUpperCase();
  }
  let firstLetter = DEFAULT_INITIAL;
  if (nameParts[0] && nameParts[0][0]) {
    firstLetter = nameParts[0][0];
  }
  return firstLetter.toUpperCase();
}

/**
 * Kept for callers / future profile empty-state that still want the bio fallback alone.
 * @param {object} trainerDoc
 * @returns {string}
 */
function trainerBio(trainerDoc) {
  const bio = pickFirstNonEmptyString(
    trainerDoc.bio,
    trainerDoc.trainerProfileBio,
    trainerDoc.about,
    trainerDoc.description,
    trainerDoc.trainingPhilosophy,
  );
  if (bio) {
    return bio;
  }
  return DEFAULT_BIO;
}

/**
 * "March 2024" from a Firestore timestamp, or whatever string was already stored.
 * @param {object} trainerDoc
 * @returns {string}
 */
function joinedMonthYearLabel(trainerDoc) {
  if (trainerDoc.memberSince) {
    return trainerDoc.memberSince;
  }
  if (trainerDoc.joinedAt && typeof trainerDoc.joinedAt.toDate === 'function') {
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
function joinedAtMilliseconds(memberSince, trainerDoc) {
  if (trainerDoc && trainerDoc.joinedAt && trainerDoc.joinedAt.toMillis) {
    return trainerDoc.joinedAt.toMillis();
  }
  if (trainerDoc && trainerDoc.createdAt && trainerDoc.createdAt.toMillis) {
    return trainerDoc.createdAt.toMillis();
  }
  const timestamp = Date.parse(memberSince);
  if (Number.isNaN(timestamp)) {
    return 0;
  }
  return timestamp;
}

/**
 * @param {number} years
 * @param {string} experience
 * @returns {boolean}
 */
function matchesExperience(years, experience) {
  if (experience === EXPERIENCE_LABEL_1_2) {
    return years >= 1 && years <= 2;
  }
  if (experience === EXPERIENCE_LABEL_3_5) {
    return years >= 3 && years <= 5;
  }
  if (experience === EXPERIENCE_LABEL_5_8) {
    return years >= 5 && years <= 8;
  }
  if (experience === EXPERIENCE_LABEL_8_PLUS) {
    return years >= 8;
  }
  return true;
}

/**
 * "In-person" also keeps Hybrid, because a hybrid coach can meet in person.
 * @param {string} mode
 * @param {string} sessionType
 * @returns {boolean}
 */
function matchesSessionType(mode, sessionType) {
  if (sessionType === SESSION_BOTH) {
    return true;
  }
  if (sessionType === SESSION_REMOTE) {
    return mode === SESSION_REMOTE;
  }
  if (sessionType === SESSION_IN_PERSON) {
    return mode === SESSION_IN_PERSON || mode === MODE_HYBRID;
  }
  return true;
}

/**
 * @param {string[]} trainerSpecialties
 * @param {string} filterSpecialty
 * @returns {boolean}
 */
function specialtyMatches(trainerSpecialties, filterSpecialty) {
  const filterText = filterSpecialty.toLowerCase();
  for (let index = 0; index < trainerSpecialties.length; index += 1) {
    const specialtyText = trainerSpecialties[index].toLowerCase();
    if (specialtyText.includes(filterText) || filterText.includes(specialtyText)) {
      return true;
    }
  }
  return false;
}

function anySheetSpecialtyMatches(trainerSpecialties, sheetSpecialties) {
  for (let index = 0; index < sheetSpecialties.length; index += 1) {
    if (specialtyMatches(trainerSpecialties, sheetSpecialties[index])) {
      return true;
    }
  }
  return false;
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
function trainerPassesAllActiveFilters(trainer, filters, searchText, quickSpecialty, minPrice, maxPrice) {
  if (searchText) {
    const searchableText = `${trainer.name} ${trainer.location} ${trainer.specialties.join(' ')}`.toLowerCase();
    if (!searchableText.includes(searchText)) {
      return false;
    }
  }
  if (quickSpecialty !== QUICK_SPECIALTY_ALL) {
    if (!specialtyMatches(trainer.specialties, quickSpecialty)) {
      return false;
    }
  }
  if (filters.specialties.length > 0) {
    if (!anySheetSpecialtyMatches(trainer.specialties, filters.specialties)) {
      return false;
    }
  }
  if (filters.availableOnly && !trainer.available) {
    return false;
  }
  if (filters.availability === AVAILABILITY_AVAILABLE && !trainer.available) {
    return false;
  }
  if (filters.availability === WAITLIST_AVAILABILITY && trainer.available) {
    return false;
  }
  if (filters.verifiedOnly && trainer.verified !== true) {
    return false;
  }

  let price = getTrainerPrice(trainer);
  if (price == null) {
    price = trainer.price;
  }
  if (price == null) {
    price = 0;
  }

  if (minPrice !== null && !Number.isNaN(minPrice) && price < minPrice) {
    return false;
  }
  if (maxPrice !== null && !Number.isNaN(maxPrice) && price > maxPrice) {
    return false;
  }
  if (!matchesSessionType(trainer.mode, filters.sessionType)) {
    return false;
  }
  if (!matchesExperience(trainer.years, filters.experience)) {
    return false;
  }
  return true;
}

function priceFromCard(trainerCard) {
  let price = getTrainerPrice(trainerCard._firebase);
  if (price == null) {
    price = trainerCard.price;
  }
  return price;
}

function comparePriceLowToHigh(first, second) {
  return priceFromCard(first) - priceFromCard(second);
}

function comparePriceHighToLow(first, second) {
  return priceFromCard(second) - priceFromCard(first);
}

function compareBestMatchThenNewest(first, second, clientPrefs) {
  const scoreGap = scoreTrainerMatch(second, clientPrefs) - scoreTrainerMatch(first, clientPrefs);
  if (scoreGap !== 0) {
    return scoreGap;
  }
  return (
    joinedAtMilliseconds(second.memberSince, second._firebase) -
    joinedAtMilliseconds(first.memberSince, first._firebase)
  );
}

function compareNewestFirst(first, second) {
  return (
    joinedAtMilliseconds(second.memberSince, second._firebase) -
    joinedAtMilliseconds(first.memberSince, first._firebase)
  );
}

/**
 * Price sorts read the raw Firestore doc. Newest uses the joined-at timestamp.
 * Best match uses scoreTrainerMatch when client prefs exist.
 * @param {object[]} trainers
 * @param {string} sortOption
 * @param {object|null} [clientPrefs]
 * @returns {object[]}
 */
function sortTrainerCards(trainers, sortOption, clientPrefs = null) {
  if (sortOption === SORT_PRICE_LOW) {
    return [...trainers].sort(comparePriceLowToHigh);
  }
  if (sortOption === SORT_PRICE_HIGH) {
    return [...trainers].sort(comparePriceHighToLow);
  }
  if (sortOption === SORT_BEST_MATCH) {
    return [...trainers].sort((first, second) =>
      compareBestMatchThenNewest(first, second, clientPrefs),
    );
  }
  if (sortOption === SORT_NEWEST) {
    return [...trainers].sort(compareNewestFirst);
  }
  return [...trainers].sort(compareNewestFirst);
}
