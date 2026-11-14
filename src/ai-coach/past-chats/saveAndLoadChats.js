// AI Coach chat persistence — session meta plus one Firestore doc per message.
// Flow: serialize message → merge session meta → merge each message doc → drop legacy messages array.
// Used by the coach conversation screen when a chat is saved, restored, or deleted.
// Read order: constants → small helpers → exported load/save recipes → PLUMBING.

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

// ===== HELPER FUNCTIONS =====
// Tiny path / role helpers the mains need. Heavy serialize/restore lives under PLUMBING.

function pathToSessionDoc(userId, sessionId) {
  return doc(db, USERS_COLLECTION, userId, AI_CHATS_COLLECTION, sessionId);
}

function pathToMessagesCollection(userId, sessionId) {
  return collection(
    db,
    USERS_COLLECTION,
    userId,
    AI_CHATS_COLLECTION,
    sessionId,
    MESSAGES_SUBCOLLECTION,
  );
}

function roleForFirestoreWrite(role) {
  if (role === ROLE_ASSISTANT) return ROLE_ASSISTANT;
  if (role === ROLE_AI) return ROLE_ASSISTANT;
  return ROLE_USER;
}

function roleForBubbleUi(role) {
  if (role === ROLE_ASSISTANT) return ROLE_AI;
  if (role === ROLE_AI) return ROLE_AI;
  return ROLE_USER;
}

function chatIdsAreReady(userId, sessionId) {
  if (!db) return false;
  if (!userId) return false;
  if (!sessionId) return false;
  return true;
}

// ===== MAIN FUNCTION =====

/**
 * Load one chat's messages: prefer the legacy array on the session doc, else the messages subcollection.
 * @param {string} userId
 * @param {string} sessionId
 * @returns {Promise<Array>}
 */
export async function loadAiChatMessages(userId, sessionId) {
  // 1. Need db + ids.
  if (!chatIdsAreReady(userId, sessionId)) return [];

  // 2. Missing session doc → empty list.
  const sessionSnapshot = await getDoc(pathToSessionDoc(userId, sessionId));
  if (!sessionSnapshot.exists()) return [];

  // 3. Prefer legacy `messages` array; otherwise read the messages subcollection.
  const sessionData = sessionSnapshot.data() || {};
  return loadMessagesFromLegacyArrayOrSubcollection(userId, sessionId, sessionData);
}

/**
 * Title + last user/assistant snippets for the history list, without loading every message.
 * @param {string} userId
 * @param {string} sessionId
 * @returns {Promise<object|null>}
 */
export async function loadAiChatSessionMeta(userId, sessionId) {
  // 1. Need db + ids.
  if (!chatIdsAreReady(userId, sessionId)) return null;

  // 2. Missing session → null.
  const sessionSnapshot = await getDoc(pathToSessionDoc(userId, sessionId));
  if (!sessionSnapshot.exists()) return null;

  // 3. Pull the three sidebar fields only.
  return sidebarMetaFromSessionData(sessionSnapshot.data() || {});
}

/**
 * Turn saved Firestore rows back into the in-memory chat shape (`role: 'ai'` for the bubble UI).
 * @param {Array} [saved]
 * @returns {Array}
 */
export function restoreChatMessagesFromSaved(saved = []) {
  // 1. Tolerate a non-array.
  let savedList = saved;
  if (!Array.isArray(saved)) {
    savedList = [];
  }

  // 2. Rebuild each row; skip empty text with no attachments.
  const restoredMessages = [];
  for (let index = 0; index < savedList.length; index += 1) {
    const savedMessage = savedList[index];
    const message = rebuildOneMessageForUi(savedMessage, index);
    if (messageHasTextOrAttachments(message)) {
      restoredMessages.push(message);
    }
  }

  return restoredMessages;
}

/**
 * Full session write: meta + every message in one batch. Also deletes the legacy `messages` array field.
 * @param {string} userId
 * @param {string} sessionId
 * @param {{ messages?: Array, meta?: object }} [options]
 * @returns {Promise<void>}
 */
export async function persistAiChatSession(userId, sessionId, { messages = [], meta = {} } = {}) {
  // 1. Need db + ids.
  if (!chatIdsAreReady(userId, sessionId)) return;

  // 2. Serialize every in-memory message into Firestore-safe rows.
  const serializedMessages = serializeMessageList(messages);
  const batch = writeBatch(db);

  // 3. Session meta (keep createdAt if the caller passed one) + each message doc + drop legacy array.
  let createdAtField = meta.createdAt;
  if (!createdAtField) {
    createdAtField = serverTimestamp();
  }
  writeSessionMetaOntoBatch(batch, userId, sessionId, meta, { createdAt: createdAtField });
  writeSerializedMessagesOntoBatch(batch, userId, sessionId, serializedMessages);

  // 4. Commit once.
  await batch.commit();
}

