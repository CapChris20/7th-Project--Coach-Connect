// Paginated “My Trainees” roster hook for a signed-in trainer.
// Flow: reset or load-more → one Firestore page → enrich link fields → merge/sort into state.
// Used by TrainerAppStart, My Trainees, and scheduling screens that need the client chip list.
// Hook order and return keys (clients / loading / loadingMore / hasMore / error / refresh / loadMore) stay frozen.

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchTrainerClientRosterPage,
  TRAINER_ROSTER_PAGE_SIZE,
} from '../trainee-records/traineeDatabaseLocations';
import { loadMyLinkedTrainees } from '../trainee-records/loadMyLinkedTrainees';

// ===== NAMED CONSTANTS =====

// Manipulate here: page size lives in traineeDatabaseLocations as TRAINER_ROSTER_PAGE_SIZE — keep both in sync.

// ===== HELPER FUNCTIONS =====

/**
 * Clear roster rows and stop the first-page spinner when no trainer is signed in.
 */
function wipeRosterState(setClients, setIsLoading, setHasMore) {
  setClients([]);
  setIsLoading(false);
  setHasMore(false);
}

/**
 * Bump the load generation so an older in-flight page cannot overwrite a newer one.
 */
function claimNextLoadGeneration(loadGenerationRef) {
  loadGenerationRef.current += 1;
  return loadGenerationRef.current;
}

/**
 * True when a newer load started after this one began.
 */
function thisLoadIsStale(thisLoadGeneration, loadGenerationRef) {
  return thisLoadGeneration !== loadGenerationRef.current;
}

/**
 * Flip the right loading flag and clear the cursor on a full reset.
 */
function beginLoadingFlags(isReset, setIsLoading, setIsLoadingMore, lastDocRef) {
  if (isReset) {
    setIsLoading(true);
    lastDocRef.current = null;
    return;
  }
  setIsLoadingMore(true);
}

/**
 * Options bag for fetchTrainerClientRosterPage (page size + cursor + legacy on reset).
 */
function buildRosterPageOptions(isReset, lastDocRef) {
  return {
    pageSize: TRAINER_ROSTER_PAGE_SIZE,
    startAfterDoc: isReset ? null : lastDocRef.current,
    includeLegacy: isReset,
  };
}

/**
 * Write cursor + merge (or replace on reset) into React state after a successful page.
 */
function writeSuccessfulRosterPage({
  isReset,
  linkedClients,
  rosterPage,
  setClients,
  setHasMore,
  setError,
  lastDocRef,
}) {
  lastDocRef.current = rosterPage.lastDoc;
  setHasMore(rosterPage.hasMore);
  setError(null);
  setClients((existingClients) => {
    if (isReset) return linkedClients;
    return mergeClientsByIdThenSortByName(existingClients, linkedClients);
  });
}

/**
 * Dedupe by id — legacy rows and paginated rows can overlap; newer fields win.
 */
function mergeClientsByIdThenSortByName(existingClients, incomingClients) {
  const clientsById = new Map();
  const existingList = existingClients || [];
  for (let i = 0; i < existingList.length; i += 1) {
    const existingClient = existingList[i];
    clientsById.set(existingClient.id, existingClient);
  }
  for (let i = 0; i < incomingClients.length; i += 1) {
    const incomingClient = incomingClients[i];
    const previousRow = clientsById.get(incomingClient.id) || {};
    clientsById.set(incomingClient.id, { ...previousRow, ...incomingClient });
  }
  const mergedClients = [...clientsById.values()];
  mergedClients.sort(compareClientNamesAToZ);
  return mergedClients;
}

/**
 * A→Z by display name (case-insensitive).
 */
function compareClientNamesAToZ(leftClient, rightClient) {
  const leftName = String(leftClient.name || '').toLowerCase();
  const rightName = String(rightClient.name || '').toLowerCase();
  return leftName.localeCompare(rightName);
}

// ===== MAIN FUNCTION =====

/**
 * Live paginated client roster for one trainer uid.
 * vocab: custom hook — callers treat the return object like React state; hook order below must not move.
 * @param {string|null|undefined} trainerUid
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
  // Hook order frozen: clients → loading → loadingMore → hasMore → error → lastDoc → generation → loadPage → refresh → loadMore → effect.
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  // vocab: useRef = box that survives re-renders without causing one; holds the Firestore cursor + load generation.
  const lastDocRef = useRef(null);
  const loadGenerationRef = useRef(0);

  const loadPage = useCallback(
    async (isReset) => {
      // 1. No trainer signed in → empty roster and stop the spinner.
      if (!trainerUid) {
        wipeRosterState(setClients, setIsLoading, setHasMore);
        return;
      }

      // 2. Bump generation so an older in-flight page cannot overwrite a newer one.
      const thisLoadGeneration = claimNextLoadGeneration(loadGenerationRef);
      beginLoadingFlags(isReset, setIsLoading, setIsLoadingMore, lastDocRef);

      try {
        // 3. Read one page, then resolve linked-trainee display fields (re-check generation after each await).
        const pageQueryOptions = buildRosterPageOptions(isReset, lastDocRef);
        const rosterPage = await fetchTrainerClientRosterPage(trainerUid, pageQueryOptions);
        if (thisLoadIsStale(thisLoadGeneration, loadGenerationRef)) return;

        const linkedClients = await loadMyLinkedTrainees(trainerUid, rosterPage.clients);
        if (thisLoadIsStale(thisLoadGeneration, loadGenerationRef)) return;

        // 4. Write cursor + merge (or replace on reset) into React state.
        writeSuccessfulRosterPage({
          isReset,
          linkedClients,
          rosterPage,
          setClients,
          setHasMore,
          setError,
          lastDocRef,
        });
      } catch (fetchError) {
        if (thisLoadIsStale(thisLoadGeneration, loadGenerationRef)) return;
        console.error('Error fetching trainer clients:', fetchError);
        setError(fetchError?.message || String(fetchError));
        if (isReset) setClients([]);
      } finally {
        if (!thisLoadIsStale(thisLoadGeneration, loadGenerationRef)) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [trainerUid],
  );

  const refresh = useCallback(() => loadPage(true), [loadPage]);

  const loadMore = useCallback(() => {
    const mayLoadMore = hasMore && !isLoadingMore && !isLoading;
    if (!mayLoadMore) return;
    loadPage(false);
  }, [hasMore, isLoadingMore, isLoading, loadPage]);

  useEffect(() => {
    // First mount / trainer change always starts at page one.
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

// ===== PLUMBING — skip unless debugging page merge / stale loads =====
// Page merge / stale-load helpers live under HELPER FUNCTIONS so the main hook stays a short recipe.
