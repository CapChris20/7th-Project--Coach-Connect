jest.setTimeout(15000);

global.__DEV__ = true;

global.__fbBatchedBridgeConfig = {
  remoteModuleConfig: [],
};

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
}));

if (typeof global.fetch !== 'function') {
  global.fetch = jest.fn();
}
