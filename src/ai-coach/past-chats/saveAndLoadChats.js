// AI Coach chat persistence — session meta plus one Firestore doc per message (avoids rewriting the whole array).
// Flow: serialize a message → write/merge session meta → write/merge each message doc → optional legacy `messages` field delete.
// Used by: the coach conversation screen when a chat is saved, restored, or deleted.

import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import { stripUndefinedForFirestore } from '../../helpers/cleanDataBeforeSaving';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const AI_CHATS_COLLECTION = 'aiChats';
const MESSAGES_SUBCOLLECTION = 'messages';

const ROLE_ASSISTANT = 'assistant';
const ROLE_AI = 'ai';
const ROLE_USER = 'user';

const RESTORED_MESSAGE_ID_PREFIX = 'msg_restored_';
const GENERATED_MESSAGE_ID_PREFIX = 'm_';

// Firestore rejects `undefined` anywhere in a write payload.
const omitUndefined = stripUndefinedForFirestore;

// ===== MAIN FUNCTION =====

/**
 * Load one chat's messages: prefer the legacy array on the session doc, else the messages subcollection.
 * @param {string} userId
 * @param {string} sessionId
 * @returns {Promise<Array>}
 */
export async function loadAiChatMessages(userId, sessionId) {
  if (!db || !userId || !sessionId) return [];
  const snapshot = await getDoc(sessionRef(userId, sessionId));
  if (!snapshot.exists()) return [];
  const data = snapshot.data() || {};
  return messagesFromLegacyArrayOrSubcollection(userId, sessionId, data);
}

/**
 * Title + last user/assistant snippets for the history list, without loading every message.
 * @param {string} userId
 * @param {string} sessionId
 * @returns {Promise<object|null>}
 */
export async function loadAiChatSessionMeta(userId, sessionId) {
  if (!db || !userId || !sessionId) return null;
  const snapshot = await getDoc(sessionRef(userId, sessionId));
  if (!snapshot.exists()) return null;
  return sessionMetaFromDoc(snapshot.data() || {});
}

/**
 * Turn saved Firestore rows back into the in-memory chat shape (`role: 'ai'` for the bubble UI).
 * @param {Array} [saved]
 * @returns {Array}
 */
export function restoreChatMessagesFromSaved(saved = []) {
  const savedList = Array.isArray(saved) ? saved : [];
  return savedList
    .map((savedMessage, index) => restoredMessageFromSaved(savedMessage, index))
    .filter((message) => restoredMessageHasContent(message));
}

/**
 * Full session write: meta + every message in one batch. Also deletes the legacy `messages` array field.
 * @param {string} userId
 * @param {string} sessionId
 * @param {{ messages?: Array, meta?: object }} [payload]
 */
export async function persistAiChatSession(userId, sessionId, { messages = [], meta = {} } = {}) {
  if (!db || !userId || !sessionId) return;
  const serialized = serializeMessageList(messages);
  const batch = writeBatch(db);
  writeSessionMeta(batch, userId, sessionId, meta, {
    createdAt: meta.createdAt || serverTimestamp(),
  });
  writeSerializedMessages(batch, userId, sessionId, serialized);
  await batch.commit();
}

/**
 * Incremental write — only upserts the given messages (e.g. after tool confirm).
 * @param {string} userId
 * @param {string} sessionId
 * @param {Array} [messages]
 * @param {object} [meta]
 */
export async function upsertAiChatMessages(userId, sessionId, messages = [], meta = {}) {
  if (!db || !userId || !sessionId) return;
  const serialized = serializeMessageList(messages);
  if (!serialized.length && !Object.keys(meta).length) return;

  const batch = writeBatch(db);
  writeSessionMeta(batch, userId, sessionId, meta, {});
  writeSerializedMessages(batch, userId, sessionId, serialized);
  await batch.commit();
}

/**
 * Write one message plus session snippets (last user / last assistant text).
 * @param {string} userId
 * @param {string} sessionId
 * @param {object} message
 * @param {object} [meta]
 */
