/**
 * Workout plan generation prompts (server-side only — keeps Claude key off client).
 */

function flattenOnboardingData(data) {
  const d = data && typeof data === 'object' ? { ...data } : {};
  if (d.onboardingData && typeof d.onboardingData === 'object' && !Array.isArray(d.onboardingData)) {
    const { onboardingData, ...rest } = d;
    return { ...onboardingData, ...rest };
  }
  return d;
}

/** Resolve weekly training days from profile (supports legacy field names). */
function resolveDaysPerWeek(data) {
  const d = flattenOnboardingData(data);
  const raw = d.daysPerWeek ?? d.frequency ?? d.workoutsPerWeek;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= 1 && rounded <= 7 ? rounded : null;
}

/** Legacy Firestore key is `exercisesDislike`; values are exercises the client wants to prioritize. */
function getPreferredExercisesList(data) {
  const d = data && typeof data === 'object' ? data : {};
  const fromLiked = Array.isArray(d.likedExercises)
    ? d.likedExercises
        .map((x) => (typeof x === 'string' ? x : x?.name || x?.exerciseName || ''))
        .filter(Boolean)
        .join(', ')
    : '';
  const fromField = String(d.exercisesPrefer || d.exercisesDislike || '').trim();
  return [fromLiked, fromField].filter(Boolean).join(', ');
}

function buildLikedExercisesBlock(data) {
  const d = data && typeof data === 'object' ? data : {};
  const liked = Array.isArray(d.likedExercises) ? d.likedExercises : [];
  const names = liked
    .map((x) => (typeof x === 'string' ? x : x?.name || x?.exerciseName || ''))
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  if (!names.length) return '';
  const top = names.slice(0, 12);
  return `
LIKED / FAVORITE EXERCISES — PRIORITIZE (place 3–5 of these early in each training day when appropriate):
${top.join(', ')}

Rules:
- Put liked exercises in the first 3–5 slots of training days when equipment/split allow.
- Fill remaining slots with complementary exercises for balance.
- Do not invent injury exclusions from this list — these are favorites.`;
}

function buildTrainerStyleBlock(data) {
  const d = data && typeof data === 'object' ? data : {};
  const style = d.trainerStyle || d.assignedTrainerStyle;
  if (!style || typeof style !== 'object') return '';
  const name = String(style.name || style.trainerName || '').trim();
  const specialties = Array.isArray(style.specialties) ? style.specialties.join(', ') : String(style.specialties || '');
  const philosophy = String(style.trainingPhilosophy || style.philosophy || '').trim();
  const preferredReps = String(style.preferredRepRanges || style.repRanges || '').trim();
  const rest = String(style.preferredRestPeriods || style.restPeriods || '').trim();
  const favExercises = Array.isArray(style.favoriteExercises)
    ? style.favoriteExercises.join(', ')
    : String(style.favoriteExercises || style.exercisesPrefer || '').trim();
  const workoutStyle = String(style.workoutStyle || specialties || '').trim();
  return `
ASSIGNED TRAINER STYLE — MATCH THIS COACHING APPROACH:
${name ? `- Trainer: ${name}` : ''}
${workoutStyle ? `- Workout style / specialties: ${workoutStyle}` : ''}
${preferredReps ? `- Preferred rep ranges: ${preferredReps}` : ''}
${rest ? `- Preferred rest periods: ${rest}` : ''}
${favExercises ? `- Trainer favorite exercises: ${favExercises}` : ''}
${philosophy ? `- Training philosophy: ${philosophy.slice(0, 500)}` : ''}

Generate a workout that matches this trainer's style. When showing the plan back to the client, note it was influenced by ${name || 'their trainer'}.`;
}

function buildExercisePreferenceBlock(data) {
  const list = getPreferredExercisesList(data);
  if (!list) return '';

  return `
PREFERRED EXERCISES — INCLUDE WHEN POSSIBLE (this is NOT a ban list):
Client wants these movements in the plan: ${list}

Rules:
- These are exercises the client LIKES and WANTS. Never treat them as exclusions or injuries.
- Include each preferred exercise on at least one training day when equipment and split allow.
- Prefer the listed movement or a close, sensible variant (same pattern / muscle emphasis).
- Only omit a preferred exercise if injuries or limitations above explicitly forbid it.`;
}

