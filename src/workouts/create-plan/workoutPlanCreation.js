// Holds workout-plan generation state: monthly usage, in-flight flag, and the API call that builds a plan.
// Flow: load this month's usage → subscribe to a background build session → expose fetch + refresh to the screen.
// Used by: the create-workout-plan flow. Hooks stay in this function so the screen can call it like a hook.

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

const DEFAULT_PLAN_GENERATION_LIMIT = 3;
const NOON_LOCAL_TIME = 'T12:00:00';
const ISO_DATE_LENGTH = 10;

// ===== HELPER FUNCTIONS =====

/**
 * Parse resets_at as a local noon date so the calendar day does not shift across time zones.
 * A bad string falls back to the first of next month.
 * @param {string} rawResetAt
 * @returns {Date}
 */
function parseResetDate(rawResetAt) {
  const parsedResetDate = new Date(`${String(rawResetAt).slice(0, ISO_DATE_LENGTH)}${NOON_LOCAL_TIME}`);
  if (Number.isNaN(parsedResetDate.getTime())) return nextMonthResetDate();
  return parsedResetDate;
}

/**
 * @param {object|null} workoutGenUsage
 * @returns {number}
 */
function plansUsedFromUsage(workoutGenUsage) {
  return Number(workoutGenUsage?.generations_used) || 0;
}

/**
 * @param {object|null} workoutGenUsage
 * @returns {number}
 */
function planLimitFromUsage(workoutGenUsage) {
  return Number(workoutGenUsage?.generations_limit) || DEFAULT_PLAN_GENERATION_LIMIT;
}

/**
 * Apply a live session snapshot: generating while in flight, hydrate when a plan just finished.
 * @param {object} session
 * @param {string} uid
 * @param {Function} setIsGenerating
 * @param {Function} setPlanReadyPending
 * @param {Function} [onHydratePlan]
 */
function applyWorkoutGenerationSession(
  session,
  uid,
  setIsGenerating,
  setPlanReadyPending,
  onHydratePlan,
) {
  if (session.uid !== uid) return;
  setIsGenerating(!!session.inFlight);
  if (session.pendingReady && !session.inFlight) {
    setPlanReadyPending(true);
    onHydratePlan?.(uid);
  } else if (!session.inFlight) {
    setPlanReadyPending(false);
  }
}

// ===== MAIN FUNCTION =====

/**
 * Workout plan generation state + API orchestration.
 * @param {{ profileSubjectUid?: string, readOnly?: boolean, onHydratePlan?: Function }} args
 * @returns {object}
 */
export function workoutPlanCreation({ profileSubjectUid, readOnly, onHydratePlan }) {
  const [workoutGenUsage, setWorkoutGenUsage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [planReadyPending, setPlanReadyPending] = useState(false);
  const [generatingMessageIndex, setGeneratingMessageIndex] = useState(0);

  const plansUsedThisMonth = plansUsedFromUsage(workoutGenUsage);
  const planGenerationLimit = planLimitFromUsage(workoutGenUsage);
  const plansRemaining = Math.max(0, planGenerationLimit - plansUsedThisMonth);

  const nextResetDate = useMemo(() => {
    const rawResetAt = workoutGenUsage?.resets_at || nextMonthResetsAtIso();
    return parseResetDate(rawResetAt);
  }, [workoutGenUsage?.resets_at]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const usage = await resolveWorkoutGenerationUsage(uid);
      if (isMounted) setWorkoutGenUsage(usage);
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const uid = profileSubjectUid || auth.currentUser?.uid;
    if (!uid || readOnly) return undefined;

    let isCancelled = false;
    (async () => {
      const session = await readWorkoutGenerationSession(uid);
      if (isCancelled) return;
      if (session.inFlight) setIsGenerating(true);
      if (session.pendingReady) {
        setPlanReadyPending(true);
        await onHydratePlan?.(uid);
      }
    })();

    const unsubscribeFromSession = subscribeWorkoutGenerationSession((session) => {
      applyWorkoutGenerationSession(
        session,
        uid,
        setIsGenerating,
        setPlanReadyPending,
        onHydratePlan,
      );
    });

    return () => {
      isCancelled = true;
      unsubscribeFromSession();
    };
  }, [profileSubjectUid, readOnly, onHydratePlan]);

  const fetchWorkoutPlanFromServer = useCallback(async (data, subjectUserId) => {
    const uid = subjectUserId || auth.currentUser?.uid;
    const { text, usage } = await askForWorkoutPlanFromApi(data, uid);
    const mergedUsage = await resolveWorkoutGenerationUsage(uid, {
      apiUsage: usage,
      justGenerated: true,
    });
    setWorkoutGenUsage(mergedUsage);
    return text;
  }, []);

  const refreshUsage = useCallback(async (uid, options = {}) => {
    const usage = await resolveWorkoutGenerationUsage(uid, options);
    setWorkoutGenUsage(usage);
    return usage;
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
