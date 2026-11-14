// Monthly workout-plan generation budget, in-flight flag, and the server call that builds a plan.
// Flow: load usage for the signed-in user → watch a background build session → expose fetch + refresh.
// Used by: create-workout-plan screens. Hooks stay in `workoutPlanCreation` so callers use it like a custom hook.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { auth } from '../../app-start/cloudConnection';
import {
  formatWorkoutLimitResetLabel,
  nextMonthResetsAtIso,
  nextMonthResetDate,
  resolveWorkoutGenerationUsage,
} from './countPlansCreated';
import { askForWorkoutPlanFromApi } from './askForWorkoutPlan';
import {
  readWorkoutGenerationSession,
  subscribeWorkoutGenerationSession,
} from './keepPlanBuildingInBackground';

// ===== NAMED CONSTANTS =====

// Manipulate here: fallback when Firestore has no generations_limit yet
const DEFAULT_PLAN_GENERATION_LIMIT = 3;
// Manipulate here: noon local keeps the calendar day stable across time zones when parsing ISO date strings
const NOON_LOCAL_TIME = 'T12:00:00';
const ISO_DATE_ONLY_LENGTH = 10;

// ===== HELPER FUNCTIONS =====

/**
 * Turn resets_at into a Date at local noon.
 * Bad / partial ISO strings fall back to the first of next month.
 * @param {string} resetAtString
 * @returns {Date}
 */
function workoutLimitResetDateFromIso(resetAtString) {
  const dateOnly = String(resetAtString).slice(0, ISO_DATE_ONLY_LENGTH);
  const resetAtLocalNoon = new Date(`${dateOnly}${NOON_LOCAL_TIME}`);
  const parsedMillis = resetAtLocalNoon.getTime();

  if (Number.isNaN(parsedMillis)) {
    return nextMonthResetDate();
  }
  return resetAtLocalNoon;
}

/**
 * How many plans this user already generated this billing month.
 * @param {object|null} workoutGenUsage
 * @returns {number}
 */
function countPlansUsedThisMonth(workoutGenUsage) {
  // vocab/symbol: ?. = stop if usage is null
  const usedCount = Number(workoutGenUsage?.generations_used);
  if (!usedCount) {
    return 0;
  }
  return usedCount;
}

/**
 * Monthly cap from usage, or the hard-coded default when Firestore has none.
 * @param {object|null} workoutGenUsage
 * @returns {number}
 */
function planGenerationLimitFromUsage(workoutGenUsage) {
  const limitFromServer = Number(workoutGenUsage?.generations_limit);
  if (!limitFromServer) {
    return DEFAULT_PLAN_GENERATION_LIMIT;
  }
  return limitFromServer;
}

/**
 * Live session snapshot → spinner + “plan ready” flags.
 * Hydrates the plan UI when a background build just finished.
 * @param {object} session
 * @param {string} expectedUserId
 * @param {Function} setIsGenerating
 * @param {Function} setPlanReadyPending
 * @param {Function} [onHydratePlan]
 */
function syncUiFromWorkoutGenerationSession(
  session,
  expectedUserId,
  setIsGenerating,
  setPlanReadyPending,
  onHydratePlan,
) {
  // Ignore events for a different user (trainer viewing a client, race on sign-out, etc.).
  if (session.uid !== expectedUserId) {
    return;
  }

  const generationStillRunning = Boolean(session.inFlight);
  setIsGenerating(generationStillRunning);

  const planFinishedInBackground = session.pendingReady && !session.inFlight;
  if (planFinishedInBackground) {
    setPlanReadyPending(true);
    // vocab/symbol: ?. = call hydrate only when the screen passed a callback
    onHydratePlan?.(expectedUserId);
    return;
  }

  if (!generationStillRunning) {
    setPlanReadyPending(false);
  }
}

// ===== MAIN FUNCTION =====

/**
 * Hook: monthly plan budget + background generation state for create-plan screens.
 * Flow: 1. load usage  2. subscribe to session  3. fetch plan  4. refresh usage
 * @param {object} options
 * @param {string} [options.profileSubjectUid]
 * @param {boolean} [options.readOnly]
 * @param {Function} [options.onHydratePlan]
 * @returns {object}
 */
