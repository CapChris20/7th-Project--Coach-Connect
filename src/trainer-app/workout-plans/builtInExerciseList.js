// Bundled exercise catalog that powers search/autocomplete in the manual plan builder.
// Flow: MANUAL_EXERCISE_LIBRARY is a static list → searchManualExerciseLibrary() scores it against
// the trainer's query and returns the best matches.
// Why bundled instead of fetched: autocomplete must feel instant and keep working offline mid-gym,
// so there's no network call in this path at all.

/**
 * Offline exercise library for the manual workout plan builder (search + autocomplete).
 * IDs are stable strings for Firestore references; trainers may still save custom names.
 */
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

// Weighted substring search over the library above. Not fuzzy matching — it's a simple additive
// score, which is predictable and fast enough to run on every keystroke over ~85 rows.
// Manipulate here: `limit` caps how many suggestions the dropdown shows.
export function searchManualExerciseLibrary(query, limit = 24) {
  // Lowercase once here so the comparisons below never have to case-fold repeatedly.
  const q = String(query || '').trim().toLowerCase();
  // Empty query = the browse case: show the first `limit` exercises rather than nothing, so the
  // dropdown has content the instant it opens.
  if (!q) return MANUAL_EXERCISE_LIBRARY.slice(0, limit);
  const scored = MANUAL_EXERCISE_LIBRARY.map((ex) => {
    const name = ex.name.toLowerCase();
    let score = 0;
    // The four tiers are cumulative, not exclusive — an exact match also starts with and includes
    // the query, so it collects 100 + 40 + 20 = 160 and lands far above a mid-word hit at 20.
    // That gap is what makes typing "bench" surface "Bench Press" above "Incline Bench Press".
    // Manipulate here: these weights are the whole ranking policy.
    //   100 exact name       — always first
    //    40 name starts with — strong prefix match, how most people type
    //    20 name contains    — mid-word match
    //     8 muscle group     — lets "chest" list every chest exercise
    //     4 description      — weakest signal, only breaks ties
    if (name === q) score += 100;
    if (name.startsWith(q)) score += 40;
    if (name.includes(q)) score += 20;
    // Joined into one string so a single includes() covers every group on the exercise.
    const mg = (ex.muscleGroups || []).join(' ').toLowerCase();
    if (mg.includes(q)) score += 8;
    const desc = (ex.description || '').toLowerCase();
    if (desc.includes(q)) score += 4;
    return { ex, score };
  })
    // Drop non-matches. Score 0 means the query appeared nowhere in the row.
    .filter((x) => x.score > 0)
    // Highest score first; the `||` is the tiebreaker — equal scores fall back to alphabetical, so
    // results are stable instead of depending on array order.
    .sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name));
  // Unwrap the { ex, score } envelopes so callers get plain exercise objects.
  return scored.slice(0, limit).map((x) => x.ex);
}
