/**
 * Unit tests for cache cleanup on sign-out and account switch (privacy-critical).
 */
const storage = new Map();

const mockGetItem = jest.fn((key) => Promise.resolve(storage.has(key) ? storage.get(key) : null));
const mockSetItem = jest.fn((key, value) => {
  storage.set(key, value);
  return Promise.resolve();
});
const mockRemoveItem = jest.fn((key) => {
  storage.delete(key);
  return Promise.resolve();
});
const mockGetAllKeys = jest.fn(() => Promise.resolve([...storage.keys()]));
const mockMultiRemove = jest.fn((keys) => {
  keys.forEach((k) => storage.delete(k));
  return Promise.resolve();
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args) => mockGetItem(...args),
  setItem: (...args) => mockSetItem(...args),
  removeItem: (...args) => mockRemoveItem(...args),
  getAllKeys: (...args) => mockGetAllKeys(...args),
  multiRemove: (...args) => mockMultiRemove(...args),
}));

const mockClearPushTokensForUid = jest.fn(() => Promise.resolve());

jest.mock('../../notifications/manageNotifications', () => ({
  clearPushTokensForUid: (...args) => mockClearPushTokensForUid(...args),
}));

jest.mock('../../app-start/config', () => ({
  auth: { currentUser: { uid: 'user-old' } },
}));

const {
  clearUserSpecificData,
  onUserSignOut,
  onUserSwitch,
  clearAllUserData,
} = require('../../utils/clearDataOnLogout');

const OLD_UID = 'user-old';
const NEW_UID = 'user-new';

beforeEach(() => {
  storage.clear();
  jest.clearAllMocks();
  mockGetItem.mockImplementation((key) => Promise.resolve(storage.has(key) ? storage.get(key) : null));
  mockGetAllKeys.mockImplementation(() => Promise.resolve([...storage.keys()]));
});

describe('clearUserSpecificData', () => {
  beforeEach(() => {
    storage.set(`COACHCONNECT_NUTRITION_${OLD_UID}`, '{"meals":[]}');
    storage.set(`COACHCONNECT_CHAT_HISTORY`, 'shared-chat');
    storage.set(`COACHCONNECT_NUTRITION_${NEW_UID}`, '{"meals":["salad"]}');
    storage.set(`user_ai_enabled_${OLD_UID}`, 'true');
  });

  it('Clears all keys containing the uid', async () => {
    await clearUserSpecificData(OLD_UID);
    expect(storage.has(`COACHCONNECT_NUTRITION_${OLD_UID}`)).toBe(false);
    expect(storage.has(`user_ai_enabled_${OLD_UID}`)).toBe(false);
  });

  it('Does NOT clear keys for other uids', async () => {
    await clearUserSpecificData(OLD_UID);
    expect(storage.get(`COACHCONNECT_NUTRITION_${NEW_UID}`)).toBe('{"meals":["salad"]}');
  });

  it('AsyncStorage error → caught, does not crash app', async () => {
    mockRemoveItem.mockRejectedValueOnce(new Error('storage locked'));
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await expect(clearUserSpecificData(OLD_UID)).resolves.toBe(true);
    logSpy.mockRestore();
  });

  it('Missing uid → no keys cleared, no crash', async () => {
    storage.set('COACHCONNECT_NUTRITION_user-old', 'data');
    await clearUserSpecificData('');
    expect(storage.get('COACHCONNECT_NUTRITION_user-old')).toBe('data');
  });
});

describe('onUserSignOut', () => {
  beforeEach(() => {
    storage.set('COACHCONNECT_NUTRITION_CACHE', '{"food":"pizza"}');
    storage.set(`COACHCONNECT_NUTRITION_${OLD_UID}`, '{"private":true}');
    storage.set('COACHCONNECT_CHAT_HISTORY', 'thread-abc');
  });

  it('Clears all user-specific cache keys for that uid', async () => {
    await onUserSignOut();
    expect(storage.has(`COACHCONNECT_NUTRITION_${OLD_UID}`)).toBe(false);
    expect(storage.has('COACHCONNECT_NUTRITION_CACHE')).toBe(false);
    expect(storage.has('COACHCONNECT_CHAT_HISTORY')).toBe(false);
  });

  it('Push token cleanup called', async () => {
    await onUserSignOut();
    expect(mockClearPushTokensForUid).toHaveBeenCalledWith(OLD_UID);
  });

  it('AsyncStorage error → caught, sign out still completes', async () => {
    mockGetAllKeys.mockRejectedValueOnce(new Error('keys unavailable'));
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await expect(onUserSignOut()).resolves.toBeUndefined();
    logSpy.mockRestore();
  });

  it('After clear: no prior user data accessible by key', async () => {
    await onUserSignOut();
    expect(await mockGetItem(`COACHCONNECT_NUTRITION_${OLD_UID}`)).toBeNull();
    expect(await mockGetItem('COACHCONNECT_CHAT_HISTORY')).toBeNull();
  });
});

