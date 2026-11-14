// Picks how Coach Connect opens a notes-and-files attachment (native image/video/PDF vs embed URL).
// Flow: classify the row → build a Google or Microsoft embed URL when the in-app WebView cannot use the raw link.
// Used by file gallery and home file popups. Pair with getFileTypeFromItem for icon choice only.
// Read order: constants → numbered mains → helper / PLUMBING at the bottom.

// ===== NAMED CONSTANTS =====

const FILE_TAG_PHOTO = 'photo';
const FILE_TAG_VIDEO = 'video';
const FILE_TAG_PDF = 'pdf';
const FILE_TAG_SPREADSHEET = 'spreadsheet';

// vocab: encodeURIComponent keeps ? and & inside the file URL from breaking the viewer query string.
const GOOGLE_DOCS_VIEWER_PREFIX = 'https://docs.google.com/gview?embedded=true&url=';
const OFFICE_VIEWER_PREFIX = 'https://view.officeapps.live.com/op/embed.aspx?src=';

// ".pdf" then a query string or end of URL — stops "/pdfs/report.docx" from matching as PDF.
const PDF_URL_PATTERN = /\.pdf(\?|$)/i;
// Manipulate here: add extensions to route through Office viewer instead of Google.
const OFFICE_EXTENSION_PATTERN = /\.(doc|docx|ppt|pptx|xls|xlsx|csv)$/i;
const IMAGE_MIME_PREFIX = 'image/';
const VIDEO_MIME_PREFIX = 'video/';
const PDF_EXTENSION = '.pdf';
const DEDUPE_ID_PREFIX = 'id:';
const DEDUPE_LEGACY_PREFIX = 'leg:';
const EMPTY_CREATED_AT_FALLBACK = 0;

// ===== MAIN FUNCTION =====

/**
 * True when the row is a photo (legacy type tag or image MIME).
 * @param {object} file
 * @returns {boolean}
 */
export function isImageFile(file) {
  if (!file) return false;
  if (file.type === FILE_TAG_PHOTO) return true;
  if (!file.mimeType) return false;
  return String(file.mimeType).startsWith(IMAGE_MIME_PREFIX);
}

/**
 * True when the row is a video (legacy type tag or video MIME).
 * @param {object} file
 * @returns {boolean}
 */
export function isVideoFile(file) {
  if (!file) return false;
  if (file.type === FILE_TAG_VIDEO) return true;
  if (!file.mimeType) return false;
  return String(file.mimeType).startsWith(VIDEO_MIME_PREFIX);
}

/**
 * True when the row is a PDF — URL is checked because Storage links often keep .pdf after MIME was lost.
 * @param {object} file
 * @param {string} url
 * @returns {boolean}
 */
export function isPdfFile(file, url) {
  const fileName = fileNameLower(file);
  const mediaType = mediaTypeLower(file);

  if (file && file.type === FILE_TAG_PDF) return true;
  if (fileName.endsWith(PDF_EXTENSION)) return true;
  if (mediaType.includes('pdf')) return true;
  if (url && PDF_URL_PATTERN.test(String(url))) return true;
  return false;
}

/**
 * Google gview URL for a public file; signed URLs may show an error page instead.
 * @param {string} url
 * @returns {string}
 */
export function googleEmbedUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return `${GOOGLE_DOCS_VIEWER_PREFIX}${encodeURIComponent(url)}`;
}

/**
 * Microsoft embed URL — Word and Excel layout often survives better here.
 * @param {string} url
 * @returns {string}
 */
export function officeEmbedUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return `${OFFICE_VIEWER_PREFIX}${encodeURIComponent(url)}`;
}

/**
 * Stable collapse key for live Firestore rows vs cached copies.
 * @param {object} fileItem
 * @returns {string}
 */
export function notesFileDedupeKey(fileItem) {
  if (fileItem && fileItem.id) {
    return `${DEDUPE_ID_PREFIX}${String(fileItem.id)}`;
  }
  return buildLegacyDedupeKey(fileItem);
}

/**
 * WebView URL when the file is not opened as raw image, video, or PDF.
 * Office formats → Microsoft viewer; everything else → Google (PDFs use the PDF viewer + raw URL).
 * @param {object} file
 * @param {string} url
 * @returns {string}
 */
export function getEmbedViewerUri(file, url) {
  // 1. Nothing to embed without a URL.
  if (!url) return '';

  // 2. Name + MIME decide Office vs Google.
  const fileName = fileNameLower(file);
  const mediaType = mediaTypeLower(file);

  // 3. Office formats → Microsoft viewer.
  if (isOfficeFile(file, fileName, mediaType)) {
    return officeEmbedUrl(url);
  }

  // 4. Fallback → Google viewer.
  return googleEmbedUrl(url);
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function fileNameLower(file) {
  if (!file) return '';
  const rawName = file.name || file.title || '';
  return rawName.toLowerCase();
}

function mediaTypeLower(file) {
  if (!file || !file.mimeType) return '';
  return String(file.mimeType).toLowerCase();
}

function mediaTypeLooksLikeOffice(mediaType) {
  if (mediaType.includes('spreadsheet')) return true;
  if (mediaType.includes('word')) return true;
  if (mediaType.includes('officedocument')) return true;
  if (mediaType.includes('msword')) return true;
  return false;
}

function isOfficeFile(file, fileName, mediaType) {
  if (OFFICE_EXTENSION_PATTERN.test(fileName)) return true;
  if (file && file.type === FILE_TAG_SPREADSHEET) return true;
  return mediaTypeLooksLikeOffice(mediaType);
}

function createdAtToMilliseconds(createdAt) {
  try {
    if (createdAt && typeof createdAt.toDate === 'function') {
      return createdAt.toDate().getTime();
    }
    if (createdAt instanceof Date) {
      return createdAt.getTime();
    }
    return new Date(createdAt || EMPTY_CREATED_AT_FALLBACK).getTime();
  } catch {
    return EMPTY_CREATED_AT_FALLBACK;
  }
}

function buildLegacyDedupeKey(fileItem) {
  const createdAtMilliseconds = createdAtToMilliseconds(fileItem && fileItem.createdAt);
  const fileType = (fileItem && fileItem.type) || '';
  const fileUrl = (fileItem && fileItem.url) || '';
  const fileName = (fileItem && (fileItem.name || fileItem.title)) || '';
  return `${DEDUPE_LEGACY_PREFIX}${fileType}|${fileUrl}|${createdAtMilliseconds}|${fileName}`;
}
