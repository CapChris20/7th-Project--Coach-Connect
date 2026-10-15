// Backfill creative titles on old coach chats that still show the first user sentence.
// Flow: guard one pass per user → filter stale titles → title API → merge write when improved.
// Used when chatHistoryList loads past sessions.

import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../../app-start/cloudConnection';
import { makeChatTitle } from './makeChatTitle';
import {
  buildCreativeTitleLocal,
  deriveChatTitle,
  needsCreativeTitle,
} from './chatTitles';

// ===== NAMED CONSTANTS =====

// Manipulate here: cap retitle calls each time history opens (API cost).
const DEFAULT_TITLE_FIX_LIMIT = 15;

const USERS_COLLECTION = 'users';
const AI_CHATS_COLLECTION = 'aiChats';

// Prevents overlapping fix passes for the same uid (double API spend).
const usersWithTitleFixInFlight = new Set();

// ===== MAIN FUNCTION =====

/**
 * Replace raw-message titles with short creative names (bounded batch).
 * @param {string} userId
 * @param {Array<object>} [sessions]
 * @param {{ limit?: number }} [options]
 * @returns {Promise<void>}
 */
export async function fixOldChatTitles(userId, sessions = [], { limit = DEFAULT_TITLE_FIX_LIMIT } = {}) {
  if (!db || !userId) return;
  if (usersWithTitleFixInFlight.has(userId)) return;

  // 1. Collect sessions whose title still looks like the opening message.
  const toFix = sessionsNeedingRetitle(sessions, limit);
  if (!toFix.length) return;

  usersWithTitleFixInFlight.add(userId);

  try {
    const uid = userId || auth?.currentUser?.uid;
    if (!uid) return;

    // 2. One title request per session; skip when the API returns nothing better.
    for (let index = 0; index < toFix.length; index += 1) {
      await persistRetitledSession(toFix[index], uid);
    }
  } finally {
    usersWithTitleFixInFlight.delete(userId);
  }
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function titleConversationFromSession(session) {
  const turns = [];
  if (session.lastUserMessage) {
    turns.push({ role: 'user', content: session.lastUserMessage });
  }
  if (session.lastAssistantMessage) {
    turns.push({ role: 'ai', content: session.lastAssistantMessage });
  }
  return turns;
}

function shouldPersistNewTitle(proposedTitle, session) {
  if (!proposedTitle) return false;
  if (proposedTitle === session.title) return false;
  if (needsCreativeTitle(proposedTitle, session.lastUserMessage)) return false;
  return true;
}

async function persistRetitledSession(session, uid) {
  const sessionId = session.sessionId || session.id;
  if (!sessionId) return;

  const conversation = titleConversationFromSession(session);
  if (!conversation.length) return;

  const localFallback =
    buildCreativeTitleLocal(session.lastUserMessage, session.lastAssistantMessage) ??
    deriveChatTitle(session.lastUserMessage);

  const proposedTitle = await makeChatTitle(conversation, localFallback, uid, {
    allowMainCoachFallback: false,
  });
  if (!shouldPersistNewTitle(proposedTitle, session)) return;

  // vocab: merge true — only title + updatedAt; serverTimestamp avoids clock skew across devices.
  await setDoc(
    doc(db, USERS_COLLECTION, uid, AI_CHATS_COLLECTION, sessionId),
    { title: proposedTitle, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

function sessionsNeedingRetitle(sessions, limit) {
  const list = Array.isArray(sessions) ? sessions : [];
  const stale = [];
  for (let index = 0; index < list.length; index += 1) {
    const session = list[index];
    if (!needsCreativeTitle(session.title, session.lastUserMessage)) continue;
    stale.push(session);
    if (stale.length >= limit) break;
  }
  return stale;
}
