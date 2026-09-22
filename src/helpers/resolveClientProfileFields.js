// Reconciles a client's profile from several sources that each use different key names.
// Flow: normalizeClientProfileFields maps legacy aliases (goal→primaryGoal, frequency→daysPerWeek)
//       onto today's keys → resolveClientProfileFields merges many such sources, later non-empty wins.
// Used wherever a profile is displayed or fed to the AI; loadCachedOnboardingProfile supplies the offline copy.

// The canonical field names the profile UI reads, including the legacy aliases we still
// accept as input. Listing them explicitly gives these keys first-class merge treatment
// before the generic pass copies everything else.
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

// The emptiness test that drives every merge decision in this file. Broader than a plain
// falsy check because "empty" shows up in four different disguises here.
function isEmptyProfileValue(value) {
  if (value == null || value === '') return true;
  // Display placeholders that older code SAVED into Firestore as if they were data.
  // Without this, "Not set" would win a merge over a real value from another source.
  if (value === '—' || value === 'Not set' || value === 'None selected' || value === 'None reported') {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (!keys.length) return true;
    // Height special case: `{ feet: 0, inches: 0 }` is a non-empty OBJECT but means
    // "never answered". Treat it as empty so a cached real height can win instead.
    if ('feet' in value || 'inches' in value || 'cm' in value) {
      const ft = Number(value.feet ?? value.ft ?? 0);
      const inch = Number(value.inches ?? value.in ?? 0);
      const cm = Number(value.cm ?? value.CM ?? 0);
      // Any one positive dimension makes it real (5'0" has inches: 0 but feet: 5).
      return !(ft > 0 || inch > 0 || cm > 0);
    }
  }
  return false;
}

/**
 * Map legacy / alternate onboarding keys to what the profile UI expects.
 */
// Rewrites one source document into today's key names. Everything downstream can then
// assume `primaryGoal`/`fitnessLevel`/`daysPerWeek`/`equipmentAccess` exist if the data does.
// Non-destructive: the legacy keys are left in place, just no longer load-bearing.
export function normalizeClientProfileFields(doc) {
  if (!doc || typeof doc !== 'object') return {};

  // Work on a copy so the caller's object is never mutated.
  let d = { ...doc };
  // Flatten the nested onboarding blob up to the top level. Spread order matters:
  // `{ ...onboardingData, ...d }` puts the OUTER doc second, so top-level fields win
  // over the onboarding snapshot (which is older by definition).
  if (d.onboardingData && typeof d.onboardingData === 'object' && !Array.isArray(d.onboardingData)) {
    d = { ...d.onboardingData, ...d };
    delete d.onboardingData;
  }

  // Alias resolution, one field at a time. Each block only fires when the modern key is
  // empty, so real data is never overwritten by a stale alias.

  // Goal: singular `goal` first, else the first entry of the `goals` array.
  if (isEmptyProfileValue(d.primaryGoal)) {
    if (!isEmptyProfileValue(d.goal)) d.primaryGoal = d.goal;
    else if (Array.isArray(d.goals) && d.goals.length) d.primaryGoal = d.goals[0];
  }

  // Fitness level used to be stored as `experience`.
  if (isEmptyProfileValue(d.fitnessLevel) && !isEmptyProfileValue(d.experience)) {
    d.fitnessLevel = d.experience;
  }

  // Training frequency has had three names across app versions.
  if (isEmptyProfileValue(d.daysPerWeek)) {
    if (!isEmptyProfileValue(d.frequency)) d.daysPerWeek = d.frequency;
    else if (!isEmptyProfileValue(d.workoutsPerWeek)) d.daysPerWeek = d.workoutsPerWeek;
  }

  // Equipment is the messiest: it may be a modern array, a legacy array under a different
  // name, or a comma-joined string. The string branch splits it into the array shape the
  // UI expects, so callers never have to handle both.
  if (isEmptyProfileValue(d.equipmentAccess)) {
    if (Array.isArray(d.availableEquipment) && d.availableEquipment.length) {
      d.equipmentAccess = d.availableEquipment;
    } else if (!isEmptyProfileValue(d.equipment) && typeof d.equipment === 'string') {
      d.equipmentAccess = d.equipment.split(',').map((p) => p.trim()).filter(Boolean);
    }
  }

  // Display name: rebuild from first/last when the combined `name` was never written.
  // filter(Boolean) prevents a lone last name from producing a leading space.
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
// Merges any number of profile sources. Call it least-trusted-first
// (e.g. cache, then AuthGate userData, then Firestore) because later non-empty values overwrite earlier ones.
// The empty-value skip is what makes this different from Object.assign: a later source
// with a blank field will NOT erase a good value an earlier source provided.
export function resolveClientProfileFields(...sources) {
  const merged = {};
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    // Normalize each source before comparing, so a legacy `goal` from the cache can
    // correctly fill in for a missing `primaryGoal` from Firestore.
    const normalized = normalizeClientProfileFields(source);
    // Pass 1 — the known profile keys.
    for (const key of PROFILE_FIELD_KEYS) {
      if (!(key in normalized)) continue;
      if (!isEmptyProfileValue(normalized[key])) {
        merged[key] = normalized[key];
      }
    }
    // Pass 2 — everything else the source happens to carry (subscription flags, trainerId,
    // timestamps). `continue` skips the keys pass 1 already handled so they aren't re-copied.
    for (const [key, value] of Object.entries(normalized)) {
      if (PROFILE_FIELD_KEYS.includes(key)) continue;
      if (!isEmptyProfileValue(value)) merged[key] = value;
    }
  }
  // Normalize ONCE MORE at the end: the merge can combine a `firstName` from one source
  // with a `lastName` from another, and only now can those be joined into `name`.
  return normalizeClientProfileFields(merged);
}

/**
 * @param {string} uid
 * @param {import('@react-native-async-storage/async-storage').default} AsyncStorage
 */
// Reads the offline profile copy so screens can render instantly before Firestore responds.
// AsyncStorage is passed IN rather than imported, which keeps this module usable from
// tests and non-React-Native contexts.
export async function loadCachedOnboardingProfile(uid, AsyncStorage) {
  if (!uid || !AsyncStorage?.getItem) return null;
  // Two keys tried in priority order: the onboarding answers are richer, so they win;
  // the auth profile is the thinner fallback.
  // Manipulate here: these key names must match whatever writes the cache, or the
  //                  offline profile silently disappears
  const keys = [`onboarding_data_${uid}`, `auth_profile_${uid}`];
  for (const key of keys) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Corrupt JSON in one key shouldn't block the other — a bad cache should
      // degrade to "no cache", never crash the screen.
      /* try next key */
    }
  }
  return null;
}
