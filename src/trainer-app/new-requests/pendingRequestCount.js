// Live count + list of pending client requests for the signed-in trainer.
// Flow: initial one-shot fetch → subscribe to the trainer's conversations → on any change, debounce and re-fetch.
// Used by the trainer's request inbox screen and the badge on the dashboard.

import { useState, useEffect, useCallback, useRef } from 'react';
// vocab: onSnapshot = Firestore LIVE listener — fires now with current data and again on every
// change, until you call the unsubscribe function it returns.
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import { getTrainerPendingRequests } from './loadPendingTraineeRequests';

// ===== NAMED CONSTANTS =====

const CONVERSATIONS_COLLECTION = 'conversations';
// Why debounce at all: getTrainerPendingRequests runs one query PER conversation, so firing
// it on every snapshot would multiply reads. A burst of changes collapses into one re-fetch.
// Manipulate here: raise this to cut Firestore reads further, lower it to make the badge feel snappier.
const REFRESH_DEBOUNCE_MS = 400;

// ===== HELPER FUNCTIONS =====

function trainerConversationsQuery(trainerUid) {
  return query(
    collection(db, CONVERSATIONS_COLLECTION),
    where('participants', 'array-contains', trainerUid),
  );
}

// ===== MAIN FUNCTION =====

/**
 * Hook to fetch and refresh pending client requests for a trainer.
 * Subscribes to the trainer's conversations so the badge/count updates in
 * realtime when a new request comes in or an existing one is accepted/rejected.
 * Hooks stay in this order: requests, loading, error, timer ref, refresh, then the listener effect.
 * @param {string} trainerUid
 * @returns {{ requests: Array, loading: boolean, error: string|null, refresh: Function }}
 */
export function pendingRequestCount(trainerUid) {
  const [requests, setRequests] = useState([]);
  // Starts true so the UI shows a skeleton on first mount rather than flashing "no requests".
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  // vocab: useRef = a mutable box that survives re-renders WITHOUT causing one. Perfect for a
  // timer id: we need to remember it to cancel it, but changing it shouldn't repaint anything.
  const refreshTimerRef = useRef(null);

  // The one place that actually loads data. Exposed to callers too (pull-to-refresh, and after
  // accepting a request) so there's a single code path for "go get the current truth".
  const refresh = useCallback(async () => {
    if (!trainerUid) {
      setRequests([]);
      setIsLoading(false);
      return;
    }
    // Clear any previous error first, so a successful retry visibly recovers the UI.
    setError(null);
    try {
      const pendingRequests = await getTrainerPendingRequests(trainerUid);
      // `|| []` because the service can return undefined on an internal bail-out, and the UI
      // maps over this value.
      setRequests(pendingRequests || []);
    } catch (fetchError) {
      // vocab: __DEV__ = React Native's build-time flag, true only in development. Logging is
      // gated so production consoles stay quiet.
      if (__DEV__) console.error('pendingRequestCount:', fetchError);
      setError(fetchError.message);
      setRequests([]);
    } finally {
      // finally, not per-branch: loading must end on success AND failure, or the UI hangs on a
      // spinner forever after an error.
      setIsLoading(false);
    }
  }, [trainerUid]);

  // Sets up the live subscription. Re-runs whenever the trainer changes (sign-out/sign-in), which
  // tears down the old listener first — that's what prevents a stale listener leaking data from
  // the previous account.
  useEffect(() => {
    if (!trainerUid || !db) {
      setRequests([]);
      setIsLoading(false);
      // Returning undefined (no cleanup) is valid — there's nothing to tear down on this path.
      return undefined;
    }

    setIsLoading(true);
    refresh();

    // Realtime: any change to the trainer's conversations (new request creates
    // or touches a conversation; accept/reject updates it) triggers a debounced
    // re-fetch of pending requests.
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    // We listen to CONVERSATIONS, not messages, on purpose: a trainer has few conversations but
    // potentially thousands of messages, so this is the far cheaper thing to keep open. Any
    // request activity touches its conversation doc, which is enough of a signal to re-check.
    const unsubscribe = onSnapshot(
      trainerConversationsQuery(trainerUid),
      (conversationSnapshot) => {
        // Skip the very first snapshot's redundant refresh (initial load already ran),
        // but still refresh on any subsequent change.
        // vocab: metadata.hasPendingWrites = true when this snapshot reflects our OWN local write
        // that the server hasn't confirmed yet. Skipping those avoids re-fetching data we just
        // wrote ourselves and would fetch again when the server echo arrives.
        if (!conversationSnapshot.metadata.hasPendingWrites) scheduleRefresh();
      },
      (listenerError) => {
        // Listener errors are warned, not surfaced: they're usually transient (offline, rules
        // re-evaluating during auth). The last good `requests` value stays on screen.
        if (__DEV__) console.warn('pendingRequestCount listener:', listenerError?.message || listenerError);
      },
    );

    // Cleanup runs on unmount AND before every re-run of this effect. Both steps matter: cancel
    // the pending debounce (or it fires setState after unmount) and close the listener (or it
    // keeps billing reads and holding a reference to this component).
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      try {
        unsubscribe();
      } catch (_) {
        /* ignore */
      }
    };
  }, [trainerUid, refresh]);

  return { requests, loading: isLoading, error, refresh };
}
