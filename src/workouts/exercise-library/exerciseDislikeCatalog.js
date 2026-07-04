/**
 * Curated exercise catalog for onboarding "exercises you dislike" multi-select.
 * IDs align with MANUAL_EXERCISE_LIBRARY where possible; extras cover cardio, machines, etc.
 */
import { MANUAL_EXERCISE_LIBRARY } from '../../trainer-app/workout-plans/manualExerciseLibrarySeed';

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

function inferCategory(muscleGroups = []) {
  const joined = muscleGroups.join(' ');
  for (const rule of CATEGORY_BY_MUSCLE) {
    if (rule.match.test(joined)) return rule.category;
  }
  return 'mobility';
}

/** Additional movements not in the manual builder seed. */
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

const fromManual = MANUAL_EXERCISE_LIBRARY.map((ex) => ({
  id: ex.id,
  name: ex.name,
  category: inferCategory(ex.muscleGroups),
}));

const seen = new Set();
export const EXERCISE_DISLIKE_CATALOG = [...fromManual, ...EXTRA_DISLIKE_EXERCISES].filter((ex) => {
  if (seen.has(ex.id)) return false;
  seen.add(ex.id);
  return true;
});

export const EXERCISE_DISLIKE_BY_ID = Object.fromEntries(
  EXERCISE_DISLIKE_CATALOG.map((ex) => [ex.id, ex]),
);

export function getExercisesByCategory(categoryId) {
  return EXERCISE_DISLIKE_CATALOG.filter((ex) => ex.category === categoryId);
}

export function searchExerciseDislikeCatalog(query, limit = 200) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return EXERCISE_DISLIKE_CATALOG;
  return EXERCISE_DISLIKE_CATALOG.filter((ex) => ex.name.toLowerCase().includes(q)).slice(0, limit);
}
