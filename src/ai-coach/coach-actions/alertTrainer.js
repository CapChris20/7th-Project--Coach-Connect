// Client ↔ trainer chat: conversations, text/file messages, pending requests, typing dots.
// Flow: find or create the pair's conversation → write the message → bump lastMessage → notify the other person.
// Used by the inbox, chat screen, client-request cards, and the home-screen "message trainer" buttons.

import { db } from '../../app-start/cloudConnection';
// vocab: collection/doc = Firestore paths. query+where+orderBy+limit = one page.
//        runTransaction = read then write as one unit so two phones cannot clobber lastMessage.
//        onSnapshot = live listener. serverTimestamp = the server's clock, not the phone's.
//        deleteField = remove a key (used to clear "is typing").
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  onSnapshot,
  updateDoc,
  runTransaction,
  deleteField,
} from 'firebase/firestore';
import {
  incrementUnreadForRecipient,
  clearUnreadForConversation,
} from '../../messaging/unreadMessageCounts';
import { getDocsWithIndexFallback } from '../../for-both/cloud-database/loadInPages';
import { postRemotePushNotify } from '../../for-both/online-connection/sendPhoneAlert';
import { markConversationMessagesReadPaginated } from '../../messaging/markMessagesRead';
import { randomClientRequestTitle } from '../../notifications/writeAlertText';

// ===== NAMED CONSTANTS =====

const CONVERSATIONS_COLLECTION = 'conversations';
const MESSAGES_COLLECTION = 'messages';
const USERS_COLLECTION = 'users';
const TRAINERS_COLLECTION = 'trainers';

const CONVERSATION_TYPE_CLIENT_TRAINER = 'client-trainer';
const MESSAGE_STATUS_PENDING = 'pending';
const NOTIFICATION_TYPE_MESSAGE = 'message';
const NOTIFICATION_TYPE_CLIENT_REQUEST = 'client_request';
const FIRESTORE_PERMISSION_DENIED = 'permission-denied';

const DEFAULT_CLIENT_NAME = 'Client';
const DEFAULT_SENDER_NAME = 'Someone';
const DEFAULT_CLIENT_GOALS = 'Not specified';
const DEFAULT_EXPERIENCE_LEVEL = 'Beginner';
const DEFAULT_EQUIPMENT = 'None';
const DEFAULT_LIMITATIONS = 'None';
const DEFAULT_CONNECTION_INTRO = "Hi! I'd like to work with you as my trainer.";
const CONNECTION_REQUEST_PREVIEW = 'Connection request';
const PHOTO_PREVIEW = '[Photo]';
const FILE_PREVIEW = '[File]';
const IMAGE_ATTACHMENT_TYPE = 'image';
const DEFAULT_ATTACHMENT_TYPE = 'file';

const REQUEST_LABEL_WORKOUT_PLAN = 'Workout plan request';
const REQUEST_LABEL_GENERAL = 'Client request';
const REQUEST_LABEL_CONNECTION = 'Connection request';

// Manipulate here: how many messages one page / live window loads. Raising it costs more reads.
export const MESSAGES_PAGE_SIZE = 80;

// Manipulate here: hide "typing…" this many ms after the last pulse with no new pulse.
export const TYPING_UI_STALE_MS = 4500;

// Manipulate here: how much of the message lands in the push banner.
const PUSH_TEXT_PREVIEW_MAX = 100;
const CLIENT_REQUEST_PUSH_BODY_MAX = 120;

const MESSAGE_ID_RANDOM_RADIX = 36;
const MESSAGE_ID_RANDOM_SKIP = 2;
const MESSAGE_ID_RANDOM_LENGTH = 9;

export const CLIENT_REQUEST_TYPES = {
  CONNECTION: 'connection',
  WORKOUT_PLAN: 'workout_plan',
  GENERAL: 'general',
};

// ===== MAIN FUNCTION =====

/**
 * Short label for a pending client-request card.
 * @param {string} type
 * @returns {string}
 */
