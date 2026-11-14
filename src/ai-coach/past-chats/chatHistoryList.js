// Live list of this user's past coach chats, plus helpers that title and group them for the sidebar.
// Flow: listen to users/{uid}/aiChats → turn each doc into a sidebar row → retitle stale chats in the background.
// Used by: coach home, live conversation, past-chats sidebar, and DeleteChatSheet.

import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import { needsCreativeTitle, isJunkChatTitle } from './chatTitles';
import { fixOldChatTitles } from './fixOldChatTitles';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const AI_CHATS_SUBCOLLECTION = 'aiChats';
// Manipulate here: how many past chats the sidebar listens to (newest first).
const DEFAULT_MAX_SESSIONS = 50;
const MILLISECONDS_PER_DAY = 86400000;
// Manipulate here: sidebar title hard cap before we cut on a word boundary.
const MAX_SIDEBAR_TITLE_CHARS = 48;
// Manipulate here: do not cut mid-word unless the last space is past this index.
const MIN_WORD_BREAK_INDEX = 10;
const DEFAULT_CHAT_TITLE = 'Chat';
const DEFAULT_DISPLAY_TITLE = 'Coach Check-In';
const JSONISH_BRACES_PATTERN = /\{[\s\S]*?\}/g;
const COLLAPSE_SPACES_PATTERN = /\s+/g;
const TRAILING_DASH_PATTERN = /[-–—]\s*$/;
const TRAILING_NUMBER_PATTERN = /\s+\d+$/;
const DATE_LABEL_OPTIONS = { month: 'short', day: 'numeric' };
const GROUP_KEY_TODAY = 'today';
// Design Law keeps the middle bucket key as "yesterday" even though the label is Yesterday.
const GROUP_KEY_WEEK = 'yesterday';
const GROUP_KEY_EARLIER = 'earlier';
const GROUP_LABEL_TODAY = 'Today';
// Design Law past-chats drawer labels: Today / Yesterday / Earlier
const GROUP_LABEL_WEEK = 'Yesterday';
const GROUP_LABEL_EARLIER = 'Earlier';

// ===== HELPER FUNCTIONS =====

/**
 * Short date for the sidebar, e.g. "Mar 4". Missing timestamps become ''.
 * @param {*} timestamp
 * @returns {string}
 */
export function toSessionDateLabel(timestamp) {
  try {
    const date = timestampToDate(timestamp);
    if (!date) return '';
    return date.toLocaleDateString([], DATE_LABEL_OPTIONS);
  } catch {
    return '';
  }
}

/**
 * Sidebar title: strip JSON-looking braces, drop junk titles, then cap length on a word boundary.
 * @param {string} title
 * @returns {string}
 */
export function formatSessionDisplayTitle(title) {
  // 1. Clean braces / extra spaces so a model dump does not show as the title.
  const rawTitle = title || DEFAULT_DISPLAY_TITLE;
  let displayTitle = String(rawTitle);
  displayTitle = displayTitle.replace(JSONISH_BRACES_PATTERN, '');
  displayTitle = displayTitle.replace(COLLAPSE_SPACES_PATTERN, ' ');
  displayTitle = displayTitle.trim();

  // 2. Junk or empty → the friendly default.
  if (!displayTitle) {
    displayTitle = DEFAULT_DISPLAY_TITLE;
  }
  if (isJunkChatTitle(displayTitle)) {
    displayTitle = DEFAULT_DISPLAY_TITLE;
  }

  // 3. Short enough already → strip a trailing dash/number and return.
  if (displayTitle.length <= MAX_SIDEBAR_TITLE_CHARS) {
    const shortTitle = stripTrailingDashOrNumber(displayTitle);
    if (shortTitle) return shortTitle;
    return DEFAULT_DISPLAY_TITLE;
  }

  // 4. Too long → cut on the last space inside the cap when that space is far enough in.
  const titleSlice = displayTitle.slice(0, MAX_SIDEBAR_TITLE_CHARS);
  const lastSpaceIndex = titleSlice.lastIndexOf(' ');
  let sliceEnd = titleSlice.length;
  if (lastSpaceIndex > MIN_WORD_BREAK_INDEX) {
    sliceEnd = lastSpaceIndex;
  }
  const cutTitle = stripTrailingDashOrNumber(titleSlice.slice(0, sliceEnd));
  if (cutTitle) return cutTitle;
  return DEFAULT_DISPLAY_TITLE;
}

/**
 * Bucket sessions into Today / Yesterday / Earlier. Empty buckets are omitted.
 * @param {Array} sessions
 * @returns {Array<{ key: string, label: string, items: Array }>}
 */
export function groupSessionsForSidebar(sessions) {
  return buildSidebarTimeGroups(sessions);
}

// ===== MAIN FUNCTION =====

/**
 * Subscribe to this user's coach chats. Newest first, capped at `max`.
 * Hook order is frozen: sessions state → snapshot effect → stale-id memo → retitle effect.
 * @param {string} userId
 * @param {{ max?: number }} [options]
 * @returns {Array}
 */
