const mockConstants = {
  isDevice: false,
  expoConfig: { extra: {}, hostUri: undefined },
  expoGoConfig: {},
  manifest: {},
  manifest2: {},
};

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: mockConstants,
}));

jest.mock('expo/virtual/env', () => ({}), { virtual: true });

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

describe('baseUrl helpers', () => {
  beforeEach(() => {
    jest.resetModules();
    mockConstants.isDevice = false;
    mockConstants.expoConfig = { extra: {}, hostUri: undefined };
    mockConstants.expoGoConfig = {};
    mockConstants.manifest = {};
    mockConstants.manifest2 = {};
    global.__DEV__ = true;
  });

  test('uses explicit env base first', () => {
    mockConstants.expoConfig = { extra: { apiBaseUrl: 'https://api.example.com/' } };
    const { getApiBase } = require('../../shared/api/baseUrl');
    expect(getApiBase()).toBe('https://api.example.com');
  });

  test('includes cloud run fallback in resilient list', () => {
    const { getResilientApiBases, PRODUCTION_API_BASE_URL } = require('../../shared/api/baseUrl');
    expect(getResilientApiBases()).toContain(PRODUCTION_API_BASE_URL);
  });
});
