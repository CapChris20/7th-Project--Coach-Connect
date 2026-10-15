// Profile card visibility — only show cards for onboarding fields the user actually answered.
// Flow: map card id → onboarding field → is that field filled? → drop empty items and empty sections.
// Used by: ClientAppStart and TrainerAppStart (CreateWorkoutPlanScreen).

// ===== NAMED CONSTANTS =====

const PERSONAL_FIELDS = ['age', 'gender', 'height', 'weight'];

const TRAINING_FIELDS = [
  'fitnessLevel',
  'goal',
  'equipment',
  'frequency',
  'trainingEnvironment',
  'preferredWorkoutTime',
];

const RECOVERY_FIELDS = [
  'exercisesDislike',
  'injuries',
  'supplementsCurrentlyTaking',
  'currentStressLevel',
  'sleepQuality',
  'energyLevels',
  'hydrationHabits',
  'situationDescription',
];

const SECTION_LABEL_PERSONAL = 'Personal';
const SECTION_LABEL_TRAINING = 'Training';
const SECTION_LABEL_RECOVERY = 'Recovery';
const MIN_HEIGHT_INCHES = 36;
const MAX_HEIGHT_INCHES = 96;

/** Maps profile card `item.id` → onboarding field key. */
export const PROFILE_CARD_FIELD_KEY = {
  age: 'age',
  gender: 'gender',
  height: 'height',
  weight: 'weight',
  fitnessLevel: 'fitnessLevel',
  goal: 'goal',
  equipment: 'equipment',
  frequency: 'frequency',
  trainingEnvironment: 'trainingEnvironment',
  preferredWorkoutTime: 'preferredWorkoutTime',
  exercisesDislike: 'exercisesDislike',
  injuries: 'injuries',
  supplements: 'supplementsCurrentlyTaking',
  stress: 'currentStressLevel',
  sleep: 'sleepQuality',
  energy: 'energyLevels',
  hydration: 'hydrationHabits',
  journey: 'situationDescription',
};

// ===== HELPER FUNCTIONS =====

/**
 * Height can be { feet, inches }, totalInches, cm, or a leftover number-in-a-string.
 * @param {*} height
 * @returns {boolean}
 */
function hasHeightValue(height) {
  if (height == null) return false;
  if (typeof height === 'object') {
    const feet = height.feet;
    const inches = height.inches;
    if (feet != null && feet !== '' && Number.isFinite(Number(feet))) return true;
    if (inches != null && inches !== '' && Number.isFinite(Number(inches))) return true;
    if (height.totalInches != null && Number(height.totalInches) > 0) return true;
    if (height.cm != null && Number(height.cm) > 0) return true;
    return false;
  }
  const numericHeight = Number(String(height).replace(/[^0-9.]/g, ''));
  return Number.isFinite(numericHeight) && numericHeight >= MIN_HEIGHT_INCHES && numericHeight <= MAX_HEIGHT_INCHES;
}

/**
 * @param {string[]} fieldKeys
 * @param {object} onboardingData
 * @returns {boolean}
 */
function hasAnyFieldData(fieldKeys, onboardingData) {
  return fieldKeys.some((fieldKey) => hasOnboardingFieldData(fieldKey, onboardingData));
}

// ===== MAIN FUNCTION =====

/**
 * True when the user provided this field during onboarding (or saved it since).
 * @param {string} fieldKey
 * @param {object} onboardingData
 * @returns {boolean}
 */
export function hasOnboardingFieldData(fieldKey, onboardingData) {
  if (!onboardingData || !fieldKey) return false;

  switch (fieldKey) {
    case 'age':
      return onboardingData.age != null && onboardingData.age !== '';
    case 'gender':
      return Boolean(String(onboardingData.gender || '').trim());
    case 'height':
      return hasHeightValue(onboardingData.height);
    case 'weight':
      return onboardingData.weight != null && onboardingData.weight !== '';
    case 'fitnessLevel':
      return Boolean(onboardingData.fitnessLevel);
    case 'goal':
      return (
        Boolean(onboardingData.primaryGoal) ||
        (Array.isArray(onboardingData.goals) && onboardingData.goals.length > 0)
      );
    case 'equipment':
      return Array.isArray(onboardingData.equipmentAccess) && onboardingData.equipmentAccess.length > 0;
    case 'frequency':
      return onboardingData.daysPerWeek != null && Number(onboardingData.daysPerWeek) > 0;
    case 'trainingEnvironment':
      return Boolean(onboardingData.trainingEnvironment);
    case 'preferredWorkoutTime':
      return Boolean(onboardingData.preferredWorkoutTime);
    case 'exercisesDislike':
      return Boolean(String(onboardingData.exercisesDislike || '').trim());
    case 'injuries':
      if (onboardingData.injuries === null) return false;
      return Boolean(String(onboardingData.injuries || '').trim());
    case 'supplementsCurrentlyTaking':
      return Boolean(String(onboardingData.supplementsCurrentlyTaking || '').trim());
    case 'currentStressLevel':
      return Boolean(onboardingData.currentStressLevel);
    case 'sleepQuality':
      return Boolean(onboardingData.sleepQuality);
    case 'energyLevels':
      return Boolean(onboardingData.energyLevels);
    case 'hydrationHabits':
      return Boolean(onboardingData.hydrationHabits);
    case 'situationDescription':
      return Boolean(String(onboardingData.situationDescription || '').trim());
    default:
      return false;
  }
}

/**
 * Resolve which onboarding field a profile card item represents.
 * @param {object} item
 * @returns {string|undefined}
 */
export function resolveProfileCardFieldKey(item) {
  return PROFILE_CARD_FIELD_KEY[item?.id] || item?.editKey || item?.id;
}

/**
 * Drop card items the user never answered.
 * @param {object[]} items
 * @param {object} onboardingData
 * @returns {object[]}
 */
export function filterProfileCardItems(items, onboardingData) {
  return (items || []).filter((item) =>
    hasOnboardingFieldData(resolveProfileCardFieldKey(item), onboardingData),
  );
}

/**
 * Same filter, then drop sections that ended up with zero items.
 * @param {object[]} sections
 * @param {object} onboardingData
 * @returns {object[]}
 */
export function filterProfileCardSections(sections, onboardingData) {
  return (sections || [])
    .map((section) => ({
      ...section,
      items: filterProfileCardItems(section.items, onboardingData),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * Section titles to show in the profile card chrome, in Personal → Training → Recovery order.
 * @param {object} onboardingData
 * @returns {string[]}
 */
export function getProfileCardSectionLabels(onboardingData) {
  const labels = [];
  if (hasAnyFieldData(PERSONAL_FIELDS, onboardingData)) {
    labels.push(SECTION_LABEL_PERSONAL);
  }
  if (hasAnyFieldData(TRAINING_FIELDS, onboardingData)) {
    labels.push(SECTION_LABEL_TRAINING);
  }
  if (hasAnyFieldData(RECOVERY_FIELDS, onboardingData)) {
    labels.push(SECTION_LABEL_RECOVERY);
  }
  return labels;
}