export function clientRequestTypeLabel(type) {
  if (type === CLIENT_REQUEST_TYPES.WORKOUT_PLAN) return REQUEST_LABEL_WORKOUT_PLAN;
  if (type === CLIENT_REQUEST_TYPES.GENERAL) return REQUEST_LABEL_GENERAL;
  return REQUEST_LABEL_CONNECTION;
}

/**
 * True when this row is a pending client request, not a normal chat bubble.
 * @param {object} message
 * @returns {boolean}
 */
export function isPendingClientRequestMessage(message) {
  return String(message?.status || '') === MESSAGE_STATUS_PENDING;
}

/**
 * Hide pending client requests from the thread — they live on the Client Requests screen.
 * @param {Array|null|undefined} messages
 * @returns {Array}
 */
export function filterChatMessages(messages) {
  const chatMessages = [];
  for (const message of messages || []) {
    if (!isPendingClientRequestMessage(message)) chatMessages.push(message);
  }
  return chatMessages;
}

/**
 * Find or create the one conversation for this client–trainer pair.
 * Flow: 1. stable id  2. return it if it exists  3. otherwise create it
 * @param {string} clientId
 * @param {string} trainerId
 * @returns {Promise<string>} Conversation ID
 */
export async function getOrCreateConversation(clientId, trainerId) {
  try {
    console.log('🔍 getOrCreateConversation:', { clientId, trainerId });

    // 1. Same pair always shares this id.
    const conversationId = conversationIdForPair(clientId, trainerId);
    const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);

    // 2. Transaction so two phones opening chat at once cannot create two docs.
    const result = await runTransaction(db, async (transaction) => {
      const conversationDoc = await transaction.get(conversationRef);
      if (conversationDoc.exists()) {
        console.log('✅ Found existing conversation:', conversationId);
        return conversationId;
      }

      transaction.set(conversationRef, newConversationFields(conversationId, clientId, trainerId));
      console.log('✅ Conversation created successfully:', conversationId);
      return conversationId;
    });

    return result;
  } catch (error) {
    console.error('❌ Error getting/creating conversation:', error);
    throw error;
  }
}

/**
 * Send a text message in a conversation.
 * Flow: 1. refuse empty input  2. read the conversation  3. write message + lastMessage  4. notify
 * @param {string} conversationId
 * @param {string} senderId
 * @param {string} messageText
 * @returns {Promise<string>} Message ID
 */
export async function sendMessage(conversationId, senderId, messageText) {
  try {
    const text = String(messageText || '').trim();
    console.log('📤 sendMessage called:', { conversationId, senderId, messageLength: text.length });

    // 1. Fail first: we cannot write a blank or ownerless message.
    if (!conversationId || !senderId || !text) {
      throw new Error('Missing required parameters: conversationId, senderId, or messageText');
    }

    // 2. Read BEFORE the transaction. Firestore forbids a read after a write in the same transaction.
    const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
    const conversationSnap = await getDoc(conversationRef);
    const conversationData = conversationSnap.exists() ? conversationSnap.data() : null;

    const messageId = makeMessageId();
    const messageData = {
      id: messageId,
      conversationId,
      senderId,
      text,
      timestamp: serverTimestamp(),
      read: false,
    };

    // 3. Message row + conversation preview in one write.
    await writeMessageAndBumpConversation(conversationRef, messageId, messageData, text);
    console.log('✅ Message and conversation updated atomically');

    // 4. Unread + push. A notify miss still returns the saved message id.
    await tryNotifyAfterTextMessage(conversationData, senderId, conversationId, messageId, text);

    return messageId;
  } catch (error) {
    console.error('❌ Error sending message:', error);
    throw error;
  }
}

/**
 * Send an image or file message. Same messages collection; extra type / fileUrl fields.
 * Flow: 1. refuse missing file  2. read conversation  3. write  4. push (no unread bump)
 * @param {string} conversationId
 * @param {string} senderId
 * @param {{ type: 'image'|'file', fileUrl: string, fileName: string, fileSize?: number }} payload
 * @returns {Promise<string>} Message ID
 */
