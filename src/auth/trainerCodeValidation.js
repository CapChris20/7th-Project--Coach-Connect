/** Normalize client input to match stored format (XXX-XXX). Returns null if invalid. */
export function normalizeInviteCodeForQuery(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  if (/^trainer/i.test(s)) s = s.replace(/^trainer[\-\s]*/i, '').trim();
  const cleaned = s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (cleaned.length !== 6) return null;
  const result = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}`;
  return result.length === 7 ? result : null;
}

/** Injectable trainer-code validation — used by OnboardingScreen and unit tests. */
export async function validateTrainerCodeWithDeps(code, deps) {
  const {
    postOnboardingApi,
    setCodeValid = () => {},
    setCodeError = () => {},
    setOnboardingData = () => {},
    setValidatingCode = () => {},
    triggerShake = () => {},
  } = deps;

  if (!code || code.trim().length === 0) {
    setCodeValid(null);
    return;
  }

  const normalized = normalizeInviteCodeForQuery(code);
  if (!normalized) {
    setCodeValid(false);
    setCodeError('Invalid code format.');
    triggerShake();
    return;
  }

  setValidatingCode(true);
  try {
    const resp = await postOnboardingApi('/api/onboarding/validate-trainer-code', {
      code: normalized,
    });

    if (resp?.valid && resp?.trainerId) {
      setCodeValid(true);
      setCodeError(null);
      setOnboardingData((prev) => ({ ...prev, trainerId: resp.trainerId }));
    } else {
      setCodeValid(false);
      setCodeError(null);
      triggerShake();
    }
  } catch (error) {
    console.warn('Trainer code validation failed:', error?.message || error);
    setCodeValid(false);
    setCodeError('Could not verify code. Check your connection and try again.');
    triggerShake();
  } finally {
    setValidatingCode(false);
  }
}
