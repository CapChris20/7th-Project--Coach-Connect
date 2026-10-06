// Pictures and box sizes for the profile cards on the workout screens.
// Flow: map a field name to an icon → fall back to the onboarding art → size the box around it.
// Used by the client and trainer profile cards.

import { getOnboardingIconSource } from './setup-icons/onboardingIconRegistry';

// ===== NAMED CONSTANTS =====

const PROFILE_CARD_ICON_SIZE = 40;
const PROFILE_CARD_ICON_WRAP = 58;
const PROFILE_ROW_ICON_SIZE = 32;
const PROFILE_ROW_ICON_WRAP = 44;
const ICON_CORNER_RATIO = 0.31;
const DARK_ICON_BACKGROUND = 'rgba(255,255,255,0.05)';
const LIGHT_ICON_BACKGROUND = 'rgba(15,23,42,0.04)';

const PROFILE_CARD_ICON_ASSETS = {
  goal: require('../assets/icons/dumbbell.png'),
  frequency: require('../assets/icons/Schedule.png'),
  trainingEnvironment: require('../assets/icons/enviro.png'),
  preferredWorkoutTime: require('../assets/icons/Schedule.png'),
  exercisesDislike: require('../assets/icons/banned.png'),
  injuries: require('../assets/icons/injury.png'),
  supplements: require('../assets/icons/supplement.png'),
  stress: require('../assets/icons/stress.png'),
  sleep: require('../assets/icons/sleeping.png'),
  energy: require('../assets/icons/energy.png'),
  hydration: require('../assets/icons/hydration.png'),
  journey: require('../assets/icons/journey.png'),
};

const PROFILE_FIELD_ICON_ID = {
  age: 'age',
  gender: 'gender',
  height: 'height',
  weight: 'weight',
  personalInfo: 'age',
  fitnessLevel: 'fitnessLevel',
  goal: 'goal',
  primaryGoal: 'goal',
  equipment: 'equipment',
  daysPerWeek: 'frequency',
  frequency: 'frequency',
  trainingEnvironment: 'trainingEnvironment',
  preferredWorkoutTime: 'preferredWorkoutTime',
  exercisesDislike: 'exercisesDislike',
  injuries: 'injuries',
  supplementsCurrentlyTaking: 'supplements',
  currentStressLevel: 'stress',
  sleepQuality: 'sleep',
  energyLevels: 'energy',
  hydrationHabits: 'hydration',
  situationDescription: 'journey',
};

// ===== HELPER FUNCTIONS =====

/**
 * Equipment is a list. The card shows the first item, then a dumbbell, then the goal picture.
 * @param {object|undefined} onboardingData
 * @returns {object|null}
 */
function equipmentIconSource(onboardingData) {
  const equipmentList = onboardingData?.equipmentAccess;
  const hasEquipment = Array.isArray(equipmentList) && equipmentList.length > 0;
  const firstEquipment = hasEquipment ? equipmentList[0] : null;
  if (firstEquipment) {
    const equipmentIcon = getOnboardingIconSource(firstEquipment);
    if (equipmentIcon) return equipmentIcon;
  }
  return getOnboardingIconSource('dumbbells') || PROFILE_CARD_ICON_ASSETS.goal;
}

// ===== MAIN FUNCTION =====

/**
 * @param {string} itemId
 * @param {object|undefined} onboardingData
 * @returns {object|null}
 */
export const resolveProfileIconSource = (itemId, onboardingData) => {
  if (itemId === 'age') return getOnboardingIconSource('age');
  if (itemId === 'gender') return getOnboardingIconSource(onboardingData?.gender);
  if (itemId === 'height') return getOnboardingIconSource('height');
  if (itemId === 'weight') {
    return getOnboardingIconSource('weight') || getOnboardingIconSource('scales');
  }
  if (itemId === 'fitnessLevel') return getOnboardingIconSource(onboardingData?.fitnessLevel);
  if (itemId === 'equipment') return equipmentIconSource(onboardingData);
  return PROFILE_CARD_ICON_ASSETS[itemId] || null;
};

/**
 * @param {boolean} isDark
 * @param {{ wrapSize?: number }} [options]
 * @returns {object}
 */
export const profileCardIconWrapStyle = (isDark, { wrapSize = PROFILE_CARD_ICON_WRAP } = {}) => ({
  width: wrapSize,
  height: wrapSize,
  borderRadius: Math.round(wrapSize * ICON_CORNER_RATIO),
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: isDark ? DARK_ICON_BACKGROUND : LIGHT_ICON_BACKGROUND,
});

export {
  PROFILE_CARD_ICON_SIZE,
  PROFILE_CARD_ICON_WRAP,
  PROFILE_ROW_ICON_SIZE,
  PROFILE_ROW_ICON_WRAP,
  PROFILE_CARD_ICON_ASSETS,
  PROFILE_FIELD_ICON_ID,
};
