// Canonical trainer ↔ client Firestore paths and roster paging.
// Flow: prefer trainer_clients/{trainerId}/clients/{clientId} → fall back to legacy clients/{clientId}.
// Used by trainer CRM, roster paging, notes/tasks/progress subcollections.
// Path STRING VALUES must not change (rules + old app versions depend on them).
// Read order: constants → ref builders → read mains → write mains.

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
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import { getDocsWithIndexFallback, sortDocsByMillis } from '../../for-both/cloud-database/loadInPages';

// ===== NAMED CONSTANTS =====

// Manipulate here: default page size when the trainer scrolls the CRM roster.
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
 * Returns a document reference for a trainer's client in trainer_clients.
 * @param {string} trainerId
 * @param {string} clientId
 * @returns {object} Firestore doc ref
 */
export function trainerClientDocRef(trainerId, clientId) {
  return doc(db, TRAINER_CLIENTS_ROOT, String(trainerId), CLIENTS_SUBCOLLECTION, String(clientId));
}

/**
 * Returns a document reference for a legacy CRM client document.
 * @param {string} clientId
 * @returns {object} Firestore doc ref
 */
export function legacyClientDocRef(clientId) {
  return doc(db, LEGACY_CRM_CLIENTS_COLLECTION, String(clientId));
}

/**
 * Returns a subcollection reference under a specific trainer's client document.
 * @param {string} trainerId
 * @param {string} clientId
 * @param {string} subcollection
 * @returns {object} Firestore collection ref
 */
export function trainerClientSubcollectionRef(trainerId, clientId, subcollection) {
  return collection(
    db,
    TRAINER_CLIENTS_ROOT,
    String(trainerId),
    CLIENTS_SUBCOLLECTION,
    String(clientId),
    subcollection,
  );
}

/**
 * Returns a subcollection reference under a legacy CRM client document.
 * @param {string} clientId
 * @param {string} subcollection
 * @returns {object} Firestore collection ref
 */
export function legacyClientSubcollectionRef(clientId, subcollection) {
  return collection(db, LEGACY_CRM_CLIENTS_COLLECTION, String(clientId), subcollection);
}

/**
 * Returns a document reference for a child doc in a client subcollection.
 * @param {string|null} trainerId
 * @param {string} clientId
 * @param {string} subcollection
 * @param {string} docId
 * @returns {object} Firestore doc ref
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
 * Returns the collection reference for client progress records.
 * @param {string|null} trainerId
 * @param {string} clientId
 * @returns {object} Firestore collection ref
 */
export function progressCollectionRef(trainerId, clientId) {
  if (trainerId) {
    return trainerClientSubcollectionRef(trainerId, clientId, PROGRESS_SUBCOLLECTION);
  }
  return legacyClientSubcollectionRef(clientId, PROGRESS_SUBCOLLECTION);
}

/**
 * Returns the collection reference for client tasks.
 * @param {string|null} trainerId
 * @param {string} clientId
 * @returns {object} Firestore collection ref
 */
export function tasksCollectionRef(trainerId, clientId) {
  if (trainerId) {
    return trainerClientSubcollectionRef(trainerId, clientId, TASKS_SUBCOLLECTION);
  }
  return legacyClientSubcollectionRef(clientId, TASKS_SUBCOLLECTION);
}

/**
 * Returns the collection reference for client notes.
 * @param {string|null} trainerId
 * @param {string} clientId
 * @returns {object} Firestore collection ref
 */
export function notesCollectionRef(trainerId, clientId) {
  if (trainerId) {
    return trainerClientSubcollectionRef(trainerId, clientId, NOTES_SUBCOLLECTION);
  }
  return legacyClientSubcollectionRef(clientId, NOTES_SUBCOLLECTION);
}

function rowFromFirestoreSnap(docSnap, extraFields) {
  const mergedExtra = extraFields || {};
  return { id: docSnap.id, ...docSnap.data(), ...mergedExtra };
}

