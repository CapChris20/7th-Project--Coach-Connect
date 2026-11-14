// One-shot read of every “client wants to work with you” card still waiting on this trainer.
// Flow: conversations the trainer is in → pending client messages per thread → newest card each.
// Used by pendingRequestCount and trainer home badges. Firebase projectId stays anatrox-auth (cloudConnection).
// Returns [] on any top-level failure so home/inbox never white-screens.

import { db } from '../../app-start/cloudConnection';
// vocab: getDocs = one-shot Firestore read (onSnapshot elsewhere would keep listening).
import { collection, query, where, getDocs } from 'firebase/firestore';
import { clientRequestTypeLabel } from '../../ai-coach/coach-actions/alertTrainer';

// ===== NAMED CONSTANTS =====

const CONVERSATIONS_COLLECTION = 'conversations';
const MESSAGES_COLLECTION = 'messages';
const REQUEST_STATUS_PENDING = 'pending';
const CLIENT_NAME_DEFAULT = 'Client';
const REQUEST_TYPE_DEFAULT = 'connection';

// ===== MAIN FUNCTION =====

/**
 * Load every pending client request for one trainer uid.
 * Flow: 1. guard  2. walk conversations  3. return cards (or [] on failure)
 * @param {string} trainerUid
 * @returns {Promise<Array>}
 */
export async function getTrainerPendingRequests(trainerUid) {
  // 1. Bail when there is no signed-in trainer or Firestore is not wired yet.
  if (!trainerUid || !db) return [];

  // 2. Walk conversations and build one card per client with a pending ask.
  try {
    const requestCards = await gatherPendingCardsForTrainer(trainerUid);
    return requestCards;
  } catch (loadError) {
    console.error('Error fetching trainer pending requests:', loadError);
    return [];
  }
}

// ===== PLUMBING — skip unless debugging Firestore query / card shape =====

async function gatherPendingCardsForTrainer(trainerUid) {
  const conversationDocs = await loadConversationDocsForTrainer(trainerUid);
  const requestCards = [];

  for (let i = 0; i < conversationDocs.length; i += 1) {
    const conversationDoc = conversationDocs[i];
    const requestCard = await newestPendingCardInConversation(conversationDoc, trainerUid);
    if (requestCard) requestCards.push(requestCard);
  }

  return requestCards;
}

async function loadConversationDocsForTrainer(trainerUid) {
  const conversationsRef = collection(db, CONVERSATIONS_COLLECTION);
  // vocab: array-contains = Firestore filter “this array field includes this value”.
  const conversationQuery = query(
    conversationsRef,
    where('participants', 'array-contains', trainerUid),
  );
  const conversationSnapshot = await getDocs(conversationQuery);
  return conversationSnapshot.docs;
}

async function newestPendingCardInConversation(conversationDoc, trainerUid) {
  const conversation = conversationDoc.data();
  const clientUid = findClientUidAmongParticipants(conversation, trainerUid);
  if (!clientUid) return null;

  try {
    const pendingMessages = await loadPendingMessagesForConversation(conversationDoc.id, clientUid);
    sortMessagesNewestFirstInPlace(pendingMessages);
    if (pendingMessages.length === 0) return null;
    const newestMessage = pendingMessages[0];
    return buildInboxCardFromPendingMessage(newestMessage, clientUid);
  } catch (conversationError) {
    console.warn('Could not query messages for', clientUid, conversationError.message);
    return null;
  }
}

async function loadPendingMessagesForConversation(conversationId, clientUid) {
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
    const messageData = messageDoc.data();
    pendingMessages.push({
      id: messageDoc.id,
      data: messageData,
      timestamp: messageData.timestamp,
    });
  });

  return pendingMessages;
}

function buildInboxCardFromPendingMessage(newestMessage, clientUid) {
  const messageId = newestMessage.id;
  const messageData = newestMessage.data;
  // Field letters stay frozen — NewTraineeRequestsScreen and badges read these keys.
  return {
    id: messageId,
    messageId,
    clientUid,
    clientName: messageData.clientName || CLIENT_NAME_DEFAULT,
    clientGoals: messageData.clientGoals,
    clientExperienceLevel: messageData.clientExperienceLevel,
    clientEquipment: messageData.clientEquipment,
    clientLimitations: messageData.clientLimitations,
    requestType: messageData.requestType || REQUEST_TYPE_DEFAULT,
    requestTitle: messageData.requestTitle || clientRequestTypeLabel(messageData.requestType),
    message: messageData.text || '',
    timestamp: messageData.timestamp,
  };
}

function findClientUidAmongParticipants(conversation, trainerUid) {
  // The client is whichever participant is not the trainer (no group threads here).
  const participants = conversation.participants;
  if (!participants) return undefined;
  return participants.find((participantId) => participantId !== trainerUid);
}

function sortMessagesNewestFirstInPlace(pendingMessages) {
  // Sorted in memory so we avoid a composite Firestore index on messages.
  pendingMessages.sort((olderMessage, newerMessage) => {
    const newerMillis = firestoreTimestampToMillis(newerMessage.timestamp);
    const olderMillis = firestoreTimestampToMillis(olderMessage.timestamp);
    return newerMillis - olderMillis;
  });
}

function firestoreTimestampToMillis(timestamp) {
  // vocab: toMillis() turns a Firestore Timestamp into a number; missing sorts as zero (oldest).
  // vocab/symbol: ?? = if left side is null/undefined, use the right side instead.
  if (!timestamp || typeof timestamp.toMillis !== 'function') return 0;
  return timestamp.toMillis() ?? 0;
}
