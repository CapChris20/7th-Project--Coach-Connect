// Checks the trainer invite code a client types during onboarding, and drives the field's UI state.
// Flow: clean the typed code into XXX-XXX → POST it to the validate endpoint → on success stash trainerId, on failure shake the field.
// Used by: NewUserSetupScreen's trainer-code step; every setter is injected so unit tests can assert without React.

// ===== NAMED CONSTANTS =====

// Manipulate here: 6 is the invite-code length. If code generation ever changes length, this check
// and the slices below both have to move together or every code will read as invalid.
const INVITE_CODE_LETTER_COUNT = 6;
const INVITE_CODE_PREFIX_LENGTH = 3;
const INVITE_CODE_STORED_LENGTH = 7;
const LEADING_TRAINER_WORD = /^trainer/i;
const STRIP_LEADING_TRAINER_WORD = /^trainer[\-\s]*/i;
const NON_LETTER_OR_DIGIT = /[^A-Za-z0-9]/g;
const INVALID_CODE_FORMAT_MESSAGE = 'Invalid code format.';
const COULD_NOT_VERIFY_CODE_MESSAGE =
  'Could not verify code. Check your connection and try again.';
const VALIDATE_TRAINER_CODE_PATH = '/api/onboarding/validate-trainer-code';

// ===== HELPER FUNCTIONS =====

/**
 * Some trainers share their code as "Trainer ABC-123". Drop a leading "trainer" plus dash/space after it.
 * vocab/regex: ^trainer = must be at the start; the /i flag = case-insensitive.
 * @param {string} typedCode
 * @returns {string}
 */
function stripLeadingTrainerWord(typedCode) {
  if (!LEADING_TRAINER_WORD.test(typedCode)) return typedCode;
  return typedCode.replace(STRIP_LEADING_TRAINER_WORD, '').trim();
}

/**
 * Throw away dashes, spaces, and invisible paste characters, then uppercase for an exact stored-code match.
 * vocab/regex: [^A-Za-z0-9] = "any character that is NOT a letter or number"; g = replace all of them.
 * @param {string} typedCode
 * @returns {string}
 */
function lettersAndDigitsUppercase(typedCode) {
  return typedCode.replace(NON_LETTER_OR_DIGIT, '').toUpperCase();
}

/**
 * Re-insert the dash so the string matches exactly how the code is stored server-side.
 * @param {string} cleanedCode
 * @returns {string|null}
 */
function formatInviteCodeWithDash(cleanedCode) {
  const formattedCode = `${cleanedCode.slice(0, INVITE_CODE_PREFIX_LENGTH)}-${cleanedCode.slice(INVITE_CODE_PREFIX_LENGTH, INVITE_CODE_LETTER_COUNT)}`;
  return formattedCode.length === INVITE_CODE_STORED_LENGTH ? formattedCode : null;
}

/**
 * Apply the successful-code UI: checkmark on, error off, trainerId merged into onboarding answers.
 * @param {object} validationResponse
 * @param {Function} setCodeValid
 * @param {Function} setCodeError
 * @param {Function} setOnboardingData
 */
function applyValidTrainerCode(validationResponse, setCodeValid, setCodeError, setOnboardingData) {
  setCodeValid(true);
  setCodeError(null);
  // vocab/symbol: (currentOnboardingData) => ({ ...currentOnboardingData, ... }) = functional state update;
  // React hands us the latest state so we don't clobber other fields set between renders.
  setOnboardingData((currentOnboardingData) => ({
    ...currentOnboardingData,
    trainerId: validationResponse.trainerId,
  }));
}

/**
 * Server said the code does not exist, or the request failed. Shake the field either way.
 * @param {Function} setCodeValid
 * @param {Function} setCodeError
 * @param {Function} triggerShake
 * @param {string|null} errorMessage
 */
function applyInvalidTrainerCode(setCodeValid, setCodeError, triggerShake, errorMessage) {
  setCodeValid(false);
  setCodeError(errorMessage);
  triggerShake();
}

// ===== MAIN FUNCTION =====

/**
 * Users paste codes in every format imaginable ("trainer ABC123", "abc-123", "ABC 123"). Stored codes
 * are always exactly XXX-XXX, so we rebuild that shape or give up.
 * Returns null = "not a valid code", which the caller treats as a format error without a network call.
 * @param {*} raw
 * @returns {string|null}
 */
export function normalizeInviteCodeForQuery(raw) {
  const trimmedCode = String(raw || '').trim();
  if (!trimmedCode) return null;

  const withoutTrainerWord = stripLeadingTrainerWord(trimmedCode);
  const cleanedCode = lettersAndDigitsUppercase(withoutTrainerWord);
  if (cleanedCode.length !== INVITE_CODE_LETTER_COUNT) return null;

  return formatInviteCodeWithDash(cleanedCode);
}

/**
 * Validates a code and reports the outcome by calling the UI setters it was handed.
 * Dependency-injection style: the wizard passes its own state setters, tests pass spies. Each setter
 * defaults to a no-op so a caller that only cares about some of them can omit the rest.
 * @param {string} code
 * @param {object} deps
 * @returns {Promise<void>}
 */
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
    applyInvalidTrainerCode(setCodeValid, setCodeError, triggerShake, INVALID_CODE_FORMAT_MESSAGE);
    return;
  }

  // Flip the spinner on before awaiting; `finally` below guarantees it turns off on every path,
  // including thrown errors, so the field can never get stuck in a loading state.
  setValidatingCode(true);
  try {
    const validationResponse = await postOnboardingApi(VALIDATE_TRAINER_CODE_PATH, {
      code: normalized,
    });

    // Require BOTH flags: `valid` alone isn't enough, because trainerId is the thing we actually
    // need — it's what links this client to that trainer when onboarding saves.
    if (validationResponse?.valid && validationResponse?.trainerId) {
      applyValidTrainerCode(validationResponse, setCodeValid, setCodeError, setOnboardingData);
    } else {
      // Server answered clearly: the code just doesn't exist. No error message on purpose — the red
      // field plus the shake already say it, and a sentence here would be redundant noise.
      applyInvalidTrainerCode(setCodeValid, setCodeError, triggerShake, null);
    }
  } catch (error) {
    // Network/server failure is a DIFFERENT story from a bad code: the code might be perfectly fine.
    // warn (not error) since this is an expected offline case, and the message tells them to retry
    // instead of implying their code is wrong.
    console.warn('Trainer code validation failed:', error?.message || error);
    applyInvalidTrainerCode(
      setCodeValid,
      setCodeError,
      triggerShake,
      COULD_NOT_VERIFY_CODE_MESSAGE,
    );
  } finally {
    setValidatingCode(false);
  }
}
