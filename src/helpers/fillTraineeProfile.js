// Reconciles a client profile when each source uses different key names.
// Flow: map legacy aliases onto today's keys → merge sources left to right, later non-empty wins → map aliases once more.
// Used by profile screens, the AI plan request, and LoginGate. The offline copy is read from AsyncStorage.
// Read order: constants → helpers → numbered mains. Profile / cache key letters stay frozen.

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

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlaceholderProfileText(value) {
  if (value === EMPTY_PROFILE_PLACEHOLDER_A) return true;
  if (value === EMPTY_PROFILE_PLACEHOLDER_B) return true;
  if (value === EMPTY_PROFILE_PLACEHOLDER_C) return true;
  if (value === EMPTY_PROFILE_PLACEHOLDER_D) return true;
  return false;
}

/**
 * { feet: 0, inches: 0 } is a real object but means "never answered".
 * 5'0" counts as answered because feet is positive even when inches is 0.
 * @param {object} value
 * @returns {boolean}
 */
function isBlankHeightRecord(value) {
  // vocab/symbol: ?? = use the right side only when left is null/undefined (0 must survive)
  const feet = Number(value.feet ?? value.ft ?? 0);
  const inches = Number(value.inches ?? value.in ?? 0);
  const centimeters = Number(value.cm ?? value.CM ?? 0);
  const hasPositiveDimension = feet > 0 || inches > 0 || centimeters > 0;
  return !hasPositiveDimension;
}

/**
 * True when a height-shaped object has no positive dimension.
 * @param {object} value
 * @returns {boolean}
 */
function objectLooksLikeBlankHeight(value) {
  const isHeightShape =
    'feet' in value || 'inches' in value || 'cm' in value;
  if (!isHeightShape) return false;
  return isBlankHeightRecord(value);
}

/**
 * True when a value should not overwrite a better answer from an earlier source.
 * @param {*} value
 * @returns {boolean}
 */
function isEmptyProfileValue(value) {
  if (value == null || value === '') return true;
  if (isPlaceholderProfileText(value)) return true;
  if (Array.isArray(value) && value.length === 0) return true;

  const isPlainObject =
    typeof value === 'object' && !Array.isArray(value);
  if (!isPlainObject) return false;

  const keys = Object.keys(value);
  if (!keys.length) return true;
  return objectLooksLikeBlankHeight(value);
}

/**
 * Spread order puts the outer doc last, so a top-level field beats the older nested snapshot.
 * @param {object} profile
 * @returns {object}
 */
function liftNestedOnboardingData(profile) {
  const nestedAnswers = profile.onboardingData;
  const hasNestedObject = Boolean(
    nestedAnswers &&
      typeof nestedAnswers === 'object' &&
      !Array.isArray(nestedAnswers),
  );
  if (!hasNestedObject) return profile;

  const lifted = { ...nestedAnswers, ...profile };
  delete lifted.onboardingData;
  return lifted;
}

/**
 * @param {object} profile
 * @returns {object}
 */
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

/**
 * @param {object} profile
 * @returns {object}
 */
function fillFitnessLevelFromExperience(profile) {
  const needsFitnessLevel = isEmptyProfileValue(profile.fitnessLevel);
  const hasExperience = !isEmptyProfileValue(profile.experience);
  if (needsFitnessLevel && hasExperience) {
    profile.fitnessLevel = profile.experience;
  }
  return profile;
}

/**
 * @param {object} profile
 * @returns {object}
 */
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

/**
 * @param {object} profile
 * @returns {object}
 */
function fillEquipmentAccessFromAliases(profile) {
  if (!isEmptyProfileValue(profile.equipmentAccess)) return profile;

  if (Array.isArray(profile.availableEquipment) && profile.availableEquipment.length) {
    profile.equipmentAccess = profile.availableEquipment;
    return profile;
  }

  const hasEquipmentString =
    !isEmptyProfileValue(profile.equipment) &&
    typeof profile.equipment === 'string';
  if (hasEquipmentString) {
    profile.equipmentAccess = profile.equipment
      .split(',')
      .map((equipmentName) => equipmentName.trim())
      .filter(Boolean);
  }
  return profile;
}

/**
 * @param {object} profile
 * @returns {object}
 */
