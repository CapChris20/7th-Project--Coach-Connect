// Trainer-wide session list: live Firestore listener plus add / update / delete helpers.
// Flow: listen to trainer_clients/{uid}/sessions → join client names → notify the client on changes.
// Used by trainer scheduling screens. Form screens should prefer the SharedSessionList aliases below.
// Read order: constants → path/normalize helpers → useSessions recipe → thin form hooks → PLUMBING notifies.

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
// Manipulate here: default session length when the form omits durationMin
const DEFAULT_DURATION_MIN = 60;
// Manipulate here: max sessions the live listener loads (UI sorts by time as needed)
const SESSION_QUERY_LIMIT = 500;
const DATE_KEY_LENGTH = 10;
const HH_MM_LENGTH = 5;
const SESSION_REMINDER_RESET_KEYS = ['date', 'time', 'startAtMs', 'status'];
const SESSION_CHANGE_WATCH_KEYS = [
  'date',
  'time',
  'status',
  'durationMin',
  'zoomLink',
  'startAtMs',
  'notes',
];
const NOTIFICATION_TYPE_SESSION_UPDATE = 'session_update';

// ===== HELPER FUNCTIONS =====

/**
 * Firestore collection path for one trainer’s sessions.
 * Letters stay: trainer_clients/{uid}/sessions
 * @param {string} trainerUid
 * @returns {string}
 */
function sessionsCollectionPath(trainerUid) {
  return `${TRAINER_CLIENTS_COLLECTION}/${trainerUid}/${SESSIONS_SUBCOLLECTION}`;
}

/**
 * Firestore document path for one session.
 * @param {string} trainerUid
 * @param {string} sessionId
 * @returns {string}
 */
function sessionDocumentPath(trainerUid, sessionId) {
  return `${TRAINER_CLIENTS_COLLECTION}/${trainerUid}/${SESSIONS_SUBCOLLECTION}/${sessionId}`;
}

/**
 * Firestore Timestamps, Date objects, and ISO strings all become YYYY-MM-DD for the calendar.
 * @param {string|Date|object} dateValue
 * @returns {string}
 */
function normalizeDateKey(dateValue) {
  if (!dateValue) return '';

  if (typeof dateValue === 'string') {
    return dateValue.slice(0, DATE_KEY_LENGTH);
  }

  // vocab: toDate = Firestore Timestamp → JS Date
  const hasToDateMethod =
    typeof dateValue === 'object' && typeof dateValue.toDate === 'function';
  if (hasToDateMethod) {
    return dateValue.toDate().toISOString().slice(0, DATE_KEY_LENGTH);
  }

  if (dateValue instanceof Date) {
    return dateValue.toISOString().slice(0, DATE_KEY_LENGTH);
  }

  return String(dateValue).slice(0, DATE_KEY_LENGTH);
}

/**
 * Keep HH:mm when the string already looks like 24h time; otherwise leave the original spelling.
 * @param {unknown} timeValue
 * @returns {string}
 */
function normalizeTime(timeValue) {
  if (!timeValue) return '';
  const timeText = String(timeValue);
  const looksLikeTwentyFourHour = /^\d{2}:\d{2}/.test(timeText);
  if (looksLikeTwentyFourHour) {
    return timeText.slice(0, HH_MM_LENGTH);
  }
  return timeText;
}

/**
 * True when the patch object owns that key (even if the value is undefined).
 * @param {object} payload
 * @param {string} key
 * @returns {boolean}
 */
function payloadHasOwnKey(payload, key) {
  return Boolean(payload) && Object.prototype.hasOwnProperty.call(payload, key);
}

/**
 * Schedule fields moved → clear sessionReminderSent so the reminder can fire again.
 * @param {object} payload
 * @returns {boolean}
 */
function shouldResetSessionReminder(payload) {
  for (let index = 0; index < SESSION_REMINDER_RESET_KEYS.length; index += 1) {
    const key = SESSION_REMINDER_RESET_KEYS[index];
    if (payloadHasOwnKey(payload, key)) return true;
  }
  return false;
}

/**
 * True when a watched field actually changed vs the doc before the update.
 * @param {object} payload
 * @param {object} before
 * @returns {boolean}
 */
function isMeaningfulSessionChange(payload, before) {
  for (let index = 0; index < SESSION_CHANGE_WATCH_KEYS.length; index += 1) {
    const key = SESSION_CHANGE_WATCH_KEYS[index];
    if (!payloadHasOwnKey(payload, key)) continue;
    if (payload[key] !== before[key]) return true;
  }
  return false;
}

/**
 * durationMin + legacy `duration` alias for create.
 * @param {object} payload
 * @returns {{ durationMin: number, duration: number }}
 */
