/**
 * Client helper: Claude AI certification verification after upload.
 *
 * Purpose: Call server /api/trainer/verify-certification with image base64 or URL.
 * Area: src/shared
 * Key exports: verifyTrainerCertification, certificationStatusLabel
 *
 * @file-header
 */
import { auth } from '../../app-start/config';
import { getResilientApiBases, isCloudHostedApiBase } from './baseUrl';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';

async function getIdToken() {
  const user = auth?.currentUser;
  if (!user) throw new Error('Please log in first.');
  return user.getIdToken(true);
}

function apiBases() {
  const bases = getResilientApiBases().filter(isCloudHostedApiBase);
  return bases.length ? bases : getResilientApiBases().slice(0, 1);
}

export function certificationStatusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'approved' || s === 'auto_approved') return 'Certification verified ✓';
  if (s === 'manual_review' || s === 'under_review') return 'Under review';
  if (s === 'rejected') return 'Rejected';
  if (s === 'checking' || s === 'verifying') return 'AI is checking…';
  return null;
}

/** Extra copy under the status line (ETA / next step). */
export function certificationStatusDetail(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'approved' || s === 'auto_approved') {
    return 'You’re good — AI confirmed this certificate.';
  }
  if (s === 'manual_review' || s === 'under_review') {
    return 'Usually reviewed within 24–48 hours. This status will update when it’s done.';
  }
  if (s === 'rejected') {
    return 'Upload a clearer photo of your certificate to try again.';
  }
  if (s === 'checking' || s === 'verifying') {
    return 'Usually finishes in under a minute.';
  }
  return null;
}

export function certificationStatusTone(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'approved' || s === 'auto_approved') return 'success';
  if (s === 'rejected') return 'danger';
  if (s === 'checking' || s === 'verifying') return 'pending';
  if (s === 'manual_review' || s === 'under_review') return 'pending';
  return 'muted';
}

export async function localImageUriToBase64(localUri) {
  if (!localUri) return null;
  return readAsStringAsync(localUri, { encoding: EncodingType.Base64 });
}

/**
 * @param {{
 *   trainerName: string,
 *   imageUrl?: string,
 *   localUri?: string,
 *   mediaType?: string,
 *   storagePath?: string,
 *   fileName?: string,
 *   trainerId?: string,
 * }} opts
 */
export async function verifyTrainerCertification(opts = {}) {
  const {
    trainerName,
    imageUrl,
    localUri,
    mediaType,
    storagePath,
    fileName,
    trainerId,
  } = opts;

  const mime = String(mediaType || '').toLowerCase();
  if (mime && !mime.startsWith('image/')) {
    return {
      success: false,
      skipped: true,
      status: 'manual_review',
      userMessage: 'Under review',
      error: 'AI verification requires a JPEG or PNG image of the certificate. Your file was still uploaded for manual review.',
    };
  }

  let imageBase64 = null;
  if (localUri && (!mime || mime.startsWith('image/'))) {
    try {
      imageBase64 = await localImageUriToBase64(localUri);
    } catch (e) {
      if (__DEV__) console.warn('cert base64 read failed:', e?.message || e);
    }
  }

  if (!imageBase64 && !imageUrl) {
    return {
      success: false,
      skipped: true,
      status: 'manual_review',
      userMessage: 'Under review',
      error: 'Could not read image for AI verification.',
    };
  }

  const token = await getIdToken();
  const bases = apiBases();
  let lastError = null;

  for (const base of bases) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    try {
      const res = await fetch(`${base}/api/trainer/verify-certification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          trainerId: trainerId || auth?.currentUser?.uid || undefined,
          trainerName,
          imageBase64,
          imageUrl: imageBase64 ? undefined : imageUrl,
          mediaType: mediaType || 'image/jpeg',
          storagePath,
          fileName,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastError = new Error(data?.error || `HTTP ${res.status}`);
        continue;
      }
      return {
        success: true,
        status: data.status,
        userMessage: data.userMessage || certificationStatusLabel(data.status),
        isVerified: data.isVerified === true,
        analysis: data.analysis,
        aiVerification: data.aiVerification,
      };
    } catch (e) {
      clearTimeout(timeoutId);
      lastError = e?.name === 'AbortError' ? new Error('Verification timed out') : e;
    }
  }

  throw lastError || new Error('Certification verification failed');
}
