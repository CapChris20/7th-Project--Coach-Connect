import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../../app-start/config';
import { needsCreativeTitle, isJunkChatTitle } from '../../server-logic/chat-api/chatTitleUtils';
import { refreshStaleChatSessionTitles } from '../../server-logic/chat-api/refreshStaleChatSessionTitles';

export function toSessionDateLabel(d) {
  try {
    const date = d?.toDate?.() instanceof Date ? d.toDate() : d instanceof Date ? d : null;
    if (!date) return '';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function formatSessionDisplayTitle(title) {
  let s = String(title || 'Coach Check-In')
    .replace(/\{[\s\S]*?\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s || isJunkChatTitle(s)) s = 'Coach Check-In';
  if (s.length <= 48) return s.replace(/[-–—]\s*$/, '').replace(/\s+\d+$/, '').trim() || 'Coach Check-In';
  const slice = s.slice(0, 48);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = (lastSpace > 10 ? slice.slice(0, lastSpace) : slice)
    .replace(/[-–—]\s*$/, '')
    .replace(/\s+\d+$/, '')
    .trim();
  return cut || 'Coach Check-In';
}

export function groupSessionsForSidebar(sessions) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfToday - 6 * 86400000;
  const groups = [
    { key: 'today', label: 'Today', items: [] },
    { key: 'week', label: 'This Week', items: [] },
    { key: 'earlier', label: 'Earlier', items: [] },
  ];
  (sessions || []).forEach((s) => {
    const ms = s.updatedAtMs || 0;
    if (ms >= startOfToday) groups[0].items.push(s);
    else if (ms >= startOfWeek) groups[1].items.push(s);
    else groups[2].items.push(s);
  });
  return groups.filter((g) => g.items.length > 0);
}

export function useCoachChatSessions(userId, { max = 50 } = {}) {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (!db || !userId) {
      setSessions([]);
      return undefined;
    }

    const q = query(
      collection(db, 'users', userId, 'aiChats'),
      orderBy('updatedAt', 'desc'),
      limit(max),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            sessionId: data.sessionId || d.id,
            title: data.title || 'Chat',
            lastUserMessage: typeof data.lastUserMessage === 'string' ? data.lastUserMessage : '',
            lastAssistantMessage:
              typeof data.lastAssistantMessage === 'string' ? data.lastAssistantMessage : '',
            date: toSessionDateLabel(data.updatedAt) || toSessionDateLabel(data.createdAt) || '',
            updatedAtMs:
              data.updatedAt?.toDate?.()?.getTime?.() ||
              data.createdAt?.toDate?.()?.getTime?.() ||
              0,
          };
        });
        setSessions(next);
      },
      () => setSessions([]),
    );

    return () => unsub();
  }, [userId, max]);

  const staleSessionKey = useMemo(
    () =>
      sessions
        .filter((s) => needsCreativeTitle(s.title, s.lastUserMessage))
        .map((s) => s.id)
        .join(','),
    [sessions],
  );

  useEffect(() => {
    if (!userId || !staleSessionKey) return undefined;
    refreshStaleChatSessionTitles(userId, sessions);
    return undefined;
  }, [userId, staleSessionKey, sessions]);

  return sessions;
}
