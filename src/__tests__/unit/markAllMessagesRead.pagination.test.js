jest.mock('../../app-start/config', () => ({ db: {} }));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'messages'),
  query: jest.fn((...args) => args),
  where: jest.fn((...args) => args),
  limit: jest.fn((n) => n),
  startAfter: jest.fn((...args) => args),
  getDocs: jest.fn(),
  writeBatch: jest.fn(() => ({
    update: jest.fn(),
    commit: jest.fn(() => Promise.resolve()),
  })),
  doc: jest.fn((_db, _col, id) => ({ id })),
}));

jest.mock('../../messaging/unreadCountIndex', () => ({
  clearUnreadForConversation: jest.fn(() => Promise.resolve()),
}));

import { READ_PAGE_SIZE, markConversationMessagesReadPaginated } from '../../ai-coach/server-logic/services/markAllMessagesRead';
import { getDocs, writeBatch } from 'firebase/firestore';

function makeSnap(docs) {
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
    forEach: (fn) => docs.forEach(fn),
  };
}

function makeMsg(id, read) {
  return {
    id,
    data: () => ({ senderId: 'other', read }),
  };
}

describe('markConversationMessagesReadPaginated', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    writeBatch.mockImplementation(() => ({
      update: jest.fn(),
      commit: jest.fn(() => Promise.resolve()),
    }));
  });

  it('marks unread messages in batches of READ_PAGE_SIZE', async () => {
    const page1 = Array.from({ length: READ_PAGE_SIZE }, (_, i) => makeMsg(`m${i}`, false));
    const page2 = [makeMsg('m-last', false)];

    getDocs
      .mockResolvedValueOnce(makeSnap(page1))
      .mockResolvedValueOnce(makeSnap(page2))
      .mockResolvedValueOnce(makeSnap([]));

    const total = await markConversationMessagesReadPaginated('conv-1', 'user-1');

    expect(total).toBe(READ_PAGE_SIZE + 1);
    expect(writeBatch).toHaveBeenCalledTimes(2);
  });
});
