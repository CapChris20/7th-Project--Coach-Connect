// Canonical trainer ↔ client Firestore paths.
// Flow: read trainer_clients/{trainerId}/clients/{clientId} first → fall back to legacy clients/{clientId}.
// Used by: trainer CRM, roster paging, notes/tasks/progress subcollections. Path STRING VALUES must not change.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import { getDocsWithIndexFallback, sortDocsByMillis } from '../../for-both/cloud-database/loadInPages';

// ===== NAMED CONSTANTS =====

export const TRAINER_ROSTER_PAGE_SIZE = 30;

export const LEGACY_CRM_CLIENTS_COLLECTION = 'clients';
export const TRAINER_CLIENT_LINKS_COLLECTION = 'trainer_client_links';

const TRAINER_CLIENTS_ROOT = 'trainer_clients';
const CLIENTS_SUBCOLLECTION = 'clients';
const UPDATED_AT_FIELD = 'updatedAt';
const TRAINER_ID_FIELD = 'trainerId';
const SOURCE_CANONICAL = 'trainer_clients';
const SOURCE_LEGACY = 'clients_legacy';
const PROGRESS_SUBCOLLECTION = 'progress';
const TASKS_SUBCOLLECTION = 'tasks';
const NOTES_SUBCOLLECTION = 'notes';
const INDEX_FALLBACK_MULTIPLIER = 3;
const INDEX_FALLBACK_CAP = 120;
const DEFAULT_MAX_CLIENTS = 300;

const EMPTY_ROSTER_PAGE = { clients: [], lastDoc: null, hasMore: false };

// ===== HELPER FUNCTIONS =====

/**
 * @param {object} docSnap
 * @param {object} [extra]
 * @returns {object}
 */
function clientRowFromSnap(docSnap, extra) {
  return { id: docSnap.id, ...docSnap.data(), ...extra };
}

/**
 * When updatedAt is missing on the first doc, the composite index was skipped — sort in memory.
 * @param {Array} docs
 * @param {number} pageSize
 * @returns {Array}
 */
function maybeSortRosterDocs(docs, pageSize) {
  if (docs.length > 0 && !docs[0].data()?.updatedAt) {
    return sortDocsByMillis(docs, UPDATED_AT_FIELD, 'desc').slice(0, pageSize);
  }
  return docs;
}

/**
 * Legacy top-level clients/{id} rows for this trainer, page 1 only, skipping ids already in canonical.
 * A rules error is swallowed so a blocked legacy collection cannot hide the canonical roster.
 * @param {string} trainerId
 * @param {number} pageSize
 * @param {Set<string>} seen
 * @param {Array} clients
 */
async function appendLegacyRosterPage(trainerId, pageSize, seen, clients) {
  try {
    const legacyPrimary = query(
      collection(db, LEGACY_CRM_CLIENTS_COLLECTION),
      where(TRAINER_ID_FIELD, '==', String(trainerId)),
      orderBy(UPDATED_AT_FIELD, 'desc'),
      limit(pageSize),
    );
    const legacySnap = await getDocsWithIndexFallback(
      legacyPrimary,
      () =>
        query(
          collection(db, LEGACY_CRM_CLIENTS_COLLECTION),
          where(TRAINER_ID_FIELD, '==', String(trainerId)),
          limit(pageSize),
        ),
      'legacy clients roster',
    );
    legacySnap.docs.forEach((docSnap) => {
      if (seen.has(docSnap.id)) return;
      seen.add(docSnap.id);
      clients.push(clientRowFromSnap(docSnap, { _legacyOnly: true }));
    });
  } catch {
    /* rules may block legacy collection query */
  }
}

// ===== MAIN FUNCTION =====

/**
 * Canonical CRM row: trainer_clients/{trainerId}/clients/{clientId}.
 * @param {string} trainerId
 * @param {string} clientId
 * @returns {object}
 */
export function trainerClientDocRef(trainerId, clientId) {
  return doc(db, TRAINER_CLIENTS_ROOT, String(trainerId), CLIENTS_SUBCOLLECTION, String(clientId));
}

/**
 * Legacy top-level clients/{clientId}.
 * @param {string} clientId
 * @returns {object}
 */
export function legacyClientDocRef(clientId) {
  return doc(db, LEGACY_CRM_CLIENTS_COLLECTION, String(clientId));
}

/**
 * Canonical subcollection under a trainer's client row.
 * @param {string} trainerId
 * @param {string} clientId
 * @param {string} subcollection
 * @returns {object}
 */
export function trainerClientSubcollectionRef(trainerId, clientId, subcollection) {
  return collection(db, TRAINER_CLIENTS_ROOT, String(trainerId), CLIENTS_SUBCOLLECTION, String(clientId), subcollection);
}