export async function sendAttachmentMessage(conversationId, senderId, payload) {
  try {
    const hasFileUrl = Boolean(payload && payload.fileUrl);
    if (!conversationId || !senderId || !hasFileUrl) {
      throw new Error('Missing required parameters for attachment message');
    }

    const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
    const conversationSnap = await getDoc(conversationRef);
    const conversationData = conversationSnap.exists() ? conversationSnap.data() : null;

    const messageId = makeMessageId();
    const lastMessagePreview = attachmentLastMessagePreview(payload);
    const messageData = {
      id: messageId,
      conversationId,
      senderId,
      type: payload.type || DEFAULT_ATTACHMENT_TYPE,
      fileUrl: payload.fileUrl,
      fileName: payload.fileName || null,
      fileSize: payload.fileSize ?? null,
      timestamp: serverTimestamp(),
      read: false,
      sent: true,
    };

    await writeMessageAndBumpConversation(conversationRef, messageId, messageData, lastMessagePreview);
    await tryNotifyAfterAttachment(
      conversationData,
      senderId,
      conversationId,
      messageId,
      lastMessagePreview,
    );

    return messageId;
  } catch (error) {
    console.error('❌ Error sending attachment message:', error);
    throw error;
  }
}

/**
 * Send a pending client request (not a normal chat bubble).
 * Flow: 1. refuse missing ids  2. build the pending row  3. write  4. push the trainer
 * @param {string} conversationId
 * @param {string} senderId
 * @param {string} messageText
 * @param {Object} metadata
 * @returns {Promise<string>} Message ID
 */
export async function sendClientRequest(conversationId, senderId, messageText, metadata = {}) {
  try {
    // 1. Fail first.
    if (!conversationId || !senderId) {
      throw new Error('Missing required parameters: conversationId or senderId');
    }

    // 2. Title, body, and inbox preview. Connection requests may fill in a default hello.
    const requestType = metadata.requestType || CLIENT_REQUEST_TYPES.CONNECTION;
    const requestTitle = metadata.requestTitle || clientRequestTypeLabel(requestType);
    const text = clientRequestMessageText(messageText, metadata, requestType);
    const lastMessagePreview = clientRequestLastMessagePreview(requestType, text, requestTitle);
    const messageId = makeMessageId();
    const messageData = buildClientRequestMessageData({
      messageId,
      conversationId,
      senderId,
      text,
      requestType,
      requestTitle,
      metadata,
    });

    // 3. Pending row + conversation preview together.
    await writeMessageAndBumpConversation(
      doc(db, CONVERSATIONS_COLLECTION, conversationId),
      messageId,
      messageData,
      lastMessagePreview,
    );

    // 4. Trainer push. Not awaited by the server helper — a miss must not fail the request.
    await tryNotifyTrainerOfClientRequest({
      conversationId,
      senderId,
      messageId,
      requestType,
      text,
      requestTitle,
      metadata,
    });

    return messageId;
  } catch (error) {
    console.error('Error sending client request:', error);
    throw error;
  }
}

/**
 * Accept/reject a pending request by writing status fields on that message.
 * @param {string} messageId
 * @param {Object} updates
 * @returns {Promise<void>}
 */
export async function updateMessageStatus(messageId, updates) {
  try {
    const messageRef = doc(db, MESSAGES_COLLECTION, messageId);
    await updateDoc(messageRef, updates);
  } catch (error) {
    console.error('Error updating message status:', error);
    throw error;
  }
}

/**
 * One page of chat messages, oldest first, with pending requests stripped.
 * @param {string} conversationId
 * @returns {Promise<Array>}
 */
export async function getMessages(conversationId) {
  if (!conversationId) return [];
  try {
    const messagesRef = collection(db, MESSAGES_COLLECTION);
    const primary = query(
      messagesRef,
      where('conversationId', '==', conversationId),
      orderBy('timestamp', 'desc'),
      limit(MESSAGES_PAGE_SIZE),
    );
    const fallback = () =>
      query(messagesRef, where('conversationId', '==', conversationId), limit(MESSAGES_PAGE_SIZE));

    const snap = await getDocsWithIndexFallback(primary, fallback, 'getMessages');
    return messagesFromDocs(snap.docs);
  } catch (error) {
    console.error('Error getting messages:', error);
    throw error;
  }
}

