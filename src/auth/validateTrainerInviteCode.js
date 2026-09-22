// Checks the trainer invite code a client types during onboarding, and drives the field's UI state.
// Flow: clean the typed code into XXX-XXX → POST it to the validate endpoint → on success stash trainerId, on failure shake the field.
// Used by OnboardingWizardScreen's trainer-code step; every setter is injected so unit tests can assert without React.
// Key exports: normalizeInviteCodeForQuery, validateTrainerCodeWithDeps

// Users paste codes in every format imaginable ("trainer ABC123", "abc-123", "ABC 123"). Stored codes
// are always exactly XXX-XXX, so we rebuild that shape or give up.
// Returns null = "not a valid code", which the caller treats as a format error without a network call.
export function normalizeInviteCodeForQuery(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;

  // Some trainers share their code as "Trainer ABC-123", so drop a leading "trainer" plus any
  // dash/space after it. vocab/regex: ^trainer = must be at the start; the /i flag = case-insensitive.
  if (/^trainer/i.test(s)) s = s.replace(/^trainer[\-\s]*/i, '').trim();

  // Throw away everything that isn't a letter or digit (dashes, spaces, invisible paste characters),
  // then uppercase so comparison against the stored code is exact.
  // vocab/regex: [^A-Za-z0-9] = "any character that is NOT a letter or number"; g = replace all of them.
  const cleaned = s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  // Manipulate here: 6 is the invite-code length. If code generation ever changes length, this check
  // and the slices below both have to move together or every code will read as invalid.
  if (cleaned.length !== 6) return null;

  // Re-insert the dash so the string matches exactly how the code is stored server-side.
  const result = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}`;
  // 7 = 6 characters + 1 dash. A last belt-and-braces check on the rebuilt string.
  return result.length === 7 ? result : null;
}

// Validates a code and reports the outcome by calling the UI setters it was handed.
// Dependency-injection style: the wizard passes its own state setters, tests pass spies. Each setter
// defaults to a no-op so a caller that only cares about some of them can omit the rest.
export async function validateTrainerCodeWithDeps(code, deps) {
  const {
    postOnboardingApi,
    setCodeValid = () => {},
    setCodeError = () => {},
    setOnboardingData = () => {},
    setValidatingCode = () => {},
    triggerShake = () => {},
  } = deps;

  // Empty field → reset to the neutral state (null, not false). null means "haven't judged yet" and
  // shows no checkmark or error; false would paint the field red while they're still typing.
  if (!code || code.trim().length === 0) {
    setCodeValid(null);
    return;
  }

  // Fail fast on malformed input — no point spending a round trip on something we know is wrong.
  const normalized = normalizeInviteCodeForQuery(code);
  if (!normalized) {
    setCodeValid(false);
    // Manipulate here: user-facing copy for a badly shaped code.
    setCodeError('Invalid code format.');
    triggerShake();
    return;
  }

  // Flip the spinner on before awaiting; `finally` below guarantees it turns off on every path,
  // including thrown errors, so the field can never get stuck in a loading state.
  setValidatingCode(true);
  try {
    const resp = await postOnboardingApi('/api/onboarding/validate-trainer-code', {
      code: normalized,
    });

    // Require BOTH flags: `valid` alone isn't enough, because trainerId is the thing we actually
    // need — it's what links this client to that trainer when onboarding saves.
    if (resp?.valid && resp?.trainerId) {
      setCodeValid(true);
      setCodeError(null);
      // Merge into existing answers rather than replacing them.
      // vocab/symbol: (prev) => ({ ...prev, ... }) = functional state update; React hands us the
      // latest state so we don't clobber other fields set between renders.
      setOnboardingData((prev) => ({ ...prev, trainerId: resp.trainerId }));
    } else {
      // Server answered clearly: the code just doesn't exist. No error message on purpose — the red
      // field plus the shake already say it, and a sentence here would be redundant noise.
      setCodeValid(false);
      setCodeError(null);
      triggerShake();
    }
  } catch (error) {
    // Network/server failure is a DIFFERENT story from a bad code: the code might be perfectly fine.
    // warn (not error) since this is an expected offline case, and the message tells them to retry
    // instead of implying their code is wrong.
    console.warn('Trainer code validation failed:', error?.message || error);
    setCodeValid(false);
    // Manipulate here: user-facing copy for the "couldn't reach the server" case.
    setCodeError('Could not verify code. Check your connection and try again.');
    triggerShake();
  } finally {
    setValidatingCode(false);
  }
}
