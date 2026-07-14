/**
 * Live unread message badge count — single Firestore listener with cleanup on unmount.
 */
import { useEffect, useState } from 'react';
import { subscribeToUnreadCount, rebuildUnreadIndexForUser } from '../messaging/unreadCountIndex';

export function useUnreadNotificationCount(userId) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return undefined;
    }

    rebuildUnreadIndexForUser(userId).catch(() => {});

    const unsubscribe = subscribeToUnreadCount(userId, (count) => {
      setUnreadCount(Number(count) || 0);
    });

    return () => {
      unsubscribe?.();
    };
  }, [userId]);

  return unreadCount;
}
