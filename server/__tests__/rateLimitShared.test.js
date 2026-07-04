const { checkAndIncrement, LIMITS } = require('../middleware/rateLimitShared');

jest.mock('firebase-admin', () => {
  const stores = new Map();
  const firestoreFn = jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn((id) => ({ id, path: id })),
    })),
    runTransaction: jest.fn(async (fn) => {
      const tx = {
        get: jest.fn(async (ref) => ({
          exists: stores.has(ref.id),
          data: () => stores.get(ref.id),
        })),
        set: jest.fn(async (ref, data) => {
          stores.set(ref.id, data);
        }),
      };
      return fn(tx);
    }),
  }));
  firestoreFn.FieldValue = { serverTimestamp: jest.fn() };
  return { apps: [{}], firestore: firestoreFn, __stores: stores };
});

describe('shared rate limiting', () => {
  beforeEach(() => {
    require('firebase-admin').__stores.clear();
  });

  test('allows requests under per-minute limit', async () => {
    const result = await checkAndIncrement('/api/ai-coach', 'user1', LIMITS['/api/ai-coach']);
    expect(result.allowed).toBe(true);
  });

  test('blocks when per-minute limit exceeded', async () => {
    const cfg = { perMinute: 2, perHour: 100 };
    await checkAndIncrement('/api/ai-coach', 'user2', cfg);
    await checkAndIncrement('/api/ai-coach', 'user2', cfg);
    const blocked = await checkAndIncrement('/api/ai-coach', 'user2', cfg);
    expect(blocked.allowed).toBe(false);
  });
});
