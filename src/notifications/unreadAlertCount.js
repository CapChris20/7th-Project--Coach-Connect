// Tab-bar badge count for unread messages (one listener, not per-thread math).
// Flow: user id arrives → rebuild index best-effort → subscribe to live count → clean up on change.
// Used by: main tab chrome (TrainerAppStart and similar).
// Read order: constants → exported hook recipe → subscription PLUMBING.

import { useEffect, useState } from 'react';
import { subscribeToUnreadCount, rebuildUnreadIndexForUser } from '../messaging/unreadMessageCounts';

// ===== NAMED CONSTANTS =====

const ZERO_UNREAD = 0;

// ===== HELPER FUNCTIONS =====
// (subscription attach lives under PLUMBING)

// ===== MAIN FUNCTION =====

/**
 * Live unread-message badge number for the signed-in user.
 * Hook order frozen: useState first, then the subscription effect.
 * @param {string|null|undefined} userId
 * @returns {number}
 */
export function unreadAlertCount(userId) {
  const [unreadCount, setUnreadCount] = useState(ZERO_UNREAD);

  // vocab: useEffect = run after paint; return a cleanup that runs on unmount or when userId changes
  useEffect(() => {
    // 1. No signed-in user → force badge to zero and skip listeners.
    if (!userId) {
      setUnreadCount(ZERO_UNREAD);
      return undefined;
    }

    // 2. Attach rebuild + live subscription; return teardown for sign-out / unmount.
    return startUnreadBadgeForUser(userId, setUnreadCount);
  }, [userId]);

  return unreadCount;
}

// ===== PLUMBING — skip unless debugging =====

/**
 * Kick a best-effort index rebuild, then listen for the aggregate unread total.
 * Failures on rebuild keep the old index usable so the badge still updates.
 * @param {string} userId
 * @param {Function} setUnreadCount
 * @returns {Function} stopListening cleanup
 */
function startUnreadBadgeForUser(userId, setUnreadCount) {
  // Background rebuild — swallow errors so a bad rebuild never blocks the badge.
  rebuildUnreadIndexForUser(userId).catch(() => {});

  // vocab: subscribeToUnreadCount = Firestore listener on the denormalized unread index total
  const stopListening = subscribeToUnreadCount(userId, (countFromServer) => {
    const safeCount = Number(countFromServer) || ZERO_UNREAD;
    setUnreadCount(safeCount);
  });

  // vocab: subscribe may return undefined if it bailed before attaching a listener
  return function stopUnreadBadge() {
    if (stopListening) stopListening();
  };
}
