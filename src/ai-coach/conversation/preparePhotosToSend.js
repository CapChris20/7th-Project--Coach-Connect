// Coach chat attachments → API-ready image objects ({ type, name, dataUrl }).
// Flow: keep image-like rows (max 3) → resolve each data URL → skip oversize payloads → return array.
// Used by: sendMessageToCoach immediately before the network post. No UI in this file.

import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';

// ===== NAMED CONSTANTS =====

// Manipulate here: more than three images usually blows the coach request size budget.
const MAX_PHOTO_ATTACHMENTS = 3;

// Manipulate here: skip data URLs longer than this so upstream does not reject the body.
const MAX_ACCEPTABLE_DATA_URL_LENGTH = 5_500_000;

const MIME_DEFAULT_JPEG = 'image/jpeg';
const DEFAULT_FILE_NAME = 'photo.jpg';
const ATTACHMENT_KIND_IMAGE = 'image';
const DATA_URL_STARTS_WITH_IMAGE = 'data:image';

// Some pickers embed a fake data-URL header on base64 blobs — strip before we add the real mime.
const REGEX_STRIP_OLD_DATA_URL_HEADER = /^data:[^;]+;base64,/;

// ===== MAIN FUNCTION =====

/**
 * Convert local coach-chat attachments into API image payloads.
 * @param {Array} [attachments]
 * @returns {Promise<Array<{ type: string, name: string, dataUrl: string }>>}
 */
export async function preparePhotosToSendForApi(attachments = []) {
  // 1. Keep only rows that look like images, capped at MAX_PHOTO_ATTACHMENTS.
  const imageRows = filterImageAttachmentsForSend(attachments);

  // 2. Resolve each row to { type, name, dataUrl } or drop it on error / oversize.
  const apiReadyPhotos = [];
  for (const oneAttachment of imageRows) {
    const onePayload = await buildOnePhotoPayloadForApi(oneAttachment);
    if (onePayload) {
      apiReadyPhotos.push(onePayload);
    }
  }

  return apiReadyPhotos;
}

// ===== PLUMBING — skip unless debugging =====

function filterImageAttachmentsForSend(attachments) {
  let list = attachments;
  if (!Array.isArray(attachments)) {
    list = [];
  }

  const imageRows = [];
  for (const oneAttachment of list) {
    if (!rowCountsAsSendableImage(oneAttachment)) {
      continue;
    }
    imageRows.push(oneAttachment);
    if (imageRows.length >= MAX_PHOTO_ATTACHMENTS) {
      break;
    }
  }
  return imageRows;
}

function rowCountsAsSendableImage(attachment) {
  if (!attachment) {
    return false;
  }
  const markedImage = attachment.type === ATTACHMENT_KIND_IMAGE;
  const hasPreview = Boolean(attachment.preview);
  const hasBase64 = Boolean(attachment.base64);
  const hasDataUrl = Boolean(attachment.dataUrl);
  const hasInlineImageData = hasPreview || hasBase64 || hasDataUrl;
  return markedImage || hasInlineImageData;
}

function valueIsImageDataUrl(maybeUrl) {
  return String(maybeUrl).startsWith(DATA_URL_STARTS_WITH_IMAGE);
}

function dataUrlLengthIsWithinLimit(dataUrl) {
  if (!dataUrl) {
    return false;
  }
  return dataUrl.length <= MAX_ACCEPTABLE_DATA_URL_LENGTH;
}

function dataUrlAlreadyOnAttachment(attachment) {
  if (!attachment) {
    return null;
  }

  const fromDataUrlField = attachment.dataUrl;
  if (fromDataUrlField && valueIsImageDataUrl(fromDataUrlField)) {
    return String(fromDataUrlField);
  }

  const fromBase64Field = attachment.base64;
  if (!fromBase64Field) {
    return null;
  }

  if (valueIsImageDataUrl(fromBase64Field)) {
    return String(fromBase64Field);
  }

  const mimeType = attachment.mimeType || MIME_DEFAULT_JPEG;
  const base64BodyOnly = String(fromBase64Field).replace(
    REGEX_STRIP_OLD_DATA_URL_HEADER,
    '',
  );
  return `data:${mimeType};base64,${base64BodyOnly}`;
}

async function readFileUriAsJpegDataUrl(fileUri, mimeType = MIME_DEFAULT_JPEG) {
  if (!fileUri) {
    return null;
  }
  // vocab: EncodingType.Base64 = expo-file-system reads the file as base64 text.
  const base64FromDisk = await readAsStringAsync(fileUri, {
    encoding: EncodingType.Base64,
  });
  if (!base64FromDisk) {
    return null;
  }
  return `data:${mimeType};base64,${base64FromDisk}`;
}

async function resolveFinalDataUrlForAttachment(attachment) {
  let dataUrl = dataUrlAlreadyOnAttachment(attachment);

  if (!dataUrl && attachment.preview) {
    const mimeType = attachment.mimeType || MIME_DEFAULT_JPEG;
    dataUrl = await readFileUriAsJpegDataUrl(attachment.preview, mimeType);
  }

  if (!dataUrl && attachment.uri) {
    const mimeType = attachment.mimeType || MIME_DEFAULT_JPEG;
    dataUrl = await readFileUriAsJpegDataUrl(attachment.uri, mimeType);
  }

  return dataUrl;
}

async function buildOnePhotoPayloadForApi(attachment) {
  try {
    const dataUrl = await resolveFinalDataUrlForAttachment(attachment);
    if (!dataUrlLengthIsWithinLimit(dataUrl)) {
      return null;
    }

    const fileName = attachment.name || DEFAULT_FILE_NAME;
    return {
      type: ATTACHMENT_KIND_IMAGE,
      name: fileName,
      dataUrl,
    };
  } catch (attachmentError) {
    let errorMessage = attachmentError;
    if (attachmentError && attachmentError.message) {
      errorMessage = attachmentError.message;
    }
    console.warn('[preparePhotosToSend] skip attachment:', errorMessage);
    return null;
  }
}