/**
 * Incremental write — only upserts the given messages (e.g. after tool confirm).
 * @param {string} userId
 * @param {string} sessionId
 * @param {Array} [messages]
 * @param {object} [meta]
 * @returns {Promise<void>}
 */
export async function upsertAiChatMessages(userId, sessionId, messages = [], meta = {}) {
  // 1. Need db + ids.
  if (!chatIdsAreReady(userId, sessionId)) return;

  // 2. Nothing to write → skip the batch.
  const serializedMessages = serializeMessageList(messages);
  const metaKeyCount = Object.keys(meta).length;
  const metaIsEmpty = metaKeyCount === 0;
  if (!serializedMessages.length && metaIsEmpty) return;

  // 3. Merge session meta + only the messages we were given.
  const batch = writeBatch(db);
  writeSessionMetaOntoBatch(batch, userId, sessionId, meta, {});
  writeSerializedMessagesOntoBatch(batch, userId, sessionId, serializedMessages);
  await batch.commit();
}

/**
 * Write one message plus session snippets (last user / last assistant text).
 * @param {string} userId
 * @param {string} sessionId
 * @param {object} message
 * @param {object} [meta]
 * @returns {Promise<void>}
 */
export async function upsertAiChatMessage(userId, sessionId, message, meta = {}) {
  // 1. Need db + ids + a message object.
  if (!chatIdsAreReady(userId, sessionId)) return;
  if (!message) return;

  // 2. Serialize; bail if the message was empty / invalid.
  const serialized = serializeOneMessage(message);
  if (!serialized) return;

  // 3. Update last-user / last-assistant snippets on the session doc for the sidebar.
  const lastSnippetFields = lastMessageSnippetsForRole(serialized, meta);
  const sessionPayload = stripUndefinedForFirestore({
    sessionId,
    ...meta,
    messages: deleteField(),
    updatedAt: serverTimestamp(),
    ...lastSnippetFields,
  });
  await setDoc(pathToSessionDoc(userId, sessionId), sessionPayload, { merge: true });

  // 4. Upsert the single message doc under messages/{id}.
  const messagePayload = stripUndefinedForFirestore({
    ...serialized,
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(pathToMessagesCollection(userId, sessionId), serialized.id), messagePayload);
}

/**
 * Delete every message doc, then the session doc, in one batch.
 * @param {string} userId
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
export async function deleteAiChatSession(userId, sessionId) {
  // 1. Need db + ids.
  if (!chatIdsAreReady(userId, sessionId)) return;

  // 2. Load every message doc so we can delete them in the same batch as the session.
  const messageSnapshot = await getDocs(pathToMessagesCollection(userId, sessionId));
  const batch = writeBatch(db);

  for (let index = 0; index < messageSnapshot.docs.length; index += 1) {
    const messageDoc = messageSnapshot.docs[index];
    batch.delete(messageDoc.ref);
  }

  // 3. Delete the session doc itself, then commit.
  batch.delete(pathToSessionDoc(userId, sessionId));
  await batch.commit();
}

/**
 * Remove the legacy `messages` array on the session doc after the subcollection exists.
 * @param {string} userId
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
export async function clearLegacyMessagesField(userId, sessionId) {
  if (!chatIdsAreReady(userId, sessionId)) return;
  await setDoc(
    pathToSessionDoc(userId, sessionId),
    { messages: deleteField() },
    { merge: true },
  );
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function makeGeneratedMessageId() {
  return `${GENERATED_MESSAGE_ID_PREFIX}${Date.now()}`;
}

function webSourcesListFromMessage(message) {
  if (Array.isArray(message.webSources)) return message.webSources;
  if (Array.isArray(message.sources)) return message.sources;
  return undefined;
}

function urlFromWebSource(source) {
  if (!source) return undefined;
  if (source.url) return source.url;
  if (source.link) return source.link;
  return undefined;
}

function titleFromWebSource(source) {
  if (!source) return undefined;
  if (source.title) return source.title;
  if (source.name) return source.name;
  return undefined;
}

function imageFromWebSource(source) {
  if (!source) return undefined;
  if (source.image) return source.image;
  if (source.thumbnail) return source.thumbnail;
  if (source.ogImage) return source.ogImage;
  return undefined;
}

function serializeOneWebSource(source) {
  let snippetValue = undefined;
  if (source && source.snippet) {
    snippetValue = source.snippet;
  }

  return stripUndefinedForFirestore({
    url: urlFromWebSource(source),
    title: titleFromWebSource(source),
    snippet: snippetValue,
    image: imageFromWebSource(source),
  });
}

function sanitizeAttachmentsList(attachments) {
  if (!Array.isArray(attachments)) return undefined;
  if (!attachments.length) return undefined;

  const cleaned = [];
  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index];
    if (!attachment) continue;
    if (typeof attachment !== 'object') continue;

    let previewValue = attachment.preview;
    if (!previewValue) {
      previewValue = attachment.uri;
    }

    cleaned.push(
      stripUndefinedForFirestore({
        id: attachment.id,
        name: attachment.name,
        type: attachment.type,
        preview: previewValue,
        mimeType: attachment.mimeType,
      }),
    );
  }

  if (!cleaned.length) return undefined;
  return cleaned;
}

function serializeWebSourcesList(webSources) {
  if (!webSources) return undefined;
  const serializedWebSources = [];
  for (let index = 0; index < webSources.length; index += 1) {
    serializedWebSources.push(serializeOneWebSource(webSources[index]));
  }
  return serializedWebSources;
}

function followUpPromptsForSave(followUpPrompts) {
  if (!Array.isArray(followUpPrompts)) return undefined;
  if (!followUpPrompts.length) return undefined;

  const cleaned = [];
  for (let index = 0; index < followUpPrompts.length; index += 1) {
    const trimmed = String(followUpPrompts[index] || '').trim();
    if (trimmed) {
      cleaned.push(trimmed);
    }
  }
  return cleaned;
}

function optionalToolCallsArray(toolCalls) {
  if (!Array.isArray(toolCalls)) return undefined;
  if (!toolCalls.length) return undefined;
  return toolCalls;
}

function trueFlagOrOmit(flag) {
  if (flag === true) return true;
  return undefined;
}

function toolCallFieldForSave(toolCall) {
  if (!toolCall) return undefined;
  return stripUndefinedForFirestore(toolCall);
}

function serializeOneMessage(message) {
  if (!message) return null;
  if (typeof message !== 'object') return null;

  const role = roleForFirestoreWrite(message.role);
  const webSources = webSourcesListFromMessage(message);
  const serializedWebSources = serializeWebSourcesList(webSources);

  let messageId = message.id;
  if (!messageId) {
    messageId = makeGeneratedMessageId();
  }

  let createdAtValue = message.createdAt;
  if (!createdAtValue) {
    createdAtValue = Date.now();
  }

  let sourceField = undefined;
  if (message.source !== undefined && message.source !== null) {
    sourceField = message.source;
  }

  return stripUndefinedForFirestore({
    id: messageId,
    role,
    text: String(message.text || message.content || ''),
    createdAt: createdAtValue,
    attachments: sanitizeAttachmentsList(message.attachments),
    source: sourceField,
    toolCall: toolCallFieldForSave(message.toolCall),
    toolCalls: optionalToolCallsArray(message.toolCalls),
    completedToolCalls: optionalToolCallsArray(message.completedToolCalls),
    toolConfirmed: trueFlagOrOmit(message.toolConfirmed),
    isToolResult: trueFlagOrOmit(message.isToolResult),
    isError: trueFlagOrOmit(message.isError),
    searchedWeb: trueFlagOrOmit(message.searchedWeb),
    webProvider: message.webProvider || undefined,
    route: message.route || undefined,
    webSources: serializedWebSources,
    followUpPrompts: followUpPromptsForSave(message.followUpPrompts),
    time: message.time || undefined,
  });
}

function serializeMessageList(messages) {
  let messageList = messages;
  if (!Array.isArray(messages)) {
    messageList = [];
  }

  const serialized = [];
  for (let index = 0; index < messageList.length; index += 1) {
    const row = serializeOneMessage(messageList[index]);
    if (row) {
      serialized.push(row);
    }
  }

  return serialized;
}

function restoredFollowUpPrompts(followUpPrompts) {
  if (!Array.isArray(followUpPrompts)) return undefined;

  const cleaned = [];
  for (let index = 0; index < followUpPrompts.length; index += 1) {
    const trimmed = String(followUpPrompts[index] || '').trim();
    if (trimmed) {
      cleaned.push(trimmed);
    }
  }
  return cleaned;
}

function rebuildOneMessageForUi(savedMessage, index) {
  let messageId = savedMessage.id;
  if (!messageId) {
    messageId = `${RESTORED_MESSAGE_ID_PREFIX}${index}`;
  }

  let timeValue = undefined;
  if (typeof savedMessage.time === 'string') {
    timeValue = savedMessage.time;
  }

  let attachmentsValue = undefined;
  if (Array.isArray(savedMessage.attachments)) {
    attachmentsValue = savedMessage.attachments;
  }

  let toolCallsValue = [];
  if (Array.isArray(savedMessage.toolCalls)) {
    toolCallsValue = savedMessage.toolCalls;
  }

  let completedToolCallsValue = [];
  if (Array.isArray(savedMessage.completedToolCalls)) {
    completedToolCallsValue = savedMessage.completedToolCalls;
  }

  let webSourcesValue = [];
  if (Array.isArray(savedMessage.webSources)) {
    webSourcesValue = savedMessage.webSources;
  }

  return {
    id: messageId,
    role: roleForBubbleUi(savedMessage.role),
    text: String(savedMessage.text || savedMessage.content || ''),
    time: timeValue,
    source: savedMessage.source || null,
    attachments: attachmentsValue,
    toolCall: savedMessage.toolCall || null,
    toolCalls: toolCallsValue,
    completedToolCalls: completedToolCallsValue,
    toolConfirmed: savedMessage.toolConfirmed === true,
    isToolResult: savedMessage.isToolResult === true,
    searchedWeb: savedMessage.searchedWeb === true,
    webProvider: savedMessage.webProvider || null,
    route: savedMessage.route || null,
    webSources: webSourcesValue,
    followUpPrompts: restoredFollowUpPrompts(savedMessage.followUpPrompts),
  };
}

function messageHasTextOrAttachments(message) {
  if (message.text.trim().length > 0) return true;
  if (!Array.isArray(message.attachments)) return false;
  if (message.attachments.length > 0) return true;
  return false;
}

function stringMetaField(value) {
  if (typeof value === 'string') return value;
  return '';
}

function sidebarMetaFromSessionData(data) {
  return {
    title: stringMetaField(data.title),
    lastUserMessage: stringMetaField(data.lastUserMessage),
    lastAssistantMessage: stringMetaField(data.lastAssistantMessage),
  };
}

function sortMessagesOldestFirst(messages) {
  messages.sort((leftMessage, rightMessage) => {
    const leftTime = leftMessage.createdAt || 0;
    const rightTime = rightMessage.createdAt || 0;
    return leftTime - rightTime;
  });
  return messages;
}

async function loadMessagesFromLegacyArrayOrSubcollection(userId, sessionId, data) {
  if (Array.isArray(data.messages) && data.messages.length) {
    return serializeMessageList(data.messages);
  }

  const messageSnapshot = await getDocs(pathToMessagesCollection(userId, sessionId));
  if (messageSnapshot.empty) return [];

  const loaded = [];
  for (let index = 0; index < messageSnapshot.docs.length; index += 1) {
    const messageDoc = messageSnapshot.docs[index];
    const row = serializeOneMessage({ id: messageDoc.id, ...messageDoc.data() });
    if (row) {
      loaded.push(row);
    }
  }

  return sortMessagesOldestFirst(loaded);
}

function writeSessionMetaOntoBatch(batch, userId, sessionId, meta, extraFields) {
  batch.set(
    pathToSessionDoc(userId, sessionId),
    stripUndefinedForFirestore({
      sessionId,
      ...meta,
      messages: deleteField(),
      updatedAt: serverTimestamp(),
      ...extraFields,
    }),
    { merge: true },
  );
}

function writeSerializedMessagesOntoBatch(batch, userId, sessionId, serializedMessages) {
  for (let index = 0; index < serializedMessages.length; index += 1) {
    const messageRow = serializedMessages[index];
    batch.set(
      doc(pathToMessagesCollection(userId, sessionId), messageRow.id),
      stripUndefinedForFirestore({ ...messageRow, updatedAt: serverTimestamp() }),
      { merge: true },
    );
  }
}

function lastMessageSnippetsForRole(serialized, meta) {
  let lastUserMessage = meta.lastUserMessage;
  if (serialized.role === ROLE_USER) {
    lastUserMessage = serialized.text;
  }

  let lastAssistantMessage = meta.lastAssistantMessage;
  if (serialized.role === ROLE_ASSISTANT) {
    lastAssistantMessage = serialized.text;
  }

  return {
    lastUserMessage,
    lastAssistantMessage,
  };
}
