const mockUnsub = jest.fn();
let capturedCallback;

jest.mock('../../messaging/unreadCountIndex', () => ({
  subscribeToUnreadCount: jest.fn((_uid, cb) => {
    capturedCallback = cb;
    return mockUnsub;
  }),
  rebuildUnreadIndexForUser: jest.fn(() => Promise.resolve()),
}));

const { subscribeToUnreadCount, rebuildUnreadIndexForUser } = require('../../messaging/unreadCountIndex');

/** Mirrors useUnreadNotificationCount subscription contract used by TrainerApp. */
function attachUnreadListener(userId, onCount) {
  if (!userId) return () => {};
  rebuildUnreadIndexForUser(userId).catch(() => {});
  return subscribeToUnreadCount(userId, onCount);
}

describe('TrainerApp unread listener contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedCallback = null;
  });

  it('subscribes and receives unread count for trainer uid', () => {
    let count = 0;
    attachUnreadListener('trainer-1', (n) => {
      count = n;
    });

    expect(subscribeToUnreadCount).toHaveBeenCalledWith('trainer-1', expect.any(Function));
    capturedCallback(5);
    expect(count).toBe(5);
  });

  it('cleans up listener on unsubscribe', () => {
    const unsub = attachUnreadListener('trainer-1', () => {});
    unsub();
    expect(mockUnsub).toHaveBeenCalled();
  });
});

describe('TrainerApp wiring', () => {
  it('imports useUnreadNotificationCount hook', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '../../app-start/TrainerApp.js'),
      'utf8',
    );
    expect(source).toContain('useUnreadNotificationCount');
    expect(source).not.toContain('subscribeToUnreadCount');
  });
});
