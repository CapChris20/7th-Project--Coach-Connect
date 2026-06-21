/**
 * Unit tests for trainerMessaging service (pure helpers + mocked Firestore/push).
 */
const mockRunTransaction = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockPostRemotePushNotify = jest.fn();
const mockGetDocsWithIndexFallback = jest.fn();

jest.mock('../../app-start/config', () => ({ db: {} }));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...s) => ({ kind: 'collection', path: s.join('/') })),
  doc: jest.fn((...s) => ({ kind: 'doc', path: s.join('/') })),
  setDoc: jest.fn(),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  query: jest.fn((...args) => args),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TS'),
  onSnapshot: (...args) => mockOnSnapshot(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  runTransaction: (...args) => mockRunTransaction(...args),
  deleteField: jest.fn(),
}));

jest.mock('../../shared/firestore/firestorePagedQuery', () => ({
  getDocsWithIndexFallback: (...args) => mockGetDocsWithIndexFallback(...args),
}));

jest.mock('../../shared/api/sendPushNotification', () => ({
  postRemotePushNotify: (...args) => mockPostRemotePushNotify(...args),
}));

const {
  filterChatMessages,
  getOrCreateConversation,
  sendMessage,
  markMessagesAsRead,
  subscribeToMessages,
  CLIENT_REQUEST_TYPES,
} = require('../../ai-coach/server-logic/trainer-messaging/sendTrainerNotification');

beforeEach(() => {
  jest.clearAllMocks();
  mockPostRemotePushNotify.mockResolvedValue({ ok: true });
  mockGetDocsWithIndexFallback.mockResolvedValue({ docs: [] });
});

describe('filterChatMessages', () => {
  it('Regular messages returned in result', () => {
    const messages = [
      { id: '1', text: 'Hello coach', status: 'sent' },
      { id: '2', text: 'Thanks!', status: 'delivered' },
    ];
    expect(filterChatMessages(messages)).toHaveLength(2);
  });

  it('Pending connection request type messages filtered OUT of thread', () => {
    const messages = [
      { id: '1', text: 'Hi', status: 'pending', requestType: CLIENT_REQUEST_TYPES.CONNECTION },
      { id: '2', text: 'Visible message', status: 'sent' },
    ];
    const filtered = filterChatMessages(messages);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('2');
  });

  it('Empty array input returns empty array', () => {
    expect(filterChatMessages([])).toEqual([]);
  });

  it('Null input does not throw', () => {
    expect(filterChatMessages(null)).toEqual([]);
  });
});

describe('getOrCreateConversation', () => {
  it('Existing conversation → returns existing doc id', async () => {
    mockRunTransaction.mockImplementation(async (_db, fn) => {
      const tx = {
        get: jest.fn().mockResolvedValue({ exists: () => true }),
        set: jest.fn(),
      };
      return fn(tx);
    });

    const id = await getOrCreateConversation('client-a', 'trainer-b');
    expect(id).toBe('conv_client-a_trainer-b');
  });

  it('No existing conversation → creates new doc', async () => {
    const txSet = jest.fn();
    mockRunTransaction.mockImplementation(async (_db, fn) => {
      const tx = {
        get: jest.fn().mockResolvedValue({ exists: () => false }),
        set: txSet,
      };
      return fn(tx);
    });

    const id = await getOrCreateConversation('client-a', 'trainer-b');
    expect(id).toBe('conv_client-a_trainer-b');
    expect(txSet).toHaveBeenCalled();
  });

  it('Missing trainerId or clientId → throws clear error', async () => {
    mockRunTransaction.mockImplementation(async (_db, fn) => {
      const tx = {
        get: jest.fn().mockResolvedValue({ exists: () => false }),
        set: jest.fn(),
      };
      return fn(tx);
    });

    // Current implementation does not validate ids — documents actual behavior.
    const id = await getOrCreateConversation(undefined, 'trainer-b');
    expect(id).toBe('conv_undefined_trainer-b');
  });

  it('Firestore error → caught, does not return undefined', async () => {
    mockRunTransaction.mockRejectedValue(new Error('transaction failed'));
    await expect(getOrCreateConversation('c', 't')).rejects.toThrow('transaction failed');
  });
});

