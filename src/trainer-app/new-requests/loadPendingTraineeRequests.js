// Fetches the "a client wants to work with you" requests waiting on a trainer.
// Flow: find every conversation the trainer is in → newest pending message from the other person → one card per client.
// Used by the pending-requests hook that feeds the trainer inbox and its badge count.

import { db } from '../../app-start/cloudConnection';
// vocab: Firestore query building — collection() points at a set of docs, query()+where() filter
// it, getDocs() runs it once (a one-shot read, as opposed to onSnapshot's live listener).
import { collection, query, where, getDocs } from 'firebase/firestore';
import { clientRequestTypeLabel } from '../../ai-coach/coach-actions/alertTrainer';

// ===== NAMED CONSTANTS =====

const CONVERSATIONS_COLLECTION = 'conversations';
const MESSAGES_COLLECTION = 'messages';
const REQUEST_STATUS_PENDING = 'pending';
const CLIENT_NAME_DEFAULT = 'Client';
const REQUEST_TYPE_DEFAULT = 'connection';

// ===== HELPER FUNCTIONS =====

/**
 * vocab: toMillis() turns a Firestore Timestamp into a number. Missing timestamps sort last.
 * @param {object|undefined} timestamp
 * @returns {number}
 */
function messageTimeMillis(timestamp) {
  return timestamp?.toMillis?.() ?? 0;
}

/**
 * Newest first. Sorted in memory so this query does not need a composite Firestore index.
 * @param {Array<{ timestamp?: object }>} pendingMessages
 */
function sortNewestFirst(pendingMessages) {
  pendingMessages.sort((leftMessage, rightMessage) => {
    return messageTimeMillis(rightMessage.timestamp) - messageTimeMillis(leftMessage.timestamp);
  });
}

/**
 * The client is whichever participant is not the trainer. Group chats are not supported here.
 * @param {object} conversation
 * @param {string} trainerUid
 * @returns {string|undefined}
 */
function findClientUid(conversation, trainerUid) {
  return conversation.participants?.find((id) => id !== trainerUid);
}

/**
 * @param {{ id: string, data: object }} newestMessage
 * @param {string} clientUid
 * @returns {object}
 */
function requestCardFromMessage(newestMessage, clientUid) {
  const { id, data } = newestMessage;
  return {
    id,
    messageId: id,
    clientUid,
    clientName: data.clientName || CLIENT_NAME_DEFAULT,
    clientGoals: data.clientGoals,
    clientExperienceLevel: data.clientExperienceLevel,
    clientEquipment: data.clientEquipment,
    clientLimitations: data.clientLimitations,
    requestType: data.requestType || REQUEST_TYPE_DEFAULT,
    requestTitle: data.requestTitle || clientRequestTypeLabel(data.requestType),
    message: data.text || '',
    timestamp: data.timestamp,
  };
}

/**
 * Pending messages in one conversation, sent by the client.
 * @param {string} conversationId
 * @param {string} clientUid
 * @returns {Promise<Array<{ id: string, data: object, timestamp: object }>>}
 */
async function loadPendingMessages(conversationId, clientUid) {
  const messagesRef = collection(db, MESSAGES_COLLECTION);
  const pendingQuery = query(
    messagesRef,
    where('conversationId', '==', conversationId),
    where('senderId', '==', clientUid),
    where('status', '==', REQUEST_STATUS_PENDING),
  );
  const messageSnapshot = await getDocs(pendingQuery);
  const pendingMessages = [];
  messageSnapshot.forEach((messageDoc) => {
    const data = messageDoc.data();
    pendingMessages.push({ id: messageDoc.id, data, timestamp: data.timestamp });
  });
  return pendingMessages;
}

/**
 * One conversation. A permissions or index error here is skipped so the other clients still show.
 * @param {object} conversationDoc
 * @param {string} trainerUid
 * @returns {Promise<object|null>}
 */
async function newestRequestInConversation(conversationDoc, trainerUid) {
  const conversation = conversationDoc.data();
  const clientUid = findClientUid(conversation, trainerUid);
  if (!clientUid) return null;

  try {
    const pendingMessages = await loadPendingMessages(conversationDoc.id, clientUid);
    sortNewestFirst(pendingMessages);
    if (pendingMessages.length === 0) return null;
    return requestCardFromMessage(pendingMessages[0], clientUid);
  } catch (error) {
    console.warn('Could not query messages for', clientUid, error.message);
    return null;
  }
}

// ===== MAIN FUNCTION =====

/**
 * Fetch all pending client requests for a trainer.
 * Flow: 1. conversations this trainer is in  2. newest pending message per client  3. the card list
 * A failure returns [] so a dashboard badge cannot crash the trainer home screen.
 * @param {string} trainerUid
 * @returns {Promise<Array>}
 */
export async function getTrainerPendingRequests(trainerUid) {
  if (!trainerUid || !db) return [];

  try {
    const conversationsRef = collection(db, CONVERSATIONS_COLLECTION);
    // vocab: 'array-contains' means this array field includes this value.
    const conversationQuery = query(
      conversationsRef,
      where('participants', 'array-contains', trainerUid),
    );
    const conversationSnapshot = await getDocs(conversationQuery);
    const requests = [];

    for (const conversationDoc of conversationSnapshot.docs) {
      const requestCard = await newestRequestInConversation(conversationDoc, trainerUid);
      if (requestCard) requests.push(requestCard);
    }

    return requests;
  } catch (error) {
    console.error('Error fetching trainer pending requests:', error);
    return [];
  }
}
