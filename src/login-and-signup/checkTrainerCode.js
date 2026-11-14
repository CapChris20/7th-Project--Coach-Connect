// Checks the trainer invite code a client types during onboarding, and drives the field's UI state.
// Flow: clean typed code into XXX-XXX → POST validate endpoint → stash trainerId or shake the field.
// Used by: NewUserSetupScreen trainer-code step. Setters are injected so tests can spy without React.
// Read order: constants → main recipes → PLUMBING at the bottom.

// ===== NAMED CONSTANTS =====

// Manipulate here: invite codes are always 6 letters/digits with a dash after the first 3.
// If generation ever changes length, update LETTER_COUNT, PREFIX_LENGTH, and STORED_LENGTH together.
const INVITE_CODE_LETTER_COUNT = 6;
const INVITE_CODE_PREFIX_LENGTH = 3;
const INVITE_CODE_STORED_LENGTH = 7;

const LEADING_TRAINER_WORD = /^trainer/i;
const STRIP_LEADING_TRAINER_WORD = /^trainer[\-\s]*/i;
const NON_LETTER_OR_DIGIT = /[^A-Za-z0-9]/g;

const INVALID_CODE_FORMAT_MESSAGE = 'Invalid code format.';
const COULD_NOT_VERIFY_CODE_MESSAGE =
  'Could not verify code. Check your connection and try again.';

// Letters must stay — onboarding API path other files and the server already use.
const VALIDATE_TRAINER_CODE_PATH = '/api/onboarding/validate-trainer-code';

// ===== MAIN FUNCTION =====

/**
 * Turn messy pasted text into the exact XXX-XXX shape the server stores.
 * Returns null when the text cannot be a real invite code (caller treats that as a format error).
 * @param {string} rawTypedCode
 * @returns {string|null}
 */
export function normalizeInviteCodeForQuery(rawTypedCode) {
  // 1. Empty field → nothing to normalize.
  const trimmedCode = String(rawTypedCode || '').trim();
  if (!trimmedCode) return null;

  // 2. Drop a spoken "trainer" prefix, then keep only letters and digits in uppercase.
  const withoutTrainerWord = dropLeadingTrainerWord(trimmedCode);
  const lettersAndDigitsOnly = keepLettersAndDigitsUppercase(withoutTrainerWord);
  if (lettersAndDigitsOnly.length !== INVITE_CODE_LETTER_COUNT) return null;

  // 3. Put the dash back so the string matches server storage.
  return putDashInInviteCode(lettersAndDigitsOnly);
}

/**
 * Ask the server if this invite code is real, then call the UI setters the wizard handed in.
 * Dependency injection: the screen passes its own setters; tests pass spies.
 * @param {string} code
 * @param {object} deps
 * @returns {Promise<void>}
 */