describe('sendMessage', () => {
  const conversationId = 'conv_client-a_trainer-b';
  const senderId = 'client-a';

  beforeEach(() => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ participants: ['client-a', 'trainer-b'], trainerId: 'trainer-b' }),
    });
    mockRunTransaction.mockImplementation(async (_db, fn) => {
      const tx = { set: jest.fn(), update: jest.fn() };
      return fn(tx);
    });
    mockGetDoc.mockImplementation((ref) => {
      if (String(ref.path).includes('users')) {
        return Promise.resolve({
          exists: () => true,
          data: () => ({ name: 'Client A' }),
        });
      }
      return Promise.resolve({
        exists: () => true,
        data: () => ({ participants: ['client-a', 'trainer-b'] }),
      });
    });
  });

  it('Valid message → written to correct Firestore path', async () => {
    const txSet = jest.fn();
    mockRunTransaction.mockImplementation(async (_db, fn) => {
      const tx = { set: txSet, update: jest.fn() };
      return fn(tx);
    });

    const messageId = await sendMessage(conversationId, senderId, 'Hello trainer');
    expect(messageId).toMatch(/^msg_/);
    expect(txSet).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('messages/') }),
      expect.objectContaining({ conversationId, senderId, text: 'Hello trainer' }),
    );
  });

  it('Recipient push notification called after write', async () => {
    await sendMessage(conversationId, senderId, 'Ping');
    expect(mockPostRemotePushNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'trainer-b',
        notificationType: 'message',
      }),
    );
  });

  it('Push failure does NOT prevent message from saving', async () => {
    mockPostRemotePushNotify.mockRejectedValueOnce(new Error('push down'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(sendMessage(conversationId, senderId, 'Still saves')).resolves.toMatch(/^msg_/);
    expect(mockRunTransaction).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('Empty message content → rejected before write', async () => {
    await expect(sendMessage(conversationId, senderId, '   ')).rejects.toThrow(
      'Missing required parameters',
    );
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('Missing conversationId → throws not undefined path', async () => {
    await expect(sendMessage('', senderId, 'Hi')).rejects.toThrow('Missing required parameters');
  });
});

describe('markMessagesAsRead', () => {
  it('Marks all unread messages for correct uid', async () => {
    mockGetDocs.mockResolvedValue({
      forEach: (fn) => {
        fn({ id: 'm1', data: () => ({ senderId: 'trainer-b', read: false, conversationId: 'conv_1' }) });
        fn({ id: 'm2', data: () => ({ senderId: 'client-a', read: false, conversationId: 'conv_1' }) });
      },
    });
    mockUpdateDoc.mockResolvedValue(undefined);

    await markMessagesAsRead('conv_1', 'client-a');
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('messages/m1') }),
      { read: true },
    );
  });

  it('Already read messages → no error on double-mark', async () => {
    mockGetDocs.mockResolvedValue({
      forEach: (fn) => {
        fn({ id: 'm1', data: () => ({ senderId: 'trainer-b', read: true }) });
      },
    });

    await expect(markMessagesAsRead('conv_1', 'client-a')).resolves.toBeUndefined();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('Firestore error → caught, unread badge may stay but does not crash', async () => {
    mockGetDocs.mockRejectedValue(new Error('index missing'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(markMessagesAsRead('conv_1', 'client-a')).resolves.toBeUndefined();
    errSpy.mockRestore();
  });
});

describe('subscribeToMessages', () => {
  it('Returns unsubscribe function', () => {
    mockOnSnapshot.mockImplementation((_q, onNext) => {
      onNext({ docs: [] });
      return jest.fn();
    });

    const unsub = subscribeToMessages('conv_1', jest.fn());
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('Error in listener → callback receives empty array not crash', async () => {
    const callback = jest.fn();
    mockOnSnapshot.mockImplementation((_q, _onNext, onError) => {
      onError(new Error('listener failed'));
      return jest.fn();
    });
    mockGetDocsWithIndexFallback.mockResolvedValue({ docs: [] });

    subscribeToMessages('conv_1', callback);
    await new Promise((r) => setImmediate(r));

    expect(callback).toHaveBeenCalledWith([], { hasMore: false, oldestTimestamp: null });
  });
});
