// Turns onboarding answers into short labels for workout profile pills and plan chrome.
// Flow: read raw field by key → hide empty placeholders → humanize snake_case tokens.
// Used by WorkoutProfileTags and NewPlanPanel. Exports LOVABLE_ACCENTS for accent rotation.
// Field key letters and LOVABLE_ACCENTS shape stay frozen.

// ===== NAMED CONSTANTS =====

const MISSING_VALUE = '—';

// Manipulate here: height stored as total inches is only trusted in this adult range.
const MIN_HEIGHT_INCHES = 36;
const MAX_HEIGHT_INCHES = 96;
const INCHES_PER_FOOT = 12;

const EMPTY_DISPLAY_VALUES = new Set([
  'Not set',
  'None selected',
  'None reported',
  'Not provided',
]);

const ONBOARDING_TOKEN_LABELS = {
  full_gym: 'Full Gym',
  home_gym: 'Home Gym',
  dumbbells: 'Dumbbells',
  barbell: 'Barbell',
  machines: 'Machines',
  bands: 'Resistance Bands',
  bodyweight: 'Bodyweight',
  less_than_4: 'Less than 4 cups/day',
  '4_8': '4–8 cups/day',
  more_than_8: 'More than 8 cups/day',
};

// Kept for historical plan-chrome letter parity (orange accent).
const PLAN_BUILDER_COLORS = {
  orange: '#F97316',
};

// Kept for historical markdown viewer letter parity on dark plan chrome.
const MARKDOWN_STYLES = {
  body: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 22 },
  heading1: { color: '#ffffff', fontSize: 20, fontWeight: '800', marginBottom: 12, marginTop: 8 },
  heading2: { color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  strong: { color: '#ffffff', fontWeight: '700' },
};

// Manipulate here: warm accent rotation for profile section chips (key / gradient / text letters frozen).
export const LOVABLE_ACCENTS = [
  { key: 'warm-a', gradient: ['#C2410C', '#F97316'], text: '#C2410C' },
  { key: 'warm-b', gradient: ['#F97316', '#C2410C'], text: '#F97316' },
  { key: 'warm-c', gradient: ['#C2410C', '#9A3412'], text: '#C2410C' },
  { key: 'warm-d', gradient: ['#9A3412', '#C2410C'], text: '#C2410C' },
];

// ===== HELPER FUNCTIONS =====

function isUsableNumber(rawNumber) {
  return rawNumber != null && rawNumber !== '';
}

function parseHeightAsTotalInches(height) {
  if (typeof height === 'number') return height;
  const digitsOnly = String(height).replace(/[^0-9.]/g, '');
  return Number(digitsOnly);
}

function totalInchesAreInAdultRange(asNumber) {
  if (!Number.isFinite(asNumber)) return false;
  if (asNumber < MIN_HEIGHT_INCHES) return false;
  if (asNumber > MAX_HEIGHT_INCHES) return false;
  return true;
}

/**
 * Height saved as { feet, inches }.
 * @param {{ feet?: number|string, inches?: number|string }} heightObject
 * @returns {string}
 */
function heightFromFeetAndInches(heightObject) {
  const hasFeet = isUsableNumber(heightObject.feet);
  const hasInches = isUsableNumber(heightObject.inches);
  if (!hasFeet && !hasInches) return MISSING_VALUE;

  const feet = hasFeet ? Number(heightObject.feet) : 0;
  const inches = hasInches ? Number(heightObject.inches) : 0;
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return MISSING_VALUE;
  return `${feet}'${inches}"`;
}

/**
 * Height saved as total inches, for example 70 → 5'10".
 * @param {number} totalInches
 * @returns {string}
 */
function heightFromTotalInches(totalInches) {
  const roundedInches = Math.round(totalInches);
  const feet = Math.floor(roundedInches / INCHES_PER_FOOT);
  const leftoverInches = roundedInches % INCHES_PER_FOOT;
  return `${feet}'${leftoverInches}"`;
}