async function readCanonicalClientRow(trainerId, clientId) {
  const canonicalSnap = await getDoc(trainerClientDocRef(trainerId, clientId));
  if (!canonicalSnap.exists()) {
    return null;
  }
  return rowFromFirestoreSnap(canonicalSnap, { _source: SOURCE_CANONICAL });
}

async function readLegacyClientRow(clientId) {
  const legacySnap = await getDoc(legacyClientDocRef(clientId));
  if (!legacySnap.exists()) {
    return null;
  }
  return rowFromFirestoreSnap(legacySnap, { _source: SOURCE_LEGACY });
}

function sortRosterDocsWhenUpdatedAtMissing(docs, pageSize) {
  if (docs.length === 0) {
    return docs;
  }
  const firstRowData = docs[0].data();
  // vocab: ?. = only read updatedAt when data() returned an object.
  const firstHasUpdatedAt = Boolean(firstRowData?.updatedAt);
  if (firstHasUpdatedAt) {
    return docs;
  }
  return sortDocsByMillis(docs, UPDATED_AT_FIELD, 'desc').slice(0, pageSize);
}

async function loadCanonicalRosterPageDocs(trainerId, pageSize, startAfterDoc) {
  const canonicalRef = collection(
    db,
    TRAINER_CLIENTS_ROOT,
    String(trainerId),
    CLIENTS_SUBCOLLECTION,
  );

  let orderedQuery;
  if (startAfterDoc) {
    orderedQuery = query(
      canonicalRef,
      orderBy(UPDATED_AT_FIELD, 'desc'),
      startAfter(startAfterDoc),
      limit(pageSize),
    );
  } else {
    orderedQuery = query(canonicalRef, orderBy(UPDATED_AT_FIELD, 'desc'), limit(pageSize));
  }

  const fallbackLimit = Math.min(pageSize * INDEX_FALLBACK_MULTIPLIER, INDEX_FALLBACK_CAP);
  const snapshot = await getDocsWithIndexFallback(
    orderedQuery,
    () => query(canonicalRef, limit(fallbackLimit)),
    'trainer_clients roster',
  );

  return sortRosterDocsWhenUpdatedAtMissing(snapshot.docs, pageSize);
}

function rowsFromDocList(sortedDocs, seenClientIds) {
  const clients = [];
  for (let index = 0; index < sortedDocs.length; index += 1) {
    const docSnap = sortedDocs[index];
    seenClientIds.add(docSnap.id);
    clients.push(rowFromFirestoreSnap(docSnap));
  }
  return clients;
}

function pushAll(targetList, sourceList) {
  for (let index = 0; index < sourceList.length; index += 1) {
    targetList.push(sourceList[index]);
  }
}

async function readSubcollectionRows(collectionRef) {
  const snapshot = await getDocs(collectionRef);
  const rows = [];
  for (let index = 0; index < snapshot.docs.length; index += 1) {
    rows.push(rowFromFirestoreSnap(snapshot.docs[index]));
  }
  return rows;
}

async function tryDeleteCanonicalSubdoc(trainerId, clientId, subcollection, docId) {
  const canonicalRef = trainerClientSubdocRef(trainerId, clientId, subcollection, docId);
  const snap = await getDoc(canonicalRef);
  if (!snap.exists()) {
    return false;
  }
  await deleteDoc(canonicalRef);
  return true;
}

async function loadLegacyRosterPageSnap(trainerId, pageSize) {
  const legacyOrderedQuery = query(
    collection(db, LEGACY_CRM_CLIENTS_COLLECTION),
    where(TRAINER_ID_FIELD, '==', String(trainerId)),
    orderBy(UPDATED_AT_FIELD, 'desc'),
    limit(pageSize),
  );
  return getDocsWithIndexFallback(
    legacyOrderedQuery,
    () =>
      query(
        collection(db, LEGACY_CRM_CLIENTS_COLLECTION),
        where(TRAINER_ID_FIELD, '==', String(trainerId)),
        limit(pageSize),
      ),
    'legacy clients roster',
  );
}

