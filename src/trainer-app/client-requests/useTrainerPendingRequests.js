/**
 * use Trainer Pending Requests
 *
 * Purpose: React hook: use Trainer Pending Requests. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: useTrainerPendingRequests
 *
 * @file-header
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../app-start/config';
import { getTrainerPendingRequests } from './loadPendingTraineeRequests';

/**
 * Hook to fetch and refresh pending client requests for a trainer.
 * Subscribes to the trainer's conversations so the badge/count updates in
 * realtime when a new request comes in or an existing one is accepted/rejected.
 */
export function useTrainerPendingRequests(trainerUid) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const refreshTimerRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!trainerUid) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await getTrainerPendingRequests(trainerUid);
      setRequests(data || []);
    } catch (err) {
      if (__DEV__) console.error('useTrainerPendingRequests:', err);
      setError(err.message);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [trainerUid]);

  useEffect(() => {
    if (!trainerUid || !db) {
      setRequests([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    // Initial load.
    refresh();

    // Realtime: any change to the trainer's conversations (new request creates
    // or touches a conversation; accept/reject updates it) triggers a debounced
    // re-fetch of pending requests.
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refresh();
      }, 400);
    };

    const convQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', trainerUid),
    );
    const unsubscribe = onSnapshot(
      convQuery,
      (snap) => {
        // Skip the very first snapshot's redundant refresh (initial load already ran),
        // but still refresh on any subsequent change.
        if (!snap.metadata.hasPendingWrites) scheduleRefresh();
      },
      (err) => {
        if (__DEV__) console.warn('useTrainerPendingRequests listener:', err?.message || err);
      },
    );

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      try {
        unsubscribe();
      } catch (_) {
        /* ignore */
      }
    };
  }, [trainerUid, refresh]);

  return { requests, loading, error, refresh };
}