// vocab: this is a React hook shape (useState/useEffect inside) — screens call it like useWorkoutPlanCreation.
export function workoutPlanCreation({ profileSubjectUid, readOnly, onHydratePlan }) {
  // Hook order frozen — do not reorder these useState / useEffect / useMemo / useCallback calls.
  const [workoutGenUsage, setWorkoutGenUsage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [planReadyPending, setPlanReadyPending] = useState(false);
  const [generatingMessageIndex, setGeneratingMessageIndex] = useState(0);

  const plansUsedThisMonth = countPlansUsedThisMonth(workoutGenUsage);
  const planGenerationLimit = planGenerationLimitFromUsage(workoutGenUsage);
  const plansRemaining = Math.max(0, planGenerationLimit - plansUsedThisMonth);

  // vocab: useMemo = recompute only when resets_at changes (avoids new Date every render)
  const nextResetDate = useMemo(() => {
    const resetAtFromServer = workoutGenUsage?.resets_at || nextMonthResetsAtIso();
    return workoutLimitResetDateFromIso(resetAtFromServer);
  }, [workoutGenUsage?.resets_at]);

  // 1. On mount: load this month's generation usage for whoever is signed in.
  useEffect(() => {
    let componentStillMounted = true;

    (async () => {
      const signedInUserId = auth.currentUser?.uid;
      if (!signedInUserId) {
        return;
      }

      const usageSnapshot = await resolveWorkoutGenerationUsage(signedInUserId);
      if (componentStillMounted) {
        setWorkoutGenUsage(usageSnapshot);
      }
    })();

    return () => {
      componentStillMounted = false;
    };
  }, []);

  // 2. When not read-only: restore in-flight state, then subscribe to background session updates.
  useEffect(() => {
    const subjectUserId = profileSubjectUid || auth.currentUser?.uid;
    if (!subjectUserId || readOnly) {
      return undefined;
    }

    let effectCancelled = false;

    (async () => {
      const savedSession = await readWorkoutGenerationSession(subjectUserId);
      if (effectCancelled) {
        return;
      }

      if (savedSession.inFlight) {
        setIsGenerating(true);
      }

      if (savedSession.pendingReady) {
        setPlanReadyPending(true);
        await onHydratePlan?.(subjectUserId);
      }
    })();

    const stopListeningToSession = subscribeWorkoutGenerationSession((liveSession) => {
      syncUiFromWorkoutGenerationSession(
        liveSession,
        subjectUserId,
        setIsGenerating,
        setPlanReadyPending,
        onHydratePlan,
      );
    });

    return () => {
      effectCancelled = true;
      stopListeningToSession();
    };
  }, [profileSubjectUid, readOnly, onHydratePlan]);

  // 3. Server round-trip: build plan text, then merge fresh usage counters.
  // vocab: useCallback = stable function identity so child effects do not re-fire every render
  const fetchWorkoutPlanFromServer = useCallback(async (requestPayload, subjectUserId) => {
    const userIdForRequest = subjectUserId || auth.currentUser?.uid;
    const apiResult = await askForWorkoutPlanFromApi(requestPayload, userIdForRequest);
    const planText = apiResult.text;
    const usageFromApi = apiResult.usage;

    const mergedUsage = await resolveWorkoutGenerationUsage(userIdForRequest, {
      apiUsage: usageFromApi,
      justGenerated: true,
    });
    setWorkoutGenUsage(mergedUsage);
    return planText;
  }, []);

  // 4. Pull latest usage without generating (after errors, profile edits, etc.).
  const refreshUsage = useCallback(async (userId, refreshOptions = {}) => {
    const latestUsage = await resolveWorkoutGenerationUsage(userId, refreshOptions);
    setWorkoutGenUsage(latestUsage);
    return latestUsage;
  }, []);

  return {
    workoutGenUsage,
    setWorkoutGenUsage,
    isGenerating,
    setIsGenerating,
    planReadyPending,
    setPlanReadyPending,
    generatingMessageIndex,
    setGeneratingMessageIndex,
    plansUsedThisMonth,
    planGenerationLimit,
    plansRemaining,
    nextResetDate,
    formatWorkoutLimitResetLabel,
    fetchWorkoutPlanFromServer,
    refreshUsage,
  };
}
