// Live set of user ids the signed-in person has blocked.
// Flow: subscribe to their block list → keep it in React state → message lists hide those people.
// Used by InboxScreen and marketplace gates.

import { useEffect, useState } from 'react';
import { subscribeMyBlocks } from './blockUser';

// ===== NAMED CONSTANTS =====

// (no named constants needed)

// ===== HELPER FUNCTIONS =====

function makeEmptyBlockedIdSet() {
  return new Set();
}

function normalizedSignedInUid(uid) {
  return String(uid || '').trim();
}

function clearBlockedListState(setBlockedIds, setIsLoadingBlocks) {
  setBlockedIds(makeEmptyBlockedIdSet());
  setIsLoadingBlocks(false);
}

function applyBlockedIdsFromFirestore(idsFromFirestore, setBlockedIds, setIsLoadingBlocks) {
  setBlockedIds(idsFromFirestore);
  setIsLoadingBlocks(false);
}

/**
 * Wire the Firestore listener (or clear state when signed out).
 * Returns the unsubscribe function (or undefined when there is nothing to clean up).
 */
function startBlockedListSubscription(uid, setBlockedIds, setIsLoadingBlocks) {
  const signedInUid = normalizedSignedInUid(uid);

  if (!signedInUid) {
    clearBlockedListState(setBlockedIds, setIsLoadingBlocks);
    return undefined;
  }

  setIsLoadingBlocks(true);
  const stopListening = subscribeMyBlocks(signedInUid, (idsFromFirestore) => {
    applyBlockedIdsFromFirestore(idsFromFirestore, setBlockedIds, setIsLoadingBlocks);
  });

  return stopListening;
}

// ===== MAIN FUNCTION =====

/**
 * Hooks stay in this function, in this order: blockedIds state, loading state, then the subscription effect.
 * The returned key is `loading` because callers already read that name.
 * @param {string|null|undefined} uid
 * @returns {{ blockedIds: Set<string>, loading: boolean }}
 */
export function blockedList(uid) {
  const [blockedIds, setBlockedIds] = useState(makeEmptyBlockedIdSet);
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(Boolean(uid));

  useEffect(() => {
    // 1. Start (or clear) the live block list for this uid.
    const stopListening = startBlockedListSubscription(
      uid,
      setBlockedIds,
      setIsLoadingBlocks,
    );
    // 2. Cleanup when uid changes or the screen leaves.
    return stopListening;
  }, [uid]);

  return { blockedIds, loading: isLoadingBlocks };
}
