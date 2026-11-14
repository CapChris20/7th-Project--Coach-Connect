// Profile card visibility — only show cards for onboarding fields the user actually answered.
// Flow: map card id → field key → field filled? → filter items → drop empty sections → section labels.
// Used by: ClientAppStart and TrainerAppStart (CreateWorkoutPlanScreen).
// Read order: constants → main recipes → PLUMBING (per-field checks + height shapes).

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

/** Maps profile card `item.id` → onboarding field key stored on the user doc. */
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

// ===== MAIN FUNCTION =====

/**
 * True when the user provided this field during onboarding (or saved it since).
 * @param {string} fieldKey
 * @param {object} onboardingData
 * @returns {boolean}
 */
export function hasOnboardingFieldData(fieldKey, onboardingData) {
  // 1. Need both a field name and a profile bag.
  if (!onboardingData || !fieldKey) return false;

  // 2. Look up the checker for this field; unknown keys count as empty.
  const fieldChecker = FIELD_DATA_CHECKERS[fieldKey];
  if (!fieldChecker) return false;

  // 3. Run that field’s own “was this answered?” rule.
  return fieldChecker(onboardingData);
}

/**
 * Resolve which onboarding field a profile card item represents.
 * @param {object} item
 * @returns {string|undefined}
 */
export function resolveProfileCardFieldKey(item) {
  if (!item) return undefined;
  if (PROFILE_CARD_FIELD_KEY[item.id]) return PROFILE_CARD_FIELD_KEY[item.id];
  if (item.editKey) return item.editKey;
  return item.id;
}

/**
 * Drop card items the user never answered.
 * @param {Array<object>} items
 * @param {object} onboardingData
 * @returns {Array<object>}
 */
export function filterProfileCardItems(items, onboardingData) {
  // 1. Walk every card item the section offered.
  const sourceItems = items || [];
  const keptItems = [];

  // 2. Keep only items whose onboarding field actually has data.
  for (const item of sourceItems) {
    const fieldKey = resolveProfileCardFieldKey(item);
    if (!hasOnboardingFieldData(fieldKey, onboardingData)) continue;
    keptItems.push(item);
  }

  // 3. Return the shorter list (same item objects, order unchanged).
  return keptItems;
}

/**
 * Same filter, then drop sections that ended up with zero items.
 * @param {Array<object>} sections
 * @param {object} onboardingData
 * @returns {Array<object>}
 */
export function filterProfileCardSections(sections, onboardingData) {
  const sourceSections = sections || [];
  const keptSections = [];

  for (const section of sourceSections) {
    const filteredItems = filterProfileCardItems(section.items, onboardingData);
    if (filteredItems.length === 0) continue;
    keptSections.push({ ...section, items: filteredItems });
  }

  return keptSections;
}

/**
 * Section titles to show in profile chrome (Personal → Training → Recovery).
 * @param {object} onboardingData
 * @returns {string[]}
 */
export function getProfileCardSectionLabels(onboardingData) {
  const labels = [];

  if (sectionHasAnyData(PERSONAL_FIELDS, onboardingData)) {
    labels.push(SECTION_LABEL_PERSONAL);
  }
  if (sectionHasAnyData(TRAINING_FIELDS, onboardingData)) {
    labels.push(SECTION_LABEL_TRAINING);
  }
  if (sectionHasAnyData(RECOVERY_FIELDS, onboardingData)) {
    labels.push(SECTION_LABEL_RECOVERY);
  }

  return labels;
}

// ===== HELPER FUNCTIONS =====

function sectionHasAnyData(fieldKeys, onboardingData) {
  for (const fieldKey of fieldKeys) {
    if (hasOnboardingFieldData(fieldKey, onboardingData)) return true;
  }
  return false;
}

function textFieldIsFilled(rawValue) {
  return Boolean(String(rawValue || '').trim());
}

function ageIsFilled(onboardingData) {
  return onboardingData.age != null && onboardingData.age !== '';
}

function genderIsFilled(onboardingData) {
  return textFieldIsFilled(onboardingData.gender);
}

function heightIsFilled(onboardingData) {
  return userHasHeightValue(onboardingData.height);
}

