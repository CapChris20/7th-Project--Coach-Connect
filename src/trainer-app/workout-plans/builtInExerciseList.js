// Bundled exercise catalog that powers search/autocomplete in the manual plan builder.
// Flow: MANUAL_EXERCISE_LIBRARY is a static list → searchManualExerciseLibrary() scores it against the trainer's query.
// Used by the manual workout plan builder. Offline so autocomplete stays instant mid-gym.

// ===== NAMED CONSTANTS =====

const MANUAL_LIBRARY_SEARCH_LIMIT_DEFAULT = 24;
const SCORE_EXACT_NAME_MATCH = 100;
const NAME_PREFIX_SCORE = 40;
const NAME_CONTAINS_SCORE = 20;
const MUSCLE_GROUP_SCORE = 8;
const DESCRIPTION_SCORE = 4;

// Manipulate here: this is the exercise catalog — add a row to make a new exercise searchable.
// Each row is { id, name, muscleGroups, description }:
//   id            NEVER change an existing one. Saved plans reference these strings, so renaming
//                 an id orphans every plan that used it.
//   name          what the trainer sees and searches
//   muscleGroups  also searchable (typing "chest" finds these), and used for plan balance hints
//   description   short cue text; searchable at the lowest weight
// Roughly grouped by movement (push → pull → hinge/squat → arms → core → conditioning), but the
// order here does NOT affect ranking — the scoring in searchManualExerciseLibrary decides that.
export const MANUAL_EXERCISE_LIBRARY = [
  { id: 'bb_bench', name: 'Barbell Bench Press', muscleGroups: ['Chest', 'Triceps'], description: 'Flat barbell press; retract scapula, controlled bar path.' },
  { id: 'db_bench', name: 'Dumbbell Bench Press', muscleGroups: ['Chest', 'Triceps'], description: 'Neutral or slight pronation grip; full ROM.' },
  { id: 'incline_db_press', name: 'Incline Dumbbell Press', muscleGroups: ['Chest', 'Shoulders'], description: '30–45° bench; drive elbows under wrists.' },
  { id: 'cable_fly', name: 'Cable Fly (High-to-Low)', muscleGroups: ['Chest'], description: 'Slight elbow bend; squeeze through midline.' },
  { id: 'pushup', name: 'Push-Up', muscleGroups: ['Chest', 'Core'], description: 'Bodyweight horizontal press; full body tension.' },
  { id: 'dip', name: 'Parallel Bar Dip', muscleGroups: ['Chest', 'Triceps'], description: 'Lean for chest bias; vertical for triceps.' },
  { id: 'ohp_bb', name: 'Standing Barbell Overhead Press', muscleGroups: ['Shoulders', 'Triceps'], description: 'Brace glutes; bar over mid-foot.' },
  { id: 'db_shoulder_press', name: 'Seated Dumbbell Shoulder Press', muscleGroups: ['Shoulders', 'Triceps'], description: 'Neutral path; avoid excessive arch.' },
  { id: 'lateral_raise', name: 'Dumbbell Lateral Raise', muscleGroups: ['Shoulders'], description: 'Lead with elbows; stop shy of pain.' },
  { id: 'rear_delt_fly', name: 'Rear Delt Fly (Bent-Over)', muscleGroups: ['Shoulders', 'Back'], description: 'Hinge; thumbs slightly down at top.' },
  { id: 'face_pull', name: 'Cable Face Pull', muscleGroups: ['Shoulders', 'Back'], description: 'External rotation finish; upper back.' },
  { id: 'arnold_press', name: 'Arnold Press', muscleGroups: ['Shoulders'], description: 'Rotation from palms-in to press.' },
  { id: 'bb_row', name: 'Barbell Bent-Over Row', muscleGroups: ['Back', 'Biceps'], description: 'Hip hinge; pull to lower ribs.' },
  { id: 'pendlay_row', name: 'Pendlay Row', muscleGroups: ['Back'], description: 'Dead stop each rep; explosive pull.' },
  { id: 'one_arm_row', name: 'One-Arm Dumbbell Row', muscleGroups: ['Back', 'Biceps'], description: 'Flat back; pull elbow to pocket.' },
  { id: 'lat_pulldown', name: 'Lat Pulldown', muscleGroups: ['Back', 'Biceps'], description: 'Chest tall; drive elbows down and in.' },
  { id: 'pullup', name: 'Pull-Up', muscleGroups: ['Back', 'Biceps'], description: 'Full hang to chin over bar.' },
  { id: 'chinup', name: 'Chin-Up', muscleGroups: ['Back', 'Biceps'], description: 'Supinated grip; more biceps emphasis.' },
  { id: 'seated_cable_row', name: 'Seated Cable Row', muscleGroups: ['Back', 'Biceps'], description: 'Neutral spine; squeeze shoulder blades.' },
  { id: 't_bar_row', name: 'T-Bar Row', muscleGroups: ['Back', 'Biceps'], description: 'Chest supported or landmine variant.' },
  { id: 'rdl', name: 'Romanian Deadlift', muscleGroups: ['Hamstrings', 'Glutes', 'Back'], description: 'Soft knee; hips back; bar close.' },
  { id: 'deadlift', name: 'Conventional Deadlift', muscleGroups: ['Back', 'Glutes', 'Hamstrings'], description: 'Brace; vertical bar path.' },
  { id: 'sumo_deadlift', name: 'Sumo Deadlift', muscleGroups: ['Glutes', 'Quads', 'Back'], description: 'Wide stance; vertical shins bias.' },
  { id: 'bb_squat', name: 'Back Squat', muscleGroups: ['Quads', 'Glutes'], description: 'High bar or low bar per preference.' },
  { id: 'front_squat', name: 'Front Squat', muscleGroups: ['Quads', 'Core'], description: 'Elbows high; upright torso.' },
  { id: 'goblet_squat', name: 'Goblet Squat', muscleGroups: ['Quads', 'Glutes'], description: 'Kettlebell or dumbbell at chest.' },
  { id: 'leg_press', name: 'Leg Press', muscleGroups: ['Quads', 'Glutes'], description: 'Feet placement adjusts bias.' },
  { id: 'lunge_walk', name: 'Walking Lunge', muscleGroups: ['Quads', 'Glutes'], description: 'Tall torso; control knee tracking.' },
  { id: 'split_squat', name: 'Bulgarian Split Squat', muscleGroups: ['Quads', 'Glutes'], description: 'Rear foot elevated; vertical shin bias.' },
  { id: 'leg_extension', name: 'Leg Extension', muscleGroups: ['Quads'], description: 'Machine quad isolation.' },
  { id: 'leg_curl_lying', name: 'Lying Leg Curl', muscleGroups: ['Hamstrings'], description: 'Control eccentric; avoid hips popping.' },
  { id: 'leg_curl_seated', name: 'Seated Leg Curl', muscleGroups: ['Hamstrings'], description: 'Full flexion; squeeze hamstrings.' },
  { id: 'hip_thrust', name: 'Barbell Hip Thrust', muscleGroups: ['Glutes', 'Hamstrings'], description: 'Chin tucked; posterior pelvic tilt at top.' },
  { id: 'glute_bridge', name: 'Glute Bridge', muscleGroups: ['Glutes', 'Core'], description: 'Bodyweight or loaded; squeeze at lockout.' },
  { id: 'calf_standing', name: 'Standing Calf Raise', muscleGroups: ['Calves'], description: 'Full stretch and peak contraction.' },
  { id: 'calf_seated', name: 'Seated Calf Raise', muscleGroups: ['Calves'], description: 'Soleus bias with bent knees.' },
  { id: 'bb_curl', name: 'Barbell Curl', muscleGroups: ['Biceps'], description: 'Elbows fixed; no swing.' },
  { id: 'db_curl', name: 'Dumbbell Curl', muscleGroups: ['Biceps'], description: 'Alternating or simultaneous.' },
  { id: 'hammer_curl', name: 'Hammer Curl', muscleGroups: ['Biceps', 'Forearms'], description: 'Neutral grip.' },
  { id: 'preacher_curl', name: 'Preacher Curl', muscleGroups: ['Biceps'], description: 'Strict elbow flexion.' },
  { id: 'tricep_pushdown', name: 'Tricep Pushdown (Rope)', muscleGroups: ['Triceps'], description: 'Split rope at bottom.' },
  { id: 'skullcrusher', name: 'Skull Crusher (EZ-Bar)', muscleGroups: ['Triceps'], description: 'Elbows fixed; deep stretch.' },
  { id: 'oh_tricep_ext', name: 'Overhead Cable Tricep Extension', muscleGroups: ['Triceps'], description: 'Elbows in; long head bias.' },
  { id: 'plank', name: 'Plank', muscleGroups: ['Core'], description: 'Ribs down; squeeze glutes.' },
  { id: 'hanging_leg_raise', name: 'Hanging Leg Raise', muscleGroups: ['Core'], description: 'Posterior pelvic tilt to lift legs.' },
  { id: 'cable_crunch', name: 'Cable Crunch', muscleGroups: ['Core'], description: 'Spine flexion from thoracic.' },
  { id: 'ab_wheel', name: 'Ab Wheel Rollout', muscleGroups: ['Core', 'Shoulders'], description: 'Anti-extension; short range first.' },
  { id: 'farmers_walk', name: "Farmer's Carry", muscleGroups: ['Forearms', 'Core', 'Traps'], description: 'Heavy dumbbells or handles; tall posture.' },
  { id: 'shrug_bb', name: 'Barbell Shrug', muscleGroups: ['Traps'], description: 'Vertical lift; pause at top.' },
  { id: 'romanian_split_dl', name: 'Single-Leg RDL', muscleGroups: ['Hamstrings', 'Glutes'], description: 'Balance and hinge pattern.' },
  { id: 'box_jump', name: 'Box Jump', muscleGroups: ['Quads', 'Glutes'], description: 'Land soft; step down if needed.' },
  { id: 'kb_swing', name: 'Kettlebell Swing', muscleGroups: ['Glutes', 'Hamstrings'], description: 'Hip hinge power; float at shoulder height.' },
  { id: 'battle_ropes', name: 'Battle Ropes', muscleGroups: ['Shoulders', 'Core'], description: 'Intervals; maintain rhythm.' },
  { id: 'rower', name: 'Row Ergometer', muscleGroups: ['Back', 'Legs', 'Cardio'], description: 'Drive with legs then pull.' },
  { id: 'bike_erg', name: 'Assault Bike', muscleGroups: ['Full Body', 'Cardio'], description: 'Arms and legs together.' },
  { id: 'sled_push', name: 'Sled Push', muscleGroups: ['Quads', 'Glutes', 'Cardio'], description: 'Low hip; short powerful steps.' },
  { id: 'burpee', name: 'Burpee', muscleGroups: ['Full Body', 'Cardio'], description: 'Scale intensity as needed.' },
  { id: 'mountain_climber', name: 'Mountain Climber', muscleGroups: ['Core', 'Cardio'], description: 'Hands under shoulders; hips low.' },
  { id: 'jump_rope', name: 'Jump Rope', muscleGroups: ['Calves', 'Cardio'], description: 'Wrist turn; light hops.' },
  { id: 'incline_bb_press', name: 'Incline Barbell Bench Press', muscleGroups: ['Chest', 'Shoulders'], description: '30–45°; bar to upper chest.' },
  { id: 'decline_press', name: 'Decline Bench Press', muscleGroups: ['Chest', 'Triceps'], description: 'Secure leg brace; controlled descent.' },
  { id: 'pec_deck', name: 'Pec Deck Machine', muscleGroups: ['Chest'], description: 'Slight bend in elbows throughout.' },
  { id: 'smith_squat', name: 'Smith Machine Squat', muscleGroups: ['Quads', 'Glutes'], description: 'Foot placement adjusts torso angle.' },
  { id: 'hack_squat', name: 'Hack Squat', muscleGroups: ['Quads', 'Glutes'], description: 'Heels stance for depth comfort.' },
  { id: 'chest_supported_row', name: 'Chest-Supported T-Bar Row', muscleGroups: ['Back', 'Biceps'], description: 'Reduces lower-back demand.' },
  { id: 'straight_arm_pulldown', name: 'Straight-Arm Pulldown', muscleGroups: ['Back'], description: 'Lat emphasis; slight hip hinge.' },
  { id: 'woodchopper', name: 'Cable Woodchopper', muscleGroups: ['Core', 'Obliques'], description: 'Rotate through hips and thoracic.' },
  { id: 'pallof_press', name: 'Pallof Press', muscleGroups: ['Core'], description: 'Anti-rotation isometric.' },
  { id: 'turkish_getup', name: 'Turkish Get-Up', muscleGroups: ['Full Body', 'Core'], description: 'Slow controlled transitions.' },
];

