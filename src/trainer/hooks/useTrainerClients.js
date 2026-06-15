/**
 * use Trainer Clients
 *
 * Purpose: React hook: use Trainer Clients. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: useTrainerClients
 *
 * @file-header
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchTrainerClientRosterPage,
  TRAINER_ROSTER_PAGE_SIZE,
} from '../lib/trainerClientFirestorePaths';
import { resolveLinkedTrainerClients } from '../lib/resolveLinkedTrainerClients';

/**
 * Trainer client roster — paginated Firestore reads (Load more), no full-collection listeners.
 */
export const useTrainerClients = (trainerUid) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const lastDocRef = useRef(null);
  const loadGenRef = useRef(0);

  const loadPage = useCallback(
    async (reset) => {
      if (!trainerUid) {
        setClients([]);
        setLoading(false);
        setHasMore(false);
        return;
      }

      const gen = ++loadGenRef.current;
      if (reset) {
        setLoading(true);
        lastDocRef.current = null;
      } else {
        setLoadingMore(true);
      }

      try {
        const page = await fetchTrainerClientRosterPage(trainerUid, {
          pageSize: TRAINER_ROSTER_PAGE_SIZE,
          startAfterDoc: reset ? null : lastDocRef.current,
          includeLegacy: reset,
        });

        if (gen !== loadGenRef.current) return;

        const linked = await resolveLinkedTrainerClients(trainerUid, page.clients);
        if (gen !== loadGenRef.current) return;

        lastDocRef.current = page.lastDoc;
        setHasMore(page.hasMore);
        setError(null);

        setClients((prev) => {
          if (reset) return linked;
          const byId = new Map((prev || []).map((x) => [x.id, x]));
          for (const c of linked) {
            byId.set(c.id, { ...(byId.get(c.id) || {}), ...c });
          }
          return [...byId.values()].sort((a, b) =>
            String(a.name || '').toLowerCase().localeCompare(String(b.name || '').toLowerCase()),
          );
        });
      } catch (err) {
        if (gen !== loadGenRef.current) return;
        console.error('Error fetching trainer clients:', err);
        setError(err?.message || String(err));
        if (reset) setClients([]);
      } finally {
        if (gen === loadGenRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [trainerUid],
  );

  const refresh = useCallback(() => loadPage(true), [loadPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    loadPage(false);
  }, [hasMore, loadingMore, loading, loadPage]);

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