function capitalizeFirstLetter(text) {
  if (!text) return 'Not set';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * snake_case tokens from equipment and hydration become words a trainee can read.
 * @param {string} token
 * @returns {string}
 */
function humanizeOnboardingToken(token) {
  const key = String(token || '').trim().toLowerCase();
  if (ONBOARDING_TOKEN_LABELS[key]) return ONBOARDING_TOKEN_LABELS[key];
  return key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function humanizeSnakeCaseList(rawText) {
  const parts = rawText.split(',');
  const labeledParts = [];
  for (const part of parts) {
    labeledParts.push(humanizeOnboardingToken(part));
  }
  return labeledParts.join(', ');
}

/**
 * Hide empty placeholders; humanize snake_case equipment / hydration tokens.
 * @param {unknown} raw
 * @returns {string|null}
 */
function formatDisplayValue(raw) {
  if (raw == null || raw === '') return null;

  let displayText = String(raw).trim();
  if (!displayText) return null;
  if (EMPTY_DISPLAY_VALUES.has(displayText)) return null;
  if (displayText === 'undefined') return null;
  if (displayText.toLowerCase() === 'undefined') return null;
  if (/^N\/A,\s*N\/Ayrs,\s*N\/Albs,\s*0'0"$/i.test(displayText)) return null;
  if (/^0\s*days\s*per\s*week$/i.test(displayText)) return null;

  const looksLikeSnakeList =
    displayText.includes('_')
    && (displayText.includes(',') || /^[a-z0-9_]+$/i.test(displayText));
  const looksLikeSingleToken =
    /^[a-z0-9_]+$/i.test(displayText) && displayText.includes('_');

  if (looksLikeSnakeList) {
    displayText = humanizeSnakeCaseList(displayText);
    return displayText;
  }
  if (looksLikeSingleToken) {
    displayText = humanizeOnboardingToken(displayText);
    return displayText;
  }
  return displayText;
}

function formatPrimaryGoalDisplay(primaryGoal) {
  if (!primaryGoal) return 'Not set';
  return primaryGoal
    .replace('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatHydrationHabitsDisplay(hydrationHabits) {
  if (hydrationHabits === 'less_than_4') return 'Less than 4 cups/day';
  if (hydrationHabits === '4_8') return '4–8 cups/day';
  if (hydrationHabits === 'more_than_8') return 'More than 8 cups/day';
  return 'Not set';
}

function formatPersonalInfoLine(onboardingData) {
  const gender = onboardingData.gender || 'N/A';
  const age = onboardingData.age || 'N/A';
  const weight = onboardingData.weight || 'N/A';
  const heightObject = onboardingData.height;
  const feet = (heightObject && heightObject.feet) || 0;
  const inches = (heightObject && heightObject.inches) || 0;
  return `${gender}, ${age}yrs, ${weight}lbs, ${feet}'${inches}"`;
}

/**
 * Map of pill keys → raw string builders. Key letters stay frozen for NewPlanPanel / tags.
 */
const WORKOUT_BUILDER_FIELD_READERS = {
  personalInfo: (onboardingData) => formatPersonalInfoLine(onboardingData),
  fitnessLevel: (onboardingData) => capitalizeFirstLetter(onboardingData.fitnessLevel),
  goal: (onboardingData) => formatPrimaryGoalDisplay(onboardingData.primaryGoal),
  equipment: (onboardingData) => {
    const accessList = onboardingData.equipmentAccess;
    if (!Array.isArray(accessList)) return 'None selected';
    const joined = accessList.join(', ');
    return joined || 'None selected';
  },
  frequency: (onboardingData) => `${onboardingData.daysPerWeek || 0} days per week`,
  injuries: (onboardingData) => onboardingData.injuries || 'None reported',
  trainingEnvironment: (onboardingData) =>
    capitalizeFirstLetter(onboardingData.trainingEnvironment),
  preferredWorkoutTime: (onboardingData) =>
    capitalizeFirstLetter(onboardingData.preferredWorkoutTime),
  exercisesDislike: (onboardingData) => onboardingData.exercisesDislike || 'None',
  supplementsCurrentlyTaking: (onboardingData) =>
    onboardingData.supplementsCurrentlyTaking || 'None',
  currentStressLevel: (onboardingData) =>
    capitalizeFirstLetter(onboardingData.currentStressLevel),
  sleepQuality: (onboardingData) => capitalizeFirstLetter(onboardingData.sleepQuality),
  energyLevels: (onboardingData) => capitalizeFirstLetter(onboardingData.energyLevels),
  hydrationHabits: (onboardingData) =>
    formatHydrationHabitsDisplay(onboardingData.hydrationHabits),
  situationDescription: (onboardingData) =>
    onboardingData.situationDescription || 'Not provided',
};

/**
 * @param {string} key
 * @param {object} onboardingData
 * @returns {string}
 */
function getWorkoutBuilderFieldRawDisplay(key, onboardingData) {
  if (!onboardingData) return '';
  const reader = WORKOUT_BUILDER_FIELD_READERS[key];
  if (!reader) return '';
  return reader(onboardingData);
}

// ===== MAIN FUNCTION =====

/**
 * Format height for a profile pill: feet/inches object, or total inches in adult range.
 * @param {unknown} height
 * @returns {string}
 */
export function formatProfileHeightDisplay(height) {
  // 1. Missing height → em dash.
  if (height == null) return MISSING_VALUE;

  // 2. Object shape { feet, inches } from onboarding forms.
  if (typeof height === 'object') {
    return heightFromFeetAndInches(height);
  }

  // 3. Number or digit string of total inches — only format when in believable adult range.
  const totalInches = parseHeightAsTotalInches(height);
  if (totalInchesAreInAdultRange(totalInches)) {
    return heightFromTotalInches(totalInches);
  }

  // 4. Anything else (junk text, out-of-range) → em dash.
  return MISSING_VALUE;
}

/**
 * One pill label for a workout-builder field key.
 * @param {string} fieldKey
 * @param {object} onboardingData
 * @returns {string}
 */
export function displayForFieldKey(fieldKey, onboardingData) {
  // 1. One concatenated or looked-up string for this pill key.
  const rawLine = getWorkoutBuilderFieldRawDisplay(fieldKey, onboardingData);

  // 2. Drop placeholders and humanize equipment/hydration tokens.
  const formatted = formatDisplayValue(rawLine);
  let displayText = '';
  if (formatted != null) {
    displayText = String(formatted).trim();
  }

  // 3. Em dash when the trainee never answered or we got string "null".
  if (!displayText) return MISSING_VALUE;
  if (displayText === 'null') return MISSING_VALUE;
  if (displayText === 'undefined') return MISSING_VALUE;
  return displayText;
}
