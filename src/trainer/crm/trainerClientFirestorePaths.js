/**
 * trainer Client Firestore Paths
 *
 * Purpose: Data/service layer: trainer Client Firestore Paths. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: trainerClientDocRef, legacyClientDocRef, trainerClientSubcollectionRef, legacyClientSubcollectionRef, fetchTrainerClientDoc, fetchTrainerClientRosterPage, fetchTrainerClientRoster, fetchTrainerClientSubcollectionDocs
 *
 * @file-header
 */
/**
 * Canonical trainer ↔ client Firestore paths.
 * Reads: trainer_clients/{trainerId}/clients/{clientId} first, legacy clients/{clientId} fallback.
 * Writes: canonical path only (legacy mirror only where explicitly documented in CRM create).
 */

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
import { db } from '../../app/config';
import { getDocsWithIndexFallback, sortDocsByMillis } from '../../shared/firestore/firestorePagedQuery';

export const TRAINER_ROSTER_PAGE_SIZE = 30;

export const LEGACY_CRM_CLIENTS_COLLECTION = 'clients';
export const TRAINER_CLIENT_LINKS_COLLECTION = 'trainer_client_links';

export function trainerClientDocRef(trainerId, clientId) {
  return doc(db, 'trainer_clients', String(trainerId), 'clients', String(clientId));
}

export function legacyClientDocRef(clientId) {
  return doc(db, LEGACY_CRM_CLIENTS_COLLECTION, String(clientId));
}

export function trainerClientSubcollectionRef(trainerId, clientId, subcollection) {
  return collection(db, 'trainer_clients', String(trainerId), 'clients', String(clientId), subcollection);
}

export function legacyClientSubcollectionRef(clientId, subcollection) {
  return collection(db, LEGACY_CRM_CLIENTS_COLLECTION, String(clientId), subcollection);
}

/** Fetch CRM client row — canonical first, then legacy top-level clients/{id}. */
export async function fetchTrainerClientDoc(clientId, trainerId = null) {
  if (!clientId || !db) return null;

  if (trainerId) {
    const canonicalSnap = await getDoc(trainerClientDocRef(trainerId, clientId));
    if (canonicalSnap.exists()) {
      return { id: canonicalSnap.id, ...canonicalSnap.data(), _source: 'trainer_clients' };
    }
  }

  const legacySnap = await getDoc(legacyClientDocRef(clientId));
  if (legacySnap.exists()) {
    return { id: legacySnap.id, ...legacySnap.data(), _source: 'clients_legacy' };
  }

  return null;
}

/**
 * Paginated roster page — canonical `trainer_clients/{trainerId}/clients` (+ legacy slice on page 1).
 */
export async function fetchTrainerClientRosterPage(
  trainerId,
  { pageSize = TRAINER_ROSTER_PAGE_SIZE, startAfterDoc = null, includeLegacy = true } = {},
) {
  if (!trainerId || !db) {
    return { clients: [], lastDoc: null, hasMore: false };
  }

  const canonicalRef = collection(db, 'trainer_clients', String(trainerId), 'clients');
  const primary = startAfterDoc
    ? query(canonicalRef, orderBy('updatedAt', 'desc'), startAfter(startAfterDoc), limit(pageSize))
    : query(canonicalRef, orderBy('updatedAt', 'desc'), limit(pageSize));

  const snap = await getDocsWithIndexFallback(
    primary,
    () => query(canonicalRef, limit(Math.min(pageSize * 3, 120))),
    'trainer_clients roster',
  );

  let docs = snap.docs;
  if (docs.length > 0 && !docs[0].data()?.updatedAt) {
    docs = sortDocsByMillis(docs, 'updatedAt', 'desc').slice(0, pageSize);
  }

  const seen = new Set();
  const clients = docs.map((docSnap) => {
    seen.add(docSnap.id);
    return { id: docSnap.id, ...docSnap.data() };
  });

  if (includeLegacy && !startAfterDoc) {
    try {
      const legacyPrimary = query(
        collection(db, LEGACY_CRM_CLIENTS_COLLECTION),
        where('trainerId', '==', String(trainerId)),
        orderBy('updatedAt', 'desc'),
        limit(pageSize),
      );
      const legacySnap = await getDocsWithIndexFallback(
        legacyPrimary,
        () =>
          query(
            collection(db, LEGACY_CRM_CLIENTS_COLLECTION),
            where('trainerId', '==', String(trainerId)),
            limit(pageSize),
          ),
        'legacy clients roster',
      );
      legacySnap.docs.forEach((docSnap) => {
        if (seen.has(docSnap.id)) return;
        seen.add(docSnap.id);
        clients.push({ id: docSnap.id, ...docSnap.data(), _legacyOnly: true });
      });
    } catch (_) {
      /* rules may block legacy collection query */
    }
  }

  const lastDoc = docs.length ? docs[docs.length - 1] : null;
  const hasMore = docs.length >= pageSize;

  return { clients, lastDoc, hasMore };
}

