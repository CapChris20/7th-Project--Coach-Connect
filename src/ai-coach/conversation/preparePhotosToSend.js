// Turn local coach-chat photos into the base64 data URLs the coach API accepts.
// Flow: keep the first image-like attachments → reuse a data URL if we have one →
// otherwise read the file → drop anything too large.
// Used by sendMessageToCoach before the message is posted.

import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';

// ===== NAMED CONSTANTS =====

// Manipulate here: more than three images makes the coach request too large.
const MAX_IMAGES = 3;

// Manipulate here: data URLs longer than this are skipped so the request doesn't fail upstream.
const MAX_DATA_URL_CHARS = 5_500_000;

const DEFAULT_IMAGE_MIME_TYPE = 'image/jpeg';
const DEFAULT_PHOTO_NAME = 'photo.jpg';
const IMAGE_ATTACHMENT_TYPE = 'image';
const IMAGE_DATA_URL_PREFIX = 'data:image';

// Some pickers hand us base64 that already includes a data-URL header for a non-image type.
// Strip that header before we add the real mime, so we don't end up with two headers.
const EXISTING_DATA_URL_HEADER = /^data:[^;]+;base64,/;

// ===== HELPER FUNCTIONS =====

function isImageDataUrl(value) {
  return String(value).startsWith(IMAGE_DATA_URL_PREFIX);
}

// A library photo, a camera photo, and a re-encoded photo don't arrive in the same shape.
// This is the check that accepts all three: already a data URL, raw base64, or base64 with a header.
function dataUrlFromAttachment(attachment) {
  if (attachment?.dataUrl && isImageDataUrl(attachment.dataUrl)) {
    return String(attachment.dataUrl);
  }
  const rawBase64 = attachment?.base64;
  if (!rawBase64) return null;
  if (isImageDataUrl(rawBase64)) return String(rawBase64);
  const mimeType = attachment?.mimeType || DEFAULT_IMAGE_MIME_TYPE;
  const base64Payload = String(rawBase64).replace(EXISTING_DATA_URL_HEADER, '');
  return `data:${mimeType};base64,${base64Payload}`;
}

// Files picked on device often have a preview uri and no base64 yet. Read those here.
async function readFileAsDataUrl(fileUri, mimeType = DEFAULT_IMAGE_MIME_TYPE) {
  if (!fileUri) return null;
  // vocab: EncodingType.Base64 reads the file as text-safe base64, not raw bytes.
  const base64 = await readAsStringAsync(fileUri, { encoding: EncodingType.Base64 });
  if (!base64) return null;
  return `data:${mimeType};base64,${base64}`;
}

// type 'image' is the chat's own label. preview / base64 / dataUrl cover older attachments
// that were saved before that label existed.
function isSendableImageAttachment(attachment) {
  if (!attachment) return false;
  const isMarkedAsImage = attachment.type === IMAGE_ATTACHMENT_TYPE;
  const hasImagePayload = Boolean(attachment.preview || attachment.base64 || attachment.dataUrl);
  return isMarkedAsImage || hasImagePayload;
}

function isDataUrlSmallEnoughToSend(dataUrl) {
  if (!dataUrl) return false;
  return dataUrl.length <= MAX_DATA_URL_CHARS;
}

function imageAttachmentsToSend(attachments) {
  const attachmentList = Array.isArray(attachments) ? attachments : [];
  return attachmentList.filter(isSendableImageAttachment).slice(0, MAX_IMAGES);
}

// ===== MAIN FUNCTION =====

/**
 * Convert local coach chat attachments into API image payloads.
 * @param {Array<{id?: string, preview?: string, uri?: string, base64?: string, dataUrl?: string, name?: string, type?: string, mimeType?: string}>} [attachments]
 * @returns {Promise<Array<{ type: 'image', name: string, dataUrl: string }>>}
 */
export async function preparePhotosToSendForApi(attachments = []) {
  const candidates = imageAttachmentsToSend(attachments);
  const readyImages = [];

  for (const attachment of candidates) {
    try {
      // Prefer bytes we already have. Reading the file is the fallback when the picker
      // only left a local path (preview first, then uri).
      let dataUrl = dataUrlFromAttachment(attachment);
      if (!dataUrl && attachment.preview) {
        dataUrl = await readFileAsDataUrl(attachment.preview, attachment.mimeType || DEFAULT_IMAGE_MIME_TYPE);
      }
      if (!dataUrl && attachment.uri) {
        dataUrl = await readFileAsDataUrl(attachment.uri, attachment.mimeType || DEFAULT_IMAGE_MIME_TYPE);
      }
      if (!isDataUrlSmallEnoughToSend(dataUrl)) continue;

      readyImages.push({
        type: IMAGE_ATTACHMENT_TYPE,
        name: attachment.name || DEFAULT_PHOTO_NAME,
        dataUrl,
      });
    } catch (error) {
      // One bad file should not drop the rest of the message.
      console.warn('[preparePhotosToSend] skip attachment:', error?.message || error);
    }
  }

  return readyImages;
}