/**
 * Older messages before `beforeTimestamp` (Load earlier).
 * @param {string} conversationId
 * @param {*} beforeTimestamp
 * @returns {Promise<{ messages: Array, hasMore: boolean }>}
 */
export async function loadEarlierMessages(conversationId, beforeTimestamp) {
  if (!conversationId || !beforeTimestamp) {
    return { messages: [], hasMore: false };
  }
  try {
    const messagesRef = collection(db, MESSAGES_COLLECTION);
    const primary = query(
      messagesRef,
      where('conversationId', '==', conversationId),
      orderBy('timestamp', 'desc'),
      startAfter(beforeTimestamp),
      limit(MESSAGES_PAGE_SIZE),
    );
    const fallback = () =>
      query(messagesRef, where('conversationId', '==', conversationId), limit(MESSAGES_PAGE_SIZE));

    const snap = await getDocsWithIndexFallback(primary, fallback, 'loadEarlierMessages');
    const messages = messagesFromDocs(snap.docs);
    const hasMore = snap.docs.length >= MESSAGES_PAGE_SIZE;
    return { messages, hasMore };
  } catch (error) {
    console.error('Error loading earlier messages:', error);
    throw error;
  }
}

/**
 * Live message window for one conversation. Cleanup closes the listener.
 * Flow: 1. refuse missing args  2. try the indexed query  3. fall back if the index is missing
 * @param {string} conversationId
 * @param {Function} callback
 * @returns {Function} Unsubscribe
 */
export function subscribeToMessages(conversationId, callback) {
  if (!conversationId || !callback) return () => {};

  const messagesRef = collection(db, MESSAGES_COLLECTION);
  const pageSize = MESSAGES_PAGE_SIZE;
  const primary = query(
    messagesRef,
    where('conversationId', '==', conversationId),
    orderBy('timestamp', 'desc'),
    limit(pageSize),
  );
  const fallback = () =>
    query(messagesRef, where('conversationId', '==', conversationId), limit(pageSize));

  let unsubscribe = () => {};
  let activeQuery = primary;

  const attach = () => {
    unsubscribe = onSnapshot(
      activeQuery,
      (querySnapshot) => {
        const messages = messagesFromDocs(querySnapshot.docs);
        const hasMore = querySnapshot.docs.length >= pageSize;
        const oldestTimestamp = messages.length ? messages[0].timestamp : null;
        callback(messages, { hasMore, oldestTimestamp });
      },
      (err) => {
        console.error('subscribeToMessages error:', err);
        callback([], { hasMore: false, oldestTimestamp: null });
      },
    );
  };

  void getDocsWithIndexFallback(primary, fallback, 'subscribeToMessages')
    .then(() => {
      activeQuery = primary;
      attach();
    })
    .catch(() => {
      activeQuery = fallback();
      attach();
    });

  return () => {
    try {
      unsubscribe();
    } catch (_) {
      /* ignore */
    }
  };
}

