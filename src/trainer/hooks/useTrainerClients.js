import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../app/config';
import { getTrainerClients } from '../services/clientCRMService';

/**
 * Hook for trainer client list updates (fetches from Firestore)
 * Uses Firebase JS SDK via clientCRMService.
 */
export const useTrainerClients = (trainerUid) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const userUnsubsRef = useRef(new Map());

  const loadClients = useCallback(async () => {
    if (!trainerUid) {
      setClients([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const clientsData = await getTrainerClients(trainerUid);
      setClients(clientsData || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching trainer clients:', err);
      setError(err.message);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [trainerUid]);

  useEffect(() => {
    if (!trainerUid || !db) {
      setClients([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Realtime: subscribe to trainer CRM subcollection
    const clientsRef = collection(db, `trainer_clients/${trainerUid}/clients`);
    const unsubClients = onSnapshot(
      clientsRef,
      (snap) => {
        const next = [];
        snap.forEach((d) => next.push({ id: d.id, ...d.data() }));

        // Sort stable by name
        next.sort((a, b) => (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()));

        setClients((prev) => {
          // Preserve any enriched user fields we already merged in
          const prevById = new Map((prev || []).map((c) => [c.id, c]));
          return next.map((c) => ({ ...c, ...(prevById.get(c.id) || {}) }));
        });

        // Subscribe to users/{clientId} to get realtime photoURL/name updates
        const seenIds = new Set(next.map((c) => c.id));

        // Unsubscribe removed clients
        for (const [clientId, unsub] of userUnsubsRef.current.entries()) {
          if (!seenIds.has(clientId)) {
            try { unsub?.(); } catch (_) {}
            userUnsubsRef.current.delete(clientId);
          }
        }

        // Subscribe new clients
        for (const client of next) {
          const clientId = client.id;
          if (!clientId || userUnsubsRef.current.has(clientId)) continue;

          const uref = doc(db, 'users', clientId);
          const unsubUser = onSnapshot(
            uref,
            (userSnap) => {
              if (!userSnap.exists()) return;
              const ud = userSnap.data() || {};
              const name =
                client.name ||
                ud.name ||
                ud.displayName ||
                `${ud.firstName || ''} ${ud.lastName || ''}`.trim() ||
                'Client';
              const photoURL = ud.photoURL || null;

              setClients((cur) =>
                (cur || []).map((c) => (c.id === clientId ? { ...c, name: c.name || name, photoURL: photoURL ?? c.photoURL ?? null } : c))
              );
            },
            () => {}
          );
          userUnsubsRef.current.set(clientId, unsubUser);
        }

        setLoading(false);
      },
      (err) => {
        console.error('Error subscribing trainer clients:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      try { unsubClients?.(); } catch (_) {}
      for (const [, unsub] of userUnsubsRef.current.entries()) {
        try { unsub?.(); } catch (_) {}
      }
      userUnsubsRef.current.clear();
    };
  }, [trainerUid]);

  return {
    clients,
    loading,
    error,
    refresh: loadClients,
  };
};
