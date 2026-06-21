/**
 * manual Workout Plan Service
 *
 * Purpose: Data/service layer: manual Workout Plan Service. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: newLocalId, parseDurationWeeks, buildStructuredWorkoutPlanFromManualDraft, buildTrainerPlanFirestorePayload, buildClientAssignedPlanDoc, createManualWorkoutPlan, updateManualWorkoutPlan, getManualWorkoutPlan
 *
 * @file-header
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../app-start/config';
import { searchManualExerciseLibrary } from './manualExerciseLibrarySeed';

export const TRAINER_WORKOUT_PLANS_COLLECTION = 'trainer_workout_plans';

const DAY_NAME_TO_SHORT = {
  sunday: 'SUN',
  monday: 'MON',
  tuesday: 'TUE',
  wednesday: 'WED',
  thursday: 'THU',
  friday: 'FRI',
  saturday: 'SAT',
};

const SHORT_CYCLE = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export function newLocalId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function parseDurationWeeks(durationLabel) {
  const s = String(durationLabel || '').toLowerCase();
  if (!s.trim()) return 4;
  if (s.includes('ongoing')) return 12;
  const m = s.match(/(\d+)/);
  if (!m) return 4;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n)) return 4;
  return Math.min(52, Math.max(1, n));
}

function inferTrainingDayFlags(dayNames) {
  const flags = [false, false, false, false, false, false, false];
  let any = false;
  (dayNames || []).forEach((raw) => {
    const key = String(raw || '')
      .toLowerCase()
      .replace(/^day\s*\d+\s*[—\-–:]*\s*/i, '')
      .trim();
    const short = DAY_NAME_TO_SHORT[key];
    if (short) {
      const idx = SHORT_CYCLE.indexOf(short);
      if (idx >= 0) {
        flags[idx] = true;
        any = true;
      }
    }
  });
  if (any) return flags;
  const n = Math.min(7, Math.max(1, (dayNames || []).length));
  for (let i = 0; i < n; i++) flags[i] = true;
  return flags;
}

function formatRepsLabel(reps) {
  if (reps == null) return '—';
  if (typeof reps === 'number' && Number.isFinite(reps)) return String(reps);
  if (typeof reps === 'object' && reps.min != null && reps.max != null) {
    if (Number(reps.min) === Number(reps.max)) return String(reps.min);
    return `${reps.min}-${reps.max}`;
  }
  return String(reps);
}

function formatRestLabel(restSeconds) {
  const sec = Number(restSeconds);
  if (!Number.isFinite(sec) || sec <= 0) return '—';
  if (sec % 60 === 0) return `${sec / 60} min`;
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s ? `${m}:${String(s).padStart(2, '0')}` : `${m} min`;
  }
  return `${sec}s`;
}

/**
 * Maps manual builder state → WorkoutPlanGeneratorScreen `structuredPlan.workoutPlan` rows.
 */
