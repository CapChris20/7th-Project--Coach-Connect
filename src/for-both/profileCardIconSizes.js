// Pictures and box sizes for the profile cards on the workout screens.
// Flow: map a field name to an icon → fall back to the onboarding art → size the box around it.
// Used by the client and trainer profile cards.
// Read order: constants → resolveProfileIconSource / wrap style → PLUMBING (onboarding + equipment).

import { getOnboardingIconSource } from './setup-icons/onboardingIconRegistry';

// ===== NAMED CONSTANTS =====

// Manipulate here: default icon and wrapper sizes on the big profile card vs compact rows
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

// Field id on the card → onboarding / static icon key. Letters stay for callers.
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

const ONBOARDING_METRIC_ITEM_IDS = {
  age: true,
  gender: true,
  height: true,
  weight: true,
  fitnessLevel: true,
};

// ===== MAIN FUNCTION =====

/**
 * Picture for one profile-card field. Onboarding art first, then the static PNG map.
 * @param {string} itemId
 * @param {object|undefined} onboardingData
 * @returns {object|null}
 */
export function resolveProfileIconSource(itemId, onboardingData) {
  // 1. Body metrics and fitness level pull from onboarding icon art.
  if (ONBOARDING_METRIC_ITEM_IDS[itemId]) {
    return onboardingDrivenIcon(itemId, onboardingData);
  }

  // 2. Equipment uses their first listed item, then dumbbell, then goal PNG.
  if (itemId === 'equipment') {
    return equipmentIconSource(onboardingData);
  }

  // 3. Everything else is the static PNG map, or null when we have no art.
  return PROFILE_CARD_ICON_ASSETS[itemId] || null;
}

/**
 * Rounded square behind a profile icon — background tint follows light/dark theme.
 * @param {boolean} isDark
 * @param {{ wrapSize?: number }} [options]
 * @returns {object}
 */
export function profileCardIconWrapStyle(isDark, { wrapSize = PROFILE_CARD_ICON_WRAP } = {}) {
  // 1. Dark cards get a faint white tint; light cards get a faint slate tint.
  let iconBackground = LIGHT_ICON_BACKGROUND;
  if (isDark) iconBackground = DARK_ICON_BACKGROUND;

  // 2. Corner radius scales with the wrap so big and compact rows stay proportional.
  const cornerRadius = Math.round(wrapSize * ICON_CORNER_RATIO);

  return {
    width: wrapSize,
    height: wrapSize,
    borderRadius: cornerRadius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: iconBackground,
  };
}

export {
  PROFILE_CARD_ICON_SIZE,
  PROFILE_CARD_ICON_WRAP,
  PROFILE_ROW_ICON_SIZE,
  PROFILE_ROW_ICON_WRAP,
  PROFILE_CARD_ICON_ASSETS,
  PROFILE_FIELD_ICON_ID,
};

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging icon lookup paths =====

function onboardingDrivenIcon(itemId, onboardingData) {
  if (itemId === 'age') return getOnboardingIconSource('age');
  if (itemId === 'gender') return getOnboardingIconSource(onboardingData?.gender);
  if (itemId === 'height') return getOnboardingIconSource('height');
  if (itemId === 'fitnessLevel') return getOnboardingIconSource(onboardingData?.fitnessLevel);

  if (itemId === 'weight') {
    return weightIconWithScalesFallback();
  }

  return null;
}

function weightIconWithScalesFallback() {
  const weightIcon = getOnboardingIconSource('weight');
  if (weightIcon) return weightIcon;
  return getOnboardingIconSource('scales');
}

/**
 * Equipment is a list. The card shows the first item, then a dumbbell, then the goal picture.
 * @param {object|undefined} onboardingData
 * @returns {object|null}
 */
function equipmentIconSource(onboardingData) {
  const firstEquipmentIcon = iconForFirstListedEquipment(onboardingData);
  if (firstEquipmentIcon) return firstEquipmentIcon;

  const dumbbellIcon = getOnboardingIconSource('dumbbells');
  if (dumbbellIcon) return dumbbellIcon;

  return PROFILE_CARD_ICON_ASSETS.goal;
}

function iconForFirstListedEquipment(onboardingData) {
  const equipmentList = onboardingData?.equipmentAccess;
  const listIsUsable = Array.isArray(equipmentList) && equipmentList.length > 0;
  if (!listIsUsable) return null;

  const firstEquipment = equipmentList[0];
  return getOnboardingIconSource(firstEquipment) || null;
}