/**
 * List roster docs (pages internally, capped) — for callers that need “all” clients.
 */
export async function fetchTrainerClientRoster(trainerId, { includeLegacy = true, maxClients = 300 } = {}) {
  if (!trainerId || !db) return [];

  const all = [];
  let cursor = null;
  let hasMore = true;
  let pages = 0;
  const maxPages = Math.ceil(maxClients / TRAINER_ROSTER_PAGE_SIZE);

  while (hasMore && pages < maxPages && all.length < maxClients) {
    const page = await fetchTrainerClientRosterPage(trainerId, {
      pageSize: TRAINER_ROSTER_PAGE_SIZE,
      startAfterDoc: cursor,
      includeLegacy: pages === 0 && includeLegacy,
    });
    all.push(...page.clients);
    cursor = page.lastDoc;
    hasMore = page.hasMore;
    pages += 1;
  }

  return all.slice(0, maxClients);
}

/** Read subcollection docs: canonical path first; if empty and trainerId known, try legacy. */
export async function fetchTrainerClientSubcollectionDocs(clientId, subcollection, trainerId = null) {
  if (!clientId || !db) return [];

  if (trainerId) {
    const canonicalRef = trainerClientSubcollectionRef(trainerId, clientId, subcollection);
    const canonicalSnap = await getDocs(canonicalRef);
    if (!canonicalSnap.empty) {
      return canonicalSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  }

  const legacyRef = legacyClientSubcollectionRef(clientId, subcollection);
  const legacySnap = await getDocs(legacyRef);
  return legacySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Write CRM client row — canonical only. */
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

export async function updateTrainerClientDoc(trainerId, clientId, updates) {
  return upsertTrainerClientDoc(trainerId, clientId, updates, { merge: true });
}

export function progressCollectionRef(trainerId, clientId) {
  if (trainerId) return trainerClientSubcollectionRef(trainerId, clientId, 'progress');
  return legacyClientSubcollectionRef(clientId, 'progress');
}

export function tasksCollectionRef(trainerId, clientId) {
  if (trainerId) return trainerClientSubcollectionRef(trainerId, clientId, 'tasks');
  return legacyClientSubcollectionRef(clientId, 'tasks');
}

export function notesCollectionRef(trainerId, clientId) {
  if (trainerId) return trainerClientSubcollectionRef(trainerId, clientId, 'notes');
  return legacyClientSubcollectionRef(clientId, 'notes');
}

export function trainerClientSubdocRef(trainerId, clientId, subcollection, docId) {
  if (trainerId) {
    return doc(
      db,
      'trainer_clients',
      String(trainerId),
      'clients',
      String(clientId),
      subcollection,
      String(docId),
    );
  }
  return doc(db, LEGACY_CRM_CLIENTS_COLLECTION, String(clientId), subcollection, String(docId));
}

/** Update subcollection doc — canonical path when trainerId present. */
export async function updateTrainerClientSubdoc(trainerId, clientId, subcollection, docId, updates) {
  if (!clientId || !docId || !db) throw new Error('Missing clientId or docId');
  const ref = trainerClientSubdocRef(trainerId, clientId, subcollection, docId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
  return { success: true };
}

/** Delete subcollection doc — canonical first; legacy fallback if canonical missing. */
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
