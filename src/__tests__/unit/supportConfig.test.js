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

  test('returns default privacy policy URL', () => {
    const { getPrivacyPolicyUrl, DEFAULT_PRIVACY_POLICY_URL } = require('../../settings/supportConfig');
    expect(getPrivacyPolicyUrl()).toBe(DEFAULT_PRIVACY_POLICY_URL);
  });

  test('supports privacy URL override from expo extra', () => {
    mockConstants.expoConfig = { extra: { privacyPolicyUrl: 'https://example.com/privacy' } };
    const { getPrivacyPolicyUrl } = require('../../settings/supportConfig');
    expect(getPrivacyPolicyUrl()).toBe('https://example.com/privacy');
  });
});
