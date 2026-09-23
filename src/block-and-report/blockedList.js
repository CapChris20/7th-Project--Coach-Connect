// Live Set of blocked user ids for the signed-in account.
// Flow: subscribeMyBlocks → React state → message lists / marketplace can filter peers.
// Used by: InboxScreen, (optional) marketplace connect gates.
// Key exports: blockedList

import { useEffect, useState } from 'react';
import { subscribeMyBlocks } from './blockUser';

/**
 * @param {string | null | undefined} uid
 * @returns {{ blockedIds: Set<string>, loading: boolean }}
 */
export function blockedList(uid) {
  const [blockedIds, setBlockedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    const me = String(uid || '').trim();
    if (!me) {
      setBlockedIds(new Set());
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeMyBlocks(me, (ids) => {
      setBlockedIds(ids);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  return { blockedIds, loading };
}
