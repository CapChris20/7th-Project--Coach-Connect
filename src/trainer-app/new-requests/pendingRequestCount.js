// Live pending client-request list + loading/error for the signed-in trainer.
// Flow: first fetch → subscribe to trainer conversations → debounced re-fetch when a thread changes.
// Used by NewTraineeRequestsScreen and dashboard badge. Hook order below is frozen.
// Firebase projectId stays anatrox-auth (cloudConnection only).

import { useState, useEffect, useCallback, useRef } from 'react';
// vocab: onSnapshot = live Firestore listener; returns unsubscribe to call on cleanup.
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import { getTrainerPendingRequests } from './loadPendingTraineeRequests';

// ===== NAMED CONSTANTS =====

const CONVERSATIONS_COLLECTION = 'conversations';
// Why debounce: getTrainerPendingRequests walks every conversation — snapshot bursts would multiply reads.
// Manipulate here: higher = fewer reads; lower = snappier badge.
const REFRESH_DEBOUNCE_MS = 400;

// ===== MAIN FUNCTION =====

/**
 * Hook: pending request cards + loading/error + manual refresh for one trainer uid.
 * Return keys stay frozen: requests / loading / error / refresh.
 * @param {string|null|undefined} trainerUid
 * @returns {{ requests: Array, loading: boolean, error: string|null, refresh: Function }}
 */
export function pendingRequestCount(trainerUid) {
  // Hook order frozen: requests → loading → error → timer ref → refresh → effect.
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const refreshTimerRef = useRef(null);

  const refresh = useCallback(async () => {
    // 1. No trainer → empty list and stop the spinner.
    if (!trainerUid) {
      setRequests([]);
      setIsLoading(false);
      return;
    }

    // 2. Clear stale error so a successful retry visibly recovers the UI.
    setError(null);

    // 3. Load cards from Firestore; tolerate a missing return by coercing to [].
    try {
      const pendingRequests = await getTrainerPendingRequests(trainerUid);
      setRequests(pendingRequests || []);
    } catch (fetchError) {
      if (__DEV__) console.error('pendingRequestCount:', fetchError);
      setError(fetchError.message);
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, [trainerUid]);

  useEffect(() => {
    // 1. Sign-out or missing db → reset and skip listener setup.
    if (!trainerUid || !db) {
      setRequests([]);
      setIsLoading(false);
      return undefined;
    }

    // 2. Initial load + show loading while the first fetch runs.
    setIsLoading(true);
    refresh();

    // 3. Collapse rapid conversation snapshots into one re-fetch.
    const scheduleDebouncedRefresh = () => {
      scheduleRefreshAfterDebounce(refreshTimerRef, refresh);
    };

    // 4. Listen to conversations (cheaper than every message doc).
    const unsubscribe = onSnapshot(
      buildTrainerConversationsQuery(trainerUid),
      (conversationSnapshot) => {
        // vocab: hasPendingWrites = local write not echoed yet — skip to avoid double fetch.
        const stillWritingLocally = conversationSnapshot.metadata.hasPendingWrites;
        if (stillWritingLocally) return;
        scheduleDebouncedRefresh();
      },
      (listenerError) => {
        if (__DEV__) console.warn('pendingRequestCount listener:', listenerError?.message || listenerError);
      },
    );

    // 5. Cleanup debounce timer + listener on unmount or trainer change.
    return () => {
      clearPendingRefreshTimer(refreshTimerRef);
      safelyStopListener(unsubscribe);
    };
  }, [trainerUid, refresh]);

  return { requests, loading: isLoading, error, refresh };
}

// ===== PLUMBING — skip unless debugging listener / debounce =====

function buildTrainerConversationsQuery(trainerUid) {
  return query(
    collection(db, CONVERSATIONS_COLLECTION),
    where('participants', 'array-contains', trainerUid),
  );
}

function scheduleRefreshAfterDebounce(refreshTimerRef, refresh) {
  if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  refreshTimerRef.current = setTimeout(() => {
    refresh();
  }, REFRESH_DEBOUNCE_MS);
}

function clearPendingRefreshTimer(refreshTimerRef) {
  if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
}

function safelyStopListener(unsubscribe) {
  try {
    unsubscribe();
  } catch (_) {
    /* ignore */
  }
}
