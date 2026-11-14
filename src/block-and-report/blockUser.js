// Hide or show another person in messages and the marketplace.
// Flow: write users/{uid}/blockedUsers/{blockedUid} → live listeners refresh → lists drop that person.
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

// ===== MAIN FUNCTIONS =====

/**
 * Block another user under users/{uid}/blockedUsers/{blockedUid}.
 * @param {string} uid
 * @param {string} blockedUid
 * @param {{ displayName?: string }} [meta]
 * @returns {Promise<void>}
 */
export async function blockUser(uid, blockedUid, meta = {}) {
  // 1. Trim both ids so empty strings cannot slip through.
  const signedInUid = trimmedUid(uid);
  const personToBlock = trimmedUid(blockedUid);

  // 2. Refuse self-block and missing ids before we touch Firestore.
  const requestIsValid = blockRequestIsValid(signedInUid, personToBlock);
  if (!requestIsValid) {
    throw new Error(INVALID_BLOCK_MESSAGE);
  }

  // 3. Optional label for the blocked-users screen (capped length).
  const displayName = displayNameForBlockDoc(meta);

  // 4. Merge-write the block row (re-block updates the label).
  const blockDocRef = blockDocReference(signedInUid, personToBlock);
  await setDoc(
    blockDocRef,
    {
      blockedUid: personToBlock,
      displayName,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Remove one blockedUsers doc so lists can show that person again.
 * @param {string} uid
 * @param {string} blockedUid
 * @returns {Promise<void>}
 */
export async function unblockUser(uid, blockedUid) {
  // 1. Trim ids; missing either side is a no-op.
  const signedInUid = trimmedUid(uid);
  const personToUnblock = trimmedUid(blockedUid);
  if (!signedInUid) {
    return;
  }
  if (!personToUnblock) {
    return;
  }

  // 2. Delete the block row; listeners clear that id from their Sets.
  const blockDocRef = blockDocReference(signedInUid, personToUnblock);
  await deleteDoc(blockDocRef);
}

/**
 * One-shot read of every block row for the blocked-users screen.
 * @param {string} uid
 * @returns {Promise<Array<{ id: string }>>}
 */
export async function listMyBlocks(uid) {
  // 1. Signed out → empty list, not an error.
  const signedInUid = trimmedUid(uid);
  if (!signedInUid) {
    return [];
  }

  // 2. Pull every doc under blockedUsers and shape each row for the screen.
  const snapshot = await getDocs(blockedUsersCollection(signedInUid));
  const blockRows = blockRowsFromSnapshot(snapshot);
  return blockRows;
}

/**
 * Live set of blocked ids. The returned function is the listener cleanup.
 * @param {string} uid
 * @param {(ids: Set<string>) => void} onChange
 * @returns {() => void}
 */
export function subscribeMyBlocks(uid, onChange) {
  // 1. Bad inputs → empty Set once, then a no-op cleanup.
  const signedInUid = trimmedUid(uid);
  const hasChangeHandler = typeof onChange === 'function';
  if (!signedInUid || !hasChangeHandler) {
    notifyEmptyBlockedSet(onChange, hasChangeHandler);
    return emptyCleanup;
  }

  // 2. Listen until the caller unsubscribes (uid change or unmount).
  const stopListening = onSnapshot(
    blockedUsersCollection(signedInUid),
    (snapshot) => {
      const blockedIds = blockedIdSetFromSnapshot(snapshot);
      onChange(blockedIds);
    },
    (listenError) => {
      warnSubscribeFailureInDev(listenError);
      onChange(new Set());
    },
  );
  return stopListening;
}

// ===== PLUMBING — skip unless debugging Firestore paths or listener edge cases =====

function blockedUsersCollection(uid) {
  return collection(db, USERS_COLLECTION, uid, BLOCKED_USERS_COLLECTION);
}

function blockDocReference(signedInUid, blockedUid) {
  return doc(
    db,
    USERS_COLLECTION,
    signedInUid,
    BLOCKED_USERS_COLLECTION,
    blockedUid,
  );
}

function trimmedUid(uid) {
  return String(uid || '').trim();
}

function blockRequestIsValid(signedInUid, personToBlock) {
  if (!signedInUid) {
    return false;
  }
  if (!personToBlock) {
    return false;
  }
  if (signedInUid === personToBlock) {
    return false;
  }
  return true;
}

function displayNameForBlockDoc(meta) {
  if (!meta.displayName) {
    return null;
  }
  return String(meta.displayName).slice(0, MAX_DISPLAY_NAME_LENGTH);
}

function blockRecordFromDoc(blockDoc) {
  const storedFields = blockDoc.data() || {};
  return { id: blockDoc.id, ...storedFields };
}

function blockRowsFromSnapshot(snapshot) {
  const rows = [];
  const docs = snapshot.docs;
  for (let index = 0; index < docs.length; index += 1) {
    const oneRow = blockRecordFromDoc(docs[index]);
    rows.push(oneRow);
  }
  return rows;
}

function blockedIdSetFromSnapshot(snapshot) {
  const blockedIds = new Set();
  const docs = snapshot.docs;
  for (let index = 0; index < docs.length; index += 1) {
    blockedIds.add(docs[index].id);
  }
  return blockedIds;
}

function notifyEmptyBlockedSet(onChange, hasChangeHandler) {
  if (!hasChangeHandler) {
    return;
  }
  onChange(new Set());
}

function emptyCleanup() {}

function warnSubscribeFailureInDev(listenError) {
  if (!__DEV__) {
    return;
  }
  let message = listenError;
  if (listenError && listenError.message) {
    message = listenError.message;
  }
  console.warn('[safety] subscribeMyBlocks:', message);
}
