/**
 * Denormalized unread message counts — single listener on users/{uid}/unreadCount/index.
 */
import { doc, onSnapshot, setDoc, updateDoc, increment, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../app-start/config';

const INDEX_DOC = 'index';

function unreadRef(userId) {
  return doc(db, 'users', userId, 'unreadCount', INDEX_DOC);
}

/**
 * Subscribe to total + per-conversation unread counts (1 listener).
 * Falls back to legacy multi-listener path when index doc is missing.
 */
export function subscribeToUnreadIndex(userId, callback) {
  if (!userId || !callback) return () => {};

  return onSnapshot(
    unreadRef(userId),
    (snap) => {
      const data = snap.exists ? snap.data() || {} : {};
      callback({
        total: Number(data.total || 0),
        conversations: data.conversations && typeof data.conversations === 'object' ? data.conversations : {},
      });
    },
    () => callback({ total: 0, conversations: {} }),
  );
}

export function subscribeToUnreadCount(userId, callback) {
  return subscribeToUnreadIndex(userId, ({ total }) => callback(total));
}

export function subscribeToUnreadByConversation(userId, callback) {
  return subscribeToUnreadIndex(userId, ({ conversations }) => callback({ ...conversations }));
}

/** Increment unread for recipient after a message is sent (best-effort; CF is authoritative). */
export async function incrementUnreadForRecipient(recipientId, conversationId) {
  if (!recipientId || !conversationId) return;
  try {
    const ref = unreadRef(recipientId);
    const snap = await getDoc(ref);
    if (!snap.exists) {
      await setDoc(ref, {
        total: 1,
        conversations: { [conversationId]: 1 },
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    await updateDoc(ref, {
      total: increment(1),
      [`conversations.${conversationId}`]: increment(1),
      updatedAt: new Date().toISOString(),
    });
  } catch (_) {
    /* Cloud Function may own this write */
  }
}

/** Reset unread for a conversation when user opens thread. */
export async function clearUnreadForConversation(userId, conversationId, clearedCount = null) {
  if (!userId || !conversationId) return;
  try {
    const ref = unreadRef(userId);
    const snap = await getDoc(ref);
    if (!snap.exists) return;
    const data = snap.data() || {};
    const convCount =
      clearedCount != null
        ? Number(clearedCount)
        : Number(data.conversations?.[conversationId] || 0);
    if (convCount <= 0) return;
    const nextTotal = Math.max(0, Number(data.total || 0) - convCount);
    const conversations = { ...(data.conversations || {}) };
    conversations[conversationId] = 0;
    await setDoc(
      ref,
      {
        total: nextTotal,
        conversations,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (_) {
    /* non-critical */
  }
}

/** One-time migration: scan messages and write unread index doc. */
export async function rebuildUnreadIndexForUser(userId) {
  if (!userId) return;
  const convSnap = await getDocs(
    query(collection(db, 'conversations'), where('participants', 'array-contains', userId)),
  );
  const conversations = {};
  let total = 0;
  for (const convDoc of convSnap.docs) {
    const msgSnap = await getDocs(
      query(collection(db, 'messages'), where('conversationId', '==', convDoc.id)),
    );
    let count = 0;
    msgSnap.forEach((m) => {
      const d = m.data();
      if (d.senderId !== userId && d.read === false) count += 1;
    });
    if (count > 0) {
      conversations[convDoc.id] = count;
      total += count;
    }
  }
  await setDoc(
    unreadRef(userId),
    { total, conversations, updatedAt: new Date().toISOString() },
    { merge: true },
  );
}