function appendUnseenLegacyClientDocs(legacyDocs, seenClientIds, clients) {
  for (let index = 0; index < legacyDocs.length; index += 1) {
    const docSnap = legacyDocs[index];
    if (seenClientIds.has(docSnap.id)) {
      continue;
    }
    seenClientIds.add(docSnap.id);
    clients.push(rowFromFirestoreSnap(docSnap, { _legacyOnly: true }));
  }
}

async function appendFirstPageLegacyClients(trainerId, pageSize, seenClientIds, clients) {
  // 1. Load page-one legacy clients; rules may deny the collection — ignore and keep canonical.
  try {
    const legacySnap = await loadLegacyRosterPageSnap(trainerId, pageSize);
    appendUnseenLegacyClientDocs(legacySnap.docs, seenClientIds, clients);
  } catch (_legacyQueryError) {
    // Rules may block legacy collection reads — canonical roster still returns.
  }
}

// ===== MAIN FUNCTION =====

/**
 * Read one CRM client row: canonical trainer_clients path first, then legacy clients/{id}.
 * @param {string} clientId
 * @param {string|null} [trainerId]
 * @returns {Promise<object|null>}
 */
export async function fetchTrainerClientDoc(clientId, trainerId = null) {
  // 1. Need a client id and an open Firestore handle.
  if (!clientId || !db) {
    return null;
  }

  // 2. When trainerId is known, read canonical trainer_clients/{trainerId}/clients/{clientId} first.
  if (trainerId) {
    const canonicalRow = await readCanonicalClientRow(trainerId, clientId);
    if (canonicalRow) {
      return canonicalRow;
    }
  }

  // 3. Fall back to legacy top-level clients/{clientId}.
  return readLegacyClientRow(clientId);
}

/**
 * One page of the trainer’s CRM roster (canonical + optional first-page legacy stitch).
 * @param {string} trainerId
 * @param {{ pageSize?: number, startAfterDoc?: object|null, includeLegacy?: boolean }} [options]
 * @returns {Promise<{ clients: object[], lastDoc: object|null, hasMore: boolean }>}
 */
export async function fetchTrainerClientRosterPage(
  trainerId,
  { pageSize = TRAINER_ROSTER_PAGE_SIZE, startAfterDoc = null, includeLegacy = true } = {},
) {
  // 1. Bail with an empty page shape when trainer or db is missing.
  if (!trainerId || !db) {
    return EMPTY_ROSTER_PAGE;
  }

  // 2. Query canonical subcollection ordered by updatedAt (or a looser query on index miss).
  const sortedDocs = await loadCanonicalRosterPageDocs(trainerId, pageSize, startAfterDoc);

  // 3. Turn snaps into plain rows and track ids already seen.
  const seenClientIds = new Set();
  const clients = rowsFromDocList(sortedDocs, seenClientIds);

  // 4. Page-one only: stitch legacy clients/{id} rows not already in canonical.
  const shouldStitchLegacy = includeLegacy && !startAfterDoc;
  if (shouldStitchLegacy) {
    await appendFirstPageLegacyClients(trainerId, pageSize, seenClientIds, clients);
  }

  const lastDoc = sortedDocs.length > 0 ? sortedDocs[sortedDocs.length - 1] : null;
  const hasMore = sortedDocs.length >= pageSize;
  return { clients, lastDoc, hasMore };
}

/**
 * Walk roster pages until the cap, the cursor ends, or max page count.
 * @param {string} trainerId
 * @param {{ includeLegacy?: boolean, maxClients?: number }} [options]
 * @returns {Promise<object[]>}
 */