export async function validateTrainerCodeWithDeps(code, deps) {
  const setters = readTrainerCodeUiSetters(deps);
  const postOnboardingApi = deps.postOnboardingApi;

  // 1. Empty field → neutral (null = "not judged yet"), not false.
  const trimmedCode = code ? code.trim() : '';
  if (trimmedCode.length === 0) {
    setters.setCodeValid(null);
    return;
  }

  // 2. Bad shape → shake locally; no network round trip.
  const normalizedCode = normalizeInviteCodeForQuery(code);
  if (!normalizedCode) {
    showTrainerCodeAsInvalid(
      setters,
      INVALID_CODE_FORMAT_MESSAGE,
    );
    return;
  }

  // 3. Spinner on, ask the server, spinner always off in finally.
  setters.setValidatingCode(true);
  try {
    const validationResponse = await postOnboardingApi(VALIDATE_TRAINER_CODE_PATH, {
      code: normalizedCode,
    });
    applyTrainerCodeServerAnswer(validationResponse, setters);
  } catch (error) {
    // Network/server failure — the code might still be fine; warn and ask them to retry.
    const errorText = error && error.message ? error.message : error;
    console.warn('Trainer code validation failed:', errorText);
    showTrainerCodeAsInvalid(setters, COULD_NOT_VERIFY_CODE_MESSAGE);
  } finally {
    setters.setValidatingCode(false);
  }
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging the invite-code cleaner or UI setters.

/**
 * Pull UI setters out of deps with no-op defaults so missing ones never crash.
 * @param {object} deps
 */
function readTrainerCodeUiSetters(deps) {
  const emptyFn = () => {};
  return {
    setCodeValid: deps.setCodeValid || emptyFn,
    setCodeError: deps.setCodeError || emptyFn,
    setOnboardingData: deps.setOnboardingData || emptyFn,
    setValidatingCode: deps.setValidatingCode || emptyFn,
    triggerShake: deps.triggerShake || emptyFn,
  };
}

/**
 * Some trainers share "Trainer ABC-123". Drop a leading "trainer" plus dash/space after it.
 * vocab/regex: ^trainer = must be at the start; /i = case-insensitive.
 * @param {string} typedCode
 * @returns {string}
 */
function dropLeadingTrainerWord(typedCode) {
  const startsWithTrainer = LEADING_TRAINER_WORD.test(typedCode);
  if (!startsWithTrainer) return typedCode;
  return typedCode.replace(STRIP_LEADING_TRAINER_WORD, '').trim();
}

/**
 * Throw away dashes, spaces, and paste junk, then uppercase for an exact stored-code match.
 * vocab/regex: [^A-Za-z0-9] = any character that is NOT a letter or number; g = replace all.
 * @param {string} typedCode
 * @returns {string}
 */
function keepLettersAndDigitsUppercase(typedCode) {
  return typedCode.replace(NON_LETTER_OR_DIGIT, '').toUpperCase();
}

/**
 * Re-insert the middle dash so the string matches how the code is stored server-side.
 * @param {string} cleanedCode
 * @returns {string|null}
 */
function putDashInInviteCode(cleanedCode) {
  const prefix = cleanedCode.slice(0, INVITE_CODE_PREFIX_LENGTH);
  const suffix = cleanedCode.slice(INVITE_CODE_PREFIX_LENGTH, INVITE_CODE_LETTER_COUNT);
  const withDash = `${prefix}-${suffix}`;
  if (withDash.length !== INVITE_CODE_STORED_LENGTH) return null;
  return withDash;
}

/**
 * Checkmark on, error off, trainerId merged into onboarding answers.
 * vocab/symbol: functional setState receives the latest object so we do not wipe other fields.
 * @param {object} validationResponse
 * @param {object} setters
 */
function showTrainerCodeAsValid(validationResponse, setters) {
  setters.setCodeValid(true);
  setters.setCodeError(null);
  setters.setOnboardingData((currentOnboardingData) => ({
    ...currentOnboardingData,
    trainerId: validationResponse.trainerId,
  }));
}

/**
 * Server said no, or the request failed. Shake the field either way.
 * @param {object} setters
 * @param {string|null} errorMessage
 */
function showTrainerCodeAsInvalid(setters, errorMessage) {
  setters.setCodeValid(false);
  setters.setCodeError(errorMessage);
  setters.triggerShake();
}

/**
 * Map a server payload into valid vs invalid UI. Needs both valid and trainerId to succeed.
 * @param {object} validationResponse
 * @param {object} setters
 */
function applyTrainerCodeServerAnswer(validationResponse, setters) {
  const responseLooksValid = Boolean(validationResponse && validationResponse.valid);
  const responseHasTrainerId = Boolean(validationResponse && validationResponse.trainerId);
  if (responseLooksValid && responseHasTrainerId) {
    showTrainerCodeAsValid(validationResponse, setters);
    return;
  }

  // Known bad code: shake only — no redundant error sentence (null message).
  showTrainerCodeAsInvalid(setters, null);
}
