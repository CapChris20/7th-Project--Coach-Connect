// Paginated client roster for the trainer, with pull-to-refresh and "Load more".
// Flow: fetch one page of CRM rows → filter/enrich them via the linked-trainees resolver → merge
// into state (deduped, alphabetical) → repeat on loadMore.
// Why paginated reads instead of a live listener: a full-collection listener would re-read every
// client on any change. Trainers with large rosters pay for that on every edit.
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchTrainerClientRosterPage,
  TRAINER_ROSTER_PAGE_SIZE,
} from '../trainee-records/traineeDatabaseLocations';
import { loadMyLinkedTrainees } from '../trainee-records/loadMyLinkedTrainees';

/**
 * Trainer client roster — paginated Firestore reads (Load more), no full-collection listeners.
 */
export const pagedTraineeList = (trainerUid) => {
  const [clients, setClients] = useState([]);
  // Two separate loading flags so the UI can show a full skeleton on first load but only a small
  // spinner at the bottom while appending a page.
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  // vocab: useRef = a mutable box that survives re-renders without triggering one.
  // lastDocRef holds the Firestore cursor (the last doc of the previous page) — that's how the next
  // query knows where to resume.
  const lastDocRef = useRef(null);
  // Generation counter guarding against out-of-order async results. See its use below.
  const loadGenRef = useRef(0);

  const loadPage = useCallback(
    async (reset) => {
      if (!trainerUid) {
        setClients([]);
        setLoading(false);
        setHasMore(false);
        return;
      }

      // Claim a generation number for THIS run. Every later await re-checks it, so if a newer load
      // starts (trainer taps refresh, or switches account) this stale run bails out instead of
      // overwriting the newer results — the classic async race in paginated lists.
      const gen = ++loadGenRef.current;
      if (reset) {
        setLoading(true);
        // Clearing the cursor is what makes the next fetch start from the beginning.
        lastDocRef.current = null;
      } else {
        setLoadingMore(true);
      }

      try {
        const page = await fetchTrainerClientRosterPage(trainerUid, {
          pageSize: TRAINER_ROSTER_PAGE_SIZE,
          // On reset, no cursor = page one. Otherwise resume after the last doc we saw.
          startAfterDoc: reset ? null : lastDocRef.current,
          // includeLegacy only on a reset: older roster docs live outside the paginated path, so
          // they're pulled in once with the first page rather than re-scanned on every "Load more".
          includeLegacy: reset,
        });

        // Race check #1, after the page fetch.
        if (gen !== loadGenRef.current) return;

        // Second async step: verify the trainer↔client links and resolve names/photos. This is why
        // there are two generation checks — either await is a chance for a newer load to start.
        const linked = await loadMyLinkedTrainees(trainerUid, page.clients);
        if (gen !== loadGenRef.current) return;

        lastDocRef.current = page.lastDoc;
        setHasMore(page.hasMore);
        // Clear a previous error on success so a recovered retry visibly resets the UI.
        setError(null);

        setClients((prev) => {
          // A reset replaces everything; anything else appends.
          if (reset) return linked;
          // Dedupe by id through a Map, because the legacy rows and the paginated rows can overlap.
          // Seeding it from `prev` and then setting the new rows means the FRESH data wins, while
          // spreading the old entry first preserves any fields the new page didn't include.
          const byId = new Map((prev || []).map((x) => [x.id, x]));
          for (const c of linked) {
            byId.set(c.id, { ...(byId.get(c.id) || {}), ...c });
          }
          // Re-sort the whole merged list: pages arrive in Firestore order, but the roster is shown
          // alphabetically, so appending without re-sorting would interleave names wrongly.
          return [...byId.values()].sort((a, b) =>
            String(a.name || '').toLowerCase().localeCompare(String(b.name || '').toLowerCase()),
          );
        });
      } catch (err) {
        if (gen !== loadGenRef.current) return;
        console.error('Error fetching trainer clients:', err);
        setError(err?.message || String(err));
        // Only wipe the list if this was a fresh load. A failed "Load more" keeps the pages the
        // trainer already has on screen.
        if (reset) setClients([]);
      } finally {
        // Guarded by the generation check too: a stale run must not clear the spinner that the
        // current, still-running load owns.
        if (gen === loadGenRef.current) {
          setLoading(false);
          setLoadingMore(false);
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
    if (!hasMore || loadingMore || loading) return;
    loadPage(false);
  }, [hasMore, loadingMore, loading, loadPage]);

  // Initial load, and a full reload whenever the trainer changes (loadPage's identity is keyed to
  // trainerUid, so sign-out/sign-in re-runs this with a clean list).
  useEffect(() => {
    loadPage(true);
  }, [loadPage]);

  return {
    clients,
    loading,
    loadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
  };
};
