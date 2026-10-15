// Trainer-wide session list: live Firestore listener plus add / update / delete helpers.
// Flow: listen to trainer_clients/{uid}/sessions → join client names → notify the client on changes.
// Used by trainer scheduling screens. Form screens should prefer the SharedSessionList aliases below.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSharedSessionList } from './SharedSessionList';
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
import { auth, db } from '../../app-start/cloudConnection';
import { pagedTraineeList } from '../my-trainees/pagedTraineeList';
import { sendSessionScheduledPushToClient } from '../scheduling/alertTraineeOfSession';
import { postRemotePushNotify } from '../../for-both/online-connection/sendPhoneAlert';
import {
  randomSessionUpdateClientBody,
  randomSessionCancelledClientBody,
} from '../../notifications/writeAlertText';
import { stripUndefinedForFirestore as stripUndefined } from '../../helpers/cleanDataBeforeSaving';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const TRAINER_CLIENTS_COLLECTION = 'trainer_clients';
const SESSIONS_SUBCOLLECTION = 'sessions';
const REQUEST_STATUS_PENDING = 'pending';
const CLIENT_NAME_DEFAULT = 'Client';
const TRAINER_NAME_FALLBACK = 'Your coach';
const DEFAULT_DURATION_MIN = 60;
const SESSION_QUERY_LIMIT = 500;
const DATE_KEY_LENGTH = 10;
const HH_MM_LENGTH = 5;
const SESSION_REMINDER_RESET_KEYS = ['date', 'time', 'startAtMs', 'status'];
const SESSION_CHANGE_WATCH_KEYS = ['date', 'time', 'status', 'durationMin', 'zoomLink', 'startAtMs', 'notes'];
const NOTIFICATION_TYPE_SESSION_UPDATE = 'session_update';

// ===== HELPER FUNCTIONS =====

function sessionsCollectionPath(trainerUid) {
  return `${TRAINER_CLIENTS_COLLECTION}/${trainerUid}/${SESSIONS_SUBCOLLECTION}`;
}

function sessionDocumentPath(trainerUid, sessionId) {
  return `${TRAINER_CLIENTS_COLLECTION}/${trainerUid}/${SESSIONS_SUBCOLLECTION}/${sessionId}`;
}

/**
 * Display name from users/{uid}. A missing profile still says "Your coach" so the push is not blank.
 * @param {string} trainerUid
 * @returns {Promise<string>}
 */
async function trainerDisplayName(trainerUid) {
  try {
    const userSnap = await getDoc(doc(db, USERS_COLLECTION, trainerUid));
    const userData = userSnap.data();
    return userData?.displayName || userData?.name || userData?.firstName || TRAINER_NAME_FALLBACK;
  } catch (ignoredError) {
    return TRAINER_NAME_FALLBACK;
  }
}

/**
 * Firestore Timestamps, Date objects, and ISO strings all become YYYY-MM-DD for the calendar.
 * @param {string|Date|object} dateValue
 * @returns {string}
 */
const normalizeDateKey = (dateValue) => {
  if (!dateValue) return '';
  if (typeof dateValue === 'string') return dateValue.slice(0, DATE_KEY_LENGTH);
  if (dateValue?.toDate) return dateValue.toDate().toISOString().slice(0, DATE_KEY_LENGTH);
  if (dateValue instanceof Date) return dateValue.toISOString().slice(0, DATE_KEY_LENGTH);
  return String(dateValue).slice(0, DATE_KEY_LENGTH);
};

/**
 * Keep HH:mm when the string already looks like 24h time; otherwise leave the original spelling.
 * @param {string} timeValue
 * @returns {string}
 */
const normalizeTime = (timeValue) => {
  if (!timeValue) return '';
  const timeText = String(timeValue);
  if (/^\d{2}:\d{2}/.test(timeText)) return timeText.slice(0, HH_MM_LENGTH);
  return timeText;
};

function payloadHasOwnKey(payload, key) {
  return Boolean(payload) && Object.prototype.hasOwnProperty.call(payload, key);
}

function shouldResetSessionReminder(payload) {
  return SESSION_REMINDER_RESET_KEYS.some((key) => payloadHasOwnKey(payload, key));
}

function isMeaningfulSessionChange(payload, before) {
  return SESSION_CHANGE_WATCH_KEYS.some((key) => {
    if (!payloadHasOwnKey(payload, key)) return false;
    return payload[key] !== before[key];
  });
}

function durationFieldsFromCreatePayload(payload) {
  const durationMin = Number(payload?.durationMin || DEFAULT_DURATION_MIN);
  return {
    durationMin,
    // Keep a `duration` alias for any legacy/other consumers.
    duration: Number(payload?.durationMin || payload?.duration || DEFAULT_DURATION_MIN),
  };
}

function durationFieldsFromUpdatePayload(payload) {
  const hasDurationMin = payload?.durationMin != null;
  const hasDuration = payload?.duration != null;
  return {
    durationMin: hasDurationMin ? Number(payload.durationMin) : undefined,
    duration: hasDurationMin ? Number(payload.durationMin) : hasDuration ? Number(payload.duration) : undefined,
  };
}

function mapSnapshotToSessionRows(snapshot) {
  const next = [];
  snapshot.forEach((sessionDoc) => next.push({ id: sessionDoc.id, ...sessionDoc.data() }));
  return next;
}

function sessionWithClientName(sessionRow, clientsById) {
  const client = sessionRow.clientId ? clientsById.get(sessionRow.clientId) : undefined;
  return {
    ...sessionRow,
    clientName: sessionRow.clientName || client?.name || CLIENT_NAME_DEFAULT,
    date: normalizeDateKey(sessionRow.date),
    time: normalizeTime(sessionRow.time),
    status: sessionRow.status || REQUEST_STATUS_PENDING,
  };
}

