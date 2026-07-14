/**
 * client Workout Plans Library
 *
 * Purpose: Data/service layer: client Workout Plans Library. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/workouts
 * Key exports: fetchClientWorkoutPlansForLibrary
 *
 * @file-header
 */
/**
 * Loads all workout plans visible in the AI Workout Library for a client
 * (subcollection, current doc, legacy global + savedWorkoutPlans).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { auth, db } from '../../app-start/config';
import { fetchSavedWorkoutPlans, getCurrentWorkoutPlan, setCurrentWorkoutPlan } from '../active-workout/workoutService';

function isBenignLoadError(e) {
  if (!e) return false;
  const code = e.code;
  if (code === 'permission-denied' || code === 'failed-precondition') return true;
  const m = String(e.message || '').toLowerCase();
  return m.includes('missing or insufficient permissions') || m.includes('index');
}

function planDedupeKey(item) {
  if (item?.id === 'current' || item?._singleDoc) return 'workoutPlan:current';
  return `plan:${item?.id || ''}:${String(item?.rawPlan || item?.planText || '').slice(0, 80)}`;
}

function decorateCurrentPlan(data) {
  if (!data?.rawPlan && !data?.planText) return null;
  const when = data.generatedAt?.toDate?.() || (data.generatedAt ? new Date(data.generatedAt) : new Date());
  const label = when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return {
    id: 'current',
    ...data,
    title: data.title || data.name || `Workout plan · ${label}`,
    name: data.name || data.title || `Workout plan · ${label}`,
    planText: data.planText || data.rawPlan,
    rawPlan: data.rawPlan || data.planText,
    source: data.source || 'generator',
    status: data.status || 'active',
    _singleDoc: true,
    _path: data._path,
    _source: data._source || 'workoutPlanCurrent',
  };
}

function planBelongsToTrainer(plan, trainerId) {
  if (!trainerId || !plan) return true;
  const tid = String(trainerId);
  const candidates = [
    plan.trainerId,
    plan.createdBy,
    plan.assignedBy,
    plan.authorId,
    plan.ownerTrainerId,
    plan._firebase?.trainerId,
  ]
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => String(v));
  // Keep plans that explicitly belong to this trainer; also keep plans with no trainer stamp
  // only when they are that trainer's assigned/manual entries (never all clients' AI spam).
  if (candidates.length === 0) {
    const src = String(plan.source || plan._source || '');
    // Unscoped legacy AI plans without trainerId should not appear on trainer dashboard.
    if (src === 'generator' || src === 'global' || src === 'savedWorkoutPlans') return false;
    return true;
  }
  return candidates.includes(tid);
}

/**
 * @param {string} clientId
 * @param {{ trainerId?: string|null }} [opts]
 * @returns {Promise<{ plans: object[], error: string|null }>}
 */
/** One-time mirror for plans saved before library sync existed (client session only). */
async function ensureCurrentPlanMirroredToLibrary(clientId) {
  if (!clientId || !db || auth?.currentUser?.uid !== clientId) return;
  try {
    const libSnap = await getDoc(doc(db, 'users', clientId, 'workoutPlans', 'current'));
    if (libSnap.exists()) return;
    const current = await getCurrentWorkoutPlan(clientId);
    if (!current?.rawPlan && !current?.planText) return;
    await setCurrentWorkoutPlan(clientId, {
      rawPlan: current.rawPlan || current.planText,
      planText: current.planText || current.rawPlan,
      structuredPlan: current.structuredPlan || null,
      title: current.title || current.name,
      generatedAt: current.generatedAt,
    });
  } catch (_) {
    // non-fatal
  }
}

export async function fetchClientWorkoutPlansForLibrary(clientId, opts = {}) {
  if (!clientId || !db) return { plans: [], error: null };
  const trainerId = opts?.trainerId ? String(opts.trainerId) : null;

  await ensureCurrentPlanMirroredToLibrary(clientId);

  const results = [];
  const seen = new Set();
  let fatalError = null;

  const add = (item) => {
    if (!item) return;
    const key = planDedupeKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    results.push(item);
  };

  try {
    const saved = await fetchSavedWorkoutPlans(clientId, 50);
    saved.forEach((p) => add({ ...p, _source: 'usersSubcollection' }));
  } catch (e) {
    if (!isBenignLoadError(e)) fatalError = fatalError || e;
  }

  try {
    const current = await getCurrentWorkoutPlan(clientId);
    const decorated = decorateCurrentPlan({
      ...current,
      _path: ['users', clientId, 'workoutPlan', 'current'],
      _source: 'workoutPlanCurrent',
    });
    if (decorated) add(decorated);
  } catch (e) {
    if (!isBenignLoadError(e)) fatalError = fatalError || e;
  }

  if (!results.some((p) => p.id === 'current' || p._singleDoc)) {
    try {
      const snap = await getDoc(doc(db, 'users', clientId, 'workoutPlan', 'current'));
      if (snap.exists()) {
        const decorated = decorateCurrentPlan({
          id: snap.id,
          ...snap.data(),
          _path: ['users', clientId, 'workoutPlan', 'current'],
          _source: 'workoutPlanCurrent',
        });
        if (decorated) add(decorated);
      }
    } catch (e) {
      if (!isBenignLoadError(e)) fatalError = fatalError || e;
    }
  }

  try {
    const globalRef = collection(db, 'workoutPlans');
    let snap;
    try {
      snap = await getDocs(query(globalRef, where('clientId', '==', clientId), orderBy('generatedAt', 'desc')));
    } catch (_) {
      snap = await getDocs(query(globalRef, where('clientId', '==', clientId)));
    }
    snap.forEach((d) => add({ id: d.id, ...d.data(), _source: 'global' }));
  } catch (e) {
    if (!isBenignLoadError(e)) fatalError = fatalError || e;
  }

  try {
    const legacyRef = collection(db, 'savedWorkoutPlans');
    const snap = await getDocs(query(legacyRef, where('userId', '==', clientId)));
    snap.forEach((d) => add({ id: d.id, ...d.data(), _source: 'savedWorkoutPlans' }));
  } catch (e) {
    if (!isBenignLoadError(e)) fatalError = fatalError || e;
  }

  const filtered = trainerId ? results.filter((p) => planBelongsToTrainer(p, trainerId)) : results;

  filtered.sort((a, b) => {
    const at =
      a.generatedAt?.toDate?.()?.getTime() ??
      (a.generatedAt ? new Date(a.generatedAt).getTime() : 0) ??
      a.createdAt?.toDate?.()?.getTime() ??
      0;
    const bt =
      b.generatedAt?.toDate?.()?.getTime() ??
      (b.generatedAt ? new Date(b.generatedAt).getTime() : 0) ??
      b.createdAt?.toDate?.()?.getTime() ??
      0;
    return bt - at;
  });

  return {
    plans: filtered,
    error: filtered.length > 0 ? null : fatalError ? String(fatalError.message || fatalError) : null,
  };
}