export async function fetchTrainerClientRoster(
  trainerId,
  { includeLegacy = true, maxClients = DEFAULT_MAX_CLIENTS } = {},
) {
  // 1. Guard missing trainer/db.
  if (!trainerId || !db) {
    return [];
  }

  // 2. Walk roster pages until cap, cursor exhausted, or max page count.
  const allClients = [];
  let cursorDoc = null;
  let morePagesExist = true;
  let pageCount = 0;
  const maxPageCount = Math.ceil(maxClients / TRAINER_ROSTER_PAGE_SIZE);

  while (morePagesExist && pageCount < maxPageCount && allClients.length < maxClients) {
    const page = await fetchTrainerClientRosterPage(trainerId, {
      pageSize: TRAINER_ROSTER_PAGE_SIZE,
      startAfterDoc: cursorDoc,
      includeLegacy: pageCount === 0 && includeLegacy,
    });
    pushAll(allClients, page.clients);
    cursorDoc = page.lastDoc;
    morePagesExist = page.hasMore;
    pageCount += 1;
  }

  return allClients.slice(0, maxClients);
}

/**
 * Read every doc in a client subcollection (canonical first, then legacy).
 * @param {string} clientId
 * @param {string} subcollection
 * @param {string|null} [trainerId]
 * @returns {Promise<object[]>}
 */
export async function fetchTrainerClientSubcollectionDocs(clientId, subcollection, trainerId = null) {
  if (!clientId || !db) {
    return [];
  }

  if (trainerId) {
    const canonicalRows = await readSubcollectionRows(
      trainerClientSubcollectionRef(trainerId, clientId, subcollection),
    );
    if (canonicalRows.length > 0) {
      return canonicalRows;
    }
  }

  return readSubcollectionRows(legacyClientSubcollectionRef(clientId, subcollection));
}

/**
 * Create or merge the canonical trainer_clients/{trainerId}/clients/{clientId} doc.
 * @param {string} trainerId
 * @param {string} clientId
 * @param {object} payload
 * @param {{ merge?: boolean }} [options]
 * @returns {Promise<object>} Firestore doc ref
 */
export async function upsertTrainerClientDoc(trainerId, clientId, payload, { merge = true } = {}) {
  if (!trainerId || !clientId || !db) {
    throw new Error('Missing trainerId or clientId');
  }

  const ref = trainerClientDocRef(trainerId, clientId);

  if (merge) {
    await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
    return ref;
  }

  await setDoc(ref, payload);
  return ref;
}

/**
 * Update an existing client document with merge semantics.
 * @param {string} trainerId
 * @param {string} clientId
 * @param {object} updates
 * @returns {Promise<object>}
 */
export async function updateTrainerClientDoc(trainerId, clientId, updates) {
  return upsertTrainerClientDoc(trainerId, clientId, updates, { merge: true });
}

/**
 * Update a specific child doc inside a client subcollection.
 * @param {string} trainerId
 * @param {string} clientId
 * @param {string} subcollection
 * @param {string} docId
 * @param {object} updates
 * @returns {Promise<{ success: boolean }>}
 */
export async function updateTrainerClientSubdoc(trainerId, clientId, subcollection, docId, updates) {
  if (!clientId || !docId || !db) {
    throw new Error('Missing clientId or docId');
  }
  const ref = trainerClientSubdocRef(trainerId, clientId, subcollection, docId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
  return { success: true };
}

/**
 * Delete a specific child doc from a client subcollection (canonical first, then legacy).
 * @param {string} trainerId
 * @param {string} clientId
 * @param {string} subcollection
 * @param {string} docId
 * @returns {Promise<{ success: boolean }>}
 */
export async function deleteTrainerClientSubdoc(trainerId, clientId, subcollection, docId) {
  if (!clientId || !docId || !db) {
    throw new Error('Missing clientId or docId');
  }

  if (trainerId) {
    const deletedCanonical = await tryDeleteCanonicalSubdoc(
      trainerId,
      clientId,
      subcollection,
      docId,
    );
    if (deletedCanonical) {
      return { success: true };
    }
  }

  const legacyRef = doc(
    db,
    LEGACY_CRM_CLIENTS_COLLECTION,
    String(clientId),
    subcollection,
    String(docId),
  );
  await deleteDoc(legacyRef);
  return { success: true };
}
