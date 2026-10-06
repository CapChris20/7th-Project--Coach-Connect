// Reconciles a client profile when each source uses different key names.
// Flow: map legacy aliases onto today's keys → merge sources left to right, later non-empty wins → map aliases once more.
// Used by profile screens, the AI plan request, and LoginGate. The offline copy is read from AsyncStorage.

// ===== NAMED CONSTANTS =====

// Today's names plus the legacy aliases we still accept. Known keys are copied first.
// Everything else (subscription flags, trainerId, timestamps) is copied in a second pass.
const PROFILE_FIELD_KEYS = [
  'name',
  'firstName',
  'lastName',
  'email',
  'age',
  'height',
  'weight',
  'gender',
  'primaryGoal',
  'goals',
  'goal',
  'fitnessLevel',
  'experience',
  'daysPerWeek',
  'frequency',
  'workoutsPerWeek',
  'equipmentAccess',
  'equipment',
  'availableEquipment',
  'injuries',
  'trainingEnvironment',
  'preferredWorkoutTime',
  'photoURL',
];

// Older builds saved these words into Firestore as if they were answers.
const EMPTY_PROFILE_PLACEHOLDER_A = '—';
const EMPTY_PROFILE_PLACEHOLDER_B = 'Not set';
const EMPTY_PROFILE_PLACEHOLDER_C = 'None selected';
const EMPTY_PROFILE_PLACEHOLDER_D = 'None reported';

// Manipulate here: these key names must match whatever writes the cache, or the offline profile disappears.
const ONBOARDING_CACHE_KEY_PREFIX = 'onboarding_data_';
const AUTH_PROFILE_CACHE_KEY_PREFIX = 'auth_profile_';

// ===== HELPER FUNCTIONS =====

function isPlaceholderProfileText(value) {
  return (
    value === EMPTY_PROFILE_PLACEHOLDER_A ||
    value === EMPTY_PROFILE_PLACEHOLDER_B ||
    value === EMPTY_PROFILE_PLACEHOLDER_C ||
    value === EMPTY_PROFILE_PLACEHOLDER_D
  );
}

// { feet: 0, inches: 0 } is a real object but means "never answered".
// 5'0" counts as answered because feet is positive even when inches is 0.
function isBlankHeightRecord(value) {
  const feet = Number(value.feet ?? value.ft ?? 0);
  const inches = Number(value.inches ?? value.in ?? 0);
  const centimeters = Number(value.cm ?? value.CM ?? 0);
  const hasPositiveDimension = feet > 0 || inches > 0 || centimeters > 0;
  return !hasPositiveDimension;
}

function isEmptyProfileValue(value) {
  if (value == null || value === '') return true;
  if (isPlaceholderProfileText(value)) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (!keys.length) return true;
    const isHeightShape = 'feet' in value || 'inches' in value || 'cm' in value;
    if (isHeightShape) return isBlankHeightRecord(value);
  }
  return false;
}

// Spread order puts the outer doc last, so a top-level field beats the older nested snapshot.
function liftNestedOnboardingData(profile) {
  const nestedAnswers = profile.onboardingData;
  const hasNestedObject = Boolean(
    nestedAnswers && typeof nestedAnswers === 'object' && !Array.isArray(nestedAnswers),
  );
  if (!hasNestedObject) return profile;

  const lifted = { ...nestedAnswers, ...profile };
  delete lifted.onboardingData;
  return lifted;
}

function fillPrimaryGoalFromAliases(profile) {
  if (!isEmptyProfileValue(profile.primaryGoal)) return profile;
  if (!isEmptyProfileValue(profile.goal)) {
    profile.primaryGoal = profile.goal;
    return profile;
  }
  if (Array.isArray(profile.goals) && profile.goals.length) {
    profile.primaryGoal = profile.goals[0];
  }
  return profile;
}

function fillFitnessLevelFromExperience(profile) {
  const needsFitnessLevel = isEmptyProfileValue(profile.fitnessLevel);
  const hasExperience = !isEmptyProfileValue(profile.experience);
  if (needsFitnessLevel && hasExperience) {
    profile.fitnessLevel = profile.experience;
  }
  return profile;
}

function fillDaysPerWeekFromAliases(profile) {
  if (!isEmptyProfileValue(profile.daysPerWeek)) return profile;
  if (!isEmptyProfileValue(profile.frequency)) {
    profile.daysPerWeek = profile.frequency;
    return profile;
  }
  if (!isEmptyProfileValue(profile.workoutsPerWeek)) {
    profile.daysPerWeek = profile.workoutsPerWeek;
  }
  return profile;
}

