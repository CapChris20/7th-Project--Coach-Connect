// Ask the server to check a trainer certificate photo with the coach model.
// Flow: reject non-images → read local base64 → POST /api/trainer/verify-certification
// on each cloud base until one accepts → map the status to a label, detail, and tone.
// Used by My Profile after a certificate is uploaded.

import { auth } from '../../app-start/cloudConnection';
import { getResilientApiBases, isCloudHostedApiBase } from './whereToConnect';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';

// ===== NAMED CONSTANTS =====

const VERIFY_CERTIFICATION_PATH = '/api/trainer/verify-certification';

// Manipulate here: certificate images are large and the check is slow. 90 seconds, then we time out.
const CERTIFICATION_TIMEOUT_MS = 90000;

const DEFAULT_CERTIFICATE_MIME_TYPE = 'image/jpeg';

const STATUS_APPROVED = 'approved';
const STATUS_AUTO_APPROVED = 'auto_approved';
const STATUS_MANUAL_REVIEW = 'manual_review';
const STATUS_UNDER_REVIEW = 'under_review';
const STATUS_REJECTED = 'rejected';
const STATUS_CHECKING = 'checking';
const STATUS_VERIFYING = 'verifying';

const TONE_SUCCESS = 'success';
const TONE_DANGER = 'danger';
const TONE_PENDING = 'pending';
const TONE_MUTED = 'muted';

const LABEL_VERIFIED = 'Certification verified ✓';
const LABEL_UNDER_REVIEW = 'Under review';
const LABEL_REJECTED = 'Rejected';
const LABEL_CHECKING = 'AI is checking…';

const DETAIL_APPROVED = 'You’re good — AI confirmed this certificate.';
const DETAIL_UNDER_REVIEW = 'Usually reviewed within 24–48 hours. This status will update when it’s done.';
const DETAIL_REJECTED = 'Upload a clearer photo of your certificate to try again.';
const DETAIL_CHECKING = 'Usually finishes in under a minute.';

const NON_IMAGE_ERROR =
  'AI verification requires a JPEG or PNG image of the certificate. Your file was still uploaded for manual review.';
const UNREADABLE_IMAGE_ERROR = 'Could not read image for AI verification.';

// ===== HELPER FUNCTIONS =====

function normalizedStatus(status) {
  return String(status || '').toLowerCase();
}

// The server uses two strings for the same outcome. Callers shouldn't have to remember both.
function isApprovedStatus(status) {
  const normalized = normalizedStatus(status);
  return normalized === STATUS_APPROVED || normalized === STATUS_AUTO_APPROVED;
}

function isUnderReviewStatus(status) {
  const normalized = normalizedStatus(status);
  return normalized === STATUS_MANUAL_REVIEW || normalized === STATUS_UNDER_REVIEW;
}

function isCheckingStatus(status) {
  const normalized = normalizedStatus(status);
  return normalized === STATUS_CHECKING || normalized === STATUS_VERIFYING;
}

function isRejectedStatus(status) {
  return normalizedStatus(status) === STATUS_REJECTED;
}

// Empty mime still counts as an image: the upload screen doesn't always know the type yet.
function isNonImageMimeType(mimeType) {
  return Boolean(mimeType) && !mimeType.startsWith('image/');
}

function isImageOrUnknownMimeType(mimeType) {
  return !mimeType || mimeType.startsWith('image/');
}

function manualReviewSkip(errorMessage) {
  return {
    success: false,
    skipped: true,
    status: STATUS_MANUAL_REVIEW,
    userMessage: LABEL_UNDER_REVIEW,
    error: errorMessage,
  };
}

async function requireSignedInIdToken() {
  const currentUser = auth?.currentUser;
  if (!currentUser) throw new Error('Please log in first.');
  // vocab: getIdToken(true) forces a fresh Firebase token. true means don't reuse the cache.
  return currentUser.getIdToken(true);
}

// Prefer bases that are actually hosted. If none qualify, keep the first resilient base
// so a local dev server can still answer.
function cloudHostedApiBases() {
  const hostedBases = getResilientApiBases().filter(isCloudHostedApiBase);
  if (hostedBases.length) return hostedBases;
  return getResilientApiBases().slice(0, 1);
}

function successfulVerification(data) {
  return {
    success: true,
    status: data.status,
    userMessage: data.userMessage || certificationStatusLabel(data.status),
    isVerified: data.isVerified === true,
    analysis: data.analysis,
    aiVerification: data.aiVerification,
  };
}