export async function upsertAiChatMessage(userId, sessionId, message, meta = {}) {
  if (!db || !userId || !sessionId || !message) return;
  const serialized = serializeMessage(message);
  if (!serialized) return;
  await setDoc(
    sessionRef(userId, sessionId),
    omitUndefined({
      sessionId,
      ...meta,
      messages: deleteField(),
      updatedAt: serverTimestamp(),
      ...lastMessageFieldsForRole(serialized, meta),
    }),
    { merge: true },
  );
  await setDoc(
    doc(messagesCol(userId, sessionId), serialized.id),
    omitUndefined({
      ...serialized,
      updatedAt: serverTimestamp(),
    }),
  );
}

/**
 * Delete every message doc, then the session doc, in one batch.
 * @param {string} userId
 * @param {string} sessionId
 */
export async function deleteAiChatSession(userId, sessionId) {
  if (!db || !userId || !sessionId) return;
  const messageSnapshot = await getDocs(messagesCol(userId, sessionId));
  const batch = writeBatch(db);
  messageSnapshot.docs.forEach((messageDoc) => batch.delete(messageDoc.ref));
  batch.delete(sessionRef(userId, sessionId));
  await batch.commit();
}

/**
 * Remove the legacy `messages` array on the session doc after the subcollection exists.
 * @param {string} userId
 * @param {string} sessionId
 */
