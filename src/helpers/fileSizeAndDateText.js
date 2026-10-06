// Turns a raw file record into text and a type the notes list can render.
// Flow: size in bytes → short date → type from tag, media type, or extension → a title that hides the raw filename.
// Used by the file cards and the notes sections. Users never see "a3f1c2....jpg".

// ===== NAMED CONSTANTS =====

const MISSING_SIZE_LABEL = '—';
// Manipulate here: unit labels. The math is 1024-based (the same split Finder uses) even though the labels say KB.
const BYTE_UNIT_LABELS = ['B', 'KB', 'MB', 'GB', 'TB'];
const BYTES_PER_UNIT = 1024;
const SMALL_SIZE_DECIMAL_PLACES = 2;
const LARGE_SIZE_DECIMAL_PLACES = 1;
const LARGE_SIZE_CUTOFF = 10;

const FILE_TYPE_IMAGE = 'image';
const FILE_TYPE_VIDEO = 'video';
const FILE_TYPE_PDF = 'pdf';
const FILE_TYPE_SPREADSHEET = 'spreadsheet';
const FILE_TYPE_DOCUMENT = 'document';
const FILE_TYPE_NOTE = 'note';
const FILE_TYPE_GENERIC = 'file';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];
const DOCUMENT_EXTENSIONS = ['doc', 'docx', 'txt', 'rtf'];
const SPREADSHEET_EXTENSIONS = ['xls', 'xlsx', 'csv'];

const UUID_FILENAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Manipulate here: 24 is "long enough to be a hash, not a word". Lower it and names like "deadbeefcafe" start matching.
const LONG_HEX_FILENAME_PATTERN = /^[0-9a-f]{24,}$/i;
const FILE_EXTENSION_PATTERN = /\.[a-z0-9]+$/i;

const TRAINER_UPLOAD_PREFIX = 'Coach';
const CLIENT_UPLOAD_PREFIX = 'Progress';

// ===== HELPER FUNCTIONS =====

function unitIndexForByteCount(byteCount) {
  // log(n) / log(1024) is "how many times 1024 fits into n", which is the unit slot.
  // The cap keeps a huge file on TB instead of reading past the end of the label list.
  const rawIndex = Math.floor(Math.log(byteCount) / Math.log(BYTES_PER_UNIT));
  return Math.min(BYTE_UNIT_LABELS.length - 1, rawIndex);
}

// Bytes need no decimals ("512 B"). Small values get two ("1.25 MB"). 10 and up get one ("24.3 MB").
function decimalPlacesForSize(unitIndex, unitValue) {
  if (unitIndex === 0) return 0;
  if (unitValue >= LARGE_SIZE_CUTOFF) return LARGE_SIZE_DECIMAL_PLACES;
  return SMALL_SIZE_DECIMAL_PLACES;
}

function fileTypeFromExtension(fileName) {
  // vocab: ?. after pop() covers a name with no dot (pop is still a string here, but a missing name is not).
  const fileExtension = fileName.split('.').pop()?.toLowerCase();
  if (IMAGE_EXTENSIONS.includes(fileExtension)) return FILE_TYPE_IMAGE;
  if (DOCUMENT_EXTENSIONS.includes(fileExtension)) return FILE_TYPE_DOCUMENT;
  if (SPREADSHEET_EXTENSIONS.includes(fileExtension)) return FILE_TYPE_SPREADSHEET;
  return FILE_TYPE_GENERIC;
}

function fileNameStem(fileName) {
  const baseName = fileName.split('/').pop() || fileName;
  return baseName.replace(FILE_EXTENSION_PATTERN, '');
}

function isMachineGeneratedStem(stem) {
  if (UUID_FILENAME_PATTERN.test(stem)) return true;
  if (LONG_HEX_FILENAME_PATTERN.test(stem)) return true;
  return false;
}

// createdAt arrives as a Date, a Firestore Timestamp, or a string/number, depending on who wrote the row.
function readFileCreatedAt(createdAt) {
  if (createdAt instanceof Date) return createdAt;
  // vocab: Firestore Timestamp = Firebase's time type. toDate() turns it into a JavaScript Date.
  // vocab: ?.toDate?.() = call toDate only when both the field and the method exist.
  // The truthiness check is on the Date toDate returns, which is why toDate can run twice.
  if (createdAt?.toDate?.()) return createdAt.toDate();
  if (createdAt) return new Date(createdAt);
  return null;
}

function labelWithOptionalDate(label, dateLabel) {
  if (dateLabel) return `${label} • ${dateLabel}`;
  return label;
}