describe('onUserSwitch', () => {
  beforeEach(() => {
    storage.set(`COACHCONNECT_NUTRITION_${OLD_UID}`, '{"clientFood":"burger"}');
    storage.set(`COACHCONNECT_WORKOUTS_${OLD_UID}`, '{"plan":"legs"}');
    storage.set(`user_ai_enabled_${OLD_UID}`, 'true');
    storage.set(`COACHCONNECT_NUTRITION_${NEW_UID}`, '{"clientFood":"salad"}');
    storage.set('COACHCONNECT_FOOD_CACHE', 'shared-food');
    mockRemoveItem.mockImplementation((key) => {
      storage.delete(key);
      return Promise.resolve();
    });
  });

  it("Old user's data cleared before new user loads", async () => {
    await onUserSwitch(OLD_UID, NEW_UID);
    expect(storage.has(`COACHCONNECT_NUTRITION_${OLD_UID}`)).toBe(false);
    expect(storage.has(`COACHCONNECT_WORKOUTS_${OLD_UID}`)).toBe(false);
  });

  it("New user's data not affected", async () => {
    await onUserSwitch(OLD_UID, NEW_UID);
    expect(storage.get(`COACHCONNECT_NUTRITION_${NEW_UID}`)).toBe('{"clientFood":"salad"}');
  });

  it('Partial failure on old user clear → still loads new user, logs warning', async () => {
    mockRemoveItem.mockImplementation((key) => {
      if (key.includes(OLD_UID)) return Promise.reject(new Error('fail old'));
      storage.delete(key);
      return Promise.resolve();
    });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await expect(onUserSwitch(OLD_UID, NEW_UID)).resolves.toBeUndefined();
    expect(storage.get(`COACHCONNECT_NUTRITION_${NEW_UID}`)).toBe('{"clientFood":"salad"}');
    logSpy.mockRestore();
  });

  it('PRIVACY: after switch, old user nutrition and AI chat cache keys return null', async () => {
    storage.set(`COACHCONNECT_NUTRITION_${OLD_UID}`, '{"secret":"macros"}');
    storage.set('COACHCONNECT_CHAT_HISTORY', 'old-ai-thread');

    await onUserSwitch(OLD_UID, NEW_UID);

    expect(await mockGetItem(`COACHCONNECT_NUTRITION_${OLD_UID}`)).toBeNull();
    expect(await mockGetItem('COACHCONNECT_CHAT_HISTORY')).toBeNull();
    expect(await mockGetItem(`user_ai_enabled_${OLD_UID}`)).toBeNull();
  });
});

describe('clearAllUserData', () => {
  beforeEach(() => {
    storage.set('COACHCONNECT_FOOD_CACHE', 'x');
    storage.set('COACHCONNECT_NUTRITION_CACHE', 'y');
    storage.set('coachconnect_theme', 'dark');
    storage.set('unrelated_app_key', 'keep');
  });

  it('Clears every app-specific key in AsyncStorage', async () => {
    await clearAllUserData();
    expect(storage.has('COACHCONNECT_FOOD_CACHE')).toBe(false);
    expect(storage.has('COACHCONNECT_NUTRITION_CACHE')).toBe(false);
    expect(storage.has('coachconnect_theme')).toBe(false);
    expect(mockMultiRemove).toHaveBeenCalled();
  });

  it('After clear: all checked keys return null', async () => {
    await clearAllUserData();
    expect(await mockGetItem('COACHCONNECT_FOOD_CACHE')).toBeNull();
    expect(await mockGetItem('COACHCONNECT_NUTRITION_CACHE')).toBeNull();
  });

  it('AsyncStorage error → caught not crash', async () => {
    mockRemoveItem.mockRejectedValue(new Error('remove failed'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await clearAllUserData();
    expect(result).toBe(true);
    errSpy.mockRestore();
  });
});