function durationFieldsFromCreatePayload(payload) {
  let durationMinSource = DEFAULT_DURATION_MIN;
  if (payload != null && payload.durationMin) {
    durationMinSource = payload.durationMin;
  }

  let durationAliasSource = DEFAULT_DURATION_MIN;
  if (payload != null && payload.durationMin) {
    durationAliasSource = payload.durationMin;
  } else if (payload != null && payload.duration) {
    durationAliasSource = payload.duration;
  }

  return {
    durationMin: Number(durationMinSource),
    // Keep a `duration` alias for any legacy/other consumers.
    duration: Number(durationAliasSource),
  };
}

/**
 * durationMin / duration only when the patch includes them (undefined omitted by strip).
 * @param {object} payload
 * @returns {{ durationMin: number|undefined, duration: number|undefined }}
 */
function durationFieldsFromUpdatePayload(payload) {
  let hasDurationMin = false;
  let hasDuration = false;
  if (payload != null && payload.durationMin != null) {
    hasDurationMin = true;
  }
  if (payload != null && payload.duration != null) {
    hasDuration = true;
  }

  let durationMin = undefined;
  let duration = undefined;

  if (hasDurationMin) {
    durationMin = Number(payload.durationMin);
    duration = Number(payload.durationMin);
  } else if (hasDuration) {
    duration = Number(payload.duration);
  }

  return { durationMin, duration };
}

/**
 * Snapshot docs → plain session rows with id.
 * @param {object} snapshot
 * @returns {object[]}
 */
function mapSnapshotToSessionRows(snapshot) {
  const sessionRows = [];
  snapshot.forEach((sessionDoc) => {
    sessionRows.push({ id: sessionDoc.id, ...sessionDoc.data() });
  });
  return sessionRows;
}

/**
 * Join one session row with the trainee display name from the roster map.
 * @param {object} sessionRow
 * @param {Map<string, object>} clientsById
 * @returns {object}
 */
function sessionWithClientName(sessionRow, clientsById) {
  let client = undefined;
  if (sessionRow.clientId) {
    client = clientsById.get(sessionRow.clientId);
  }

  let clientName = CLIENT_NAME_DEFAULT;
  if (sessionRow.clientName) {
    clientName = sessionRow.clientName;
  } else if (client != null && client.name) {
    clientName = client.name;
  }

  let status = REQUEST_STATUS_PENDING;
  if (sessionRow.status) {
    status = sessionRow.status;
  }

  return {
    ...sessionRow,
    clientName,
    date: normalizeDateKey(sessionRow.date),
    time: normalizeTime(sessionRow.time),
    status,
  };
}

/**
 * Build a Map of client id → client row for name joins.
 * @param {object[]} clients
 * @returns {Map<string, object>}
 */
function buildClientsByIdMap(clients) {
  const clientsById = new Map();
  const clientList = clients || [];
  for (let index = 0; index < clientList.length; index += 1) {
    const client = clientList[index];
    clientsById.set(client.id, client);
  }
  return clientsById;
}

/**
 * Attach client names to every raw session row.
 * @param {object[]} sessionsRaw
 * @param {Map<string, object>} clientsById
 * @returns {object[]}
 */
function joinSessionRowsWithClientNames(sessionsRaw, clientsById) {
  const rawRows = sessionsRaw || [];
  const withNames = [];
  for (let index = 0; index < rawRows.length; index += 1) {
    withNames.push(sessionWithClientName(rawRows[index], clientsById));
  }
  return withNames;
}

/**
 * Find one session by id in the joined list.
 * @param {object[]} sessions
 * @param {string} sessionId
 * @returns {object|undefined}
 */
function findSessionById(sessions, sessionId) {
  const allSessions = sessions || [];
  for (let index = 0; index < allSessions.length; index += 1) {
    if (allSessions[index].id === sessionId) return allSessions[index];
  }
  return undefined;
}

/**
 * Signed-in trainer uid, or null when auth / currentUser is missing.
 * @returns {string|null}
 */
function currentTrainerUid() {
  if (auth == null) return null;
  if (auth.currentUser == null) return null;
  return auth.currentUser.uid || null;
}

/**
 * Status from a create payload, or pending when omitted.
 * @param {object} payload
 * @returns {string}
 */
function statusFromCreatePayload(payload) {
  if (payload != null && payload.status) {
    return payload.status;
  }
  return REQUEST_STATUS_PENDING;
}

/**
 * Date / time fields from a create or update payload (may be empty).
 * @param {object} payload
 * @returns {{ dateKey: string, timeText: string }}
 */
