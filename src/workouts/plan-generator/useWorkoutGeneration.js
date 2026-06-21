/**
 * Workout plan generation state + API orchestration.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { auth } from '../../app-start/config';
import {
  formatWorkoutLimitResetLabel,
  nextMonthResetsAtIso,
  nextMonthResetDate,
  resolveWorkoutGenerationUsage,
} from './trackWorkoutGenerationUsage';
import { requestWorkoutPlanFromApi } from './requestWorkoutPlan';
import {
  readWorkoutGenerationSession,
  subscribeWorkoutGenerationSession,
} from './workoutPlanGenerationSession';

export function useWorkoutGeneration({ profileSubjectUid, readOnly, onHydratePlan }) {
  const [workoutGenUsage, setWorkoutGenUsage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [planReadyPending, setPlanReadyPending] = useState(false);
  const [generatingMessageIndex, setGeneratingMessageIndex] = useState(0);

  const plansUsedThisMonth = Number(workoutGenUsage?.generations_used) || 0;
  const planGenerationLimit = Number(workoutGenUsage?.generations_limit) || 3;
  const plansRemaining = Math.max(0, planGenerationLimit - plansUsedThisMonth);

  const nextResetDate = useMemo(() => {
    const raw = workoutGenUsage?.resets_at || nextMonthResetsAtIso();
    const d = new Date(`${String(raw).slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? nextMonthResetDate() : d;
  }, [workoutGenUsage?.resets_at]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const uid = profileSubjectUid || auth.currentUser?.uid;
      if (!uid) return;
      const usage = await resolveWorkoutGenerationUsage(uid);
      if (mounted) setWorkoutGenUsage(usage);
    })();
    return () => {
      mounted = false;
    };
  }, [profileSubjectUid]);

  useEffect(() => {
    const uid = profileSubjectUid || auth.currentUser?.uid;
    if (!uid || readOnly) return undefined;

    let cancelled = false;
    (async () => {
      const session = await readWorkoutGenerationSession(uid);
      if (cancelled) return;
      if (session.inFlight) setIsGenerating(true);
      if (session.pendingReady) {
        setPlanReadyPending(true);
        await onHydratePlan?.(uid);
      }
    })();

    const unsub = subscribeWorkoutGenerationSession((session) => {
      if (session.uid !== uid) return;
      setIsGenerating(!!session.inFlight);
      if (session.pendingReady && !session.inFlight) {
        setPlanReadyPending(true);
        onHydratePlan?.(uid);
      } else if (!session.inFlight) {
        setPlanReadyPending(false);
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [profileSubjectUid, readOnly, onHydratePlan]);

  const fetchWorkoutPlanFromServer = useCallback(async (data, subjectUserId) => {
    const uid = subjectUserId || auth.currentUser?.uid;
    const { text, usage } = await requestWorkoutPlanFromApi(data, uid);
    const merged = await resolveWorkoutGenerationUsage(uid, { apiUsage: usage, justGenerated: true });
    setWorkoutGenUsage(merged);
    return text;
  }, []);

  const refreshUsage = useCallback(async (uid, opts = {}) => {
    const usage = await resolveWorkoutGenerationUsage(uid, opts);
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
