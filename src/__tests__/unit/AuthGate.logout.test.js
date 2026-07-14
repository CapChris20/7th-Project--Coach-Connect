const { handleAuthUidTransition } = require('../../auth/authSessionTransition');

describe('AuthGate logout cleanup', () => {
  it('clears push tokens and local data on sign-out using previous uid ref', async () => {
    const clearPushTokensForUid = jest.fn(() => Promise.resolve());
    const clearAllUserData = jest.fn(() => Promise.resolve());

    await handleAuthUidTransition('user-a', null, {
      clearPushTokensForUid,
      clearAllUserData,
    });

    expect(clearPushTokensForUid).toHaveBeenCalledWith('user-a');
    expect(clearAllUserData).toHaveBeenCalled();
  });

  it('clears data when switching accounts', async () => {
    const clearPushTokensForUid = jest.fn(() => Promise.resolve());
    const clearAllUserData = jest.fn(() => Promise.resolve());

    await handleAuthUidTransition('user-a', { uid: 'user-b' }, {
      clearPushTokensForUid,
      clearAllUserData,
    });

    expect(clearPushTokensForUid).toHaveBeenCalledWith('user-a');
    expect(clearAllUserData).toHaveBeenCalled();
  });

  it('does not clear on first sign-in', async () => {
    const clearAllUserData = jest.fn(() => Promise.resolve());

    await handleAuthUidTransition(null, { uid: 'user-a' }, {
      clearPushTokensForUid: jest.fn(),
      clearAllUserData,
    });

    expect(clearAllUserData).not.toHaveBeenCalled();
  });
});