/**
 * Every conversation this person is in, newest updatedAt first.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getUserConversations(userId) {
  try {
    const conversationsRef = collection(db, CONVERSATIONS_COLLECTION);
    // vocab: 'array-contains' means this array field includes this value.
    const conversationQuery = query(
      conversationsRef,
      where('participants', 'array-contains', userId),
    );

    const querySnapshot = await getDocs(conversationQuery);
    const conversations = [];
    querySnapshot.forEach((conversationDoc) => {
      conversations.push({
        id: conversationDoc.id,
        ...conversationDoc.data(),
      });
    });

    sortConversationsNewestFirst(conversations);
    return conversations;
  } catch (error) {
    console.error('Error getting user conversations:', error);
    throw error;
  }
}

/**
 * Mark the other person's messages in this thread as read.
 * @param {string} conversationId
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function markMessagesAsRead(conversationId, userId) {
  try {
    await markConversationMessagesReadPaginated(conversationId, userId);
  } catch (error) {
    if (__DEV__) console.error('Error marking messages as read:', error);
  }
}

/**
 * Load a user card. Tries `users` first; on missing doc or permission-denied, tries `trainers`.
 * Flow: 1. refuse a blank id  2. users doc  3. trainers fallback  4. null
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export async function getUserData(userId) {
  const id = typeof userId === 'string' ? userId.trim() : '';
  if (!id) return null;

  try {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, id));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  try {
    const trainerSnap = await getDoc(doc(db, TRAINERS_COLLECTION, id));
    if (trainerSnap.exists()) {
      return userDataFromTrainerSnap(trainerSnap);
    }
  } catch (trainerError) {
    console.warn('getUserData: trainers fallback failed', id, trainerError?.message || trainerError);
  }

  return null;
}

/**
 * Total unread messages across every conversation this person is in.
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function getUnreadMessageCount(userId) {
  try {
    const conversations = await getUserConversations(userId);
    let totalUnread = 0;
    for (const conversation of conversations) {
      const unreadHere = await unreadCountInConversation(conversation.id, userId);
      totalUnread += unreadHere;
    }
    return totalUnread;
  } catch (error) {
    console.error('Error getting unread message count:', error);
    return 0;
  }
}

/**
 * @deprecated Use loadOlderChats.subscribeToUnreadCount or messaging/unreadMessageCounts.
 */
export { subscribeToUnreadCount } from '../../messaging/unreadMessageCounts';

/**
 * Live typing hints on `conversations/{conversationId}`.
 * @param {string} conversationId
 * @param {(meta: { typingUserId: string|null, typingAt: object|null }) => void} listener
 * @returns {Function} Unsubscribe
 */
export function subscribeConversationTyping(conversationId, listener) {
  if (!db || !conversationId || typeof listener !== 'function') return () => {};
  const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
  return onSnapshot(
    conversationRef,
    (snap) => {
      listener(typingMetaFromSnapshot(snap));
    },
    () => listener({ typingUserId: null, typingAt: null }),
  );
}

/**
 * Pulse "I am typing" on this conversation. Best-effort.
 * @param {string} conversationId
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function pulseConversationTyping(conversationId, userId) {
  if (!db || !conversationId || !userId) return;
  try {
    await updateDoc(doc(db, CONVERSATIONS_COLLECTION, conversationId), {
      typingUserId: userId,
      typingAt: serverTimestamp(),
    });
  } catch (error) {
    if (__DEV__) console.warn('pulseConversationTyping:', error?.message || error);
  }
}

/**
 * Clear the typing hint only when it is still this person (do not erase the other side).
 * @param {string} conversationId
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function clearMyConversationTyping(conversationId, userId) {
  if (!db || !conversationId || !userId) return;
  try {
    const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
    const snapshot = await getDoc(conversationRef);
    if (!snapshot.exists()) return;
    const conversationData = snapshot.data() || {};
    const currentTypingUserId = conversationData.typingUserId;
    if (currentTypingUserId === userId) {
      await updateDoc(conversationRef, {
        typingUserId: deleteField(),
        typingAt: deleteField(),
      });
    }
  } catch (error) {
    if (__DEV__) console.warn('clearMyConversationTyping:', error?.message || error);
  }
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

/**
 * vocab: toMillis() turns a Firestore Timestamp into a number. A raw number is already millis.
 * @param {object} message
 * @returns {number}
 */
function messageTimeMillis(message) {
  const timestamp = message && message.timestamp;
  if (timestamp && timestamp.toMillis) return timestamp.toMillis();
  if (typeof timestamp === 'number') return timestamp;
  return 0;
}

/**
 * Oldest first so the chat list reads top-to-bottom.
 * @param {Array} messages
 * @returns {Array}
 */
