import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../app/config';
import { useTrainerClients } from '../trainer/hooks/useTrainerClients';
import { sendSessionScheduledPushToClient } from '../trainer/services/pushSessionNotification';
import { postRemotePushNotify } from '../shared/services/pushNotifyApi';
import {
  randomSessionUpdateClientBody,
  randomSessionCancelledClientBody,
} from '../shared/notifications/pushCopy';

async function trainerDisplayName(trainerUid) {
  try {
    const s = await getDoc(doc(db, 'users', trainerUid));
    const d = s.data();
    return d?.displayName || d?.name || d?.firstName || 'Your coach';
  } catch {
    return 'Your coach';
  }
}

const normalizeDateKey = (d) => {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  if (d?.toDate) return d.toDate().toISOString().slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
};

const normalizeTime = (t) => {
  if (!t) return '';
  const s = String(t);
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  return s;
};

const stripUndefined = (obj) => {
  const next = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) next[k] = v;
  }
  return next;
};

/**
 * useSessions — Trainer-wide session scheduling (across all clients).
 *
 * Firestore:
 * - `trainer_clients/{trainerUid}/sessions/{sessionId}`
 *
 * Session doc shape:
 * - clientId: string
 * - date: YYYY-MM-DD
 * - time: HH:mm (24h)
 * - durationMin: number
 * - notes?: string
 * - zoomLink?: string
 * - createdAt/updatedAt: server timestamps
 */
export const useSessions = () => {
  const trainerUid = auth?.currentUser?.uid || null;
  const { clients } = useTrainerClients(trainerUid);
  const [sessionsRaw, setSessionsRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!trainerUid || !db) {
      setSessionsRaw([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const sessionsRef = collection(db, `trainer_clients/${trainerUid}/sessions`);
    // Keep query index-light; UI sorts by time as needed.
    const q = query(sessionsRef, orderBy('date', 'asc'), limit(500));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = [];
        snap.forEach((d) => next.push({ id: d.id, ...d.data() }));
        setSessionsRaw(next);
        setLoading(false);
      },
      (e) => {
        setError(e?.message || 'Failed to load sessions');
        setLoading(false);
      }
    );

    return () => {
      try {
        unsub?.();
      } catch (_) {}
    };
  }, [trainerUid]);

  const clientsById = useMemo(() => new Map((clients || []).map((c) => [c.id, c])), [clients]);

  const sessions = useMemo(() => {
    return (sessionsRaw || []).map((s) => {
      const client = s.clientId ? clientsById.get(s.clientId) : undefined;
      return {
        ...s,
        clientName: s.clientName || client?.name || 'Client',
        date: normalizeDateKey(s.date),
        time: normalizeTime(s.time),
        status: s.status || 'pending',
      };
    });
  }, [sessionsRaw, clientsById]);

  const getSession = useCallback(
    (sessionId) => (sessions || []).find((s) => s.id === sessionId),
    [sessions]
  );

  const addSession = useCallback(
    async (payload) => {
      if (!trainerUid) throw new Error('Not signed in');
      const sessionsRef = collection(db, `trainer_clients/${trainerUid}/sessions`);
      const docPayload = stripUndefined({
        trainerId: trainerUid,
        ...stripUndefined(payload),
        status: payload?.status || 'pending',
        date: normalizeDateKey(payload?.date),
        time: normalizeTime(payload?.time),
        durationMin: Number(payload?.durationMin || 60),
        // Keep a `duration` alias for any legacy/other consumers.
        duration: Number(payload?.durationMin || payload?.duration || 60),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const ref = await addDoc(sessionsRef, docPayload);
      if (docPayload.clientId) {
        void sendSessionScheduledPushToClient({
          clientId: docPayload.clientId,
          trainerUid,
          date: docPayload.date,
          time: docPayload.time,
          sessionId: ref.id,
        }).catch(() => {});
      }
    },
    [trainerUid]
  );

  const updateSession = useCallback(
    async (sessionId, payload) => {
      if (!trainerUid) throw new Error('Not signed in');
      if (!sessionId) throw new Error('Missing session id');
      const ref = doc(db, `trainer_clients/${trainerUid}/sessions/${sessionId}`);
      const beforeSnap = await getDoc(ref);
      const before = beforeSnap.exists() ? beforeSnap.data() : {};
      const clientId = payload?.clientId || before?.clientId;

      const docPayload = stripUndefined({
        trainerId: trainerUid,
        ...stripUndefined(payload),
        date: normalizeDateKey(payload?.date),
        time: normalizeTime(payload?.time),
        durationMin: payload?.durationMin != null ? Number(payload.durationMin) : undefined,
        duration: payload?.durationMin != null ? Number(payload.durationMin) : payload?.duration != null ? Number(payload.duration) : undefined,
        updatedAt: serverTimestamp(),
      });

      if (['date', 'time', 'startAtMs', 'status'].some((k) => payload && Object.prototype.hasOwnProperty.call(payload, k))) {
        docPayload.sessionReminderSent = false;
      }

      await updateDoc(ref, docPayload);

      const watchKeys = ['date', 'time', 'status', 'durationMin', 'zoomLink', 'startAtMs', 'notes'];
      const meaningful = watchKeys.some((k) => {
        if (!payload || !Object.prototype.hasOwnProperty.call(payload, k)) return false;
        return payload[k] !== before[k];
      });
      if (clientId && meaningful) {
        const name = await trainerDisplayName(trainerUid);
        void postRemotePushNotify({
          recipientId: clientId,
          senderName: name,
          messageText: randomSessionUpdateClientBody(),
          senderId: `session_${sessionId}`,
          messageId: sessionId,
          notificationType: 'session_update',
        });
      }
    },
    [trainerUid]
  );

  const deleteSession = useCallback(
    async (sessionId) => {
      if (!trainerUid) throw new Error('Not signed in');
      if (!sessionId) throw new Error('Missing session id');
      const ref = doc(db, `trainer_clients/${trainerUid}/sessions/${sessionId}`);
      const prevSnap = await getDoc(ref);
      const prev = prevSnap.exists() ? prevSnap.data() : null;
      await deleteDoc(ref);
      const cid = prev?.clientId;
      if (cid) {
        const name = await trainerDisplayName(trainerUid);
        void postRemotePushNotify({
          recipientId: cid,
          senderName: name,
          messageText: randomSessionCancelledClientBody(),
          senderId: `session_${sessionId}`,
          messageId: sessionId,
          notificationType: 'session_update',
        });
      }
    },
    [trainerUid]
  );

  return {
    clients,
    sessions,
    loading,
    error,
    addSession,
    updateSession,
    deleteSession,
    getSession,
  };
};