function weightIsFilled(onboardingData) {
  return onboardingData.weight != null && onboardingData.weight !== '';
}

function fitnessLevelIsFilled(onboardingData) {
  return Boolean(onboardingData.fitnessLevel);
}

function goalIsFilled(onboardingData) {
  const hasPrimaryGoal = Boolean(onboardingData.primaryGoal);
  const hasGoalsList = Array.isArray(onboardingData.goals) && onboardingData.goals.length > 0;
  return hasPrimaryGoal || hasGoalsList;
}

function equipmentIsFilled(onboardingData) {
  return Array.isArray(onboardingData.equipmentAccess) && onboardingData.equipmentAccess.length > 0;
}

function frequencyIsFilled(onboardingData) {
  return onboardingData.daysPerWeek != null && Number(onboardingData.daysPerWeek) > 0;
}

function trainingEnvironmentIsFilled(onboardingData) {
  return Boolean(onboardingData.trainingEnvironment);
}

function preferredWorkoutTimeIsFilled(onboardingData) {
  return Boolean(onboardingData.preferredWorkoutTime);
}

function exercisesDislikeIsFilled(onboardingData) {
  return textFieldIsFilled(onboardingData.exercisesDislike);
}

function injuriesIsFilled(onboardingData) {
  // null means "skipped / unknown" — do not treat that as answered
  if (onboardingData.injuries === null) return false;
  return textFieldIsFilled(onboardingData.injuries);
}

function supplementsIsFilled(onboardingData) {
  return textFieldIsFilled(onboardingData.supplementsCurrentlyTaking);
}

function stressIsFilled(onboardingData) {
  return Boolean(onboardingData.currentStressLevel);
}

function sleepIsFilled(onboardingData) {
  return Boolean(onboardingData.sleepQuality);
}

function energyIsFilled(onboardingData) {
  return Boolean(onboardingData.energyLevels);
}

function hydrationIsFilled(onboardingData) {
  return Boolean(onboardingData.hydrationHabits);
}

function situationDescriptionIsFilled(onboardingData) {
  return textFieldIsFilled(onboardingData.situationDescription);
}

// One lookup table avoids a long if-ladder in the main export
const FIELD_DATA_CHECKERS = {
  age: ageIsFilled,
  gender: genderIsFilled,
  height: heightIsFilled,
  weight: weightIsFilled,
  fitnessLevel: fitnessLevelIsFilled,
  goal: goalIsFilled,
  equipment: equipmentIsFilled,
  frequency: frequencyIsFilled,
  trainingEnvironment: trainingEnvironmentIsFilled,
  preferredWorkoutTime: preferredWorkoutTimeIsFilled,
  exercisesDislike: exercisesDislikeIsFilled,
  injuries: injuriesIsFilled,
  supplementsCurrentlyTaking: supplementsIsFilled,
  currentStressLevel: stressIsFilled,
  sleepQuality: sleepIsFilled,
  energyLevels: energyIsFilled,
  hydrationHabits: hydrationIsFilled,
  situationDescription: situationDescriptionIsFilled,
};

// ===== PLUMBING — skip unless debugging =====

function heightObjectHasFeetOrInches(height) {
  const feet = height.feet;
  const inches = height.inches;
  if (feet != null && feet !== '' && Number.isFinite(Number(feet))) return true;
  if (inches != null && inches !== '' && Number.isFinite(Number(inches))) return true;
  return false;
}

function heightObjectHasTotalOrCm(height) {
  if (height.totalInches != null && Number(height.totalInches) > 0) return true;
  if (height.cm != null && Number(height.cm) > 0) return true;
  return false;
}

function numericHeightStringIsInRange(height) {
  const numericHeight = Number(String(height).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(numericHeight)) return false;
  if (numericHeight < MIN_HEIGHT_INCHES) return false;
  if (numericHeight > MAX_HEIGHT_INCHES) return false;
  return true;
}

function userHasHeightValue(height) {
  if (height == null) return false;

  if (typeof height === 'object') {
    if (heightObjectHasFeetOrInches(height)) return true;
    if (heightObjectHasTotalOrCm(height)) return true;
    return false;
  }

  return numericHeightStringIsInRange(height);
}