function dateAndTimeFromPayload(payload) {
  let dateRaw = undefined;
  let timeRaw = undefined;
  if (payload != null) {
    dateRaw = payload.date;
    timeRaw = payload.time;
  }
  return {
    dateKey: normalizeDateKey(dateRaw),
    timeText: normalizeTime(timeRaw),
  };
}

/**
 * Client id from the patch, else from the doc that existed before the update.
 * @param {object} payload
 * @param {object} beforeData
 * @returns {string|undefined}
 */
function clientIdFromUpdate(payload, beforeData) {
  if (payload != null && payload.clientId) {
    return payload.clientId;
  }
  if (beforeData != null && beforeData.clientId) {
    return beforeData.clientId;
  }
  return undefined;
}

/**
 * Display name from a users/{uid} profile, falling back to "Your coach".
 * @param {object|undefined} userData
 * @returns {string}
 */
function displayNameFromUserData(userData) {
  if (userData == null) return TRAINER_NAME_FALLBACK;
  if (userData.displayName) return userData.displayName;
  if (userData.name) return userData.name;
  if (userData.firstName) return userData.firstName;
  return TRAINER_NAME_FALLBACK;
}

/**
 * Fire-and-forget: ignore push failures so the write path still succeeds.
 * @param {Promise} pushPromise
 * @returns {void}
 */