function fillNameFromFirstAndLast(profile) {
  if (!isEmptyProfileValue(profile.name)) return profile;
  // filter(Boolean) drops a missing first or last name so we don't save a leading space.
  const combinedName = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (combinedName) profile.name = combinedName;
  return profile;
}

/**
 * @param {object} merged
 * @param {object} normalized
 */
function copyKnownProfileFields(merged, normalized) {
  for (const key of PROFILE_FIELD_KEYS) {
    if (!(key in normalized)) continue;
    if (!isEmptyProfileValue(normalized[key])) {
      merged[key] = normalized[key];
    }
  }
}

/**
 * @param {object} merged
 * @param {object} normalized
 */
function copyExtraProfileFields(merged, normalized) {
  for (const [key, value] of Object.entries(normalized)) {
    if (PROFILE_FIELD_KEYS.includes(key)) continue;
    if (!isEmptyProfileValue(value)) merged[key] = value;
  }
}

/**
 * @param {string} uid
 * @returns {string}
 */
function onboardingCacheKeyForUid(uid) {
  return `${ONBOARDING_CACHE_KEY_PREFIX}${uid}`;
}

/**
 * @param {string} uid
 * @returns {string}
 */
function authProfileCacheKeyForUid(uid) {
  return `${AUTH_PROFILE_CACHE_KEY_PREFIX}${uid}`;
}

/**
 * A bad JSON blob returns null so the caller can try the next key. It must not throw.
 * @param {{ getItem: (key: string) => Promise<string|null> }} AsyncStorage
 * @param {string} storageKey
 * @returns {Promise<object|null>}
 */
async function readCachedProfileJson(AsyncStorage, storageKey) {
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

/**
 * Merge one source into the running profile. Later non-empty values win.
 * @param {object} merged
 * @param {object|null|undefined} source
 */
function mergeOneProfileSourceInto(merged, source) {
  if (!source || typeof source !== 'object') return;
  const normalized = normalizeClientProfileFields(source);
  copyKnownProfileFields(merged, normalized);
  copyExtraProfileFields(merged, normalized);
}

// ===== MAIN FUNCTION =====

/**
 * Map legacy onboarding keys onto the names the profile UI reads.
 * Legacy keys are left in place. They are just no longer required.
 * @param {object} doc
 * @returns {object}
 */
export function normalizeClientProfileFields(doc) {
  // 1. Guard: a missing or non-object doc becomes an empty profile.
  if (!doc || typeof doc !== 'object') return {};

  // 2. Work on a copy so callers keep their original object untouched.
  let profile = { ...doc };

  // 3. Lift nested onboardingData so top-level fields beat the older nested snapshot.
  profile = liftNestedOnboardingData(profile);

  // 4. Fill today's canonical fields from legacy spellings still sitting on the doc.
  profile = fillPrimaryGoalFromAliases(profile);
  profile = fillFitnessLevelFromExperience(profile);
  profile = fillDaysPerWeekFromAliases(profile);
  profile = fillEquipmentAccessFromAliases(profile);
  profile = fillNameFromFirstAndLast(profile);
  return profile;
}

/**
 * Merge one or more profile/onboarding objects into one trainee profile.
 * Later sources overwrite earlier ones for the same field.
 * Pass the least trusted source first (cache, then the signed-in profile, then Firestore).
 * A later blank field does not erase a good value from an earlier source.
 * @param {...(object|null|undefined)} sources
 * @returns {object}
 */
export function fillTraineeProfile(...sources) {
  const merged = {};

  // 1. Walk each source left to right; later non-empty values win per field.
  for (const source of sources) {
    mergeOneProfileSourceInto(merged, source);
  }

  // 2. One more pass: firstName from one source and lastName from another can only form `name` now.
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
  // 1. Need a user id and a storage object that can read strings.
  if (!uid || !AsyncStorage?.getItem) return null;

  // 2. Onboarding answers are richer, so they are tried before the thinner auth profile.
  const storageKeys = [
    onboardingCacheKeyForUid(uid),
    authProfileCacheKeyForUid(uid),
  ];
  for (const storageKey of storageKeys) {
    const cachedProfile = await readCachedProfileJson(AsyncStorage, storageKey);
    if (cachedProfile) return cachedProfile;
  }
  return null;
}
