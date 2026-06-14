/**
 * Profile card visibility — only show cards for onboarding fields the user actually answered.
 * Shared by ClientApp + TrainerApp (WorkoutPlanGeneratorScreen).
 */

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

function hasHeightValue(height) {
  if (height == null) return false;
  if (typeof height === 'object') {
    const ft = height.feet;
    const inches = height.inches;
    if (ft != null && ft !== '' && Number.isFinite(Number(ft))) return true;
    if (inches != null && inches !== '' && Number.isFinite(Number(inches))) return true;
    if (height.totalInches != null && Number(height.totalInches) > 0) return true;
    if (height.cm != null && Number(height.cm) > 0) return true;
    return false;
  }
  const n = Number(String(height).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n >= 36 && n <= 96;
}

/** True when the user provided this field during onboarding (or saved it since). */
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

export function resolveProfileCardFieldKey(item) {
  return PROFILE_CARD_FIELD_KEY[item?.id] || item?.editKey || item?.id;
}

export function filterProfileCardItems(items, onboardingData) {
  return (items || []).filter((item) =>
    hasOnboardingFieldData(resolveProfileCardFieldKey(item), onboardingData),
  );
}

export function filterProfileCardSections(sections, onboardingData) {
  return (sections || [])
    .map((sec) => ({
      ...sec,
      items: filterProfileCardItems(sec.items, onboardingData),
    }))
    .filter((sec) => sec.items.length > 0);
}

export function getProfileCardSectionLabels(onboardingData) {
  const labels = [];
  if (PERSONAL_FIELDS.some((key) => hasOnboardingFieldData(key, onboardingData))) {
    labels.push('Personal');
  }
  if (TRAINING_FIELDS.some((key) => hasOnboardingFieldData(key, onboardingData))) {
    labels.push('Training');
  }
  if (RECOVERY_FIELDS.some((key) => hasOnboardingFieldData(key, onboardingData))) {
    labels.push('Recovery');
  }
  return labels;
}