function fillEquipmentAccessFromAliases(profile) {
  if (!isEmptyProfileValue(profile.equipmentAccess)) return profile;
  if (Array.isArray(profile.availableEquipment) && profile.availableEquipment.length) {
    profile.equipmentAccess = profile.availableEquipment;
    return profile;
  }
  const hasEquipmentString = !isEmptyProfileValue(profile.equipment) && typeof profile.equipment === 'string';
  if (hasEquipmentString) {
    profile.equipmentAccess = profile.equipment
      .split(',')
      .map((equipmentName) => equipmentName.trim())
      .filter(Boolean);
  }
  return profile;
}

function fillNameFromFirstAndLast(profile) {
  if (!isEmptyProfileValue(profile.name)) return profile;
  // filter(Boolean) drops a missing first or last name so we don't save a leading space.
  const combinedName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  if (combinedName) profile.name = combinedName;
  return profile;
}

function copyKnownProfileFields(merged, normalized) {
  for (const key of PROFILE_FIELD_KEYS) {
    if (!(key in normalized)) continue;
    if (!isEmptyProfileValue(normalized[key])) {
      merged[key] = normalized[key];
    }
  }
}

function copyExtraProfileFields(merged, normalized) {
  for (const [key, value] of Object.entries(normalized)) {
    if (PROFILE_FIELD_KEYS.includes(key)) continue;
    if (!isEmptyProfileValue(value)) merged[key] = value;
  }
}

function onboardingCacheKey(uid) {
  return `${ONBOARDING_CACHE_KEY_PREFIX}${uid}`;
}

function authProfileCacheKey(uid) {
  return `${AUTH_PROFILE_CACHE_KEY_PREFIX}${uid}`;
}

// A bad JSON blob returns null so the caller can try the next key. It must not throw.
async function readCachedProfile(AsyncStorage, storageKey) {
  try {
    const rawText = await AsyncStorage.getItem(storageKey);
    if (!rawText) return null;
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed === 'object') return parsed;
    return null;
  } catch {
    return null;
  }
}

// ===== MAIN FUNCTION =====

/**
 * Map legacy onboarding keys onto the names the profile UI reads.
 * Legacy keys are left in place. They are just no longer required.
 * @param {object} doc
 * @returns {object}
 */
export function normalizeClientProfileFields(doc) {
  if (!doc || typeof doc !== 'object') return {};

  let profile = { ...doc };
  profile = liftNestedOnboardingData(profile);
  profile = fillPrimaryGoalFromAliases(profile);
  profile = fillFitnessLevelFromExperience(profile);
  profile = fillDaysPerWeekFromAliases(profile);
  profile = fillEquipmentAccessFromAliases(profile);
  profile = fillNameFromFirstAndLast(profile);
  return profile;
}

/**
 * Merge profile sources left to right. Later non-empty values win.
 * Pass the least trusted source first (cache, then the signed-in profile, then Firestore).
 * A later blank field does not erase a good value from an earlier source.
 * @param {...(object|null|undefined)} sources
 * @returns {object}
 */
export function fillTraineeProfile(...sources) {
  const merged = {};
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const normalized = normalizeClientProfileFields(source);
    copyKnownProfileFields(merged, normalized);
    copyExtraProfileFields(merged, normalized);
  }
  // One more pass: firstName from one source and lastName from another can only form `name` now.
  return normalizeClientProfileFields(merged);
}

/**
 * Read the offline profile so a screen can render before Firestore answers.
 * AsyncStorage is passed in so tests and non-app callers can supply their own storage.
 * @param {string} uid
 * @param {{ getItem: (key: string) => Promise<string|null> }} AsyncStorage
 * @returns {Promise<object|null>}
 */
export async function loadCachedOnboardingProfile(uid, AsyncStorage) {
  if (!uid || !AsyncStorage?.getItem) return null;

  // Onboarding answers are richer, so they are tried before the thinner auth profile.
  const storageKeys = [onboardingCacheKey(uid), authProfileCacheKey(uid)];
  for (const storageKey of storageKeys) {
    const cachedProfile = await readCachedProfile(AsyncStorage, storageKey);
    if (cachedProfile) return cachedProfile;
  }
  return null;
}
