/**
 * Trainer invite code validation (trainerCodeValidation module).
 */
const {
  normalizeInviteCodeForQuery,
  validateTrainerCodeWithDeps,
} = require('../../auth/trainerCodeValidation');

function createValidationHarness() {
  const state = {
    codeValid: undefined,
    codeError: undefined,
    trainerId: undefined,
    validating: false,
    shakeCount: 0,
    onboardingData: {},
  };

  const postOnboardingApi = jest.fn();

  const run = (code) =>
    validateTrainerCodeWithDeps(code, {
      postOnboardingApi,
      setCodeValid: (v) => {
        state.codeValid = v;
      },
      setCodeError: (v) => {
        state.codeError = v;
      },
      setOnboardingData: (updater) => {
        state.onboardingData =
          typeof updater === 'function' ? updater(state.onboardingData) : updater;
        if (state.onboardingData?.trainerId) state.trainerId = state.onboardingData.trainerId;
      },
      setValidatingCode: (v) => {
        state.validating = v;
      },
      triggerShake: () => {
        state.shakeCount += 1;
      },
    });

  return { state, postOnboardingApi, run };
}

describe('normalizeInviteCodeForQuery', () => {
  it('formats a 6-character code as XXX-XXX', () => {
    expect(normalizeInviteCodeForQuery('ABC123')).toBe('ABC-123');
    expect(normalizeInviteCodeForQuery('abc-123')).toBe('ABC-123');
  });

  it('rejects too-short and over-long codes', () => {
    expect(normalizeInviteCodeForQuery('abc')).toBeNull();
    expect(normalizeInviteCodeForQuery('abc-123-xyz')).toBeNull();
  });
});

describe('validateTrainerCode', () => {
  it('returns valid true and sets trainerId from a working API response', async () => {
    const { state, postOnboardingApi, run } = createValidationHarness();
    postOnboardingApi.mockResolvedValueOnce({ valid: true, trainerId: 'abc123' });

    await run('ABC123');

    expect(postOnboardingApi).toHaveBeenCalledTimes(1);
    expect(postOnboardingApi).toHaveBeenCalledWith('/api/onboarding/validate-trainer-code', {
      code: 'ABC-123',
    });
    expect(state.codeValid).toBe(true);
    expect(state.trainerId).toBe('abc123');
    expect(state.codeError).toBeNull();
  });

  it('returns valid false when the API reports an invalid code', async () => {
    const { state, postOnboardingApi, run } = createValidationHarness();
    postOnboardingApi.mockResolvedValueOnce({ valid: false });

    await run('XYZ999');

    expect(state.codeValid).toBe(false);
    expect(state.trainerId).toBeUndefined();
    expect(state.shakeCount).toBeGreaterThan(0);
  });

  it('does not treat API network errors as a valid code', async () => {
    const { state, postOnboardingApi, run } = createValidationHarness();
    postOnboardingApi.mockRejectedValueOnce(new Error('Network request failed'));

    await run('ABC123');

    expect(state.codeValid).toBe(false);
    expect(state.trainerId).toBeUndefined();
    expect(state.codeError).toMatch(/connection/i);
  });

  it('does not treat API 500 errors as a valid code', async () => {
    const { state, postOnboardingApi, run } = createValidationHarness();
    postOnboardingApi.mockRejectedValueOnce(
      new Error('Server /api/onboarding/validate-trainer-code failed (500)'),
    );

    await run('ABC123');

    expect(state.codeValid).toBe(false);
    expect(state.trainerId).toBeUndefined();
    expect(state.codeError).toMatch(/connection/i);
  });

  it('rejects an empty code before calling the API', async () => {
    const { state, postOnboardingApi, run } = createValidationHarness();

    await run('');

    expect(postOnboardingApi).not.toHaveBeenCalled();
    expect(state.codeValid).toBeNull();
  });

  it('rejects malformed codes before calling the API', async () => {
    const { state, postOnboardingApi, run } = createValidationHarness();

    await run('abc');
    expect(postOnboardingApi).not.toHaveBeenCalled();
    expect(state.codeValid).toBe(false);

    postOnboardingApi.mockClear();
    state.codeValid = undefined;

    await run('abc-123-xyz');
    expect(postOnboardingApi).not.toHaveBeenCalled();
    expect(state.codeValid).toBe(false);
  });
});