function buildExerciseExclusionBlock(data) {
  const d = data && typeof data === 'object' ? data : {};
  const parts = [d.injuries, d.situationDescription]
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  if (!parts.length) return '';

  const combined = parts.join(' | ');
  return `
EXERCISE EXCLUSIONS — NON-NEGOTIABLE (highest priority; overrides variety and defaults):
Client banned / avoid list (injuries/limitations only — NOT preferred exercises): ${combined}

Enforcement rules:
- NEVER prescribe any banned movement or a close variant (same pattern, muscle line, or common alias).
- "No squats except hex/trap bar squat" → ONLY hex bar / trap bar squat for squat pattern. NO goblet squat, Bulgarian split squat, front squat, back squat, leg press, box squat, split squat, etc.
- "No RDL" / "no deadlifts" / "no single leg deadlift" → NO Romanian deadlift, single-leg RDL/SLDL, stiff-leg deadlift, good morning, kettlebell swing hinge substitutes if deadlift banned.
- "No walking lunges" → NO walking lunge, deficit lunge, jumping lunge, lunge walk.
- "No burpees" → NO burpee, dumbbell burpee, sprawl, man maker with burpee.
- "Renegade row" banned → NO renegade row, plank row, push-up to row combo.
- Before returning JSON, scan EVERY exercise name against the ban list (partial match counts). Replace any hit with an allowed alternative using their equipment.
- If unsure whether a name is too similar to a banned move, pick a different exercise.`;
}

function buildTrainingFrequencyBlock(data) {
  const days = resolveDaysPerWeek(data);
  if (days == null) return '';

  const restDays = 7 - days;
  return `
TRAINING SCHEDULE — NON-NEGOTIABLE:
- Client trains EXACTLY ${days} day(s) per week — not ${days + 1}, not ${Math.max(1, days - 1)}.
- The plan array has 7 calendar days (Monday–Sunday).
- EXACTLY ${days} day(s): "rest": false with 3–5 exercises each.
- EXACTLY ${restDays} day(s): "rest": true with recoveryActivities[] and NO exercises.
- Before returning JSON, count days where rest:false — it MUST equal ${days}.`;
}

function buildWorkoutSystemPrompt({ daysPerWeek } = {}) {
  const resolvedDays = resolveDaysPerWeek({ daysPerWeek });
  const trainingFreqRule =
    resolvedDays != null
      ? `${13}. TRAINING FREQUENCY (NON-NEGOTIABLE): Exactly ${resolvedDays} training days (rest:false) and exactly ${7 - resolvedDays} rest days (rest:true) in the 7-day Mon–Sun plan. Never exceed ${resolvedDays} training days.\n`
      : `${13}. TRAINING FREQUENCY: Honor the client's requested training days per week from the user message. The 7-day plan must split training vs rest days to match that number exactly.\n`;

  return `You are an expert strength and conditioning coach. Generate a complete 7-day personalized workout plan.

RESPONSE FORMAT:
Return ONLY a JSON object with this structure (NO markdown, NO prose, just JSON):

{
  "success": true,
  "overview": "2-4 sentences summarizing the program focus, weekly split, progression intent, and 1 key form/safety theme. No fluff.",
  "plan": [
    {
      "day": "Monday",
      "short": "MON",
      "focus": "Push — Chest/Shoulders/Triceps",
      "focusColor": "pink",
      "rest": false,
      "warmup": "Specific warmup protocol for push day",
      "estimatedDuration": "55-65 min",
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": 4,
          "reps": "6-8 reps",
          "rest": "120s rest",
          "muscle": "Muscle Group",
          "tempo": "3-1-1",
          "notes": "Short execution cue",
          "tips": [
            "Detailed coaching tip 1",
            "Detailed coaching tip 2",
            "Detailed coaching tip 3"
          ]
        }
      ]
    }
  ]
}

CRITICAL RULES:
1. Generate exactly 7 days (Monday-Sunday)
2. Include 3-5 exercises per training day
3. Each exercise MUST have: name, sets, reps, rest, muscle, tempo, notes, tips[]
4. Rest days MUST have recoveryActivities[] (short-phrase items) and NO exercises
5. focusColor MUST be one of: "pink", "purple", "cyan", "orange", "green", or "gray"
6. tips MUST be an array of exactly 3 strings (detailed coaching points)
7. Output ONLY JSON - no markdown, no prose, no code blocks
8. Include warmup and estimatedDuration for every training day
9. Rest days: set "rest": true, include "recoveryActivities": [...], NO exercises array
10. Training days: set "rest": false, INCLUDE exercises array
11. NO repetition: do NOT reuse the same exact sentence/phrase across different exercises (especially in notes/tips). Avoid generic filler.
12. You MUST include a top-level "overview" string (2–4 sentences). Make it specific to the user's goal and the week's split.
${trainingFreqRule}
COACHING CONTENT REQUIREMENTS (VERY IMPORTANT):

EXERCISE notes (single string per exercise):
- Must be SPECIFIC and actionable for that exact exercise (setup + execution + one safety/form point).
- Include tempo cues when relevant (e.g., "3-second eccentric, pause, explode") and tie it to the movement.
- Include at least one concrete setup detail when relevant (e.g., stance, grip width, bar path, torso angle).
- Make every note distinct. Do NOT repeat generic phrases like "control the descent" or "squeeze at the top" across the plan.

EXERCISE tips (tips[] must be EXACTLY 3 strings, each 1–2 sentences max):
- Tip 1 (TECHNIQUE): a crisp form/tech cue for THIS exercise.
- Tip 2 (SAFETY / COMMON MISTAKE): call out one common mistake + how to fix/avoid it.
- Tip 3 (PERFORMANCE / PROGRESSION): a progression or performance lever (load, reps in reserve, rest, tempo, range, grip).
- No generic tips. No duplicates across exercises. Each tip should sound like a real coach speaking.

WARMUP (warmup string):
- Must be more specific than a generic list.
- Include the WHY for each warmup step using a simple arrow format.
- Example format: "5 min easy row (blood flow) → 15 band pull-aparts (rear delt activation) → 10 arm circles (shoulder mobility)".

REST DAY FORMAT (VERY IMPORTANT):
Rest days MUST use a "recoveryActivities" array instead of a long "recoveryNote" paragraph.
Each activity is a short phrase (NOT a full sentence) with an optional detail string for the tap-through.

RULES FOR recoveryActivities:
- Each "label" must be a SHORT phrase (≤10 words). No full sentences. Think exercise-name brevity.
- Each "detail" is 1–2 sentences of coaching context shown when the user taps.
- Include 3–5 activities per rest day.
- You may ALSO include "recoveryNote" as a 1-sentence summary, but recoveryActivities is required.
- Do NOT write paragraph-style recovery notes. Keep labels punchy: "20–30 min yoga flow", "Foam roll lower body", "8+ hours sleep".`;
}