export function chatHistoryList(userId, { max = DEFAULT_MAX_SESSIONS } = {}) {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    // 1. No db / no user → empty list and skip the listener.
    if (!db || !userId) {
      setSessions([]);
      return undefined;
    }

    // 2. Newest-first page of this user's aiChats.
    // Firestore letters stay: users / aiChats / updatedAt.
    const sessionQuery = query(
      collection(db, USERS_COLLECTION, userId, AI_CHATS_SUBCOLLECTION),
      orderBy('updatedAt', 'desc'),
      limit(max),
    );

    // 3. Live listen → map each doc into a sidebar row; errors clear the list.
    const unsubscribeFromSessions = onSnapshot(
      sessionQuery,
      (snapshot) => {
        setSessions(sessionListFromSnapshot(snapshot));
      },
      () => setSessions([]),
    );

    return () => unsubscribeFromSessions();
  }, [userId, max]);

  // 4. Stable key of session ids that still need a creative title (avoids re-running every render).
  const staleSessionKey = useMemo(() => staleSessionIdKey(sessions), [sessions]);

  // 5. When that key changes, ask fixOldChatTitles to rewrite those titles in Firestore.
  useEffect(() => {
    if (!userId || !staleSessionKey) return undefined;
    fixOldChatTitles(userId, sessions);
    return undefined;
  }, [userId, staleSessionKey, sessions]);

  return sessions;
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function stripTrailingDashOrNumber(text) {
  let cleaned = text.replace(TRAILING_DASH_PATTERN, '');
  cleaned = cleaned.replace(TRAILING_NUMBER_PATTERN, '');
  return cleaned.trim();
}

function timestampToDate(timestamp) {
  if (timestamp && typeof timestamp.toDate === 'function') {
    const asDate = timestamp.toDate();
    if (asDate instanceof Date) return asDate;
  }
  if (timestamp instanceof Date) return timestamp;
  return null;
}

function millisFromFirestoreTimestamp(timestamp) {
  if (!timestamp) return 0;
  if (typeof timestamp.toDate !== 'function') return 0;

  const asDate = timestamp.toDate();
  if (!asDate) return 0;
  if (typeof asDate.getTime !== 'function') return 0;

  const asMillis = asDate.getTime();
  if (typeof asMillis !== 'number') return 0;
  return asMillis;
}

function stringFieldOrEmpty(value) {
  if (typeof value === 'string') return value;
  return '';
}

function sessionFromChatDoc(chatDoc) {
  const data = chatDoc.data() || {};
  const updatedAtMillis = millisFromFirestoreTimestamp(data.updatedAt);
  const createdAtMillis = millisFromFirestoreTimestamp(data.createdAt);
  const updatedAtMs = updatedAtMillis || createdAtMillis || 0;
  const dateFromUpdated = toSessionDateLabel(data.updatedAt);
  const dateFromCreated = toSessionDateLabel(data.createdAt);
  const dateLabel = dateFromUpdated || dateFromCreated || '';

  return {
    id: chatDoc.id,
    sessionId: data.sessionId || chatDoc.id,
    title: data.title || DEFAULT_CHAT_TITLE,
    lastUserMessage: stringFieldOrEmpty(data.lastUserMessage),
    lastAssistantMessage: stringFieldOrEmpty(data.lastAssistantMessage),
    date: dateLabel,
    updatedAtMs,
  };
}

function sessionListFromSnapshot(snapshot) {
  const sessionList = [];
  for (let docIndex = 0; docIndex < snapshot.docs.length; docIndex += 1) {
    sessionList.push(sessionFromChatDoc(snapshot.docs[docIndex]));
  }
  return sessionList;
}

function staleSessionIdKey(sessions) {
  const staleIds = [];
  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index];
    if (needsCreativeTitle(session.title, session.lastUserMessage)) {
      staleIds.push(session.id);
    }
  }
  return staleIds.join(',');
}

function pushSessionIntoTimeGroup(
  updatedAtMs,
  startOfToday,
  startOfYesterday,
  todayGroup,
  yesterdayGroup,
  earlierGroup,
  session,
) {
  if (updatedAtMs >= startOfToday) {
    todayGroup.items.push(session);
    return;
  }
  if (updatedAtMs >= startOfYesterday) {
    yesterdayGroup.items.push(session);
    return;
  }
  earlierGroup.items.push(session);
}

function buildSidebarTimeGroups(sessions) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  // Middle bucket = calendar yesterday only (Design Law), not a rolling 7-day week.
  const startOfYesterday = startOfToday - MILLISECONDS_PER_DAY;

  const todayGroup = { key: GROUP_KEY_TODAY, label: GROUP_LABEL_TODAY, items: [] };
  const yesterdayGroup = { key: GROUP_KEY_WEEK, label: GROUP_LABEL_WEEK, items: [] };
  const earlierGroup = { key: GROUP_KEY_EARLIER, label: GROUP_LABEL_EARLIER, items: [] };

  const safeSessions = sessions || [];
  for (let index = 0; index < safeSessions.length; index += 1) {
    const session = safeSessions[index];
    const updatedAtMs = session.updatedAtMs || 0;
    pushSessionIntoTimeGroup(
      updatedAtMs,
      startOfToday,
      startOfYesterday,
      todayGroup,
      yesterdayGroup,
      earlierGroup,
      session,
    );
  }

  return groupsThatHaveItems([todayGroup, yesterdayGroup, earlierGroup]);
}

function groupsThatHaveItems(allGroups) {
  const groupsWithItems = [];
  for (let groupIndex = 0; groupIndex < allGroups.length; groupIndex += 1) {
    const group = allGroups[groupIndex];
    if (group.items.length > 0) groupsWithItems.push(group);
  }
  return groupsWithItems;
}
