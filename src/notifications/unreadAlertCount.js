// The number on the unread-message badge.
// Flow: rebuild the index once → subscribe to the live count → unsubscribe when the user changes.
// Used by: the tab bar. One listener, not a count across every thread.

import { useEffect, useState } from 'react';
import { subscribeToUnreadCount, rebuildUnreadIndexForUser } from '../messaging/unreadMessageCounts';

// ===== NAMED CONSTANTS =====

const EMPTY_UNREAD_COUNT = 0;

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * Hooks stay in this order: state, then the effect that subscribes.
 * @param {string|null|undefined} userId
 * @returns {number}
 */
export function unreadAlertCount(userId) {
  const [unreadCount, setUnreadCount] = useState(EMPTY_UNREAD_COUNT);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(EMPTY_UNREAD_COUNT);
      return undefined;
    }

    // A failed rebuild still leaves the old index usable, so the badge does not wait on it.
    rebuildUnreadIndexForUser(userId).catch(() => {});

    const unsubscribe = subscribeToUnreadCount(userId, (count) => {
      setUnreadCount(Number(count) || EMPTY_UNREAD_COUNT);
    });

    // vocab: unsubscribe may be missing if the subscribe call bailed out early.
    return () => {
      unsubscribe?.();
    };
  }, [userId]);

  return unreadCount;
}