export async function clearLegacyMessagesField(userId, sessionId) {
  if (!db || !userId || !sessionId) return;
  await setDoc(
    sessionRef(userId, sessionId),
    { messages: deleteField() },
    { merge: true },
  );
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function sessionRef(userId, sessionId) {
  return doc(db, USERS_COLLECTION, userId, AI_CHATS_COLLECTION, sessionId);
}

function messagesCol(userId, sessionId) {
  return collection(db, USERS_COLLECTION, userId, AI_CHATS_COLLECTION, sessionId, MESSAGES_SUBCOLLECTION);
}

function firestoreRole(role) {
  if (role === ROLE_ASSISTANT || role === ROLE_AI) return ROLE_ASSISTANT;
  return ROLE_USER;
}

function uiRole(role) {
  if (role === ROLE_ASSISTANT || role === ROLE_AI) return ROLE_AI;
  return ROLE_USER;
}

function generatedMessageId() {
  return `${GENERATED_MESSAGE_ID_PREFIX}${Date.now()}`;
}

function webSourcesFromMessage(msg) {
  if (Array.isArray(msg.webSources)) return msg.webSources;
  if (Array.isArray(msg.sources)) return msg.sources;
  return undefined;
}

function serializeOneWebSource(source) {
  return omitUndefined({
    url: source?.url || source?.link,
    title: source?.title || source?.name,
    // Snippet was dropped here, so a restored source row lost its preview text.
    snippet: source?.snippet || undefined,
    image: source?.image || source?.thumbnail || source?.ogImage,
  });
}

function sanitizeAttachments(attachments) {
  if (!Array.isArray(attachments) || !attachments.length) return undefined;
  const cleaned = attachments
    .map((attachment) => {
      if (!attachment || typeof attachment !== 'object') return null;
      return omitUndefined({
        id: attachment.id,
        name: attachment.name,
        type: attachment.type,
        preview: attachment.preview || attachment.uri,
        mimeType: attachment.mimeType,
      });
    })
    .filter(Boolean);
  if (!cleaned.length) return undefined;
  return cleaned;
}

function serializeMessage(msg) {
  if (!msg || typeof msg !== 'object') return null;
  const role = firestoreRole(msg.role);
  const webSources = webSourcesFromMessage(msg);
  return omitUndefined({
    id: msg.id || generatedMessageId(),
    role,
    text: String(msg.text || msg.content || ''),
    createdAt: msg.createdAt || Date.now(),
    attachments: sanitizeAttachments(msg.attachments),
    source: msg.source ?? undefined,
    toolCall: msg.toolCall ? omitUndefined(msg.toolCall) : undefined,
    // Multi-action queue + progress, so a half-finished "log sleep + water"
    // reply still shows the remaining chip after the chat is reopened.
    toolCalls: Array.isArray(msg.toolCalls) && msg.toolCalls.length ? msg.toolCalls : undefined,
    completedToolCalls:
      Array.isArray(msg.completedToolCalls) && msg.completedToolCalls.length
        ? msg.completedToolCalls
        : undefined,
    toolConfirmed: msg.toolConfirmed === true ? true : undefined,
    isToolResult: msg.isToolResult === true ? true : undefined,
    isError: msg.isError === true ? true : undefined,
    searchedWeb: msg.searchedWeb === true ? true : undefined,
    webProvider: msg.webProvider || undefined,
    route: msg.route || undefined,
    webSources: webSources ? webSources.map((source) => serializeOneWebSource(source)) : undefined,
    time: msg.time || undefined,
  });
}

function serializeMessageList(messages) {
  return (Array.isArray(messages) ? messages : []).map(serializeMessage).filter(Boolean);
}

function restoredMessageFromSaved(savedMessage, index) {
  return {
    id: savedMessage.id || `${RESTORED_MESSAGE_ID_PREFIX}${index}`,
    role: uiRole(savedMessage.role),
    text: String(savedMessage.text || savedMessage.content || ''),
    time: typeof savedMessage.time === 'string' ? savedMessage.time : undefined,
    source: savedMessage.source || null,
    attachments: Array.isArray(savedMessage.attachments) ? savedMessage.attachments : undefined,
    toolCall: savedMessage.toolCall || null,
    toolCalls: Array.isArray(savedMessage.toolCalls) ? savedMessage.toolCalls : [],
    completedToolCalls: Array.isArray(savedMessage.completedToolCalls)
      ? savedMessage.completedToolCalls
      : [],
    toolConfirmed: savedMessage.toolConfirmed === true,
    isToolResult: savedMessage.isToolResult === true,
    // Web-search fields were saved above but never restored, so reopening a
    // past chat made the Sources pill (and web formatting) silently vanish.
    searchedWeb: savedMessage.searchedWeb === true,
    webProvider: savedMessage.webProvider || null,
    route: savedMessage.route || null,
    webSources: Array.isArray(savedMessage.webSources) ? savedMessage.webSources : [],
  };
}

function restoredMessageHasContent(message) {
  if (message.text.trim().length > 0) return true;
  return Array.isArray(message.attachments) && message.attachments.length > 0;
}

function stringMetaField(value) {
  if (typeof value === 'string') return value;
  return '';
}

function sessionMetaFromDoc(data) {
  return {
    title: stringMetaField(data.title),
    lastUserMessage: stringMetaField(data.lastUserMessage),
    lastAssistantMessage: stringMetaField(data.lastAssistantMessage),
  };
}

function sortMessagesOldestFirst(messages) {
  return messages.sort((leftMessage, rightMessage) => (leftMessage.createdAt || 0) - (rightMessage.createdAt || 0));
}

async function messagesFromLegacyArrayOrSubcollection(userId, sessionId, data) {
  if (Array.isArray(data.messages) && data.messages.length) {
    return data.messages.map(serializeMessage).filter(Boolean);
  }
  const messageSnapshot = await getDocs(messagesCol(userId, sessionId));
  if (messageSnapshot.empty) return [];
  const loaded = messageSnapshot.docs
    .map((messageDoc) => serializeMessage({ id: messageDoc.id, ...messageDoc.data() }))
    .filter(Boolean);
  return sortMessagesOldestFirst(loaded);
}

function writeSessionMeta(batch, userId, sessionId, meta, extraFields) {
  batch.set(
    sessionRef(userId, sessionId),
    omitUndefined({
      sessionId,
      ...meta,
      messages: deleteField(),
      updatedAt: serverTimestamp(),
      ...extraFields,
    }),
    { merge: true },
  );
}

function writeSerializedMessages(batch, userId, sessionId, serialized) {
  for (const msg of serialized) {
    batch.set(
      doc(messagesCol(userId, sessionId), msg.id),
      omitUndefined({ ...msg, updatedAt: serverTimestamp() }),
      { merge: true },
    );
  }
}

function lastMessageFieldsForRole(serialized, meta) {
  return {
    lastUserMessage: serialized.role === ROLE_USER ? serialized.text : meta.lastUserMessage,
    lastAssistantMessage: serialized.role === ROLE_ASSISTANT ? serialized.text : meta.lastAssistantMessage,
  };
}
