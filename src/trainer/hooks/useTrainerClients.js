import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../app/config';
import { getTrainerClients } from '../services/clientCRMService';
import { resolveTrainerClientDisplayName, isGenericClientDisplayName } from '../lib/trainerClientDisplayName';

/** CRM row explicitly marked inactive (legacy / soft paths). */
function isCrmRowInactive(c) {
  if (!c || c.archived === true) return true;
  const st = String(c.status || 'active').toLowerCase();
  return st === 'inactive' || st === 'removed' || st === 'deleted';
}

/** Client counts only when their user profile still lists this trainer. */
function userLinkedToTrainer(userData, trainerUid) {
  if (!userData || !trainerUid) return false;
  const tid = userData.trainerId;
  if (tid == null || tid === '') return false;
  return String(tid) === String(trainerUid);
}

/**
 * Hook for trainer client list updates (fetches from Firestore)
 * Uses Firebase JS SDK via clientCRMService.
 *
 * Roster = CRM docs under trainer_clients/.../clients that still have an active
 * link on users/{id}.trainerId (matches removeTrainerClientLink / getTrainerClients).
 */
export const useTrainerClients = (trainerUid) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const userUnsubsRef = useRef(new Map());
  const snapshotGenRef = useRef(0);

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
    snapshotGenRef.current += 1;

    const clientsRef = collection(db, `trainer_clients/${trainerUid}/clients`);
    const unsubClients = onSnapshot(
      clientsRef,
      (snap) => {
        const gen = ++snapshotGenRef.current;
        const raw = [];
        snap.forEach((d) => raw.push({ id: d.id, ...d.data() }));

        void (async () => {
          try {
            const linked = [];
            for (const c of raw) {
              if (gen !== snapshotGenRef.current) return;
              if (!c?.id || isCrmRowInactive(c)) continue;
              try {
                const userSnap = await getDoc(doc(db, 'users', c.id));
                if (gen !== snapshotGenRef.current) return;
                if (!userSnap.exists()) continue;
                const ud = userSnap.data() || {};
                if (!userLinkedToTrainer(ud, trainerUid)) continue;
                const resolvedName = resolveTrainerClientDisplayName(c, ud);
                const photoURL = ud.photoURL || c.photoURL || null;
                if (
                  resolvedName &&
                  !isGenericClientDisplayName(resolvedName) &&
                  isGenericClientDisplayName(String(c.name || '').trim())
                ) {
                  try {
                    await setDoc(
                      doc(db, 'trainer_clients', trainerUid, 'clients', c.id),
                      { name: resolvedName, updatedAt: serverTimestamp() },
                      { merge: true }
                    );
                  } catch (_) {
                    /* ignore heal failures */
                  }
                }
                linked.push({ ...c, name: resolvedName, photoURL });
              } catch (_) {
                /* skip */
              }
            }
            linked.sort((a, b) => String(a.name || '').toLowerCase().localeCompare(String(b.name || '').toLowerCase()));
            if (gen !== snapshotGenRef.current) return;

            setClients((prev) => {
              const prevById = new Map((prev || []).map((x) => [x.id, x]));
              return linked.map((c) => ({ ...(prevById.get(c.id) || {}), ...c }));
            });

            const seenIds = new Set(linked.map((c) => c.id));
            for (const [clientId, unsub] of userUnsubsRef.current.entries()) {
              if (!seenIds.has(clientId)) {
                try {
                  unsub?.();
                } catch (_) {}
                userUnsubsRef.current.delete(clientId);
              }
            }

            for (const client of linked) {
              const clientId = client.id;
              if (!clientId || userUnsubsRef.current.has(clientId)) continue;

              const uref = doc(db, 'users', clientId);
              const unsubUser = onSnapshot(
                uref,
                (userSnap) => {
                  if (!userSnap.exists()) {
                    setClients((cur) => (cur || []).filter((x) => x.id !== clientId));
                    const u = userUnsubsRef.current.get(clientId);
                    try {
                      u?.();
                    } catch (_) {}
                    userUnsubsRef.current.delete(clientId);
                    return;
                  }
                  const ud = userSnap.data() || {};
                  if (!userLinkedToTrainer(ud, trainerUid)) {
                    setClients((cur) => (cur || []).filter((x) => x.id !== clientId));
                    const u = userUnsubsRef.current.get(clientId);
                    try {
                      u?.();
                    } catch (_) {}
                    userUnsubsRef.current.delete(clientId);
                    return;
                  }
                  setClients((cur) =>
                    (cur || []).map((x) => {
                      if (x.id !== clientId) return x;
                      return {
                        ...x,
                        name: resolveTrainerClientDisplayName(x, ud),
                        photoURL: ud.photoURL ?? x.photoURL ?? null,
                      };
                    })
                  );
                },
                () => {}
              );
              userUnsubsRef.current.set(clientId, unsubUser);
            }
          } finally {
            if (gen === snapshotGenRef.current) {
              setLoading(false);
            }
          }
        })();
      },
      (err) => {
        console.error('Error subscribing trainer clients:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      snapshotGenRef.current += 1;
      try {
        unsubClients?.();
      } catch (_) {}
      for (const [, unsub] of userUnsubsRef.current.entries()) {
        try {
          unsub?.();
        } catch (_) {}
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
