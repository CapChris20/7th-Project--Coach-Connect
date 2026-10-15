// Turn local coach-chat photos into the base64 data URLs the coach API accepts.
// Flow: keep the first image-like attachments → reuse a data URL if we have one →
// otherwise read the file → drop anything too large.
// Used by: sendMessageToCoach before the message is posted.

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

// ===== MAIN FUNCTION =====

/**
 * Convert local coach chat attachments into API image payloads.
 * @param {Array<{id?: string, preview?: string, uri?: string, base64?: string, dataUrl?: string, name?: string, type?: string, mimeType?: string}>} [attachments]
 * @returns {Promise<Array<{ type: 'image', name: string, dataUrl: string }>>}
 */
export async function preparePhotosToSendForApi(attachments = []) {
  const imageAttachments = imageAttachmentsToSend(attachments);
  const readyImages = [];

  for (const attachment of imageAttachments) {
    const photoPayload = await photoPayloadFromAttachment(attachment);
    if (photoPayload) readyImages.push(photoPayload);
  }

  return readyImages;
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function isImageDataUrl(value) {
  return String(value).startsWith(IMAGE_DATA_URL_PREFIX);
}

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

async function readFileAsDataUrl(fileUri, mimeType = DEFAULT_IMAGE_MIME_TYPE) {
  if (!fileUri) return null;
  // vocab: EncodingType.Base64 reads the file as text-safe base64, not raw bytes.
  const base64 = await readAsStringAsync(fileUri, { encoding: EncodingType.Base64 });
  if (!base64) return null;
  return `data:${mimeType};base64,${base64}`;
}

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

async function resolveDataUrlForAttachment(attachment) {
  let dataUrl = dataUrlFromAttachment(attachment);
  if (!dataUrl && attachment.preview) {
    dataUrl = await readFileAsDataUrl(attachment.preview, attachment.mimeType || DEFAULT_IMAGE_MIME_TYPE);
  }
  if (!dataUrl && attachment.uri) {
    dataUrl = await readFileAsDataUrl(attachment.uri, attachment.mimeType || DEFAULT_IMAGE_MIME_TYPE);
  }
  return dataUrl;
}

function imageAttachmentsToSend(attachments) {
  const attachmentList = Array.isArray(attachments) ? attachments : [];
  return attachmentList.filter(isSendableImageAttachment).slice(0, MAX_IMAGES);
}

async function photoPayloadFromAttachment(attachment) {
  try {
    const dataUrl = await resolveDataUrlForAttachment(attachment);
    if (!isDataUrlSmallEnoughToSend(dataUrl)) return null;
    return {
      type: IMAGE_ATTACHMENT_TYPE,
      name: attachment.name || DEFAULT_PHOTO_NAME,
      dataUrl,
    };
  } catch (attachmentError) {
    console.warn('[preparePhotosToSend] skip attachment:', attachmentError?.message || attachmentError);
    return null;
  }
}
