// Live set of user ids the signed-in person has blocked.
// Flow: subscribe to their block list → keep it in state → message lists can hide those people.
// Used by: InboxScreen and marketplace gates.

import { useEffect, useState } from 'react';
import { subscribeMyBlocks } from './blockUser';

// ===== NAMED CONSTANTS =====

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * Hooks stay in this function, in this order: state, then the subscription effect.
 * The returned key is `loading` because callers already read that name.
 * @param {string|null|undefined} uid
 * @returns {{ blockedIds: Set<string>, loading: boolean }}
 */
export function blockedList(uid) {
  const [blockedIds, setBlockedIds] = useState(() => new Set());
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(Boolean(uid));

  useEffect(() => {
    const signedInUid = String(uid || '').trim();
    if (!signedInUid) {
      setBlockedIds(new Set());
      setIsLoadingBlocks(false);
      return undefined;
    }
    setIsLoadingBlocks(true);
    const unsubscribe = subscribeMyBlocks(signedInUid, (ids) => {
      setBlockedIds(ids);
      setIsLoadingBlocks(false);
    });
    return unsubscribe;
  }, [uid]);

  return { blockedIds, loading: isLoadingBlocks };
}
