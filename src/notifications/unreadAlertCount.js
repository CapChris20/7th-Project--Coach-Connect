// Hook powering the unread-message badge.
// Flow: kick off a one-time index rebuild → subscribe to the live count → push each
//       update into state → unsubscribe on unmount or when the user changes.
// Reads from the pre-aggregated index in messaging/unreadMessageCounts.js, so the badge costs
// ONE listener instead of counting messages across every thread.

import { useEffect, useState } from 'react';
import { subscribeToUnreadCount, rebuildUnreadIndexForUser } from '../messaging/unreadMessageCounts';

export function unreadAlertCount(userId) {
  const [unreadCount, setUnreadCount] = useState(0);

  // Keyed on `userId`: when it changes, React runs the cleanup below before re-running
  // this effect, so the old user's listener is always torn down first.
  useEffect(() => {
    // Signed out — zero the badge and skip subscribing. Returning undefined is the
    // "no cleanup needed" signal to React.
    if (!userId) {
      setUnreadCount(0);
      return undefined;
    }

    // Self-heal: the stored index can drift if a write failed or the app was killed
    // mid-update. Deliberately NOT awaited so the listener attaches immediately and the
    // badge shows the cached value right away; `.catch(() => {})` because a failed
    // rebuild is non-fatal — the existing index is still usable.
    rebuildUnreadIndexForUser(userId).catch(() => {});

    // `Number(count) || 0` guards the badge against a null/NaN index value, which would
    // otherwise render as "NaN" on the tab bar.
    const unsubscribe = subscribeToUnreadCount(userId, (count) => {
      setUnreadCount(Number(count) || 0);
    });

    // vocab/symbol: unsubscribe?.() = only call it if subscribeToUnreadCount actually
    //               returned a function (it may return nothing on an early bail-out).
    return () => {
      unsubscribe?.();
    };
  }, [userId]);

  return unreadCount;
}
