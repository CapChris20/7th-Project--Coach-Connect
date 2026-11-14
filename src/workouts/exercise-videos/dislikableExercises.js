// Curated exercise catalog for onboarding "exercises you dislike" multi-select.
// Flow: manual builder seed → extra movements → dedupe by id → category filter or name search.
// Used by the onboarding dislike picker. IDs align with MANUAL_EXERCISE_LIBRARY where possible.

import { MANUAL_EXERCISE_LIBRARY } from '../../trainer-app/workout-plans/builtInExerciseList';

// ===== NAMED CONSTANTS =====

const DEFAULT_DISLIKE_CATEGORY = 'mobility';
const DEFAULT_SEARCH_LIMIT = 200;

/**
 * Category chips shown in the dislike picker. id letters are frozen (Firestore / UI keys).
 * @type {{ id: string, label: string }[]}
 */
export const EXERCISE_DISLIKE_CATEGORIES = [
  { id: 'push', label: 'Chest & Push' },
  { id: 'pull', label: 'Back & Pull' },
  { id: 'legs', label: 'Legs & Glutes' },
  { id: 'core', label: 'Core' },
  { id: 'arms', label: 'Arms' },
  { id: 'cardio', label: 'Cardio & Conditioning' },
  { id: 'machines', label: 'Machines' },
  { id: 'power', label: 'Olympic & Power' },
  { id: 'mobility', label: 'Mobility & Other' },
];

/** Extra movements not already in the manual builder seed. */
const EXTRA_DISLIKE_EXERCISES = [
  { id: 'running', name: 'Running', category: 'cardio' },
  { id: 'treadmill', name: 'Treadmill', category: 'cardio' },
  { id: 'outdoor_run', name: 'Outdoor Running', category: 'cardio' },
  { id: 'sprints', name: 'Sprints', category: 'cardio' },
  { id: 'stair_climber', name: 'Stair Climber', category: 'cardio' },
  { id: 'elliptical', name: 'Elliptical', category: 'cardio' },
  { id: 'stationary_bike', name: 'Stationary Bike', category: 'cardio' },
  { id: 'cycling', name: 'Outdoor Cycling', category: 'cardio' },
  { id: 'swimming', name: 'Swimming', category: 'cardio' },
  { id: 'hiit_circuits', name: 'HIIT Circuits', category: 'cardio' },
  { id: 'jumping_jacks', name: 'Jumping Jacks', category: 'cardio' },
  { id: 'bear_crawl', name: 'Bear Crawl', category: 'cardio' },
  { id: 'sled_pull', name: 'Sled Pull', category: 'cardio' },
  { id: 'wall_ball', name: 'Wall Ball', category: 'cardio' },
  { id: 'thruster', name: 'Thruster', category: 'power' },
  { id: 'clean_jerk', name: 'Clean and Jerk', category: 'power' },
  { id: 'snatch', name: 'Snatch', category: 'power' },
  { id: 'power_clean', name: 'Power Clean', category: 'power' },
  { id: 'jump_squat', name: 'Jump Squat', category: 'legs' },
  { id: 'step_up', name: 'Step-Up', category: 'legs' },
  { id: 'reverse_lunge', name: 'Reverse Lunge', category: 'legs' },
  { id: 'stationary_lunge', name: 'Stationary Lunge', category: 'legs' },
  { id: 'good_morning', name: 'Good Morning', category: 'legs' },
  { id: 'back_extension', name: 'Back Extension', category: 'core' },
  { id: 'hyperextension', name: 'Hyperextension', category: 'core' },
  { id: 'ghd_situp', name: 'GHD Sit-Up', category: 'core' },
  { id: 'v_up', name: 'V-Up', category: 'core' },
  { id: 'russian_twist', name: 'Russian Twist', category: 'core' },
  { id: 'bicycle_crunch', name: 'Bicycle Crunch', category: 'core' },
  { id: 'side_plank', name: 'Side Plank', category: 'core' },
  { id: 'dead_bug', name: 'Dead Bug', category: 'core' },
  { id: 'inverted_row', name: 'Inverted Row', category: 'pull' },
  { id: 'muscle_up', name: 'Muscle-Up', category: 'pull' },
  { id: 'handstand_pushup', name: 'Handstand Push-Up', category: 'push' },
  { id: 'pistol_squat', name: 'Pistol Squat', category: 'legs' },
  { id: 'sissy_squat', name: 'Sissy Squat', category: 'legs' },
  { id: 'nordic_curl', name: 'Nordic Hamstring Curl', category: 'legs' },
  { id: 'chest_press_machine', name: 'Chest Press Machine', category: 'machines' },
  { id: 'shoulder_press_machine', name: 'Shoulder Press Machine', category: 'machines' },
  { id: 'seated_row_machine', name: 'Seated Row Machine', category: 'machines' },
  { id: 'lat_pullover_machine', name: 'Lat Pullover Machine', category: 'machines' },
  { id: 'calf_raise_machine', name: 'Calf Raise Machine', category: 'machines' },
  { id: 'adductor_machine', name: 'Hip Adductor Machine', category: 'machines' },
  { id: 'abductor_machine', name: 'Hip Abductor Machine', category: 'machines' },
  { id: 'smith_bench', name: 'Smith Machine Bench Press', category: 'machines' },
  { id: 'cable_crossover', name: 'Cable Crossover', category: 'push' },
  { id: 'yoga_flow', name: 'Yoga Flow', category: 'mobility' },
  { id: 'pilates', name: 'Pilates', category: 'mobility' },
  { id: 'static_stretching', name: 'Static Stretching', category: 'mobility' },
  { id: 'foam_rolling', name: 'Foam Rolling', category: 'mobility' },
  { id: 'wrist_curl', name: 'Wrist Curl', category: 'arms' },
  { id: 'reverse_curl', name: 'Reverse Curl', category: 'arms' },
  { id: 'close_grip_bench', name: 'Close-Grip Bench Press', category: 'arms' },
  { id: 'diamond_pushup', name: 'Diamond Push-Up', category: 'arms' },
  { id: 'tricep_dip_bench', name: 'Bench Tricep Dip', category: 'arms' },
];