/**
 * Legacy subcollection under clients/{clientId}.
 * @param {string} clientId
 * @param {string} subcollection
 * @returns {object}
 */
export function legacyClientSubcollectionRef(clientId, subcollection) {
  return collection(db, LEGACY_CRM_CLIENTS_COLLECTION, String(clientId), subcollection);
}

/**
 * Fetch CRM client row — canonical first, then legacy top-level clients/{id}.
 * @param {string} clientId
 * @param {string|null} [trainerId]
 * @returns {Promise<object|null>}
 */
export async function fetchTrainerClientDoc(clientId, trainerId = null) {
  if (!clientId || !db) return null;

  if (trainerId) {
    const canonicalSnap = await getDoc(trainerClientDocRef(trainerId, clientId));
    if (canonicalSnap.exists()) {
      return clientRowFromSnap(canonicalSnap, { _source: SOURCE_CANONICAL });
    }
  }

  const legacySnap = await getDoc(legacyClientDocRef(clientId));
  if (legacySnap.exists()) {
    return clientRowFromSnap(legacySnap, { _source: SOURCE_LEGACY });
  }

  return null;
}

/**
 * Paginated roster page — canonical `trainer_clients/{trainerId}/clients` (+ legacy slice on page 1).
 * @param {string} trainerId
 * @param {{ pageSize?: number, startAfterDoc?: object|null, includeLegacy?: boolean }} [options]
 * @returns {Promise<{ clients: Array, lastDoc: object|null, hasMore: boolean }>}
 */
export async function fetchTrainerClientRosterPage(
  trainerId,
  { pageSize = TRAINER_ROSTER_PAGE_SIZE, startAfterDoc = null, includeLegacy = true } = {},
) {
  if (!trainerId || !db) return EMPTY_ROSTER_PAGE;

  const canonicalRef = collection(db, TRAINER_CLIENTS_ROOT, String(trainerId), CLIENTS_SUBCOLLECTION);
  const primary = startAfterDoc
    ? query(canonicalRef, orderBy(UPDATED_AT_FIELD, 'desc'), startAfter(startAfterDoc), limit(pageSize))
    : query(canonicalRef, orderBy(UPDATED_AT_FIELD, 'desc'), limit(pageSize));

  const snap = await getDocsWithIndexFallback(
    primary,
    () => query(canonicalRef, limit(Math.min(pageSize * INDEX_FALLBACK_MULTIPLIER, INDEX_FALLBACK_CAP))),
    'trainer_clients roster',
  );

  const docs = maybeSortRosterDocs(snap.docs, pageSize);
  const seen = new Set();
  const clients = docs.map((docSnap) => {
    seen.add(docSnap.id);
    return clientRowFromSnap(docSnap);
  });

  if (includeLegacy && !startAfterDoc) {
    await appendLegacyRosterPage(trainerId, pageSize, seen, clients);
  }

  const lastDoc = docs.length ? docs[docs.length - 1] : null;
  const hasMore = docs.length >= pageSize;
  return { clients, lastDoc, hasMore };
}

/**
 * List roster docs (pages internally, capped) — for callers that need “all” clients.
 * @param {string} trainerId
 * @param {{ includeLegacy?: boolean, maxClients?: number }} [options]
 * @returns {Promise<Array>}
 */
export async function fetchTrainerClientRoster(trainerId, { includeLegacy = true, maxClients = DEFAULT_MAX_CLIENTS } = {}) {
  if (!trainerId || !db) return [];

  const allClients = [];
  let cursor = null;
  let hasMore = true;
  let pages = 0;
  const maxPages = Math.ceil(maxClients / TRAINER_ROSTER_PAGE_SIZE);

  while (hasMore && pages < maxPages && allClients.length < maxClients) {
    const page = await fetchTrainerClientRosterPage(trainerId, {
      pageSize: TRAINER_ROSTER_PAGE_SIZE,
      startAfterDoc: cursor,
      includeLegacy: pages === 0 && includeLegacy,
    });
    allClients.push(...page.clients);
    cursor = page.lastDoc;
    hasMore = page.hasMore;
    pages += 1;
  }

  return allClients.slice(0, maxClients);
}

/**
 * Read subcollection docs: canonical path first; if empty and trainerId known, try legacy.
 * @param {string} clientId
 * @param {string} subcollection
 * @param {string|null} [trainerId]
 * @returns {Promise<Array>}
 */
