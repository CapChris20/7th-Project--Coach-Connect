/**
 * ai Chat Persistence
 *
 * Purpose: ai Chat Persistence — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: loadAiChatMessages, restoreChatMessagesFromSaved, persistAiChatSession, upsertAiChatMessage, upsertAiChatMessages, deleteAiChatSession, clearLegacyMessagesField
 *
 * @file-header
 */
/**
 * AI Coach chat persistence — session meta + per-message docs (avoids full-array rewrites).
 */
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
import { db } from '../../../app-start/config';
import { stripUndefinedForFirestore } from '../../../shared-utils/firestoreSanitize';

const sessionRef = (userId, sessionId) => doc(db, 'users', userId, 'aiChats', sessionId);
const messagesCol = (userId, sessionId) => collection(db, 'users', userId, 'aiChats', sessionId, 'messages');

/** Firestore rejects `undefined` anywhere in a write payload. */
const omitUndefined = stripUndefinedForFirestore;

function sanitizeAttachments(attachments) {
  if (!Array.isArray(attachments) || !attachments.length) return undefined;
  const cleaned = attachments
    .map((att) => {
      if (!att || typeof att !== 'object') return null;
      return omitUndefined({
        id: att.id,
        name: att.name,
        type: att.type,
        preview: att.preview || att.uri,
        mimeType: att.mimeType,
      });
    })
    .filter(Boolean);
  return cleaned.length ? cleaned : undefined;
}

function serializeMessage(msg) {
  if (!msg || typeof msg !== 'object') return null;
  const role = msg.role === 'assistant' || msg.role === 'ai' ? 'assistant' : 'user';
  const webSources = Array.isArray(msg.webSources)
    ? msg.webSources
    : Array.isArray(msg.sources)
      ? msg.sources
      : undefined;
  return omitUndefined({
    id: msg.id || `m_${Date.now()}`,
    role,
    text: String(msg.text || msg.content || ''),
    createdAt: msg.createdAt || Date.now(),
    attachments: sanitizeAttachments(msg.attachments),
    source: msg.source ?? undefined,
    toolCall: msg.toolCall ? omitUndefined(msg.toolCall) : undefined,
    toolConfirmed: msg.toolConfirmed === true ? true : undefined,
    isToolResult: msg.isToolResult === true ? true : undefined,
    isError: msg.isError === true ? true : undefined,
    searchedWeb: msg.searchedWeb === true ? true : undefined,
    webProvider: msg.webProvider || undefined,
    route: msg.route || undefined,
    webSources: webSources
      ? webSources.map((s) =>
          omitUndefined({
            url: s?.url || s?.link,
            title: s?.title || s?.name,
            image: s?.image || s?.thumbnail || s?.ogImage,
          }),
        )
      : undefined,
    time: msg.time || undefined,
  });
}

export async function loadAiChatMessages(userId, sessionId) {
  if (!db || !userId || !sessionId) return [];
  const snap = await getDoc(sessionRef(userId, sessionId));
  if (!snap.exists()) return [];
  const data = snap.data() || {};
  if (Array.isArray(data.messages) && data.messages.length) {
    return data.messages.map(serializeMessage).filter(Boolean);
  }
  const msgSnap = await getDocs(messagesCol(userId, sessionId));
  if (msgSnap.empty) return [];
  return msgSnap.docs
    .map((d) => serializeMessage({ id: d.id, ...d.data() }))
    .filter(Boolean)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export function restoreChatMessagesFromSaved(saved = []) {
  return (Array.isArray(saved) ? saved : [])
    .map((m, idx) => ({
      id: m.id || `msg_restored_${idx}`,
      role: m.role === 'assistant' || m.role === 'ai' ? 'ai' : 'user',
      text: String(m.text || m.content || ''),
      time: typeof m.time === 'string' ? m.time : undefined,
      source: m.source || null,
      attachments: Array.isArray(m.attachments) ? m.attachments : undefined,
      toolCall: m.toolCall || null,
      toolConfirmed: m.toolConfirmed === true,
      isToolResult: m.isToolResult === true,
    }))
    .filter((m) => m.text.trim().length > 0 || (Array.isArray(m.attachments) && m.attachments.length > 0));
}

export async function persistAiChatSession(userId, sessionId, { messages = [], meta = {} } = {}) {
  if (!db || !userId || !sessionId) return;
  const serialized = messages.map(serializeMessage).filter(Boolean);
  const batch = writeBatch(db);
  batch.set(
    sessionRef(userId, sessionId),
    omitUndefined({
      sessionId,
      ...meta,
      messages: deleteField(),
      updatedAt: serverTimestamp(),
      createdAt: meta.createdAt || serverTimestamp(),
    }),
    { merge: true },
  );
  for (const msg of serialized) {
    batch.set(
      doc(messagesCol(userId, sessionId), msg.id),
      omitUndefined({ ...msg, updatedAt: serverTimestamp() }),
      { merge: true },
    );
  }
  await batch.commit();
}

/** Incremental write — only upserts the given messages (e.g. after tool confirm). */
export async function upsertAiChatMessages(userId, sessionId, messages = [], meta = {}) {
  if (!db || !userId || !sessionId) return;
  const serialized = (Array.isArray(messages) ? messages : []).map(serializeMessage).filter(Boolean);
  if (!serialized.length && !Object.keys(meta).length) return;

  const batch = writeBatch(db);
  batch.set(
    sessionRef(userId, sessionId),
    omitUndefined({
      sessionId,
      ...meta,
      messages: deleteField(),
      updatedAt: serverTimestamp(),
    }),
    { merge: true },
  );
  for (const msg of serialized) {
    batch.set(
      doc(messagesCol(userId, sessionId), msg.id),
      omitUndefined({ ...msg, updatedAt: serverTimestamp() }),
      { merge: true },
    );
  }
  await batch.commit();
}

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
      lastUserMessage: serialized.role === 'user' ? serialized.text : meta.lastUserMessage,
      lastAssistantMessage:
        serialized.role === 'assistant' ? serialized.text : meta.lastAssistantMessage,
    }),
    { merge: true },
  );
  await setDoc(doc(messagesCol(userId, sessionId), serialized.id), omitUndefined({
    ...serialized,
    updatedAt: serverTimestamp(),
  }));
}

export async function deleteAiChatSession(userId, sessionId) {
  if (!db || !userId || !sessionId) return;
  const msgSnap = await getDocs(messagesCol(userId, sessionId));
  const batch = writeBatch(db);
  msgSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(sessionRef(userId, sessionId));
  await batch.commit();
}

export async function clearLegacyMessagesField(userId, sessionId) {
  if (!db || !userId || !sessionId) return;
  await setDoc(
    sessionRef(userId, sessionId),
    { messages: deleteField() },
    { merge: true },
  );
}
