/**
 * Onboarding complete → trainer link creation (client + server paths).
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

const AsyncStorage = require('@react-native-async-storage/async-storage');
const { completeOnboardingClient } = require('../../auth/finishOnboarding');
const {
  applyOnboardingCompleteServer,
} = require('../../../server/lib/onboardingCompleteLinks');

function createMockFirestore() {
  const writes = [];
  const docRefs = new Map();

  const makeDocRef = (path) => {
    if (docRefs.has(path)) return docRefs.get(path);
    const docRef = {
      path,
      set: jest.fn(async (data, opts) => {
        writes.push({ op: 'set', path, data, opts });
      }),
      get: jest.fn(async () => ({ exists: false, data: () => ({}) })),
      collection: (subName) => makeCollection(`${path}/${subName}`),
    };
    docRefs.set(path, docRef);
    return docRef;
  };

  const makeCollection = (name) => {
    const collectionPath = name;
    return {
      doc: (id) => makeDocRef(`${collectionPath}/${id}`),
    };
  };

  const db = {
    collection: jest.fn((name) => makeCollection(name)),
    _writes: writes,
  };

  return db;
}

describe('Onboarding complete → trainer link creation', () => {
  const clientId = 'client-uid-1';
  const trainerId = 'tid1';
  const serverTimestamp = jest.fn(() => 'SERVER_TS');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes all 3 link surfaces when onboarding completes with a trainer code', async () => {
    const mockSetDoc = jest.fn(() => Promise.resolve());
    const mockDoc = jest.fn((_db, col, id) => ({ col, id }));
    const postOnboardingApi = jest.fn(() => Promise.resolve({ success: true, trainerId }));

    const clientResult = await completeOnboardingClient({
      userId: clientId,
      finalRole: 'client',
      onboardingData: { trainerId, firstName: 'Sam' },
      db: {},
      doc: mockDoc,
      setDoc: mockSetDoc,
      serverTimestamp,
      AsyncStorage,
      postOnboardingApi,
    });

    expect(clientResult.error).toBeNull();
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const clientPayload = mockSetDoc.mock.calls[0][1];
    expect(clientPayload.trainerId).toBeUndefined();
    expect(clientPayload.role).toBeUndefined();
    expect(clientPayload.onboardingCompleted).toBe(true);

    const db = createMockFirestore();
    const trainerUserDoc = db.collection('users').doc(trainerId);
    trainerUserDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({ role: 'trainer' }),
    });

    await applyOnboardingCompleteServer({
      db,
      uid: clientId,
      finalRole: 'client',
      onboardingData: { trainerId, firstName: 'Sam' },
      serverTimestamp,
    });

    const paths = db._writes.map((w) => w.path);
    expect(paths).toContain(`users/${clientId}`);
    expect(paths).toContain(`trainer_clients/${trainerId}/clients/${clientId}`);
    expect(paths).toContain(`trainer_client_links/${trainerId}_${clientId}`);
    expect(db._writes.every((w) => w.opts?.merge === true)).toBe(true);
  });

  it('skips trainer link collections when no trainer code is provided', async () => {
    const mockSetDoc = jest.fn(() => Promise.resolve());
    const postOnboardingApi = jest.fn(() => Promise.resolve({ success: true }));

    await completeOnboardingClient({
      userId: clientId,
      finalRole: 'client',
      onboardingData: { firstName: 'Sam' },
      db: {},
      doc: jest.fn(),
      setDoc: mockSetDoc,
      serverTimestamp,
      AsyncStorage,
      postOnboardingApi,
    });

    const clientPayload = mockSetDoc.mock.calls[0][1];
    expect(clientPayload.role).toBeUndefined();
    expect(clientPayload.trainerId).toBeUndefined();

    const db = createMockFirestore();
    await applyOnboardingCompleteServer({
      db,
      uid: clientId,
      finalRole: 'client',
      onboardingData: { firstName: 'Sam' },
      serverTimestamp,
    });

    const paths = db._writes.map((w) => w.path);
    expect(paths).toContain(`users/${clientId}`);
    expect(paths.some((p) => p.startsWith('trainer_clients/'))).toBe(false);
    expect(paths.some((p) => p.startsWith('trainer_client_links/'))).toBe(false);
  });

  it('does not write trainer links when the server call fails', async () => {
    const mockSetDoc = jest.fn(() => Promise.resolve());
    const postOnboardingApi = jest.fn(() => Promise.reject(new Error('Network request failed')));

    const result = await completeOnboardingClient({
      userId: clientId,
      finalRole: 'client',
      onboardingData: { trainerId, firstName: 'Sam' },
      db: {},
      doc: jest.fn(),
      setDoc: mockSetDoc,
      serverTimestamp,
      AsyncStorage,
      postOnboardingApi,
    });

    expect(result.error).toBeTruthy();
    expect(result.error.message).toMatch(/Network request failed/i);

    const db = createMockFirestore();
    expect(db._writes.filter((w) => w.path.includes('trainer_'))).toHaveLength(0);
  });

  it('sets onboardingCompleted in Firestore and AsyncStorage on success', async () => {
    const mockSetDoc = jest.fn(() => Promise.resolve());
    const postOnboardingApi = jest.fn(() => Promise.resolve({ success: true }));

    await completeOnboardingClient({
      userId: clientId,
      finalRole: 'client',
      onboardingData: { trainerId },
      db: {},
      doc: jest.fn(),
      setDoc: mockSetDoc,
      serverTimestamp,
      AsyncStorage,
      postOnboardingApi,
    });

    expect(mockSetDoc.mock.calls[0][1].onboardingCompleted).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      `onboarding_data_${clientId}`,
      expect.stringContaining('"onboardingCompleted":true'),
    );
  });

  it('uses merge set on duplicate completion calls (no duplicate link docs)', async () => {
    const db = createMockFirestore();
    const trainerUserDoc = db.collection('users').doc(trainerId);
    trainerUserDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({ role: 'trainer' }),
    });

    const payload = { trainerId, firstName: 'Sam' };
    await applyOnboardingCompleteServer({
      db,
      uid: clientId,
      finalRole: 'client',
      onboardingData: payload,
      serverTimestamp,
    });
    await applyOnboardingCompleteServer({
      db,
      uid: clientId,
      finalRole: 'client',
      onboardingData: payload,
      serverTimestamp,
    });

    const linkWrites = db._writes.filter((w) => w.path.includes('trainer_'));
    expect(linkWrites).toHaveLength(4);
    linkWrites.forEach((w) => {
      expect(w.op).toBe('set');
      expect(w.opts).toEqual({ merge: true });
    });
  });
});