export async function fetchTrainerClientSubcollectionDocs(clientId, subcollection, trainerId = null) {
  if (!clientId || !db) return [];

  if (trainerId) {
    const canonicalRef = trainerClientSubcollectionRef(trainerId, clientId, subcollection);
    const canonicalSnap = await getDocs(canonicalRef);
    if (!canonicalSnap.empty) {
      return canonicalSnap.docs.map((docSnap) => clientRowFromSnap(docSnap));
    }
  }

  const legacyRef = legacyClientSubcollectionRef(clientId, subcollection);
  const legacySnap = await getDocs(legacyRef);
  return legacySnap.docs.map((docSnap) => clientRowFromSnap(docSnap));
}

/**
 * Write CRM client row — canonical only.
 * @param {string} trainerId
 * @param {string} clientId
 * @param {object} payload
 * @param {{ merge?: boolean }} [options]
 * @returns {Promise<object>}
 */
export async function upsertTrainerClientDoc(trainerId, clientId, payload, { merge = true } = {}) {
  if (!trainerId || !clientId || !db) throw new Error('Missing trainerId or clientId');
  const ref = trainerClientDocRef(trainerId, clientId);
  if (merge) {
    await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
  } else {
    await setDoc(ref, payload);
  }
  return ref;
}

/**
 * Merge-update a canonical CRM client row.
 * @param {string} trainerId
 * @param {string} clientId
 * @param {object} updates
 * @returns {Promise<object>}
 */
export async function updateTrainerClientDoc(trainerId, clientId, updates) {
  return upsertTrainerClientDoc(trainerId, clientId, updates, { merge: true });
}

/**
 * @param {string} trainerId
 * @param {string} clientId
 * @returns {object}
 */
export function progressCollectionRef(trainerId, clientId) {
  if (trainerId) return trainerClientSubcollectionRef(trainerId, clientId, PROGRESS_SUBCOLLECTION);
  return legacyClientSubcollectionRef(clientId, PROGRESS_SUBCOLLECTION);
}

/**
 * @param {string} trainerId
 * @param {string} clientId
 * @returns {object}
 */
export function tasksCollectionRef(trainerId, clientId) {
  if (trainerId) return trainerClientSubcollectionRef(trainerId, clientId, TASKS_SUBCOLLECTION);
  return legacyClientSubcollectionRef(clientId, TASKS_SUBCOLLECTION);
}

/**
 * @param {string} trainerId
 * @param {string} clientId
 * @returns {object}
 */
export function notesCollectionRef(trainerId, clientId) {
  if (trainerId) return trainerClientSubcollectionRef(trainerId, clientId, NOTES_SUBCOLLECTION);
  return legacyClientSubcollectionRef(clientId, NOTES_SUBCOLLECTION);
}

/**
 * Doc ref inside a client subcollection. Canonical when trainerId is present.
 * @param {string} trainerId
 * @param {string} clientId
 * @param {string} subcollection
 * @param {string} docId
 * @returns {object}
 */
export function trainerClientSubdocRef(trainerId, clientId, subcollection, docId) {
  if (trainerId) {
    return doc(
      db,
      TRAINER_CLIENTS_ROOT,
      String(trainerId),
      CLIENTS_SUBCOLLECTION,
      String(clientId),
      subcollection,
      String(docId),
    );
  }
  return doc(db, LEGACY_CRM_CLIENTS_COLLECTION, String(clientId), subcollection, String(docId));
}

/**
 * Update subcollection doc — canonical path when trainerId present.
 * @param {string} trainerId
 * @param {string} clientId
 * @param {string} subcollection
 * @param {string} docId
 * @param {object} updates
 * @returns {Promise<{ success: boolean }>}
 */
export async function updateTrainerClientSubdoc(trainerId, clientId, subcollection, docId, updates) {
  if (!clientId || !docId || !db) throw new Error('Missing clientId or docId');
  const ref = trainerClientSubdocRef(trainerId, clientId, subcollection, docId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
  return { success: true };
}

/**
 * Delete subcollection doc — canonical first; legacy fallback if canonical missing.
 * @param {string} trainerId
 * @param {string} clientId
 * @param {string} subcollection
 * @param {string} docId
 * @returns {Promise<{ success: boolean }>}
 */
export async function deleteTrainerClientSubdoc(trainerId, clientId, subcollection, docId) {
  if (!clientId || !docId || !db) throw new Error('Missing clientId or docId');
  if (trainerId) {
    const canonicalRef = trainerClientSubdocRef(trainerId, clientId, subcollection, docId);
    const snap = await getDoc(canonicalRef);
    if (snap.exists()) {
      await deleteDoc(canonicalRef);
      return { success: true };
    }
  }
  const legacyRef = doc(db, LEGACY_CRM_CLIENTS_COLLECTION, String(clientId), subcollection, String(docId));
  await deleteDoc(legacyRef);
  return { success: true };
}
