// Live list of this user's past coach chats, plus helpers that title and group them for the sidebar.
// Flow: listen to users/{uid}/aiChats → map each doc into a sidebar row → retitle stale chats in the background.
// Used by: the coach home, the live conversation, and the past-chats sidebar.

import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import { needsCreativeTitle, isJunkChatTitle } from './chatTitles';
import { fixOldChatTitles } from './fixOldChatTitles';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const AI_CHATS_SUBCOLLECTION = 'aiChats';
const DEFAULT_MAX_SESSIONS = 50;
const MILLISECONDS_PER_DAY = 86400000;
const THIS_WEEK_LOOKBACK_DAYS = 6;
const MAX_SIDEBAR_TITLE_CHARS = 48;
const MIN_WORD_BREAK_INDEX = 10;
const DEFAULT_CHAT_TITLE = 'Chat';
const DEFAULT_DISPLAY_TITLE = 'Coach Check-In';
const JSONISH_BRACES_PATTERN = /\{[\s\S]*?\}/g;
const COLLAPSE_SPACES_PATTERN = /\s+/g;
const TRAILING_DASH_PATTERN = /[-–—]\s*$/;
const TRAILING_NUMBER_PATTERN = /\s+\d+$/;
const DATE_LABEL_OPTIONS = { month: 'short', day: 'numeric' };
const GROUP_KEY_TODAY = 'today';
const GROUP_KEY_WEEK = 'week';
const GROUP_KEY_EARLIER = 'earlier';
const GROUP_LABEL_TODAY = 'Today';
const GROUP_LABEL_WEEK = 'This Week';
const GROUP_LABEL_EARLIER = 'Earlier';

// ===== MAIN FUNCTION =====

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
  let displayTitle = String(title || DEFAULT_DISPLAY_TITLE)
    .replace(JSONISH_BRACES_PATTERN, '')
    .replace(COLLAPSE_SPACES_PATTERN, ' ')
    .trim();
  if (!displayTitle || isJunkChatTitle(displayTitle)) displayTitle = DEFAULT_DISPLAY_TITLE;
  if (displayTitle.length <= MAX_SIDEBAR_TITLE_CHARS) {
    return stripTrailingDashOrNumber(displayTitle) || DEFAULT_DISPLAY_TITLE;
  }
  const titleSlice = displayTitle.slice(0, MAX_SIDEBAR_TITLE_CHARS);
  const lastSpaceIndex = titleSlice.lastIndexOf(' ');
  const cutTitle = stripTrailingDashOrNumber(
    lastSpaceIndex > MIN_WORD_BREAK_INDEX ? titleSlice.slice(0, lastSpaceIndex) : titleSlice,
  );
  return cutTitle || DEFAULT_DISPLAY_TITLE;
}

/**
 * Bucket sessions into Today / This Week / Earlier. Empty buckets are omitted.
 * @param {Array} sessions
 * @returns {Array<{ key: string, label: string, items: Array }>}
 */
export function groupSessionsForSidebar(sessions) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfToday - THIS_WEEK_LOOKBACK_DAYS * MILLISECONDS_PER_DAY;
  const todayGroup = { key: GROUP_KEY_TODAY, label: GROUP_LABEL_TODAY, items: [] };
  const weekGroup = { key: GROUP_KEY_WEEK, label: GROUP_LABEL_WEEK, items: [] };
  const earlierGroup = { key: GROUP_KEY_EARLIER, label: GROUP_LABEL_EARLIER, items: [] };

  (sessions || []).forEach((session) => {
    const updatedAtMs = session.updatedAtMs || 0;
    pushSessionIntoTimeGroup(
      updatedAtMs,
      startOfToday,
      startOfWeek,
      todayGroup,
      weekGroup,
      earlierGroup,
      session,
    );
  });

  return [todayGroup, weekGroup, earlierGroup].filter((group) => group.items.length > 0);
}

/**
 * Subscribe to this user's coach chats. Newest first, capped at `max`.
 * @param {string} userId
 * @param {{ max?: number }} [options]
 * @returns {Array}
 */
export function chatHistoryList(userId, { max = DEFAULT_MAX_SESSIONS } = {}) {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (!db || !userId) {
      setSessions([]);
      return undefined;
    }

    const sessionQuery = query(
      collection(db, USERS_COLLECTION, userId, AI_CHATS_SUBCOLLECTION),
      orderBy('updatedAt', 'desc'),
      limit(max),
    );

    const unsubscribeFromSessions = onSnapshot(
      sessionQuery,
      (snapshot) => {
        const sessionList = snapshot.docs.map((chatDoc) => sessionFromChatDoc(chatDoc));
        setSessions(sessionList);
      },
      () => setSessions([]),
    );

    return () => unsubscribeFromSessions();
  }, [userId, max]);

  const staleSessionKey = useMemo(
    () => staleSessionIdKey(sessions),
    [sessions],
  );

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
  return text.replace(TRAILING_DASH_PATTERN, '').replace(TRAILING_NUMBER_PATTERN, '').trim();
}

function timestampToDate(timestamp) {
  if (timestamp?.toDate?.() instanceof Date) return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  return null;
}

function sessionFromChatDoc(chatDoc) {
  const data = chatDoc.data() || {};
  return {
    id: chatDoc.id,
    sessionId: data.sessionId || chatDoc.id,
    title: data.title || DEFAULT_CHAT_TITLE,
    lastUserMessage: typeof data.lastUserMessage === 'string' ? data.lastUserMessage : '',
    lastAssistantMessage:
      typeof data.lastAssistantMessage === 'string' ? data.lastAssistantMessage : '',
    date: toSessionDateLabel(data.updatedAt) || toSessionDateLabel(data.createdAt) || '',
    updatedAtMs:
      data.updatedAt?.toDate?.()?.getTime?.() ||
      data.createdAt?.toDate?.()?.getTime?.() ||
      0,
  };
}

function staleSessionIdKey(sessions) {
  return sessions
    .filter((session) => needsCreativeTitle(session.title, session.lastUserMessage))
    .map((session) => session.id)
    .join(',');
}

function pushSessionIntoTimeGroup(
  updatedAtMs,
  startOfToday,
  startOfWeek,
  todayGroup,
  weekGroup,
  earlierGroup,
  session,
) {
  if (updatedAtMs >= startOfToday) {
    todayGroup.items.push(session);
    return;
  }
  if (updatedAtMs >= startOfWeek) {
    weekGroup.items.push(session);
    return;
  }
  earlierGroup.items.push(session);
}