// ===== HELPER FUNCTIONS =====

function searchScoreForExercise(exercise, searchText) {
  const name = exercise.name.toLowerCase();
  let score = 0;
  // The four tiers are cumulative, not exclusive — an exact match also starts with and includes
  // the query, so it collects 100 + 40 + 20 = 160 and lands far above a mid-word hit at 20.
  // That gap is what makes typing "bench" surface "Bench Press" above "Incline Bench Press".
  // Manipulate here: these weights are the whole ranking policy.
  if (name === searchText) score += SCORE_EXACT_NAME_MATCH;
  if (name.startsWith(searchText)) score += NAME_PREFIX_SCORE;
  if (name.includes(searchText)) score += NAME_CONTAINS_SCORE;
  // Joined into one string so a single includes() covers every group on the exercise.
  const muscleGroupsText = (exercise.muscleGroups || []).join(' ').toLowerCase();
  if (muscleGroupsText.includes(searchText)) score += MUSCLE_GROUP_SCORE;
  const descriptionText = (exercise.description || '').toLowerCase();
  if (descriptionText.includes(searchText)) score += DESCRIPTION_SCORE;
  return { exercise, score };
}

function highestScoreThenName(leftMatch, rightMatch) {
  // Highest score first; equal scores fall back to alphabetical, so results are stable
  // instead of depending on array order.
  return rightMatch.score - leftMatch.score || leftMatch.exercise.name.localeCompare(rightMatch.exercise.name);
}

