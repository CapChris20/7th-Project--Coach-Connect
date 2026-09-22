import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../../../app-start/config';
import { generateCreativeChatTitle } from './generateCreativeChatTitle';
import {
  buildCreativeTitleLocal,
  deriveChatTitle,
  needsCreativeTitle,
} from './chatTitleUtils';

const inflightByUser = new Set();

/**
 * Retroactively retitle sessions that still have raw/derived message titles.
 */
export async function refreshStaleChatSessionTitles(userId, sessions = [], { limit = 15 } = {}) {
  if (!db || !userId || inflightByUser.has(userId)) return;

  const stale = (sessions || [])
    .filter((s) => needsCreativeTitle(s.title, s.lastUserMessage))
    .slice(0, limit);

  if (!stale.length) return;
  inflightByUser.add(userId);

  try {
    const uid = userId || auth?.currentUser?.uid;
    if (!uid) return;

    for (const session of stale) {
      const sessionId = session.sessionId || session.id;
      if (!sessionId) continue;

      const convo = [];
      if (session.lastUserMessage) {
        convo.push({ role: 'user', content: session.lastUserMessage });
      }
      if (session.lastAssistantMessage) {
        convo.push({ role: 'ai', content: session.lastAssistantMessage });
      }
      if (!convo.length) continue;

      const fallback =
        buildCreativeTitleLocal(session.lastUserMessage, session.lastAssistantMessage) ||
        deriveChatTitle(session.lastUserMessage);

      const title = await generateCreativeChatTitle(convo, fallback, uid, {
        allowMainCoachFallback: false,
      });
      if (!title || title === session.title || needsCreativeTitle(title, session.lastUserMessage)) {
        continue;
      }

      await setDoc(
        doc(db, 'users', uid, 'aiChats', sessionId),
        { title, updatedAt: serverTimestamp() },
        { merge: true },
      );
    }
  } finally {
    inflightByUser.delete(userId);
  }
}
