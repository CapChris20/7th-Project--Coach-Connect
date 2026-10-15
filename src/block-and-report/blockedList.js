// Live set of user ids the signed-in person has blocked.
// Flow: subscribe to their block list → keep it in state → message lists can hide those people.
// Used by: InboxScreen and marketplace gates.

import { useEffect, useState } from 'react';
import { subscribeMyBlocks } from './blockUser';

// ===== NAMED CONSTANTS =====

const EMPTY_BLOCKED_SET = () => new Set();

// ===== HELPER FUNCTIONS =====

/**
 * @param {string|null|undefined} uid
 * @returns {string}
 */
function normalizedSignedInUid(uid) {
  return String(uid || '').trim();
}

// ===== MAIN FUNCTION =====

/**
 * Hooks stay in this function, in this order: state, then the subscription effect.
 * The returned key is `loading` because callers already read that name.
 * @param {string|null|undefined} uid
 * @returns {{ blockedIds: Set<string>, loading: boolean }}
 */
export function blockedList(uid) {
  const [blockedIds, setBlockedIds] = useState(EMPTY_BLOCKED_SET);
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(Boolean(uid));

  useEffect(() => {
    const signedInUid = normalizedSignedInUid(uid);
    if (!signedInUid) {
      setBlockedIds(EMPTY_BLOCKED_SET());
      setIsLoadingBlocks(false);
      return undefined;
    }

    setIsLoadingBlocks(true);
    const unsubscribe = subscribeMyBlocks(signedInUid, (idsFromFirestore) => {
      setBlockedIds(idsFromFirestore);
      setIsLoadingBlocks(false);
    });

    return unsubscribe;
  }, [uid]);

  return { blockedIds, loading: isLoadingBlocks };
}
