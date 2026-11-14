// Backfill creative titles on old coach chats that still show the first user sentence.
// Flow: one pass per user → cap how many sessions → title API → merge write when improved.
// Used when chatHistoryList loads past sessions.

import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../../app-start/cloudConnection';
import { makeChatTitle } from './makeChatTitle';
import { buildCreativeTitleLocal, deriveChatTitle, needsCreativeTitle } from './chatTitles';

// ===== NAMED CONSTANTS =====

// Manipulate here: cap retitle calls each time history opens (API cost).
const DEFAULT_TITLE_FIX_LIMIT = 15;

// Firestore path letters stay frozen — users/{uid}/aiChats/{sessionId}.
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
  // 1. Need Firestore + a user, and no other pass already running for this uid.
  if (!db || !userId) return;
  if (usersWithTitleFixInFlight.has(userId)) return;

  // 2. Collect sessions whose title still looks like the opening message.
  const sessionsToRetitle = collectSessionsNeedingRetitle(sessions, limit);
  if (!sessionsToRetitle.length) return;

  usersWithTitleFixInFlight.add(userId);

  try {
    // 3. Resolve the account uid we will write under (arg wins, else signed-in user).
    const accountUid = resolveAccountUidForTitleFix(userId);
    if (!accountUid) return;

    // 4. One title request per session; skip when the API returns nothing better.
    await retitleEachStaleSession(sessionsToRetitle, accountUid);
  } finally {
    usersWithTitleFixInFlight.delete(userId);
  }
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function resolveAccountUidForTitleFix(userId) {
  if (userId) return userId;
  if (!auth) return null;
  if (!auth.currentUser) return null;
  if (!auth.currentUser.uid) return null;
  return auth.currentUser.uid;
}

function collectSessionsNeedingRetitle(sessions, limit) {
  let sessionList = [];
  if (Array.isArray(sessions)) {
    sessionList = sessions;
  }

  const staleSessions = [];
  for (let index = 0; index < sessionList.length; index += 1) {
    const session = sessionList[index];
    const stillNeedsCreativeTitle = needsCreativeTitle(session.title, session.lastUserMessage);
    if (!stillNeedsCreativeTitle) continue;

    staleSessions.push(session);
    if (staleSessions.length >= limit) break;
  }

  return staleSessions;
}

async function retitleEachStaleSession(sessionsToRetitle, accountUid) {
  for (let index = 0; index < sessionsToRetitle.length; index += 1) {
    const session = sessionsToRetitle[index];
    await persistRetitledSession(session, accountUid);
  }
}

function turnsForTitleFromSession(session) {
  const turns = [];

  if (session.lastUserMessage) {
    turns.push({ role: 'user', content: session.lastUserMessage });
  }
  if (session.lastAssistantMessage) {
    turns.push({ role: 'ai', content: session.lastAssistantMessage });
  }

  return turns;
}

function pickLocalTitleForSession(session) {
  const localCreativeTitle = buildCreativeTitleLocal(
    session.lastUserMessage,
    session.lastAssistantMessage,
  );
  // Keep null/undefined → derive; empty string from creative local still wins (same as ??).
  if (localCreativeTitle != null) return localCreativeTitle;
  return deriveChatTitle(session.lastUserMessage);
}

function shouldPersistNewTitle(proposedTitle, session) {
  if (!proposedTitle) return false;
  if (proposedTitle === session.title) return false;
  if (needsCreativeTitle(proposedTitle, session.lastUserMessage)) return false;
  return true;
}

function sessionDocumentId(session) {
  if (session.sessionId) return session.sessionId;
  if (session.id) return session.id;
  return null;
}

async function persistRetitledSession(session, uid) {
  const sessionId = sessionDocumentId(session);
  if (!sessionId) return;

  const conversationTurns = turnsForTitleFromSession(session);
  if (!conversationTurns.length) return;

  const localFallback = pickLocalTitleForSession(session);
  const proposedTitle = await makeChatTitle(conversationTurns, localFallback, uid, {
    allowMainCoachFallback: false,
  });
  if (!shouldPersistNewTitle(proposedTitle, session)) return;

  // merge true — only title + updatedAt; serverTimestamp avoids clock skew across devices.
  const chatDocRef = doc(db, USERS_COLLECTION, uid, AI_CHATS_COLLECTION, sessionId);
  await setDoc(
    chatDocRef,
    { title: proposedTitle, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
