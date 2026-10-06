// Rewrite old coach-chat titles that are still the raw first message.
// Flow: skip if a pass is already running → pick sessions that need a title →
// ask for a short title → write it only when it's actually better.
// Used by the chat history list when past chats load.

import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../../app-start/cloudConnection';
import { makeChatTitle } from './makeChatTitle';
import {
  buildCreativeTitleLocal,
  deriveChatTitle,
  needsCreativeTitle,
} from './chatTitles';

// ===== NAMED CONSTANTS =====

// Manipulate here: how many stale titles to fix per history open. Higher costs more title API calls.
const DEFAULT_TITLE_FIX_LIMIT = 15;

const USERS_COLLECTION = 'users';
const AI_CHATS_COLLECTION = 'aiChats';

// One user at a time. A second history refresh while the first pass is writing
// would call the title API twice for the same chats.
const titleFixInFlightForUser = new Set();

// ===== HELPER FUNCTIONS =====

// The title route only needs the last user line and the last coach line, in that order.
// role values are what makeChatTitle already understands ('user' and 'ai').
function conversationForTitle(session) {
  const conversation = [];
  if (session.lastUserMessage) {
    conversation.push({ role: 'user', content: session.lastUserMessage });
  }
  if (session.lastAssistantMessage) {
    conversation.push({ role: 'ai', content: session.lastAssistantMessage });
  }
  return conversation;
}

// Don't write a blank title, the same title, or another raw sentence.
// needsCreativeTitle is true when the text still looks like a message, not a name.
function shouldSkipTitleWrite(nextTitle, session) {
  const isMissing = !nextTitle;
  const isUnchanged = nextTitle === session.title;
  const isStillRawMessage = needsCreativeTitle(nextTitle, session.lastUserMessage);
  return isMissing || isUnchanged || isStillRawMessage;
}

async function retitleOneSession(session, uid) {
  const sessionId = session.sessionId || session.id;
  if (!sessionId) return;

  const conversation = conversationForTitle(session);
  if (!conversation.length) return;

  const fallbackTitle =
    buildCreativeTitleLocal(session.lastUserMessage, session.lastAssistantMessage) ||
    deriveChatTitle(session.lastUserMessage);

  // allowMainCoachFallback stays false: this pass should use the cheap title route,
  // not a full coach reply that can come back as a disclaimer and get saved as the title.
  const title = await makeChatTitle(conversation, fallbackTitle, uid, {
    allowMainCoachFallback: false,
  });
  if (shouldSkipTitleWrite(title, session)) return;

  // vocab: merge: true writes only these fields and leaves the rest of the chat document alone.
  // vocab: serverTimestamp() lets Firestore fill the time, so two phones don't disagree.
  await setDoc(
    doc(db, USERS_COLLECTION, uid, AI_CHATS_COLLECTION, sessionId),
    { title, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

// ===== MAIN FUNCTION =====

/**
 * Retitle sessions that still have raw message text as their title.
 * @param {string} userId
 * @param {Array<object>} [sessions]
 * @param {{ limit?: number }} [options] limit is the caller key. Defaults to 15.
 * @returns {Promise<void>}
 */
export async function fixOldChatTitles(userId, sessions = [], { limit = DEFAULT_TITLE_FIX_LIMIT } = {}) {
  if (!db || !userId || titleFixInFlightForUser.has(userId)) return;

  const sessionsNeedingTitles = (sessions || [])
    .filter((session) => needsCreativeTitle(session.title, session.lastUserMessage))
    .slice(0, limit);

  if (!sessionsNeedingTitles.length) return;
  titleFixInFlightForUser.add(userId);

  try {
    const uid = userId || auth?.currentUser?.uid;
    if (!uid) return;

    for (const session of sessionsNeedingTitles) {
      await retitleOneSession(session, uid);
    }
  } finally {
    // Always clear, including the early return above, or this user could never retitle again.
    titleFixInFlightForUser.delete(userId);
  }
}
