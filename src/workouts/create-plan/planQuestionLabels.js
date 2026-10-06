// Turns onboarding answers into short labels for the workout profile pills.
// Flow: read the raw field → hide empty placeholders → humanize snake_case.
// Used by: WorkoutProfileTags.

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

const PLAN_BUILDER_COLORS = {
  orange: '#F97316',
};

const MARKDOWN_STYLES = {
  body: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 22 },
  heading1: { color: '#ffffff', fontSize: 20, fontWeight: '800', marginBottom: 12, marginTop: 8 },
  heading2: { color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  strong: { color: '#ffffff', fontWeight: '700' },
};

export const LOVABLE_ACCENTS = [
  { key: 'warm-a', gradient: ['#BE185D', '#C2410C'], text: '#BE185D' },
  { key: 'warm-b', gradient: ['#C2410C', '#BE185D'], text: '#C2410C' },
  { key: 'warm-c', gradient: ['#BE185D', '#9A3412'], text: '#BE185D' },
  { key: 'warm-d', gradient: ['#9A3412', '#C2410C'], text: '#C2410C' },
];

// ===== HELPER FUNCTIONS =====

/**
 * @param {number|string|null|undefined} rawNumber
 * @returns {boolean}
 */
function isUsableNumber(rawNumber) {
  return rawNumber != null && rawNumber !== '';
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

/**
 * @param {string} text
 * @returns {string}
 */
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

/**
 * @param {string} rawText
 * @returns {string}
 */
function humanizeSnakeCaseList(rawText) {
  return rawText
    .split(',')
    .map((part) => humanizeOnboardingToken(part))
    .join(', ');
}

/**
 * Hide the placeholders the form uses when a field was never answered.
 * @param {string|number|null|undefined} raw
 * @returns {string|null}
 */
function formatDisplayValue(raw) {
  if (raw == null || raw === '') return null;
  let displayText = String(raw).trim();
  if (!displayText) return null;
  if (EMPTY_DISPLAY_VALUES.has(displayText)) return null;
  if (displayText === 'undefined' || displayText.toLowerCase() === 'undefined') return null;
  if (/^N\/A,\s*N\/Ayrs,\s*N\/Albs,\s*0'0"$/i.test(displayText)) return null;
  if (/^0\s*days\s*per\s*week$/i.test(displayText)) return null;

  const looksLikeSnakeList = displayText.includes('_') && (displayText.includes(',') || /^[a-z0-9_]+$/i.test(displayText));
  const looksLikeSingleToken = /^[a-z0-9_]+$/i.test(displayText) && displayText.includes('_');
  if (looksLikeSnakeList) {
    displayText = humanizeSnakeCaseList(displayText);
  } else if (looksLikeSingleToken) {
    displayText = humanizeOnboardingToken(displayText);
  }
  return displayText;
}

/**
 * Raw one-line text for one profile pill, before empty values are hidden.
 * @param {string} key
 * @param {object|null|undefined} onboardingData
 * @returns {string}
 */
function getWorkoutBuilderFieldRawDisplay(key, onboardingData) {
  if (!onboardingData) return '';
  switch (key) {
    case 'personalInfo':
      return `${onboardingData.gender || 'N/A'}, ${onboardingData.age || 'N/A'}yrs, ${onboardingData.weight || 'N/A'}lbs, ${onboardingData.height?.feet || 0}'${onboardingData.height?.inches || 0}"`;
    case 'fitnessLevel':
      return capitalizeFirstLetter(onboardingData.fitnessLevel);
    case 'goal':
      return onboardingData.primaryGoal
        ? onboardingData.primaryGoal.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
        : 'Not set';
    case 'equipment':
      return onboardingData.equipmentAccess?.join(', ') || 'None selected';
    case 'frequency':
      return `${onboardingData.daysPerWeek || 0} days per week`;
    case 'injuries':
      return onboardingData.injuries || 'None reported';
    case 'trainingEnvironment':
      return capitalizeFirstLetter(onboardingData.trainingEnvironment);
    case 'preferredWorkoutTime':
      return capitalizeFirstLetter(onboardingData.preferredWorkoutTime);
    case 'exercisesDislike':
      return onboardingData.exercisesDislike || 'None';
    case 'supplementsCurrentlyTaking':
      return onboardingData.supplementsCurrentlyTaking || 'None';
    case 'currentStressLevel':
      return capitalizeFirstLetter(onboardingData.currentStressLevel);
    case 'sleepQuality':
      return capitalizeFirstLetter(onboardingData.sleepQuality);
    case 'energyLevels':
      return capitalizeFirstLetter(onboardingData.energyLevels);
    case 'hydrationHabits':
      if (onboardingData.hydrationHabits === 'less_than_4') return 'Less than 4 cups/day';
      if (onboardingData.hydrationHabits === '4_8') return '4–8 cups/day';
      if (onboardingData.hydrationHabits === 'more_than_8') return 'More than 8 cups/day';
      return 'Not set';
    case 'situationDescription':
      return onboardingData.situationDescription || 'Not provided';
    default:
      return '';
  }
}

// ===== MAIN FUNCTION =====

/**
 * Show height as feet and inches, or an em dash when it is missing.
 * @param {number|string|{ feet?: number|string, inches?: number|string }|null|undefined} height
 * @returns {string}
 */
export function formatProfileHeightDisplay(height) {
  if (height == null) return MISSING_VALUE;
  if (typeof height === 'object') return heightFromFeetAndInches(height);

  const totalInches = typeof height === 'number' ? height : Number(String(height).replace(/[^0-9.]/g, ''));
  const inchesAreInRange = Number.isFinite(totalInches) && totalInches >= MIN_HEIGHT_INCHES && totalInches <= MAX_HEIGHT_INCHES;
  if (inchesAreInRange) return heightFromTotalInches(totalInches);
  return MISSING_VALUE;
}

/**
 * Label shown on one profile pill. Empty answers become an em dash.
 * @param {string} fieldKey
 * @param {object} onboardingData
 * @returns {string}
 */
export function displayForFieldKey(fieldKey, onboardingData) {
  const raw = getWorkoutBuilderFieldRawDisplay(fieldKey, onboardingData);
  const formatted = formatDisplayValue(raw);
  const displayText = formatted != null ? String(formatted).trim() : '';
  if (!displayText || displayText === 'null' || displayText === 'undefined') return MISSING_VALUE;
  return displayText;
}
