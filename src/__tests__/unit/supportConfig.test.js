const mockConstants = {
  expoConfig: { extra: {} },
};

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: mockConstants,
}));

describe('supportConfig', () => {
  beforeEach(() => {
    jest.resetModules();
    mockConstants.expoConfig = { extra: {} };
  });

  test('returns default support email', () => {
    const { getSupportEmail, DEFAULT_SUPPORT_EMAIL } = require('../../settings/supportConfig');
    expect(getSupportEmail()).toBe(DEFAULT_SUPPORT_EMAIL);
  });

  test('supports env override from expo extra', () => {
    mockConstants.expoConfig = { extra: { supportEmail: 'help@example.com' } };
    const { getSupportEmail } = require('../../settings/supportConfig');
    expect(getSupportEmail()).toBe('help@example.com');
  });
});