// ===== MAIN FUNCTION =====

/**
 * Weighted substring search over the library above. Not fuzzy matching — it's a simple additive
 * score, which is predictable and fast enough to run on every keystroke over ~85 rows.
 * Empty query = the browse case: show the first `limit` exercises rather than nothing.
 * @param {string} query
 * @param {number} [limit=24]
 * @returns {Array}
 */
export function searchManualExerciseLibrary(query, limit = MANUAL_LIBRARY_SEARCH_LIMIT_DEFAULT) {
  const searchText = String(query || '').trim().toLowerCase();
  if (!searchText) return MANUAL_EXERCISE_LIBRARY.slice(0, limit);
  const scored = MANUAL_EXERCISE_LIBRARY.map((exercise) => searchScoreForExercise(exercise, searchText))
    .filter((scoredEntry) => scoredEntry.score > 0)
    .sort(highestScoreThenName);
  return scored.slice(0, limit).map((scoredEntry) => scoredEntry.exercise);
}

/**
 * Infer equipment from the exercise name (catalog has no equipment field).
 * Design Law PNG 21 pills: Barbell · Dumbbell · Bodyweight · Cable · Machine.
 * @param {{ name?: string }} exercise
 * @returns {string|null}
 */
export function inferExerciseEquipment(exercise) {
  const name = String(exercise?.name || '').toLowerCase();
  if (!name) return null;
  if (/\b(barbell|bb |ez[- ]?bar|landmine|t-bar)\b/.test(name) || name.startsWith('bb ')) {
    return 'Barbell';
  }
  if (/\b(dumbbell|db |kettlebell|kb |hammer curl|goblet)\b/.test(name) || name.startsWith('db ')) {
    return 'Dumbbell';
  }
  if (/\b(cable|pulldown|pushdown|face pull|woodchopper|pallof)\b/.test(name)) {
    return 'Cable';
  }
  if (
    /\b(machine|smith|leg press|leg extension|leg curl|pec deck|hack squat|ergometer|assault bike|rower)\b/.test(
      name,
    )
  ) {
    return 'Machine';
  }
  if (
    /\b(push-?up|pull-?up|chin-?up|plank|burpee|mountain climber|jump rope|dip|glute bridge|hanging|ab wheel|box jump)\b/.test(
      name,
    )
  ) {
    return 'Bodyweight';
  }
  return null;
}

/**
 * Text search + optional muscle / equipment chip filters (PNG 21).
 * @param {{
 *   query?: string,
 *   muscle?: string|null,
 *   equipments?: string[],
 *   limit?: number,
 * }} opts
 * @returns {Array}
 */
export function filterManualExerciseLibrary({
  query = '',
  muscle = null,
  equipments = [],
  limit = MANUAL_LIBRARY_SEARCH_LIMIT_DEFAULT,
} = {}) {
  const muscleKey = String(muscle || '').trim().toLowerCase();
  const equipmentKeys = (Array.isArray(equipments) ? equipments : [])
    .map((item) => String(item || '').trim().toLowerCase())
    .filter(Boolean);

  let rows = searchManualExerciseLibrary(query, MANUAL_EXERCISE_LIBRARY.length);
  if (muscleKey) {
    rows = rows.filter((exercise) =>
      (exercise.muscleGroups || []).some((group) => String(group).toLowerCase() === muscleKey),
    );
  }
  if (equipmentKeys.length) {
    rows = rows.filter((exercise) => {
      const inferred = String(inferExerciseEquipment(exercise) || '').toLowerCase();
      if (!inferred) return false;
      return equipmentKeys.includes(inferred);
    });
  }
  return rows.slice(0, limit);
}
