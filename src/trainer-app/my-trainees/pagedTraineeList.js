// Paginated client roster for the trainer, with pull-to-refresh and "Load more".
// Flow: fetch one page of CRM rows → filter/enrich them via the linked-trainees resolver → merge into state.
// Used by the trainer's My Trainees list. Paginated reads so a full-collection listener cannot re-read every client on each edit.

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchTrainerClientRosterPage,
  TRAINER_ROSTER_PAGE_SIZE,
} from '../trainee-records/traineeDatabaseLocations';
import { loadMyLinkedTrainees } from '../trainee-records/loadMyLinkedTrainees';

// ===== NAMED CONSTANTS =====

// Page size lives in traineeDatabaseLocations (TRAINER_ROSTER_PAGE_SIZE) so list and fetch stay in sync.

// ===== HELPER FUNCTIONS =====

function mergeAndSortClients(existingClients, incomingClients) {
  // Dedupe by id through a Map, because the legacy rows and the paginated rows can overlap.
  // Seeding it from existingClients and then setting the new rows means the FRESH data wins, while
  // spreading the old entry first preserves any fields the new page didn't include.
  const clientsById = new Map(
    (existingClients || []).map((existingClient) => [existingClient.id, existingClient]),
  );
  for (const incomingClient of incomingClients) {
    clientsById.set(incomingClient.id, { ...(clientsById.get(incomingClient.id) || {}), ...incomingClient });
  }
  // Re-sort the whole merged list: pages arrive in Firestore order, but the roster is shown
  // alphabetically, so appending without re-sorting would interleave names wrongly.
  return [...clientsById.values()].sort((leftClient, rightClient) =>
    String(leftClient.name || '').toLowerCase().localeCompare(String(rightClient.name || '').toLowerCase()),
  );
}

function canLoadMorePage(hasMore, isLoadingMore, isLoading) {
  return hasMore && !isLoadingMore && !isLoading;
}

// ===== MAIN FUNCTION =====

/**
 * Trainer client roster — paginated Firestore reads (Load more), no full-collection listeners.
 * Hooks stay in this order: clients, loading, loadingMore, hasMore, error, lastDoc ref,
 * generation ref, loadPage, refresh, loadMore, then the initial-load effect.
 * @param {string} trainerUid
 * @returns {{
 *   clients: Array,
 *   loading: boolean,
 *   loadingMore: boolean,
 *   hasMore: boolean,
 *   error: string|null,
 *   refresh: Function,
 *   loadMore: Function,
 * }}
 */
export const pagedTraineeList = (trainerUid) => {
  const [clients, setClients] = useState([]);
  // Two separate loading flags so the UI can show a full skeleton on first load but only a small
  // spinner at the bottom while appending a page.
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  // vocab: useRef = a mutable box that survives re-renders without triggering one.
  // lastDocRef holds the Firestore cursor (the last doc of the previous page) — that's how the next
  // query knows where to resume.
  const lastDocRef = useRef(null);
  // Generation counter guarding against out-of-order async results. See its use below.
  const loadGenRef = useRef(0);

  const loadPage = useCallback(
    async (isReset) => {
      if (!trainerUid) {
        setClients([]);
        setIsLoading(false);
        setHasMore(false);
        return;
      }

      // Claim a generation number for THIS run. Every later await re-checks it, so if a newer load
      // starts (trainer taps refresh, or switches account) this stale run bails out instead of
      // overwriting the newer results — the classic async race in paginated lists.
      const loadGeneration = ++loadGenRef.current;
      if (isReset) {
        setIsLoading(true);
        // Clearing the cursor is what makes the next fetch start from the beginning.
        lastDocRef.current = null;
      } else {
        setIsLoadingMore(true);
      }

      try {
        const rosterPage = await fetchTrainerClientRosterPage(trainerUid, {
          pageSize: TRAINER_ROSTER_PAGE_SIZE,
          // On reset, no cursor = page one. Otherwise resume after the last doc we saw.
          startAfterDoc: isReset ? null : lastDocRef.current,
          // includeLegacy only on a reset: older roster docs live outside the paginated path, so
          // they're pulled in once with the first page rather than re-scanned on every "Load more".
          includeLegacy: isReset,
        });

        if (loadGeneration !== loadGenRef.current) return;

        // Second async step: verify the trainer↔client links and resolve names/photos. This is why
        // there are two generation checks — either await is a chance for a newer load to start.
        const linkedClients = await loadMyLinkedTrainees(trainerUid, rosterPage.clients);
        if (loadGeneration !== loadGenRef.current) return;

        lastDocRef.current = rosterPage.lastDoc;
        setHasMore(rosterPage.hasMore);
        // Clear a previous error on success so a recovered retry visibly resets the UI.
        setError(null);

        setClients((existingClients) => {
          if (isReset) return linkedClients;
          return mergeAndSortClients(existingClients, linkedClients);
        });
      } catch (fetchError) {
        if (loadGeneration !== loadGenRef.current) return;
        console.error('Error fetching trainer clients:', fetchError);
        setError(fetchError?.message || String(fetchError));
        // Only wipe the list if this was a fresh load. A failed "Load more" keeps the pages the
        // trainer already has on screen.
        if (isReset) setClients([]);
      } finally {
        // Guarded by the generation check too: a stale run must not clear the spinner that the
        // current, still-running load owns.
        if (loadGeneration === loadGenRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [trainerUid],
  );

  // Pull-to-refresh: start over from page one.
  const refresh = useCallback(() => loadPage(true), [loadPage]);

  // Append the next page. The three guards prevent the two ways this gets misfired: reaching the
  // end of the list, and a scroll handler firing again while a page is already in flight.
  const loadMore = useCallback(() => {
    if (!canLoadMorePage(hasMore, isLoadingMore, isLoading)) return;
    loadPage(false);
  }, [hasMore, isLoadingMore, isLoading, loadPage]);

  // Initial load, and a full reload whenever the trainer changes (loadPage's identity is keyed to
  // trainerUid, so sign-out/sign-in re-runs this with a clean list).
  useEffect(() => {
    loadPage(true);
  }, [loadPage]);

  return {
    clients,
    loading: isLoading,
    loadingMore: isLoadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
  };
};