/**
 * First matching muscle-group regex wins. Order matters (more specific first).
 * Manipulate here: add a rule when a new muscle label should map to a chip.
 */
const CATEGORY_BY_MUSCLE = [
  { match: /cardio/i, category: 'cardio' },
  { match: /chest|triceps/i, category: 'push' },
  { match: /back|biceps|traps/i, category: 'pull' },
  { match: /quad|glute|hamstring|calf|calves/i, category: 'legs' },
  { match: /core|oblique/i, category: 'core' },
  { match: /shoulder/i, category: 'push' },
  { match: /forearm/i, category: 'arms' },
  { match: /full body/i, category: 'cardio' },
];

// ===== HELPER FUNCTIONS =====

/**
 * Map one manual-builder row into a dislike-catalog row (id, name, category).
 * @param {{ id: string, name: string, muscleGroups?: string[] }} exercise
 * @returns {{ id: string, name: string, category: string }}
 */
function convertOneManualExerciseToDislikeRow(exercise) {
  return {
    id: exercise.id,
    name: exercise.name,
    category: pickDislikeCategoryFromMuscles(exercise.muscleGroups),
  };
}

/**
 * Convert the whole manual library into dislike rows.
 * @returns {{ id: string, name: string, category: string }[]}
 */
function convertManualLibraryToDislikeRows() {
  const dislikeRows = [];
  for (const exercise of MANUAL_EXERCISE_LIBRARY) {
    dislikeRows.push(convertOneManualExerciseToDislikeRow(exercise));
  }
  return dislikeRows;
}

/**
 * Keep the first row for each exercise id; drop later duplicates.
 * @param {{ id: string }[]} exercises
 * @returns {{ id: string }[]}
 */
function dropDuplicateExerciseIds(exercises) {
  const seenIds = new Set();
  const uniqueExercises = [];

  for (const exercise of exercises) {
    if (seenIds.has(exercise.id)) continue;
    seenIds.add(exercise.id);
    uniqueExercises.push(exercise);
  }

  return uniqueExercises;
}