function ignorePushFailure(pushPromise) {
  pushPromise.catch(() => {});
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
 *
 * Hook order is frozen — do not reorder useState / useEffect / useMemo / useCallback.
 * @returns {object}
 */
export const useSessions = () => {
  const trainerUid = currentTrainerUid();
  const { clients } = pagedTraineeList(trainerUid);
  const [sessionsRaw, setSessionsRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Subscribe to trainer_clients/{trainerUid}/sessions while signed in.
  // vocab: onSnapshot = live Firestore listener; cleanup must unsubscribe
  useEffect(() => {
    const cannotListen = !trainerUid || !db;
    if (cannotListen) {
      setSessionsRaw([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const sessionsRef = collection(db, sessionsCollectionPath(trainerUid));
    // Keep query index-light; UI sorts by time as needed.
    const sessionsQuery = query(
      sessionsRef,
      orderBy('date', 'asc'),
      limit(SESSION_QUERY_LIMIT),
    );
    const stopListening = onSnapshot(
      sessionsQuery,
      (firestoreSnapshot) => {
        const sessionRows = mapSnapshotToSessionRows(firestoreSnapshot);
        setSessionsRaw(sessionRows);
        setLoading(false);
      },
      (listenerError) => {
        let message = 'Failed to load sessions';
        if (listenerError != null && listenerError.message) {
          message = listenerError.message;
        }
        setError(message);
        setLoading(false);
      },
    );

    return () => {
      try {
        if (typeof stopListening === 'function') {
          stopListening();
        }
      } catch (_teardownError) {
        // Listener may already be gone after sign-out.
      }
    };
  }, [trainerUid]);

  // 2. Join each session row with the trainee name from the roster.
  const clientsById = useMemo(
    () => buildClientsByIdMap(clients),
    [clients],
  );

  const sessions = useMemo(
    () => joinSessionRowsWithClientNames(sessionsRaw, clientsById),
    [sessionsRaw, clientsById],
  );

  const getSession = useCallback(
    (sessionId) => findSessionById(sessions, sessionId),
    [sessions],
  );

  // 3. Create — normalize fields, write Firestore, notify client.
  const addSession = useCallback(
    async (payload) => {
      if (!trainerUid) throw new Error('Not signed in');
      const sessionsRef = collection(db, sessionsCollectionPath(trainerUid));
      const durationFields = durationFieldsFromCreatePayload(payload);
      const dateAndTime = dateAndTimeFromPayload(payload);
      const docPayload = stripUndefined({
        trainerId: trainerUid,
        ...stripUndefined(payload),
        status: statusFromCreatePayload(payload),
        date: dateAndTime.dateKey,
        time: dateAndTime.timeText,
        ...durationFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const createdRef = await addDoc(sessionsRef, docPayload);
      notifyClientSessionScheduled(docPayload, createdRef.id, trainerUid);
    },
    [trainerUid],
  );

  // 4. Update — merge patch, reset reminder when schedule fields move, maybe push client.
  const updateSession = useCallback(
    async (sessionId, payload) => {
      if (!trainerUid) throw new Error('Not signed in');
      if (!sessionId) throw new Error('Missing session id');
      const sessionRef = doc(db, sessionDocumentPath(trainerUid, sessionId));
      const beforeSnap = await getDoc(sessionRef);
      let beforeData = {};
      if (beforeSnap.exists()) {
        beforeData = beforeSnap.data();
      }
      const clientId = clientIdFromUpdate(payload, beforeData);
      const durationFields = durationFieldsFromUpdatePayload(payload);
      const dateAndTime = dateAndTimeFromPayload(payload);

      const docPayload = stripUndefined({
        trainerId: trainerUid,
        ...stripUndefined(payload),
        date: dateAndTime.dateKey,
        time: dateAndTime.timeText,
        ...durationFields,
        updatedAt: serverTimestamp(),
      });

      if (shouldResetSessionReminder(payload)) {
        docPayload.sessionReminderSent = false;
      }

      await updateDoc(sessionRef, docPayload);

      const meaningful = isMeaningfulSessionChange(payload, beforeData);
      if (clientId && meaningful) {
        await notifyClientSessionChanged(clientId, trainerUid, sessionId);
      }
    },
    [trainerUid],
  );

  // 5. Delete — read client id first so we can send a cancel push after remove.
  const deleteSession = useCallback(
    async (sessionId) => {
      if (!trainerUid) throw new Error('Not signed in');
      if (!sessionId) throw new Error('Missing session id');
      const sessionRef = doc(db, sessionDocumentPath(trainerUid, sessionId));
      const previousSnap = await getDoc(sessionRef);
      let previousData = null;
      if (previousSnap.exists()) {
        previousData = previousSnap.data();
      }
      await deleteDoc(sessionRef);

      let clientId = undefined;
      if (previousData != null && previousData.clientId) {
        clientId = previousData.clientId;
      }
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

/**
 * Thin alias for session form screens — requires SessionsProvider (single listener).
 * @returns {Function}
 */
export function useCreateTrainingSession() {
  const { addSession } = useSharedSessionList();
  return addSession;
}

/**
 * Thin alias for session form screens — requires SessionsProvider (single listener).
 * @returns {Function}
 */
export function useUpdateTrainingSession() {
  const { updateSession } = useSharedSessionList();
  return updateSession;
}

/**
 * Thin alias for session form screens — requires SessionsProvider (single listener).
 * @returns {Function}
 */
export function useDeleteTrainingSession() {
  const { deleteSession } = useSharedSessionList();
  return deleteSession;
}

/**
 * Thin alias for session form screens — requires SessionsProvider (single listener).
 * @returns {Function}
 */
export function useGetTrainingSession() {
  const { getSession, sessions } = useSharedSessionList();
  return useCallback((sessionId) => getSession(sessionId), [getSession, sessions]);
}

// ===== PLUMBING — skip unless debugging push notifies or display names =====

/**
 * Display name from users/{uid}. A missing profile still says "Your coach" so the push is not blank.
 * @param {string} trainerUid
 * @returns {Promise<string>}
 */
async function trainerDisplayName(trainerUid) {
  try {
    const userSnap = await getDoc(doc(db, USERS_COLLECTION, trainerUid));
    const userData = userSnap.data();
    return displayNameFromUserData(userData);
  } catch (_profileReadError) {
    return TRAINER_NAME_FALLBACK;
  }
}

/**
 * Fire-and-forget “session scheduled” push to the client.
 * @param {object} docPayload
 * @param {string} sessionId
 * @param {string} trainerUid
 * @returns {void}
 */
function notifyClientSessionScheduled(docPayload, sessionId, trainerUid) {
  if (!docPayload.clientId) return;
  const pushPromise = sendSessionScheduledPushToClient({
    clientId: docPayload.clientId,
    trainerUid,
    date: docPayload.date,
    time: docPayload.time,
    sessionId,
  });
  ignorePushFailure(pushPromise);
}

/**
 * Push when a watched session field changed.
 * @param {string} clientId
 * @param {string} trainerUid
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
async function notifyClientSessionChanged(clientId, trainerUid, sessionId) {
  if (!clientId) return;
  const coachName = await trainerDisplayName(trainerUid);
  const pushPromise = postRemotePushNotify({
    recipientId: clientId,
    senderName: coachName,
    messageText: randomSessionUpdateClientBody(),
    senderId: `session_${sessionId}`,
    messageId: sessionId,
    notificationType: NOTIFICATION_TYPE_SESSION_UPDATE,
  });
  ignorePushFailure(pushPromise);
}

/**
 * Push when a session was deleted.
 * @param {string} clientId
 * @param {string} trainerUid
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
async function notifyClientSessionCancelled(clientId, trainerUid, sessionId) {
  if (!clientId) return;
  const coachName = await trainerDisplayName(trainerUid);
  const pushPromise = postRemotePushNotify({
    recipientId: clientId,
    senderName: coachName,
    messageText: randomSessionCancelledClientBody(),
    senderId: `session_${sessionId}`,
    messageId: sessionId,
    notificationType: NOTIFICATION_TYPE_SESSION_UPDATE,
  });
  ignorePushFailure(pushPromise);
}