// ===== MAIN FUNCTION =====

/**
 * Bytes to a short size label. Missing or zero sizes become an em dash, never "0 B" or "NaN".
 * @param {number|string} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  const byteCount = typeof bytes === 'number' ? bytes : Number(bytes);
  if (!Number.isFinite(byteCount) || byteCount <= 0) return MISSING_SIZE_LABEL;

  const unitIndex = unitIndexForByteCount(byteCount);
  const unitValue = byteCount / Math.pow(BYTES_PER_UNIT, unitIndex);
  const decimalPlaces = decimalPlacesForSize(unitIndex, unitValue);
  return `${unitValue.toFixed(decimalPlaces)} ${BYTE_UNIT_LABELS[unitIndex]}`;
}

/**
 * "Sep 13, 2026". A bad date becomes '' so the caller can omit the label.
 * @param {Date|string|number} dateLike
 * @returns {string}
 */
export function formatDateShort(dateLike) {
  if (!dateLike) return '';
  const parsedDate = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(parsedDate.getTime())) return '';
  // Manipulate here: switch month to 'long', or drop year, for a shorter label.
  return parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Classify an attachment so the list knows which icon and which viewer to open.
 * Returns 'image' | 'video' | 'pdf' | 'spreadsheet' | 'document' | 'note' | 'file'.
 * @param {object} item
 * @returns {string}
 */
export function getFileTypeFromItem(item) {
  // Three signals, because rows come from several eras and any one of them may be missing.
  const fileName = String(item?.name || item?.title || '');
  const mediaType = String(item?.mimeType || '');
  const typeTag = String(item?.type || '');

  // Most specific first. PDF is checked before the generic document tag so PDFs get the PDF viewer.
  if (typeTag === 'photo' || mediaType.startsWith('image/')) return FILE_TYPE_IMAGE;
  if (typeTag === 'spreadsheet') return FILE_TYPE_SPREADSHEET;
  if (typeTag === 'video' || mediaType.startsWith('video/')) return FILE_TYPE_VIDEO;
  if (typeTag === 'pdf' || mediaType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf')) {
    return FILE_TYPE_PDF;
  }
  if (typeTag === 'document') return FILE_TYPE_DOCUMENT;
  if (typeTag === 'doc') return FILE_TYPE_DOCUMENT;
  if (typeTag === 'note') return FILE_TYPE_NOTE;
  // documentId is the older "this row points at a written doc" signal, even when type was left blank.
  if (typeTag === 'document' || item?.documentId) return FILE_TYPE_DOCUMENT;

  return fileTypeFromExtension(fileName);
}

/**
 * True when the name looks like a camera-roll UUID or a storage hash, not a title a person typed.
 * @param {string} name
 * @returns {boolean}
 */
export function isProbablyGeneratedFilename(name) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) return false;
  return isMachineGeneratedStem(fileNameStem(trimmedName));
}

/**
 * The label on a file card, for example "Coach photo • Sep 13, 2026".
 * The raw filename is never shown. Photos and videos say who added them. Documents do not.
 * @param {object} item
 * @returns {string}
 */
export function getFriendlyFileTitle(item) {
  const fileType = getFileTypeFromItem(item);
  const isTrainerUpload = item?.addedBy === 'trainer';
  const ownerPrefix = isTrainerUpload ? TRAINER_UPLOAD_PREFIX : CLIENT_UPLOAD_PREFIX;

  const createdAt = readFileCreatedAt(item?.createdAt);
  const hasValidDate = Boolean(createdAt && !Number.isNaN(createdAt.getTime()));
  const dateLabel = hasValidDate ? formatDateShort(createdAt) : '';

  // Manipulate here: every user-facing file label lives in this block.
  if (fileType === FILE_TYPE_IMAGE) return labelWithOptionalDate(`${ownerPrefix} photo`, dateLabel);
  if (fileType === FILE_TYPE_VIDEO) return labelWithOptionalDate(`${ownerPrefix} video`, dateLabel);
  if (fileType === FILE_TYPE_PDF) return labelWithOptionalDate('PDF', dateLabel);
  if (fileType === FILE_TYPE_SPREADSHEET) return labelWithOptionalDate('Spreadsheet', dateLabel);
  if (fileType === FILE_TYPE_DOCUMENT) return labelWithOptionalDate('Document', dateLabel);
  if (fileType === FILE_TYPE_NOTE) return labelWithOptionalDate('Coach note', dateLabel);
  return labelWithOptionalDate('File', dateLabel);
}