/**
 * Merge manual seed + extras, then dedupe by id.
 * @returns {{ id: string, name: string, category: string }[]}
 */
function buildMergedDislikeCatalog() {
  const fromManualBuilder = convertManualLibraryToDislikeRows();
  const combined = [...fromManualBuilder, ...EXTRA_DISLIKE_EXERCISES];
  return dropDuplicateExerciseIds(combined);
}

/**
 * Pick a dislike chip category from muscle-group labels. Default = mobility.
 * @param {string[]} [muscleGroups]
 * @returns {string}
 */
function pickDislikeCategoryFromMuscles(muscleGroups = []) {
  const muscleNamesJoined = muscleGroups.join(' ');

  for (const rule of CATEGORY_BY_MUSCLE) {
    if (rule.match.test(muscleNamesJoined)) return rule.category;
  }

  return DEFAULT_DISLIKE_CATEGORY;
}

/**
 * Build { [id]: exercise } lookup from the merged catalog.
 * @param {{ id: string }[]} catalog
 * @returns {Record<string, object>}
 */
function buildExerciseLookupById(catalog) {
  const lookupById = {};
  for (const exercise of catalog) {
    lookupById[exercise.id] = exercise;
  }
  return lookupById;
}

/**
 * Filter the catalog to one category id.
 * @param {string} categoryId
 * @returns {Array}
 */
function filterCatalogByCategory(categoryId) {
  const matchingExercises = [];
  for (const exercise of EXERCISE_DISLIKE_CATALOG) {
    if (exercise.category === categoryId) {
      matchingExercises.push(exercise);
    }
  }
  return matchingExercises;
}

/**
 * Case-insensitive name contains search, capped at limit.
 * @param {string} searchTextLower
 * @param {number} limit
 * @returns {Array}
 */
function findExercisesWhoseNameContains(searchTextLower, limit) {
  const matchingExercises = [];

  for (const exercise of EXERCISE_DISLIKE_CATALOG) {
    if (matchingExercises.length >= limit) break;
    const nameLower = exercise.name.toLowerCase();
    if (!nameLower.includes(searchTextLower)) continue;
    matchingExercises.push(exercise);
  }

  return matchingExercises;
}

// ===== MAIN FUNCTION =====

/** Full merged catalog (manual seed + extras, unique ids). Built once at module load. */
export const EXERCISE_DISLIKE_CATALOG = buildMergedDislikeCatalog();

/** Fast id → exercise lookup for the picker. */
export const EXERCISE_DISLIKE_BY_ID = buildExerciseLookupById(EXERCISE_DISLIKE_CATALOG);

/**
 * Exercises in one onboarding category.
 * Flow: 1. walk the catalog  2. keep matching category  3. return the list
 * @param {string} categoryId
 * @returns {Array}
 */
export function getExercisesByCategory(categoryId) {
  // 1. Walk the catalog and keep rows whose category matches.
  const exercisesInCategory = filterCatalogByCategory(categoryId);
  // 2. Hand the list to the picker chips.
  return exercisesInCategory;
}

/**
 * Case-insensitive name search. Empty query returns the full catalog.
 * Flow: 1. normalize query  2. empty → full list  3. name contains + limit
 * @param {string} query
 * @param {number} [limit=200]
 * @returns {Array}
 */
export function searchExerciseDislikeCatalog(query, limit = DEFAULT_SEARCH_LIMIT) {
  // 1. Normalize typed text (trim + lower).
  const searchText = String(query || '').trim().toLowerCase();

  // 2. Nothing typed → show everything (same door as before).
  if (!searchText) {
    return EXERCISE_DISLIKE_CATALOG;
  }

  // 3. Name contains search, capped at limit.
  const matchingExercises = findExercisesWhoseNameContains(searchText, limit);
  return matchingExercises;
}

// ===== PLUMBING — skip unless debugging =====
// (category regex + merge helpers live above under HELPER FUNCTIONS)