function sortMessagesOldestFirst(messages) {
  return [...messages].sort((leftMessage, rightMessage) => {
    return messageTimeMillis(leftMessage) - messageTimeMillis(rightMessage);
  });
}

/**
 * @param {object} messageDoc
 * @returns {object}
 */
function messageFromDoc(messageDoc) {
  return { id: messageDoc.id, ...messageDoc.data() };
}

/**
 * @param {Array} messageDocs
 * @returns {Array}
 */
function messagesFromDocs(messageDocs) {
  const messages = [];
  for (const messageDoc of messageDocs) {
    messages.push(messageFromDoc(messageDoc));
  }
  return filterChatMessages(sortMessagesOldestFirst(messages));
}

/**
 * The other person in a two-person conversation.
 * @param {object|null} conversationData
 * @param {string} senderId
 * @returns {string|undefined}
 */
function findRecipientUid(conversationData, senderId) {
  const participants = conversationData && conversationData.participants;
  if (!participants) return undefined;
  for (const participantId of participants) {
    if (participantId !== senderId) return participantId;
  }
  return undefined;
}

/**
 * @param {object|null} senderData
 * @returns {string}
 */
function senderDisplayName(senderData) {
  if (senderData && senderData.name) return senderData.name;
  if (senderData && senderData.firstName) return senderData.firstName;
  return DEFAULT_SENDER_NAME;
}

/**
 * @returns {string}
 */
function makeMessageId() {
  const randomTail = Math.random()
    .toString(MESSAGE_ID_RANDOM_RADIX)
    .substr(MESSAGE_ID_RANDOM_SKIP, MESSAGE_ID_RANDOM_LENGTH);
  return `msg_${Date.now()}_${randomTail}`;
}

/**
 * Same pair always gets the same conversation id, so we never open a second thread.
 * @param {string} clientId
 * @param {string} trainerId
 * @returns {string}
 */
function conversationIdForPair(clientId, trainerId) {
  return `conv_${clientId}_${trainerId}`;
}

/**
 * @param {string} conversationId
 * @param {string} clientId
 * @param {string} trainerId
 * @returns {object}
 */
function newConversationFields(conversationId, clientId, trainerId) {
  return {
    id: conversationId,
    participants: [clientId, trainerId],
    clientId,
    trainerId,
    type: CONVERSATION_TYPE_CLIENT_TRAINER,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: null,
    lastMessageTime: null,
  };
}

/**
 * Best-effort phone alert. A failed push must not roll back the saved message.
 * @param {object} pushFields
 * @returns {Promise<void>}
 */
async function notifyRecipientMessagePush({
  recipientId,
  senderId,
  senderName,
  conversationId,
  messageId,
  messageText,
}) {
  const pushResult = await postRemotePushNotify({
    recipientId,
    senderName,
    senderId,
    conversationId,
    messageId,
    messageText: (messageText || '').substring(0, PUSH_TEXT_PREVIEW_MAX),
    notificationType: NOTIFICATION_TYPE_MESSAGE,
  });
  if (!pushResult.ok && pushResult.reason) {
    console.warn('⚠️ Push notification:', pushResult.reason);
  }
}

/**
 * Unread badge + push after a text message. Missing recipient is a no-op.
 * @returns {Promise<void>}
 */
async function tryNotifyAfterTextMessage(conversationData, senderId, conversationId, messageId, text) {
  try {
    const recipientId = findRecipientUid(conversationData, senderId);
    if (!recipientId) return;
    await incrementUnreadForRecipient(recipientId, conversationId);
    const senderData = await getUserData(senderId);
    await notifyRecipientMessagePush({
      recipientId,
      senderName: senderDisplayName(senderData),
      senderId,
      conversationId,
      messageId,
      messageText: text,
    });
  } catch (notifError) {
    console.warn('⚠️ Failed to send push notification:', notifError);
  }
}

/**
 * Attachment path does not bump unread — only the text path does that.
 * @returns {Promise<void>}
 */
