/**
 * Extended coach context: workout plans, notes/files, trainer-shared documents.
 * Loaded server-side into the AI Coach system prompt (Firebase Admin).
 */

const logger = require('./logger');

const PLAN_SUMMARY_CHAR_CAP = 22000;
const NOTE_CONTENT_CHAR_CAP = 400;
const MAX_PLANS_IN_PROMPT = 8;
const MAX_NOTES_IN_PROMPT = 15;
const MAX_FILES_IN_PROMPT = 15;

function truncate(text, max) {
  const s = String(text || '').trim();
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function tryParseJson(text) {
  if (text == null) return null;
  const s = String(text).trim();
  if (!s || !/^[\[{]/.test(s)) return null;
  try {
    return JSON.parse(s);
  } catch (_) {
    return null;
  }
}

function countDayExercises(days) {
  if (!Array.isArray(days)) return 0;
  return days.reduce((total, day) => {
    if (day?.rest || day?.isRest) return total;
    return total + (Array.isArray(day?.exercises) ? day.exercises.length : 0);
  }, 0);
}

function mergeCoachDayEdits(planDays, editDays) {
  if (!Array.isArray(planDays) || !planDays.length || !Array.isArray(editDays) || !editDays.length) {
    return planDays || [];
  }
  return planDays.map((day, i) => {
    const edit = editDays[i];
    if (!edit?.exercises?.length) return day;
    const exercises = [...(Array.isArray(day?.exercises) ? day.exercises : [])];
    edit.exercises.forEach((exEdit, j) => {
      if (!exEdit || typeof exEdit !== 'object') return;
      const isCoachEdit =
        exEdit.modifiedBy === 'aiCoach' ||
        exEdit.modificationReason ||
        (exEdit.name && !exercises[j]?.name);
      if (!isCoachEdit) return;
      while (exercises.length <= j) exercises.push({ name: 'Exercise' });
      exercises[j] = { ...exercises[j], ...exEdit };
    });
    return { ...day, exercises };
  });
}

/**
 * Match workout.js resolution: workoutPlan → plan → days (pick fullest source).
 */
function resolvePlanDayBlocks(structured, rawPlanText) {
  const parsed =
    structured && typeof structured === 'object'
      ? structured
      : tryParseJson(rawPlanText) || {};

  const candidates = [];
  const pushCandidate = (key, days) => {
    if (!Array.isArray(days) || !days.length) return;
    candidates.push({ key, days, exercises: countDayExercises(days), dayCount: days.length });
  };

  pushCandidate('workoutPlan', parsed.workoutPlan);
  pushCandidate('plan', parsed.plan);
  pushCandidate('days', parsed.days);

  if (!candidates.length) return [];

  candidates.sort((a, b) => {
    if (b.exercises !== a.exercises) return b.exercises - a.exercises;
    return b.dayCount - a.dayCount;
  });

  const best = candidates[0].days;
  const editDays = Array.isArray(parsed.days) && parsed.days.length ? parsed.days : null;
  if (editDays && candidates[0].key !== 'days') {
    return mergeCoachDayEdits(best, editDays);
  }
  return best;
}

function formatExerciseLine(ex) {
  if (!ex || typeof ex !== 'object') return null;
  const name = String(ex.name || ex.exerciseName || ex.exercise || '').trim();
  if (!name) return null;

  const sets = ex.sets != null ? ex.sets : ex.setCount;
  const reps = ex.reps != null ? ex.reps : ex.repRange;
  const rest = ex.rest != null ? String(ex.rest).trim() : '';
  const muscle = ex.muscle || ex.muscleGroup || '';
  const parts = [];
  if (sets != null && reps != null) parts.push(`${sets} x ${reps}`);
  else if (sets != null) parts.push(`${sets} sets`);
  else if (reps != null) parts.push(`${reps} reps`);
  if (rest) parts.push(String(rest).toLowerCase().includes('rest') ? rest : `rest ${rest}`);

  let line = `  - ${name}`;
  if (parts.length) line += `: ${parts.join(', ')}`;
  if (muscle) line += ` (${muscle})`;
  if (ex.modifiedBy === 'aiCoach' && ex.modificationReason) {
    line += ` [coach swap: ${ex.modificationReason}]`;
  }
  const notes = ex.notes || (Array.isArray(ex.formCues) ? ex.formCues.filter(Boolean).join('; ') : '');
  if (notes) line += `\n    Notes: ${truncate(notes, 200)}`;
  return line;
}

function formatPlanDayBlock(day, index) {
  if (!day || typeof day !== 'object') return '';
  const label = String(day.day || day.label || day.name || `Day ${index + 1}`).trim();
  if (day.rest || day.isRest) {
    const note = day.recoveryNote || day.restGuidance || day.restNote || '';
    const activities = Array.isArray(day.recoveryActivities)
      ? day.recoveryActivities.filter(Boolean).join(', ')
      : '';
    const extra = [note, activities].filter(Boolean).join(' · ');
    return `${label}: Rest${extra ? ` — ${extra}` : ''}`;
  }

  const focus = day.focus || day.focusArea || day.sessionFocus || day.type || '';
  const lines = [`${label}${focus ? ` — ${focus}` : ''}:`];

  if (Array.isArray(day.warmUp) && day.warmUp.length) {
    lines.push(`  Warm-up: ${day.warmUp.map((w) => String(w)).join(', ')}`);
  }
  if (Array.isArray(day.warmup) && day.warmup.length) {
    lines.push(`  Warm-up: ${day.warmup.map((w) => String(w)).join(', ')}`);
  }

  (Array.isArray(day.exercises) ? day.exercises : []).forEach((ex) => {
    const line = formatExerciseLine(ex);
    if (line) lines.push(line);
  });

  if (day.estimatedDuration) lines.push(`  Duration: ~${day.estimatedDuration} min`);
  if (Array.isArray(day.coolDown) && day.coolDown.length) {
    lines.push(`  Cool-down: ${day.coolDown.map((w) => String(w)).join(', ')}`);
  }
  return lines.join('\n');
}

function extractStructuredPlanSummary(structuredPlan, rawPlanText) {
  const parsed =
    structuredPlan && typeof structuredPlan === 'object'
      ? structuredPlan
      : tryParseJson(rawPlanText);
  if (!parsed || typeof parsed !== 'object') return null;

  const lines = [];
  const overview = parsed.overview || parsed.planOverview || parsed.summary;
  if (overview) lines.push(truncate(String(overview), 1200));

  const dayBlocks = resolvePlanDayBlocks(parsed, rawPlanText);
  dayBlocks.forEach((day, i) => {
    const block = formatPlanDayBlock(day, i);
    if (block) lines.push(block);
  });

  if (!lines.length) return null;
  return truncate(lines.join('\n'), PLAN_SUMMARY_CHAR_CAP);
}

function summarizeRawPlan(rawPlan) {
  if (rawPlan == null) return null;
  const s = String(rawPlan).trim();
  if (!s) return null;

  const parsed = tryParseJson(s);
  if (parsed && typeof parsed === 'object') {
    const fromStruct = extractStructuredPlanSummary(parsed, s);
    if (fromStruct) return fromStruct;
    if (parsed.overview) return truncate(String(parsed.overview), PLAN_SUMMARY_CHAR_CAP);
  }

  return truncate(s, PLAN_SUMMARY_CHAR_CAP);
}

function summarizePlanDoc(data, docId) {
  const d = data || {};
  const rawPlan = d.rawPlan || d.planText || d.plan;
  const summary =
    extractStructuredPlanSummary(d.structuredPlan, rawPlan) ||
    summarizeRawPlan(rawPlan);
  if (summary) {
    const dayBlocks = resolvePlanDayBlocks(d.structuredPlan, rawPlan);
    const exerciseCount = countDayExercises(dayBlocks);
    return {
      title: d.title || d.name || d.planTitle || d.planName || docId,
      summary,
      exerciseCount,
      dayCount: dayBlocks.length,
      hasLinkOnly: false,
    };
  }
  if (d.url) {
    return {
      title: d.planTitle || d.title || d.name || docId,
      summary: `[Linked/PDF plan — "${d.planTitle || d.title || docId}" — exercise details not stored as text]`,
      hasLinkOnly: true,
      exerciseCount: 0,
      dayCount: 0,
    };
  }
  return null;
}

async function fetchWorkoutPlanContext(db, userId) {
  const plans = [];
  const seenIds = new Set();

  const addPlan = (id, data, isActive = false) => {
    if (!id || seenIds.has(id)) return;
    const summarized = summarizePlanDoc(data, id);
    if (!summarized) return;
    seenIds.add(id);
    plans.push({ id, isActive, ...summarized });
  };

  try {
    const currentSnap = await db.doc(`users/${userId}/workoutPlan/current`).get();
    if (currentSnap.exists) addPlan('current', currentSnap.data(), true);
  } catch (err) {
    logger.warn('coachExtendedContext: failed to fetch workoutPlan/current', err?.message || err);
  }

  try {
    const snap = await db.collection('users').doc(userId).collection('workoutPlans').limit(20).get();
    snap.docs.forEach((d) => {
      const isActive = d.id === 'current' || d.data()?.status === 'active';
      addPlan(d.id, d.data(), isActive);
    });
  } catch (err) {
    logger.warn('coachExtendedContext: failed to fetch workoutPlans', err?.message || err);
  }

  if (!plans.length) return null;

  plans.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return String(b.id).localeCompare(String(a.id));
  });

  const activePlan = plans.find((p) => p.isActive) || plans[0];
  return {
    activePlan,
    plans: plans.slice(0, MAX_PLANS_IN_PROMPT),
    totalPlans: plans.length,
  };
}

async function fetchNotesAndFilesContext(db, userId) {
  const notes = [];
  const files = [];

  try {
    const snap = await db.collection('users').doc(userId).collection('notes_and_files').limit(50).get();
    snap.docs.forEach((d) => {
      const data = d.data() || {};
      const addedBy = data.addedBy === 'trainer' ? 'trainer' : 'client';
      const created =
        data.createdAt?.toDate?.()?.toISOString?.()?.slice(0, 10) ||
        (typeof data.createdAt === 'string' ? data.createdAt.slice(0, 10) : '');

      if (data.type === 'note' || data.content || data.note || data.text) {
        notes.push({
          date: created,
          from: addedBy,
          content: truncate(data.content || data.note || data.text, NOTE_CONTENT_CHAR_CAP),
        });
        return;
      }

      files.push({
        date: created,
        from: addedBy,
        type: data.type || data.fileType || 'file',
        name: data.filename || data.fileName || data.title || data.name || 'file',
      });
    });

    notes.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    files.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  } catch (err) {
    logger.warn('coachExtendedContext: failed to fetch notes_and_files', err?.message || err);
  }

  if (!notes.length && !files.length) return null;

  return {
    notes: notes.slice(0, MAX_NOTES_IN_PROMPT),
    files: files.slice(0, MAX_FILES_IN_PROMPT),
    trainerNoteCount: notes.filter((n) => n.from === 'trainer').length,
    trainerFileCount: files.filter((f) => f.from === 'trainer').length,
  };
}

async function fetchTrainerDocumentsContext(db, userId, trainerId) {
  if (!trainerId) return null;
  const documents = [];

  try {
    const snap = await db.collection('users').doc(trainerId).collection('documents').limit(40).get();
    snap.docs.forEach((d) => {
      const data = d.data() || {};
      const shared = Array.isArray(data.sharedWith) ? data.sharedWith : [];
      if (!shared.includes(userId)) return;
      documents.push({
        title: data.title || data.name || d.id,
        type: data.type || 'document',
        preview: truncate(data.content || data.body || data.text || data.description, NOTE_CONTENT_CHAR_CAP),
      });
    });
  } catch (err) {
    logger.warn('coachExtendedContext: failed to fetch trainer documents', err?.message || err);
  }

  if (!documents.length) return null;
  return { trainerId, documents: documents.slice(0, 10) };
}

async function fetchCoachExtendedContext(db, userId, profile = {}) {
  const trainerId = String(profile?.trainerId || profile?.trainer_id || '').trim() || null;

  const [workoutPlan, notesAndFiles, trainerDocuments] = await Promise.all([
    fetchWorkoutPlanContext(db, userId),
    fetchNotesAndFilesContext(db, userId),
    fetchTrainerDocumentsContext(db, userId, trainerId),
  ]);

  return {
    workoutPlan,
    notesAndFiles,
    trainerDocuments,
    linkedTrainerId: trainerId,
  };
}

function pickTodayPlanDay(dayBlocks) {
  if (!Array.isArray(dayBlocks) || !dayBlocks.length) return { day: null, index: -1 };
  const dowNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayName = dowNames[new Date().getDay()];
  for (let i = 0; i < dayBlocks.length; i += 1) {
    const label = String(dayBlocks[i]?.day || dayBlocks[i]?.name || dayBlocks[i]?.label || '').toLowerCase();
    if (label.includes(todayName)) return { day: dayBlocks[i], index: i };
  }
  const index = Math.floor(Date.now() / 86400000) % dayBlocks.length;
  return { day: dayBlocks[index], index };
}

async function loadWorkoutPlanDoc(db, userId, planId = 'current') {
  const id = String(planId || 'current').trim() || 'current';
  try {
    const libSnap = await db.collection('users').doc(userId).collection('workoutPlans').doc(id).get();
    if (libSnap.exists) return { id, data: libSnap.data() || {} };
  } catch (_) {
    /* try current path */
  }
  if (id === 'current') {
    try {
      const curSnap = await db.doc(`users/${userId}/workoutPlan/current`).get();
      if (curSnap.exists) return { id: 'current', data: curSnap.data() || {} };
    } catch (_) {
      /* ignore */
    }
  }
  return null;
}

/** Load plan detail for openWorkoutPlan tool + coach replies. */
async function fetchOpenWorkoutPlanPayload(db, userId, planId = 'current') {
  const loaded = await loadWorkoutPlanDoc(db, userId, planId);
  if (!loaded?.data) return null;

  const { id, data } = loaded;
  const rawPlan = data.rawPlan || data.planText || data.plan || '';
  const summaryMeta = summarizePlanDoc(data, id);
  const dayBlocks = resolvePlanDayBlocks(data.structuredPlan, rawPlan);
  const { day: todayDay, index: todayIndex } = pickTodayPlanDay(dayBlocks);
  const todayPreview = todayDay ? formatPlanDayBlock(todayDay, todayIndex) : null;

  return {
    planId: id,
    title: data.title || data.name || summaryMeta?.title || 'Workout plan',
    summary: summaryMeta?.summary || extractStructuredPlanSummary(data.structuredPlan, rawPlan),
    todayPreview,
    dayCount: summaryMeta?.dayCount || dayBlocks.length,
    exerciseCount: summaryMeta?.exerciseCount || countDayExercises(dayBlocks),
  };
}

module.exports = {
  fetchCoachExtendedContext,
  fetchOpenWorkoutPlanPayload,
  extractStructuredPlanSummary,
  summarizeRawPlan,
  resolvePlanDayBlocks,
  countDayExercises,
};
