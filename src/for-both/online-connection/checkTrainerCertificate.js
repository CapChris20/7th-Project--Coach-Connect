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
const LOGIN_REQUIRED_ERROR = 'Please log in first.';
const VERIFICATION_TIMEOUT_ERROR = 'Verification timed out';
const VERIFICATION_FAILED_ERROR = 'Certification verification failed';

// ===== HELPER FUNCTIONS =====

/**
 * Short label for a certificate status string from the server.
 * @param {string} status
 * @returns {string|null}
 */
export function certificationStatusLabel(status) {
  if (certificateStatusMeansApproved(status)) {
    return LABEL_VERIFIED;
  }
  if (certificateStatusMeansUnderReview(status)) {
    return LABEL_UNDER_REVIEW;
  }
  if (certificateStatusMeansRejected(status)) {
    return LABEL_REJECTED;
  }
  if (certificateStatusMeansStillChecking(status)) {
    return LABEL_CHECKING;
  }
  return null;
}

/**
 * Longer detail line under the status label.
 * @param {string} status
 * @returns {string|null}
 */
export function certificationStatusDetail(status) {
  if (certificateStatusMeansApproved(status)) {
    return DETAIL_APPROVED;
  }
  if (certificateStatusMeansUnderReview(status)) {
    return DETAIL_UNDER_REVIEW;
  }
  if (certificateStatusMeansRejected(status)) {
    return DETAIL_REJECTED;
  }
  if (certificateStatusMeansStillChecking(status)) {
    return DETAIL_CHECKING;
  }
  return null;
}

/**
 * Tone key for chips / banners (success, danger, pending, muted).
 * @param {string} status
 * @returns {string}
 */
export function certificationStatusTone(status) {
  if (certificateStatusMeansApproved(status)) {
    return TONE_SUCCESS;
  }
  if (certificateStatusMeansRejected(status)) {
    return TONE_DANGER;
  }
  if (certificateStatusMeansStillChecking(status)) {
    return TONE_PENDING;
  }
  if (certificateStatusMeansUnderReview(status)) {
    return TONE_PENDING;
  }
  return TONE_MUTED;
}

/**
 * Read a local image URI as base64 text for the verify POST body.
 * @param {string} localUri
 * @returns {Promise<string|null>}
 */
export async function localImageUriToBase64(localUri) {
  if (!localUri) {
    return null;
  }
  // vocab: EncodingType.Base64 reads the file as text-safe base64, not raw bytes.
  return readAsStringAsync(localUri, { encoding: EncodingType.Base64 });
}

// ===== MAIN FUNCTION =====

