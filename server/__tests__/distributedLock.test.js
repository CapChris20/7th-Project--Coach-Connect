const mockLockStore = new Map();

jest.mock('firebase-admin', () => {
  const FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TS'),
  };
  const Timestamp = {
    fromMillis: (ms) => ({ toMillis: () => ms }),
  };

  const firestoreFn = jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn((id) => ({
        id,
        delete: jest.fn(async () => {
          mockLockStore.delete(id);
        }),
      })),
    })),
    runTransaction: jest.fn(async (fn) => {
      const tx = {
        get: jest.fn(async (ref) => {
          const data = mockLockStore.get(ref.id);
          return { exists: data != null, data: () => data };
        }),
        set: jest.fn(async (ref, data) => {
          mockLockStore.set(ref.id, data);
        }),
      };
      return fn(tx);
    }),
  }));

  firestoreFn.FieldValue = FieldValue;
  firestoreFn.Timestamp = Timestamp;

  return {
    apps: [{ name: 'test' }],
    firestore: firestoreFn,
  };
});

const { acquireLock, releaseLock } = require('../lib/distributedLock');

describe('distributed lock', () => {
  beforeEach(() => {
    mockLockStore.clear();
    jest.clearAllMocks();
  });

  test('acquireLock returns true when no lock exists', async () => {
    const acquired = await acquireLock('test-lock', 60);
    expect(acquired).toBe(true);
  });

  test('acquireLock returns false when lock is held', async () => {
    const future = Date.now() + 60_000;
    mockLockStore.set('held-lock', { expiresAtMs: future });

    const acquired = await acquireLock('held-lock', 60);
    expect(acquired).toBe(false);
  });

  test('releaseLock clears lock doc', async () => {
    mockLockStore.set('release-me', { expiresAtMs: Date.now() + 60_000 });
    await releaseLock('release-me');
    expect(mockLockStore.has('release-me')).toBe(false);
  });
});
