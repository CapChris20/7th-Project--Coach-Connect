/**
 * Merge client profile / onboarding fields from Firestore, AuthGate userData, and local cache.
 */

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

function isEmptyProfileValue(value) {
  if (value == null || value === '') return true;
  if (value === '—' || value === 'Not set' || value === 'None selected' || value === 'None reported') {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (!keys.length) return true;
    if ('feet' in value || 'inches' in value || 'cm' in value) {
      const ft = Number(value.feet ?? value.ft ?? 0);
      const inch = Number(value.inches ?? value.in ?? 0);
      const cm = Number(value.cm ?? value.CM ?? 0);
      return !(ft > 0 || inch > 0 || cm > 0);
    }
  }
  return false;
}

/**
 * Map legacy / alternate onboarding keys to what the profile UI expects.
 */
export function normalizeClientProfileFields(doc) {
  if (!doc || typeof doc !== 'object') return {};

  let d = { ...doc };
  if (d.onboardingData && typeof d.onboardingData === 'object' && !Array.isArray(d.onboardingData)) {
    d = { ...d.onboardingData, ...d };
    delete d.onboardingData;
  }

  if (isEmptyProfileValue(d.primaryGoal)) {
    if (!isEmptyProfileValue(d.goal)) d.primaryGoal = d.goal;
    else if (Array.isArray(d.goals) && d.goals.length) d.primaryGoal = d.goals[0];
  }

  if (isEmptyProfileValue(d.fitnessLevel) && !isEmptyProfileValue(d.experience)) {
    d.fitnessLevel = d.experience;
  }

  if (isEmptyProfileValue(d.daysPerWeek)) {
    if (!isEmptyProfileValue(d.frequency)) d.daysPerWeek = d.frequency;
    else if (!isEmptyProfileValue(d.workoutsPerWeek)) d.daysPerWeek = d.workoutsPerWeek;
  }

  if (isEmptyProfileValue(d.equipmentAccess)) {
    if (Array.isArray(d.availableEquipment) && d.availableEquipment.length) {
      d.equipmentAccess = d.availableEquipment;
    } else if (!isEmptyProfileValue(d.equipment) && typeof d.equipment === 'string') {
      d.equipmentAccess = d.equipment.split(',').map((p) => p.trim()).filter(Boolean);
    }
  }

  if (isEmptyProfileValue(d.name)) {
    const combined = [d.firstName, d.lastName].filter(Boolean).join(' ').trim();
    if (combined) d.name = combined;
  }

  return d;
}

/**
 * Merge profile sources left-to-right; later non-empty values win (Firestore over cache).
 * @param {...(object|null|undefined)} sources
 */
export function resolveClientProfileFields(...sources) {
  const merged = {};
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const normalized = normalizeClientProfileFields(source);
    for (const key of PROFILE_FIELD_KEYS) {
      if (!(key in normalized)) continue;
      if (!isEmptyProfileValue(normalized[key])) {
        merged[key] = normalized[key];
      }
    }
    for (const [key, value] of Object.entries(normalized)) {
      if (PROFILE_FIELD_KEYS.includes(key)) continue;
      if (!isEmptyProfileValue(value)) merged[key] = value;
    }
  }
  return normalizeClientProfileFields(merged);
}

/**
 * @param {string} uid
 * @param {import('@react-native-async-storage/async-storage').default} AsyncStorage
 */
export async function loadCachedOnboardingProfile(uid, AsyncStorage) {
  if (!uid || !AsyncStorage?.getItem) return null;
  const keys = [`onboarding_data_${uid}`, `auth_profile_${uid}`];
  for (const key of keys) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      /* try next key */
    }
  }
  return null;
}
