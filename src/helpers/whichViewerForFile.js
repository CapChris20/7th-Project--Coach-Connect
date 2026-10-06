// Decides how to open a notes-and-files attachment inside the app, instead of handing it to the browser.
// Flow: image, video, and PDF checks pick a native viewer → everything else becomes a Google or Office embed URL.
// Used by the file gallery and the home file popups. Pair this with getFileTypeFromItem, which only picks the icon.

// ===== NAMED CONSTANTS =====

const FILE_TAG_PHOTO = 'photo';
const FILE_TAG_VIDEO = 'video';
const FILE_TAG_PDF = 'pdf';
const FILE_TAG_SPREADSHEET = 'spreadsheet';

// vocab: encodeURIComponent escapes ? and & inside the file URL so they don't break the viewer URL.
const GOOGLE_DOCS_VIEWER_PREFIX = 'https://docs.google.com/gview?embedded=true&url=';
const OFFICE_VIEWER_PREFIX = 'https://view.officeapps.live.com/op/embed.aspx?src=';

// ".pdf" then a query string or the end of the URL. The (\\?|$) part stops "/pdfs/report.docx" from matching.
const PDF_URL_PATTERN = /\.pdf(\?|$)/i;
// Manipulate here: add an extension to send that format to the Office viewer instead of Google's.
const OFFICE_EXTENSION_PATTERN = /\.(doc|docx|ppt|pptx|xls|xlsx|csv)$/i;

// ===== HELPER FUNCTIONS =====

function fileNameLower(file) {
  return (file?.name || file?.title || '').toLowerCase();
}

function mediaTypeLower(file) {
  if (!file?.mimeType) return '';
  return String(file.mimeType).toLowerCase();
}

// Office MIME types vary by uploader, so the extension, our tag, and several MIME fragments all count.
function isOfficeFile(file, fileName, mediaType) {
  if (OFFICE_EXTENSION_PATTERN.test(fileName)) return true;
  if (file?.type === FILE_TAG_SPREADSHEET) return true;
  if (mediaType.includes('spreadsheet')) return true;
  if (mediaType.includes('word')) return true;
  if (mediaType.includes('officedocument')) return true;
  if (mediaType.includes('msword')) return true;
  return false;
}

// Firestore Timestamp objects compare by reference, so two copies of one file would never dedupe
// if the raw Timestamp were part of the key. Collapse every time shape to a number first.
function createdAtToMilliseconds(createdAt) {
  try {
    if (createdAt && typeof createdAt.toDate === 'function') return createdAt.toDate().getTime();
    if (createdAt instanceof Date) return createdAt.getTime();
    return new Date(createdAt || 0).getTime();
  } catch (_) {
    // An unreadable date becomes 0 so two copies of the same broken row still collapse together.
    return 0;
  }
}

// ===== MAIN FUNCTION =====

/**
 * True when the row is a photo. Older rows use type "photo". Newer rows use an image MIME type.
 * @param {object} file
 * @returns {boolean}
 */
export function isImageFile(file) {
  if (!file) return false;
  if (file.type === FILE_TAG_PHOTO) return true;
  if (file.mimeType && String(file.mimeType).startsWith('image/')) return true;
  return false;
}

/**
 * True when the row is a video.
 * @param {object} file
 * @returns {boolean}
 */
export function isVideoFile(file) {
  if (!file) return false;
  if (file.type === FILE_TAG_VIDEO) return true;
  if (file.mimeType && String(file.mimeType).startsWith('video/')) return true;
  return false;
}

/**
 * True when the row is a PDF. The URL is checked too, because Storage links often keep the extension
 * after the saved MIME type was lost.
 * @param {object} file
 * @param {string} [url]
 * @returns {boolean}
 */
export function isPdfFile(file, url) {
  const fileName = fileNameLower(file);
  const mediaType = mediaTypeLower(file);
  if (file?.type === FILE_TAG_PDF) return true;
  if (fileName.endsWith('.pdf')) return true;
  if (mediaType.includes('pdf')) return true;
  if (url && PDF_URL_PATTERN.test(String(url))) return true;
  return false;
}

/**
 * Google's viewer. It renders a public file as HTML a WebView can show.
 * A signed or expiring URL often comes back as an error page.
 * @param {string} url
 * @returns {string}
 */
export function googleEmbedUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return `${GOOGLE_DOCS_VIEWER_PREFIX}${encodeURIComponent(url)}`;
}

/**
 * Microsoft's viewer. Word and Excel layout survives here better than in Google's viewer.
 * @param {string} url
 * @returns {string}
 */
export function officeEmbedUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return `${OFFICE_VIEWER_PREFIX}${encodeURIComponent(url)}`;
}

/**
 * Stable key for a notes-and-files row so a live doc and its cached copy collapse into one.
 * A real id wins. Without one, the key is type + url + time + name.
 * @param {object} fileItem
 * @returns {string}
 */
export function notesFileDedupeKey(fileItem) {
  if (fileItem?.id) return `id:${String(fileItem.id)}`;

  const createdAtMilliseconds = createdAtToMilliseconds(fileItem?.createdAt);
  const fileType = fileItem?.type || '';
  const fileUrl = fileItem?.url || '';
  const fileName = fileItem?.name || fileItem?.title || '';
  // "leg:" marks the fingerprint form so it can never collide with an id key.
  return `leg:${fileType}|${fileUrl}|${createdAtMilliseconds}|${fileName}`;
}

/**
 * WebView URL for a file that is not an image, video, or PDF.
 * Office formats go to Microsoft. Everything else goes to Google.
 * PDFs should use the PDF viewer with the raw URL instead of this.
 * @param {object} file
 * @param {string} url
 * @returns {string}
 */
export function getEmbedViewerUri(file, url) {
  if (!url) return '';
  const fileName = fileNameLower(file);
  const mediaType = mediaTypeLower(file);
  if (isOfficeFile(file, fileName, mediaType)) return officeEmbedUrl(url);
  return googleEmbedUrl(url);
}