async function tryNotifyAfterAttachment(
  conversationData,
  senderId,
  conversationId,
  messageId,
  lastMessagePreview,
) {
  try {
    const recipientId = findRecipientUid(conversationData, senderId);
    if (!recipientId) return;
    const senderData = await getUserData(senderId);
    await notifyRecipientMessagePush({
      recipientId,
      senderName: senderDisplayName(senderData),
      senderId,
      conversationId,
      messageId,
      messageText: lastMessagePreview,
    });
  } catch (notifError) {
    console.warn('⚠️ Failed to send push notification (attachment):', notifError);
  }
}

/**
 * @param {object} conversationRef
 * @param {string} messageId
 * @param {object} messageData
 * @param {string} lastMessagePreview
 * @returns {Promise<void>}
 */
async function writeMessageAndBumpConversation(conversationRef, messageId, messageData, lastMessagePreview) {
  await runTransaction(db, async (transaction) => {
    const messageRef = doc(db, MESSAGES_COLLECTION, messageId);
    transaction.set(messageRef, messageData);
    transaction.update(conversationRef, {
      lastMessage: lastMessagePreview,
      lastMessageTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * @param {string} messageText
 * @param {object} metadata
 * @param {string} requestType
 * @returns {string}
 */
function clientRequestMessageText(messageText, metadata, requestType) {
  const trimmed = messageText != null ? String(messageText).trim() : '';
  const allowDefaultIntro = metadata.allowDefaultIntro !== false;
  if (trimmed) return trimmed;
  if (allowDefaultIntro && requestType === CLIENT_REQUEST_TYPES.CONNECTION) {
    return DEFAULT_CONNECTION_INTRO;
  }
  return '';
}

/**
 * @param {string} requestType
 * @param {string} text
 * @param {string} requestTitle
 * @returns {string}
 */
function clientRequestLastMessagePreview(requestType, text, requestTitle) {
  if (requestType === CLIENT_REQUEST_TYPES.CONNECTION) {
    return text || CONNECTION_REQUEST_PREVIEW;
  }
  return requestTitle;
}

/**
 * @param {object} fields
 * @returns {object}
 */
function buildClientRequestMessageData({
  messageId,
  conversationId,
  senderId,
  text,
  requestType,
  requestTitle,
  metadata,
}) {
  return {
    id: messageId,
    conversationId,
    senderId,
    text,
    timestamp: serverTimestamp(),
    read: false,
    status: MESSAGE_STATUS_PENDING,
    requestType,
    requestTitle,
    clientName: metadata.clientName || DEFAULT_CLIENT_NAME,
    clientGoals: metadata.clientGoals || DEFAULT_CLIENT_GOALS,
    clientExperienceLevel: metadata.clientExperienceLevel || DEFAULT_EXPERIENCE_LEVEL,
    clientEquipment: metadata.clientEquipment || DEFAULT_EQUIPMENT,
    clientLimitations: metadata.clientLimitations || DEFAULT_LIMITATIONS,
  };
}

/**
 * @param {string} requestType
 * @param {string} clientName
 * @returns {string}
 */
function clientRequestPushTitle(requestType, clientName) {
  if (requestType === CLIENT_REQUEST_TYPES.WORKOUT_PLAN) {
    return `Workout plan request from ${clientName}`;
  }
  if (requestType === CLIENT_REQUEST_TYPES.GENERAL) {
    return `New request from ${clientName}`;
  }
  return randomClientRequestTitle(clientName);
}

/**
 * @param {string} requestType
 * @param {string} clientName
 * @param {string} text
 * @param {string} requestTitle
 * @returns {string}
 */
function clientRequestPushBody(requestType, clientName, text, requestTitle) {
  if (requestType === CLIENT_REQUEST_TYPES.CONNECTION) {
    if (text) return `${clientName}: ${text.substring(0, CLIENT_REQUEST_PUSH_BODY_MAX)}`;
    return `${clientName} sent a connection request`;
  }
  if (text) return `${requestTitle}: ${text.substring(0, CLIENT_REQUEST_PUSH_BODY_MAX)}`;
  return requestTitle;
}

/**
 * Fire-and-forget: the request row is already saved. A push miss must not fail the send.
 * @returns {Promise<void>}
 */
async function tryNotifyTrainerOfClientRequest({
  conversationId,
  senderId,
  messageId,
  requestType,
  text,
  requestTitle,
  metadata,
}) {
  try {
    const conversationSnap = await getDoc(doc(db, CONVERSATIONS_COLLECTION, conversationId));
    const trainerId = conversationSnap.exists() ? conversationSnap.data()?.trainerId : null;
    if (!trainerId || trainerId === senderId) return;
    const clientName = metadata.clientName || metadata.name || DEFAULT_CLIENT_NAME;
    void postRemotePushNotify({
      recipientId: trainerId,
      senderName: clientRequestPushTitle(requestType, clientName),
      messageText: clientRequestPushBody(requestType, clientName, text, requestTitle),
      senderId,
      conversationId,
      messageId,
      notificationType: NOTIFICATION_TYPE_CLIENT_REQUEST,
    });
  } catch (notifyError) {
    console.warn('Client request push skipped:', notifyError?.message || notifyError);
  }
}

/**
 * @param {Error} error
 * @returns {boolean}
 */
function isPermissionDeniedError(error) {
  const errorCode = error?.code || '';
  const errorMessage = String(error?.message || '').toLowerCase();
  return errorCode === FIRESTORE_PERMISSION_DENIED || errorMessage.includes('insufficient permissions');
}

/**
 * Marketplace trainer docs use displayName; user docs use name. Expose both spellings.
 * @param {object} trainerSnap
 * @returns {object}
 */
function userDataFromTrainerSnap(trainerSnap) {
  const trainerData = trainerSnap.data();
  return {
    id: trainerSnap.id,
    ...trainerData,
    displayName: trainerData.displayName || trainerData.name,
    name: trainerData.name || trainerData.displayName,
  };
}

/**
 * @param {object} conversation
 * @returns {number}
 */
function conversationUpdatedMillis(conversation) {
  const updatedAt = conversation.updatedAt;
  if (updatedAt && typeof updatedAt.toMillis === 'function') {
    return updatedAt.toMillis() || updatedAt || 0;
  }
  return updatedAt || 0;
}

/**
 * Newest conversation first. Sorted in memory so the query needs no composite index.
 * @param {Array} conversations
 */
function sortConversationsNewestFirst(conversations) {
  conversations.sort((leftConversation, rightConversation) => {
    return conversationUpdatedMillis(rightConversation) - conversationUpdatedMillis(leftConversation);
  });
}

/**
 * Count unread rows the other person sent. `read === false` on purpose — a missing `read` does not count.
 * @param {string} conversationId
 * @param {string} userId
 * @returns {Promise<number>}
 */
async function unreadCountInConversation(conversationId, userId) {
  const messagesRef = collection(db, MESSAGES_COLLECTION);
  const conversationQuery = query(messagesRef, where('conversationId', '==', conversationId));
  const querySnapshot = await getDocs(conversationQuery);
  let unreadCount = 0;
  querySnapshot.forEach((messageDoc) => {
    const messageData = messageDoc.data();
    if (messageData.senderId !== userId && messageData.read === false) {
      unreadCount += 1;
    }
  });
  return unreadCount;
}

/**
 * @param {object} snapshot
 * @returns {{ typingUserId: string|null, typingAt: object|null }}
 */
function typingMetaFromSnapshot(snapshot) {
  if (!snapshot.exists()) {
    return { typingUserId: null, typingAt: null };
  }
  const conversationData = snapshot.data() || {};
  return {
    typingUserId: conversationData.typingUserId ?? null,
    typingAt: conversationData.typingAt ?? null,
  };
}

/**
 * @param {object} payload
 * @returns {string}
 */
function attachmentLastMessagePreview(payload) {
  if (payload.type === IMAGE_ATTACHMENT_TYPE) return PHOTO_PREVIEW;
  return payload.fileName || FILE_PREVIEW;
}