function notifyClientSessionScheduled(docPayload, sessionId, trainerUid) {
  if (!docPayload.clientId) return;
  void sendSessionScheduledPushToClient({
    clientId: docPayload.clientId,
    trainerUid,
    date: docPayload.date,
    time: docPayload.time,
    sessionId,
  }).catch(() => {});
}

async function notifyClientSessionChanged(clientId, trainerUid, sessionId) {
  if (!clientId) return;
  const name = await trainerDisplayName(trainerUid);
  void postRemotePushNotify({
    recipientId: clientId,
    senderName: name,
    messageText: randomSessionUpdateClientBody(),
    senderId: `session_${sessionId}`,
    messageId: sessionId,
    notificationType: NOTIFICATION_TYPE_SESSION_UPDATE,
  });
}

async function notifyClientSessionCancelled(clientId, trainerUid, sessionId) {
  if (!clientId) return;
  const name = await trainerDisplayName(trainerUid);
  void postRemotePushNotify({
    recipientId: clientId,
    senderName: name,
    messageText: randomSessionCancelledClientBody(),
    senderId: `session_${sessionId}`,
    messageId: sessionId,
    notificationType: NOTIFICATION_TYPE_SESSION_UPDATE,
  });
}

// ===== MAIN FUNCTION =====

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
  const { clients } = pagedTraineeList(trainerUid);
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

    const sessionsRef = collection(db, sessionsCollectionPath(trainerUid));
    // Keep query index-light; UI sorts by time as needed.
    const sessionsQuery = query(sessionsRef, orderBy('date', 'asc'), limit(SESSION_QUERY_LIMIT));
    const unsub = onSnapshot(
      sessionsQuery,
      (snap) => {
        setSessionsRaw(mapSnapshotToSessionRows(snap));
        setLoading(false);
      },
      (errorFromListener) => {
        setError(errorFromListener?.message || 'Failed to load sessions');
        setLoading(false);
      },
    );

    return () => {
      try {
        unsub?.();
      } catch (_) {}
    };
  }, [trainerUid]);

  const clientsById = useMemo(
    () => new Map((clients || []).map((client) => [client.id, client])),
    [clients],
  );

  const sessions = useMemo(() => {
    return (sessionsRaw || []).map((sessionRow) => sessionWithClientName(sessionRow, clientsById));
  }, [sessionsRaw, clientsById]);

  const getSession = useCallback(
    (sessionId) => (sessions || []).find((sessionRow) => sessionRow.id === sessionId),
    [sessions],
  );

  const addSession = useCallback(
    async (payload) => {
      if (!trainerUid) throw new Error('Not signed in');
      const sessionsRef = collection(db, sessionsCollectionPath(trainerUid));
      const durationFields = durationFieldsFromCreatePayload(payload);
      const docPayload = stripUndefined({
        trainerId: trainerUid,
        ...stripUndefined(payload),
        status: payload?.status || REQUEST_STATUS_PENDING,
        date: normalizeDateKey(payload?.date),
        time: normalizeTime(payload?.time),
        ...durationFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const createdRef = await addDoc(sessionsRef, docPayload);
      notifyClientSessionScheduled(docPayload, createdRef.id, trainerUid);
    },
    [trainerUid],
  );

  const updateSession = useCallback(
    async (sessionId, payload) => {
      if (!trainerUid) throw new Error('Not signed in');
      if (!sessionId) throw new Error('Missing session id');
      const sessionRef = doc(db, sessionDocumentPath(trainerUid, sessionId));
      const beforeSnap = await getDoc(sessionRef);
      const before = beforeSnap.exists() ? beforeSnap.data() : {};
      const clientId = payload?.clientId || before?.clientId;
      const durationFields = durationFieldsFromUpdatePayload(payload);

      const docPayload = stripUndefined({
        trainerId: trainerUid,
        ...stripUndefined(payload),
        date: normalizeDateKey(payload?.date),
        time: normalizeTime(payload?.time),
        ...durationFields,
        updatedAt: serverTimestamp(),
      });

      if (shouldResetSessionReminder(payload)) {
        docPayload.sessionReminderSent = false;
      }

      await updateDoc(sessionRef, docPayload);

      const meaningful = isMeaningfulSessionChange(payload, before);
      if (clientId && meaningful) {
        await notifyClientSessionChanged(clientId, trainerUid, sessionId);
      }
    },
    [trainerUid],
  );

  const deleteSession = useCallback(
    async (sessionId) => {
      if (!trainerUid) throw new Error('Not signed in');
      if (!sessionId) throw new Error('Missing session id');
      const sessionRef = doc(db, sessionDocumentPath(trainerUid, sessionId));
      const prevSnap = await getDoc(sessionRef);
      const prev = prevSnap.exists() ? prevSnap.data() : null;
      await deleteDoc(sessionRef);
      const clientId = prev?.clientId;
      if (clientId) {
        await notifyClientSessionCancelled(clientId, trainerUid, sessionId);
      }
    },
    [trainerUid],
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

/** Thin aliases for session form screens — require SessionsProvider (single listener). */
export function useCreateTrainingSession() {
  const { addSession } = useSharedSessionList();
  return addSession;
}

/** @returns {function} */
export function useUpdateTrainingSession() {
  const { updateSession } = useSharedSessionList();
  return updateSession;
}

/** @returns {function} */
export function useDeleteTrainingSession() {
  const { deleteSession } = useSharedSessionList();
  return deleteSession;
}

/** @returns {function} */
export function useGetTrainingSession() {
  const { getSession, sessions } = useSharedSessionList();
  return useCallback((sessionId) => getSession(sessionId), [getSession, sessions]);
}
