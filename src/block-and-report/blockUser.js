// Block / unblock other users for messaging + marketplace safety (Apple Guideline 1.2).
// Flow: writes users/{uid}/blockedUsers/{blockedUid} → blockedList subscribes → lists hide peers.
// Used by: ReportOrBlockPopup, BlockedUsersScreen, InboxScreen filter.
// Key exports: blockUser, unblockUser, subscribeMyBlocks, listMyBlocks

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

function blockedUsersCol(uid) {
  return collection(db, 'users', uid, 'blockedUsers');
}

/**
 * @param {string} uid - signed-in user
 * @param {string} blockedUid - person to hide
 * @param {{ displayName?: string } } [meta]
 */
export async function blockUser(uid, blockedUid, meta = {}) {
  const me = String(uid || '').trim();
  const them = String(blockedUid || '').trim();
  if (!me || !them || me === them) {
    throw new Error('Invalid block request.');
  }
  // vocab: blockedUsers = per-user subcollection — only the owner can read/write (see firestore.rules)
  await setDoc(
    doc(db, 'users', me, 'blockedUsers', them),
    {
      blockedUid: them,
      displayName: meta.displayName ? String(meta.displayName).slice(0, 120) : null,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function unblockUser(uid, blockedUid) {
  const me = String(uid || '').trim();
  const them = String(blockedUid || '').trim();
  if (!me || !them) return;
  await deleteDoc(doc(db, 'users', me, 'blockedUsers', them));
}

/** One-shot list for Settings (no live listener needed for a short list). */
export async function listMyBlocks(uid) {
  const me = String(uid || '').trim();
  if (!me) return [];
  const snap = await getDocs(blockedUsersCol(me));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

/**
 * Live Set of blocked uids for filtering conversation lists.
 * @param {string} uid
 * @param {(ids: Set<string>) => void} onChange
 * @returns {() => void} unsubscribe
 */
export function subscribeMyBlocks(uid, onChange) {
  const me = String(uid || '').trim();
  if (!me || typeof onChange !== 'function') {
    onChange?.(new Set());
    return () => {};
  }
  return onSnapshot(
    blockedUsersCol(me),
    (snap) => {
      const ids = new Set();
      snap.forEach((d) => ids.add(d.id));
      onChange(ids);
    },
    (err) => {
      if (__DEV__) console.warn('[safety] subscribeMyBlocks:', err?.message || err);
      onChange(new Set());
    },
  );
}