// Does not throw. A failure comes back as error so the caller can try the next base.
async function requestCertificationVerification(baseUrl, idToken, requestBody) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CERTIFICATION_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}${VERIFY_CERTIFICATION_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { error: new Error(data?.error || `HTTP ${response.status}`) };
    }
    return { result: successfulVerification(data) };
  } catch (error) {
    clearTimeout(timeoutId);
    const timeoutOrNetworkError =
      error?.name === 'AbortError' ? new Error('Verification timed out') : error;
    return { error: timeoutOrNetworkError };
  }
}

// ===== MAIN FUNCTION =====

/**
 * Short label for a certification status, or null when the status is unknown.
 * @param {string} status
 * @returns {string|null}
 */
export function certificationStatusLabel(status) {
  if (isApprovedStatus(status)) return LABEL_VERIFIED;
  if (isUnderReviewStatus(status)) return LABEL_UNDER_REVIEW;
  if (isRejectedStatus(status)) return LABEL_REJECTED;
  if (isCheckingStatus(status)) return LABEL_CHECKING;
  return null;
}

/**
 * Extra line under the status (how long it takes, or what to do next).
 * @param {string} status
 * @returns {string|null}
 */
export function certificationStatusDetail(status) {
  if (isApprovedStatus(status)) return DETAIL_APPROVED;
  if (isUnderReviewStatus(status)) return DETAIL_UNDER_REVIEW;
  if (isRejectedStatus(status)) return DETAIL_REJECTED;
  if (isCheckingStatus(status)) return DETAIL_CHECKING;
  return null;
}

/**
 * Color tone for the status line: success, danger, pending, or muted.
 * @param {string} status
 * @returns {'success'|'danger'|'pending'|'muted'}
 */
export function certificationStatusTone(status) {
  if (isApprovedStatus(status)) return TONE_SUCCESS;
  if (isRejectedStatus(status)) return TONE_DANGER;
  if (isCheckingStatus(status)) return TONE_PENDING;
  if (isUnderReviewStatus(status)) return TONE_PENDING;
  return TONE_MUTED;
}

/**
 * Read a local image file as base64 text.
 * @param {string} localUri
 * @returns {Promise<string|null>}
 */
export async function localImageUriToBase64(localUri) {
  if (!localUri) return null;
  // vocab: EncodingType.Base64 reads the file as text-safe base64, not raw bytes.
  return readAsStringAsync(localUri, { encoding: EncodingType.Base64 });
}

/**
 * Send a certificate image to the verify route. Non-images and unreadable files
 * come back as a manual-review skip instead of a thrown error — the file is already uploaded.
 * @param {{
 *   trainerName: string,
 *   imageUrl?: string,
 *   localUri?: string,
 *   mediaType?: string,
 *   storagePath?: string,
 *   fileName?: string,
 *   trainerId?: string,
 * }} [options]
 * @returns {Promise<object>}
 */
export async function checkTrainerCertificate(options = {}) {
  const {
    trainerName,
    imageUrl,
    localUri,
    mediaType,
    storagePath,
    fileName,
    trainerId,
  } = options;

  const mimeType = String(mediaType || '').toLowerCase();
  if (isNonImageMimeType(mimeType)) {
    return manualReviewSkip(NON_IMAGE_ERROR);
  }

  let imageBase64 = null;
  if (localUri && isImageOrUnknownMimeType(mimeType)) {
    try {
      imageBase64 = await localImageUriToBase64(localUri);
    } catch (error) {
      if (__DEV__) console.warn('cert base64 read failed:', error?.message || error);
    }
  }

  if (!imageBase64 && !imageUrl) {
    return manualReviewSkip(UNREADABLE_IMAGE_ERROR);
  }

  const idToken = await requireSignedInIdToken();
  // Send base64 when we have it, and only then omit imageUrl. The server should see one source.
  // mediaType keeps the caller's original spelling; the lowercase copy was only for the image/ check.
  const requestBody = {
    trainerId: trainerId || auth?.currentUser?.uid || undefined,
    trainerName,
    imageBase64,
    imageUrl: imageBase64 ? undefined : imageUrl,
    mediaType: mediaType || DEFAULT_CERTIFICATE_MIME_TYPE,
    storagePath,
    fileName,
  };

  let lastError = null;
  for (const baseUrl of cloudHostedApiBases()) {
    const outcome = await requestCertificationVerification(baseUrl, idToken, requestBody);
    if (outcome.result) return outcome.result;
    lastError = outcome.error;
  }

  throw lastError || new Error('Certification verification failed');
}