function buildWorkoutUserPrompt(data) {
  const d = flattenOnboardingData(data);
  const daysPerWeek = resolveDaysPerWeek(d);
  const preferred = getPreferredExercisesList(d);
  const preferenceBlock = buildExercisePreferenceBlock(d);
  const likedBlock = buildLikedExercisesBlock(d);
  const trainerBlock = buildTrainerStyleBlock(d);
  const exclusionBlock = buildExerciseExclusionBlock(d);
  const frequencyBlock = buildTrainingFrequencyBlock(d);
  const trainingDaysLabel = daysPerWeek != null ? daysPerWeek : 'the requested number of';
  const trainerName = d.trainerStyle?.name || d.assignedTrainerStyle?.name || d.trainerName || '';
  return `Create a ${trainingDaysLabel}-day per week personalized workout plan for a client:

CLIENT PROFILE:
- Age: ${d.age || 'Not specified'}
- Experience: ${d.fitnessLevel || 'Beginner'}
- Goal: ${d.primaryGoal || 'General fitness'}
- Equipment: ${(d.equipmentAccess || []).join(', ') || 'Bodyweight only'}
- Environment: ${d.trainingEnvironment || 'Gym'}
- Training Days Per Week: ${daysPerWeek != null ? daysPerWeek : 'Not specified — ask is invalid; use profile if present'}
- Session Duration: ${d.preferredWorkoutTime || '60 minutes'}
- Injuries/Limitations: ${d.injuries || 'None'}
- Preferred Exercises (include in plan when possible): ${preferred || 'No specific preferences'}
- Sleep: ${d.sleepQuality || '7-8 hours'}
- Stress Level: ${d.currentStressLevel || 'Moderate'}
${frequencyBlock}${likedBlock}${preferenceBlock}${trainerBlock}${exclusionBlock}
Generate the complete 7-day JSON plan NOW. Return ONLY JSON. Honor injury/limitation exclusions only — preferred/liked exercises must appear early in the plan when feasible.${
    trainerName ? ` Overview may mention AI Coach trained by ${trainerName}.` : ''
  }`;
}

module.exports = {
  buildWorkoutSystemPrompt,
  buildWorkoutUserPrompt,
  buildExerciseExclusionBlock,
  buildExercisePreferenceBlock,
  buildLikedExercisesBlock,
  buildTrainerStyleBlock,
  buildTrainingFrequencyBlock,
  getPreferredExercisesList,
  resolveDaysPerWeek,
  flattenOnboardingData,
};
