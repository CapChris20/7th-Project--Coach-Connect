/**
 * profile Card Icons
 *
 * Purpose: UI screen or component: profile Card Icons. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: PROFILE_CARD_ICON_SIZE, PROFILE_CARD_ICON_WRAP, PROFILE_ROW_ICON_SIZE, PROFILE_ROW_ICON_WRAP, PROFILE_CARD_ICON_ASSETS, PROFILE_FIELD_ICON_ID, resolveProfileCardIconSource, profileCardIconWrapStyle
 *
 * @file-header
 */
import { getOnboardingIconSource } from '../assets/onboardingIconRegistry';

/** Shared profile-card PNG sizing (ClientApp + TrainerApp workout screens). */
export const PROFILE_CARD_ICON_SIZE = 40;
export const PROFILE_CARD_ICON_WRAP = 58;
export const PROFILE_ROW_ICON_SIZE = 32;
export const PROFILE_ROW_ICON_WRAP = 44;

/** Static PNG assets for recovery / lifestyle profile fields. */
export const PROFILE_CARD_ICON_ASSETS = {
  goal: require('../../assets/icons/dumbbell.png'),
  frequency: require('../../assets/icons/Schedule.png'),
  trainingEnvironment: require('../../assets/icons/enviro.png'),
  preferredWorkoutTime: require('../../assets/icons/Schedule.png'),
  exercisesDislike: require('../../assets/icons/banned.png'),
  injuries: require('../../assets/icons/injury.png'),
  supplements: require('../../assets/icons/supplement.png'),
  stress: require('../../assets/icons/stress.png'),
  sleep: require('../../assets/icons/sleeping.png'),
  energy: require('../../assets/icons/energy.png'),
  hydration: require('../../assets/icons/hydration.png'),
  journey: require('../../assets/icons/journey.png'),
};

/** Maps workout plan builder field keys → profile card icon ids. */
export const PROFILE_FIELD_ICON_ID = {
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

export const resolveProfileCardIconSource = (itemId, onboardingData) => {
  switch (itemId) {
    case 'age':
      return getOnboardingIconSource('age');
    case 'gender':
      return getOnboardingIconSource(onboardingData?.gender);
    case 'height':
      return getOnboardingIconSource('height');
    case 'weight':
      return getOnboardingIconSource('weight') || getOnboardingIconSource('scales');
    case 'fitnessLevel':
      return getOnboardingIconSource(onboardingData?.fitnessLevel);
    case 'equipment': {
      const list = onboardingData?.equipmentAccess;
      const first = Array.isArray(list) && list.length ? list[0] : null;
      return (
        (first && getOnboardingIconSource(first)) ||
        getOnboardingIconSource('dumbbells') ||
        PROFILE_CARD_ICON_ASSETS.goal
      );
    }
    default:
      return PROFILE_CARD_ICON_ASSETS[itemId] || null;
  }
};

export const profileCardIconWrapStyle = (isDark, { wrapSize = PROFILE_CARD_ICON_WRAP } = {}) => ({
  width: wrapSize,
  height: wrapSize,
  borderRadius: Math.round(wrapSize * 0.31),
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
});