export function buildStructuredWorkoutPlanFromManualDraft({
  planName,
  planType,
  duration,
  description,
  workoutDays,
}) {
  const overviewParts = [
    String(description || '').trim(),
    `Program: ${planName}.`,
    `Focus: ${planType}.`,
    `Duration target: ${duration}.`,
  ].filter(Boolean);
  const overview = overviewParts.join(' ');

  const workoutPlan = (workoutDays || []).map((d, index) => {
    const dayLabel = String(d.dayName || `Day ${d.dayNumber || index + 1}`).trim();
    const short =
      DAY_NAME_TO_SHORT[String(dayLabel).toLowerCase().replace(/^day\s*\d+\s*[—\-–:]*\s*/i, '')] ||
      SHORT_CYCLE[index % SHORT_CYCLE.length];

    const exercises = (d.exercises || []).map((ex) => {
      const sets = Number(ex.sets);
      const setsStr = Number.isFinite(sets) && sets > 0 ? String(sets) : '1';
      const repsStr = formatRepsLabel(ex.reps);
      const restStr = formatRestLabel(ex.restSeconds);
      const notes = [
        ex.notes,
        ex.tempo ? `Tempo: ${ex.tempo}` : '',
        ex.weight ? `Target load: ${ex.weight}` : '',
        ex.progression ? `Progression: ${ex.progression}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      return {
        name: String(ex.exerciseName || '').trim() || 'Exercise',
        sets: setsStr,
        reps: repsStr,
        rest: restStr,
        muscle: (ex.muscleGroups && ex.muscleGroups[0]) || planType || '',
        notes: notes || undefined,
      };
    });

    return {
      short,
      day: dayLabel,
      focus: `${planType} — ${dayLabel}`,
      focusColor: 'pink',
      rest: exercises.length === 0,
      exercises,
    };
  });

  return { overview, workoutPlan };
}

export function buildTrainerPlanFirestorePayload(draft, trainerId, planId) {
  const durationWeeks = parseDurationWeeks(draft.duration);
  const trainingDays = inferTrainingDayFlags((draft.workoutDays || []).map((d) => d.dayName));
  const structuredPlan = buildStructuredWorkoutPlanFromManualDraft(draft);
  const planText = JSON.stringify(structuredPlan);

  return {
    id: planId,
    trainerId,
    source: 'manualBuilder',
    planKind: 'manual',
    planName: String(draft.planName || '').trim(),
    category: String(draft.planType || 'Custom').trim(),
    duration: String(draft.duration || '4 weeks'),
    durationWeeks,
    description: String(draft.description || '').trim(),
    workoutDays: draft.workoutDays || [],
    assignedClients: Array.isArray(draft.assignedClients) ? [...new Set(draft.assignedClients.filter(Boolean))] : [],
    structuredPlan,
    planText,
    trainingDays,
    daysPerWeek: (draft.workoutDays || []).length || 0,
    totalWeeks: durationWeeks,
    weeksCompleted: 0,
    sessionMinutes: 50,
    title: String(draft.planName || '').trim(),
    name: String(draft.planName || '').trim(),
    focus: String(draft.planType || 'Custom').trim(),
    goal: 'manual',
    assigned: false,
    updatedAt: serverTimestamp(),
  };
}

export function buildClientAssignedPlanDoc(trainerPayload, { trainerId, clientId, planId }) {
  const clientIds = trainerPayload.assignedClients || [];
  const assigned = clientIds.includes(clientId);
  return {
    id: planId,
    title: trainerPayload.title || trainerPayload.planName,
    name: trainerPayload.name || trainerPayload.planName,
    planText: trainerPayload.planText,
    structuredPlan: trainerPayload.structuredPlan,
    trainerId,
    trainerPlanId: planId,
    clientId,
    userId: clientId,
    source: 'manualBuilder',
    planKind: 'manual',
    category: trainerPayload.category,
    duration: trainerPayload.duration,
    durationWeeks: trainerPayload.durationWeeks,
    trainingDays: trainerPayload.trainingDays,
    daysPerWeek: trainerPayload.daysPerWeek,
    totalWeeks: trainerPayload.totalWeeks,
    weeksCompleted: trainerPayload.weeksCompleted ?? 0,
    sessionMinutes: trainerPayload.sessionMinutes,
    focus: trainerPayload.focus || trainerPayload.category,
    goal: 'manual',
    assigned: assigned || true,
    status: 'active',
    generatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    _source: 'usersSubcollection',
  };
}

export async function createManualWorkoutPlan(trainerId, draft) {
  if (!db || !trainerId) return { success: false, error: 'Missing db or trainer' };
  const planRef = doc(collection(db, TRAINER_WORKOUT_PLANS_COLLECTION));
  const planId = planRef.id;
  await setDoc(planRef, {
    ...buildTrainerPlanFirestorePayload({ ...draft, assignedClients: draft.assignedClients || [] }, trainerId, planId),
    id: planId,
    createdAt: serverTimestamp(),
  });
  return { success: true, planId };
}

export async function updateManualWorkoutPlan(trainerId, planId, draft) {
  if (!db || !trainerId || !planId) return { success: false, error: 'Missing ids' };
  const ref = doc(db, TRAINER_WORKOUT_PLANS_COLLECTION, planId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { success: false, error: 'Plan not found' };
  const data = snap.data() || {};
  if (String(data.trainerId) !== String(trainerId)) return { success: false, error: 'Forbidden' };
  await setDoc(
    ref,
    {
      ...buildTrainerPlanFirestorePayload({ ...draft, assignedClients: draft.assignedClients ?? data.assignedClients ?? [] }, trainerId, planId),
      id: planId,
      createdAt: data.createdAt || serverTimestamp(),
    },
    { merge: true },
  );
  return { success: true, planId };
}

export async function getManualWorkoutPlan(trainerId, planId) {
  if (!db || !planId) return null;
  const snap = await getDoc(doc(db, TRAINER_WORKOUT_PLANS_COLLECTION, planId));
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  if (trainerId && String(data.trainerId) !== String(trainerId)) return null;
  return { id: snap.id, ...data };
}

export async function listManualWorkoutPlansForTrainer(trainerId, max = 50) {
  if (!db || !trainerId) return [];
  try {
    const qy = query(
      collection(db, TRAINER_WORKOUT_PLANS_COLLECTION),
      where('trainerId', '==', trainerId),
      where('source', '==', 'manualBuilder'),
      orderBy('updatedAt', 'desc'),
    );
    const snap = await getDocs(qy);
    const out = [];
    snap.forEach((d) => {
      if (out.length >= max) return;
      out.push({ id: d.id, ...d.data() });
    });
    return out;
  } catch (e) {
    try {
      const qy2 = query(collection(db, TRAINER_WORKOUT_PLANS_COLLECTION), where('trainerId', '==', trainerId));
      const snap2 = await getDocs(qy2);
      const rows = [];
      snap2.forEach((d) => {
        const x = d.data() || {};
        if (String(x.source) === 'manualBuilder') rows.push({ id: d.id, ...x });
      });
      rows.sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
        const tb = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      return rows.slice(0, max);
    } catch (e2) {
      console.warn('listManualWorkoutPlansForTrainer:', e2?.message || e2);
      return [];
    }
  }
}

/**
 * Writes / merges client copies under users/{clientId}/workoutPlans/{planId}
 */
export async function syncManualPlanAssignments(trainerId, planId, draft) {
  if (!db || !trainerId || !planId) return { success: false, error: 'Missing parameters' };
  const baseRef = doc(db, TRAINER_WORKOUT_PLANS_COLLECTION, planId);
  const snap = await getDoc(baseRef);
  if (!snap.exists()) return { success: false, error: 'Plan not found' };
  const prev = snap.data() || {};
  if (String(prev.trainerId) !== String(trainerId)) return { success: false, error: 'Forbidden' };

  const clientIds = [...new Set((draft.assignedClients || []).filter(Boolean))];
  const payload = buildTrainerPlanFirestorePayload({ ...draft, assignedClients: clientIds }, trainerId, planId);

  await setDoc(
    baseRef,
    {
      ...payload,
      assignedClients: clientIds,
      assigned: clientIds.length > 0,
      createdAt: prev.createdAt || serverTimestamp(),
    },
    { merge: true },
  );

  const prevClients = Array.isArray(prev.assignedClients) ? prev.assignedClients : [];
  const removed = prevClients.filter((id) => !clientIds.includes(id));
  const added = clientIds.filter((id) => !prevClients.includes(id));
  const kept = clientIds.filter((id) => prevClients.includes(id));

  const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  for (const group of chunk(removed, 400)) {
    const batch = writeBatch(db);
    group.forEach((cid) => batch.delete(doc(db, 'users', cid, 'workoutPlans', planId)));
    await batch.commit();
  }

  const writeIds = [...new Set([...added, ...kept])];
  for (const group of chunk(writeIds, 400)) {
    const batch = writeBatch(db);
    group.forEach((cid) => {
      batch.set(doc(db, 'users', cid, 'workoutPlans', planId), buildClientAssignedPlanDoc(payload, { trainerId, clientId: cid, planId }), {
        merge: true,
      });
    });
    await batch.commit();
  }

  return { success: true, planId, assignedClients: clientIds };
}

export async function saveManualPlanDraft(trainerId, draft, existingPlanId) {
  if (!db || !trainerId) return { success: false, error: 'Missing trainer' };
  let planId = existingPlanId;
  if (!planId) {
    const created = await createManualWorkoutPlan(trainerId, draft);
    if (!created.success) return created;
    planId = created.planId;
  }
  return syncManualPlanAssignments(trainerId, planId, draft);
}

export async function deleteManualWorkoutPlan(trainerId, planId) {
  if (!db || !trainerId || !planId) return { success: false, error: 'Missing parameters' };
  const ref = doc(db, TRAINER_WORKOUT_PLANS_COLLECTION, planId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { success: false, error: 'Not found' };
  const data = snap.data() || {};
  if (String(data.trainerId) !== String(trainerId)) return { success: false, error: 'Forbidden' };
  const clients = Array.isArray(data.assignedClients) ? data.assignedClients : [];
  for (let i = 0; i < clients.length; i += 400) {
    const batch = writeBatch(db);
    clients.slice(i, i + 400).forEach((cid) => {
      batch.delete(doc(db, 'users', cid, 'workoutPlans', planId));
    });
    await batch.commit();
  }
  await deleteDoc(ref);
  return { success: true };
}

export function searchExercisesForBuilder(query, limit) {
  return searchManualExerciseLibrary(query, limit);
}

/**
 * Hydrates builder UI state from a Firestore trainer plan doc.
 */
export function draftFromTrainerPlanDoc(docData) {
  if (!docData || typeof docData !== 'object') return null;
  const workoutDays = Array.isArray(docData.workoutDays)
    ? docData.workoutDays.map((d, i) => ({
        id: d.dayId || newLocalId('day'),
        dayName: d.dayName || `Day ${i + 1}`,
        dayNumber: d.dayNumber ?? i + 1,
        exercises: Array.isArray(d.exercises)
          ? d.exercises.map((ex) => {
              const min = ex.reps != null && typeof ex.reps === 'object' ? Number(ex.reps.min) : NaN;
              const max = ex.reps != null && typeof ex.reps === 'object' ? Number(ex.reps.max) : NaN;
              const fixed = Number.isFinite(min) && Number.isFinite(max) && min === max;
              return {
                id: ex.exerciseId || newLocalId('ex'),
                libraryExerciseId: ex.libraryExerciseId || null,
                exerciseName: ex.exerciseName || '',
                sets: typeof ex.sets === 'number' ? ex.sets : parseInt(ex.sets, 10) || 3,
                repMode: fixed ? 'fixed' : 'range',
                repsSingle: fixed ? min : 10,
                repsMin: Number.isFinite(min) ? min : 8,
                repsMax: Number.isFinite(max) ? max : 12,
                restSeconds: typeof ex.restSeconds === 'number' ? ex.restSeconds : 120,
                notes: ex.notes || '',
                tempo: ex.tempo || '',
                weight: ex.weight != null ? String(ex.weight) : '',
                progression: ex.progression || '',
                muscleGroups: ex.muscleGroups || [],
              };
            })
          : [],
      }))
    : [];

  return {
    planName: docData.planName || docData.title || '',
    planType: docData.category || docData.planType || 'Custom',
    duration: docData.duration || '4 weeks',
    description: docData.description || '',
    workoutDays,
    assignedClients: Array.isArray(docData.assignedClients) ? [...docData.assignedClients] : [],
  };
}