/**
 * Ask the cloud API to AI-check a trainer certificate photo.
 * @param {object} [options]
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

  const mimeTypeLowercase = String(mediaType || '').toLowerCase();

  // 1. PDFs and other non-images skip AI. The file is already uploaded for a human.
  const fileIsDefinitelyNotAnImage =
    Boolean(mimeTypeLowercase) && !mimeTypeLowercase.startsWith('image/');
  if (fileIsDefinitelyNotAnImage) {
    return skipAiAndLeaveForManualReview(NON_IMAGE_ERROR);
  }

  // 2. Read the local photo. No bytes and no hosted URL → skip the same way.
  const imageBase64 = await tryReadCertificateFileAsBase64(localUri, mimeTypeLowercase);
  if (!imageBase64 && !imageUrl) {
    return skipAiAndLeaveForManualReview(UNREADABLE_IMAGE_ERROR);
  }

  // 3. Fresh login token — the verify route rejects a stale one.
  const idToken = await fetchFreshFirebaseIdToken();

  // 4. One body: base64 when we have it, otherwise the hosted URL.
  const requestBody = buildCertificationVerifyBody({
    trainerId,
    trainerName,
    imageBase64,
    imageUrl,
    mediaType,
    storagePath,
    fileName,
  });

  // 5. Try each cloud API base until one accepts.
  return verifyCertificateOnFirstAcceptingBase(idToken, requestBody);
}

// ===== PLUMBING — skip unless debugging =====

function lowercaseCertificateStatus(status) {
  return String(status || '').toLowerCase();
}

function certificateStatusMeansApproved(status) {
  const normalized = lowercaseCertificateStatus(status);
  if (normalized === STATUS_APPROVED) {
    return true;
  }
  if (normalized === STATUS_AUTO_APPROVED) {
    return true;
  }
  return false;
}

function certificateStatusMeansUnderReview(status) {
  const normalized = lowercaseCertificateStatus(status);
  if (normalized === STATUS_MANUAL_REVIEW) {
    return true;
  }
  if (normalized === STATUS_UNDER_REVIEW) {
    return true;
  }
  return false;
}

function certificateStatusMeansStillChecking(status) {
  const normalized = lowercaseCertificateStatus(status);
  if (normalized === STATUS_CHECKING) {
    return true;
  }
  if (normalized === STATUS_VERIFYING) {
    return true;
  }
  return false;
}

function certificateStatusMeansRejected(status) {
  return lowercaseCertificateStatus(status) === STATUS_REJECTED;
}

function mimeTypeIsImageOrUnknown(mimeType) {
  // Empty mime still counts as an image: the upload screen doesn't always know the type yet.
  if (!mimeType) {
    return true;
  }
  return mimeType.startsWith('image/');
}

function skipAiAndLeaveForManualReview(errorMessage) {
  return {
    success: false,
    skipped: true,
    status: STATUS_MANUAL_REVIEW,
    userMessage: LABEL_UNDER_REVIEW,
    error: errorMessage,
  };
}

async function fetchFreshFirebaseIdToken() {
  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new Error(LOGIN_REQUIRED_ERROR);
  }
  // vocab: getIdToken(true) forces a fresh Firebase token. true means don't reuse the cache.
  return currentUser.getIdToken(true);
}

function cloudHostedApiBaseUrls() {
  const allBases = getResilientApiBases();
  const hostedBases = [];
  for (let baseIndex = 0; baseIndex < allBases.length; baseIndex += 1) {
    const baseUrl = allBases[baseIndex];
    if (isCloudHostedApiBase(baseUrl)) {
      hostedBases.push(baseUrl);
    }
  }
  if (hostedBases.length) {
    return hostedBases;
  }
  return allBases.slice(0, 1);
}

function mapServerPayloadToSuccessResult(data) {
  return {
    success: true,
    status: data.status,
    userMessage: data.userMessage || certificationStatusLabel(data.status),
    isVerified: data.isVerified === true,
    analysis: data.analysis,
    aiVerification: data.aiVerification,
  };
}

function httpFailureError(data, statusCode) {
  return new Error(data?.error || `HTTP ${statusCode}`);
}

function normalizeTimeoutOrNetworkError(error) {
  if (error?.name === 'AbortError') {
    return new Error(VERIFICATION_TIMEOUT_ERROR);
  }
  return error;
}

async function parseResponseJsonOrEmptyObject(response) {
  try {
    return await response.json();
  } catch (ignoredError) {
    return {};
  }
}

async function postCertificationVerifyToBase(baseUrl, idToken, requestBody) {
  // vocab: AbortController = cancel the fetch when the timeout fires
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
    const data = await parseResponseJsonOrEmptyObject(response);
    if (!response.ok) {
      return { error: httpFailureError(data, response.status) };
    }
    return { result: mapServerPayloadToSuccessResult(data) };
  } catch (error) {
    clearTimeout(timeoutId);
    return { error: normalizeTimeoutOrNetworkError(error) };
  }
}

async function tryReadCertificateFileAsBase64(localUri, mimeType) {
  const shouldReadFromDisk = localUri && mimeTypeIsImageOrUnknown(mimeType);
  if (!shouldReadFromDisk) {
    return null;
  }
  try {
    return await localImageUriToBase64(localUri);
  } catch (readError) {
    if (__DEV__) {
      console.warn('cert base64 read failed:', readError?.message || readError);
    }
    return null;
  }
}

function buildCertificationVerifyBody({
  trainerId,
  trainerName,
  imageBase64,
  imageUrl,
  mediaType,
  storagePath,
  fileName,
}) {
  // Send base64 when we have it, and only then omit imageUrl. The server should see one source.
  const trainerIdOrCurrentUser = trainerId || auth?.currentUser?.uid || undefined;
  const imageUrlWhenNoBase64 = imageBase64 ? undefined : imageUrl;
  const mediaTypeOrJpegDefault = mediaType || DEFAULT_CERTIFICATE_MIME_TYPE;

  return {
    trainerId: trainerIdOrCurrentUser,
    trainerName,
    imageBase64,
    imageUrl: imageUrlWhenNoBase64,
    mediaType: mediaTypeOrJpegDefault,
    storagePath,
    fileName,
  };
}

async function verifyCertificateOnFirstAcceptingBase(idToken, requestBody) {
  let lastError = null;
  const baseUrls = cloudHostedApiBaseUrls();
  for (let baseIndex = 0; baseIndex < baseUrls.length; baseIndex += 1) {
    const baseUrl = baseUrls[baseIndex];
    const outcome = await postCertificationVerifyToBase(baseUrl, idToken, requestBody);
    if (outcome.result) {
      return outcome.result;
    }
    lastError = outcome.error;
  }
  throw lastError || new Error(VERIFICATION_FAILED_ERROR);
}
