// Hide or show another person in messages and the marketplace.
// Flow: write users/{uid}/blockedUsers/{blockedUid} → the blocked list hears the change → lists drop that person.
// Used by the report popup, the blocked-users screen, and the inbox filter.

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const BLOCKED_USERS_COLLECTION = 'blockedUsers';
const MAX_DISPLAY_NAME_LENGTH = 120;
const INVALID_BLOCK_MESSAGE = 'Invalid block request.';

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} uid
 * @returns {import('firebase/firestore').CollectionReference}
 */
function blockedUsersCollection(uid) {
  return collection(db, USERS_COLLECTION, uid, BLOCKED_USERS_COLLECTION);
}

/**
 * @param {string} uid
 * @returns {string}
 */
function trimmedUid(uid) {
  return String(uid || '').trim();
}

/**
 * @param {import('firebase/firestore').QueryDocumentSnapshot} blockDoc
 * @returns {object}
 */
function blockRecord(blockDoc) {
  return { id: blockDoc.id, ...(blockDoc.data() || {}) };
}

// ===== MAIN FUNCTION =====

/**
 * @param {string} uid
 * @param {string} blockedUid
 * @param {{ displayName?: string }} [meta]
 * @returns {Promise<void>}
 */
export async function blockUser(uid, blockedUid, meta = {}) {
  const signedInUid = trimmedUid(uid);
  const personToBlock = trimmedUid(blockedUid);
  if (!signedInUid || !personToBlock || signedInUid === personToBlock) {
    throw new Error(INVALID_BLOCK_MESSAGE);
  }
  // vocab: blockedUsers is a subcollection only the owner can read. See firestore.rules.
  const displayName = meta.displayName
    ? String(meta.displayName).slice(0, MAX_DISPLAY_NAME_LENGTH)
    : null;
  await setDoc(
    doc(db, USERS_COLLECTION, signedInUid, BLOCKED_USERS_COLLECTION, personToBlock),
    {
      blockedUid: personToBlock,
      displayName,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * @param {string} uid
 * @param {string} blockedUid
 * @returns {Promise<void>}
 */
export async function unblockUser(uid, blockedUid) {
  const signedInUid = trimmedUid(uid);
  const personToUnblock = trimmedUid(blockedUid);
  if (!signedInUid || !personToUnblock) return;
  await deleteDoc(doc(db, USERS_COLLECTION, signedInUid, BLOCKED_USERS_COLLECTION, personToUnblock));
}

/**
 * @param {string} uid
 * @returns {Promise<object[]>}
 */
export async function listMyBlocks(uid) {
  const signedInUid = trimmedUid(uid);
  if (!signedInUid) return [];
  const snapshot = await getDocs(blockedUsersCollection(signedInUid));
  return snapshot.docs.map(blockRecord);
}

/**
 * Live set of blocked ids. The returned function is the listener cleanup.
 * @param {string} uid
 * @param {Function} onChange
 * @returns {Function}
 */
export function subscribeMyBlocks(uid, onChange) {
  const signedInUid = trimmedUid(uid);
  if (!signedInUid || typeof onChange !== 'function') {
    onChange?.(new Set());
    return () => {};
  }
  return onSnapshot(
    blockedUsersCollection(signedInUid),
    (snapshot) => {
      const blockedIds = new Set();
      snapshot.forEach((blockDoc) => blockedIds.add(blockDoc.id));
      onChange(blockedIds);
    },
    (listenError) => {
      if (__DEV__) console.warn('[safety] subscribeMyBlocks:', listenError?.message || listenError);
      onChange(new Set());
    },
  );
}
