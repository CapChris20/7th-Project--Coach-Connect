// Turns a raw file record into text and a type the notes list can render.
// Flow: size in bytes → short date → type from tag, media type, or extension → a title that hides the raw filename.
// Used by the file cards and the notes sections. Users never see "a3f1c2....jpg".
// Read order: constants → helpers → numbered mains. Type string letters stay frozen.

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

const UUID_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Manipulate here: 24 is "long enough to be a hash, not a word". Lower it and names like "deadbeefcafe" start matching.
const LONG_HEX_FILENAME_PATTERN = /^[0-9a-f]{24,}$/i;
const FILE_EXTENSION_PATTERN = /\.[a-z0-9]+$/i;

const TRAINER_UPLOAD_PREFIX = 'Coach';
const CLIENT_UPLOAD_PREFIX = 'Progress';

// ===== HELPER FUNCTIONS =====

/**
 * Coerce a size field into a number (strings from older rows are allowed).
 * @param {number|string} bytes
 * @returns {number}
 */
function readByteCountAsNumber(bytes) {
  if (typeof bytes === 'number') return bytes;
  return Number(bytes);
}

/**
 * Missing, NaN, or zero bytes should show the em dash — never "0 B" or "NaN".
 * @param {number} byteCount
 * @returns {boolean}
 */
function byteCountShouldShowDash(byteCount) {
  if (!Number.isFinite(byteCount)) return true;
  if (byteCount <= 0) return true;
  return false;
}

/**
 * Pick which unit slot (B / KB / MB / …) fits this byte count.
 * @param {number} byteCount
 * @returns {number}
 */
function pickByteUnitIndex(byteCount) {
  // log(n) / log(1024) is "how many times 1024 fits into n", which is the unit slot.
  // The cap keeps a huge file on TB instead of reading past the end of the label list.
  const rawIndex = Math.floor(Math.log(byteCount) / Math.log(BYTES_PER_UNIT));
  const maxIndex = BYTE_UNIT_LABELS.length - 1;
  if (rawIndex > maxIndex) return maxIndex;
  return rawIndex;
}

/**
 * Bytes need no decimals ("512 B"). Small values get two ("1.25 MB"). 10 and up get one ("24.3 MB").
 * @param {number} unitIndex
 * @param {number} unitValue
 * @returns {number}
 */
function pickDecimalPlacesForSize(unitIndex, unitValue) {
  if (unitIndex === 0) return 0;
  if (unitValue >= LARGE_SIZE_CUTOFF) return LARGE_SIZE_DECIMAL_PLACES;
  return SMALL_SIZE_DECIMAL_PLACES;
}

/**
 * @param {string} fileName
 * @returns {string|undefined}
 */
function extensionFromFileName(fileName) {
  // vocab: ?. after pop() covers a name with no dot (pop is still a string here, but a missing name is not).
  return fileName.split('.').pop()?.toLowerCase();
}

/**
 * Fall back to the filename extension when tags are missing or vague.
 * @param {string} fileName
 * @returns {string}
 */
function classifyFileTypeFromExtension(fileName) {
  const fileExtension = extensionFromFileName(fileName);
  if (IMAGE_EXTENSIONS.includes(fileExtension)) return FILE_TYPE_IMAGE;
  if (DOCUMENT_EXTENSIONS.includes(fileExtension)) return FILE_TYPE_DOCUMENT;
  if (SPREADSHEET_EXTENSIONS.includes(fileExtension)) return FILE_TYPE_SPREADSHEET;
  return FILE_TYPE_GENERIC;
}

/**
 * Strip path + extension so we can test the stem for UUID / hash shapes.
 * @param {string} fileName
 * @returns {string}
 */
function fileNameWithoutExtension(fileName) {
  const baseName = fileName.split('/').pop() || fileName;
  return baseName.replace(FILE_EXTENSION_PATTERN, '');
}

/**
 * @param {string} stem
 * @returns {boolean}
 */
function stemLooksMachineGenerated(stem) {
  if (UUID_FILENAME_PATTERN.test(stem)) return true;
  if (LONG_HEX_FILENAME_PATTERN.test(stem)) return true;
  return false;
}

/**
 * createdAt arrives as a Date, a Firestore Timestamp, or a string/number, depending on who wrote the row.
 * @param {*} createdAt
 * @returns {Date|null}
 */
function readCreatedAtAsDate(createdAt) {
  if (createdAt instanceof Date) return createdAt;
  // vocab: Firestore Timestamp = Firebase's time type. toDate() turns it into a JavaScript Date.
  // vocab: ?.toDate?.() = call toDate only when both the field and the method exist.
  // The truthiness check is on the Date toDate returns, which is why toDate can run twice.
  if (createdAt?.toDate?.()) return createdAt.toDate();
  if (createdAt) return new Date(createdAt);
  return null;
}

/**
 * @param {string} label
 * @param {string} dateLabel
 * @returns {string}
 */
function joinLabelWithOptionalDate(label, dateLabel) {
  if (dateLabel) return `${label} • ${dateLabel}`;
  return label;
}

/**
 * Read the three signals a row might carry from different upload eras.
 * @param {object} item
 * @returns {{ fileName: string, mediaType: string, typeTag: string }}
 */
function readFileSignalsFromItem(item) {
  const fileName = String(item?.name || item?.title || '');
  const mediaType = String(item?.mimeType || '');
  const typeTag = String(item?.type || '');
  return { fileName, mediaType, typeTag };
}

/**
 * Pick the friendly noun + owner prefix for a card title.
 * @param {string} fileType
 * @param {boolean} isTrainerUpload
 * @returns {string}
 */
function baseTitleForFileType(fileType, isTrainerUpload) {
  const ownerPrefix = isTrainerUpload
    ? TRAINER_UPLOAD_PREFIX
    : CLIENT_UPLOAD_PREFIX;

  // Manipulate here: every user-facing file label noun lives in this block.
  if (fileType === FILE_TYPE_IMAGE) return `${ownerPrefix} photo`;
  if (fileType === FILE_TYPE_VIDEO) return `${ownerPrefix} video`;
  if (fileType === FILE_TYPE_PDF) return 'PDF';
  if (fileType === FILE_TYPE_SPREADSHEET) return 'Spreadsheet';
  if (fileType === FILE_TYPE_DOCUMENT) return 'Document';
  if (fileType === FILE_TYPE_NOTE) return 'Coach note';
  return 'File';
}

// ===== MAIN FUNCTION =====

/**
 * Human file size like "12.4 KB". Missing or zero bytes become "—".
 * @param {number|string} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  // 1. Coerce to a number; missing / zero / NaN become the dash.
  const byteCount = readByteCountAsNumber(bytes);
  if (byteCountShouldShowDash(byteCount)) return MISSING_SIZE_LABEL;

  // 2. Pick unit slot, scale, and how many decimals to show.
  const unitIndex = pickByteUnitIndex(byteCount);
  const unitValue = byteCount / Math.pow(BYTES_PER_UNIT, unitIndex);
  const decimalPlaces = pickDecimalPlacesForSize(unitIndex, unitValue);
  const unitLabel = BYTE_UNIT_LABELS[unitIndex];
  return `${unitValue.toFixed(decimalPlaces)} ${unitLabel}`;
}

/**
 * "Sep 13, 2026". A bad date becomes '' so the caller can omit the label.
 * @param {Date|string|number} dateLike
 * @returns {string}
 */
export function formatDateShort(dateLike) {
  // 1. Refuse empty / unparseable values so the card can hide the date.
  if (!dateLike) return '';
  const parsedDate = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(parsedDate.getTime())) return '';

  // 2. Short month + day + year. Manipulate here: switch month to 'long', or drop year.
  return parsedDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Classify an attachment so the list knows which icon and which viewer to open.
 * Returns 'image' | 'video' | 'pdf' | 'spreadsheet' | 'document' | 'note' | 'file'.
 * @param {object} item
 * @returns {string}
 */
export function getFileTypeFromItem(item) {
  // 1. Read the three signals rows might carry from different upload eras.
  const { fileName, mediaType, typeTag } = readFileSignalsFromItem(item);

  // 2. Most specific first. PDF is checked before the generic document tag so PDFs get the PDF viewer.
  if (typeTag === 'photo' || mediaType.startsWith('image/')) return FILE_TYPE_IMAGE;
  if (typeTag === 'spreadsheet') return FILE_TYPE_SPREADSHEET;
  if (typeTag === 'video' || mediaType.startsWith('video/')) return FILE_TYPE_VIDEO;
  if (
    typeTag === 'pdf' ||
    mediaType.includes('pdf') ||
    fileName.toLowerCase().endsWith('.pdf')
  ) {
    return FILE_TYPE_PDF;
  }
  if (typeTag === 'document') return FILE_TYPE_DOCUMENT;
  if (typeTag === 'doc') return FILE_TYPE_DOCUMENT;
  if (typeTag === 'note') return FILE_TYPE_NOTE;
  // documentId is the older "this row points at a written doc" signal, even when type was left blank.
  if (typeTag === 'document' || item?.documentId) return FILE_TYPE_DOCUMENT;

  // 3. Fall back to the filename extension when tags are missing or vague.
  return classifyFileTypeFromExtension(fileName);
}

/**
 * True when the name looks like a camera-roll UUID or a storage hash, not a title a person typed.
 * @param {string} name
 * @returns {boolean}
 */
export function isProbablyGeneratedFilename(name) {
  // 1. Empty names are not "generated" — they are just missing.
  const trimmedName = String(name || '').trim();
  if (!trimmedName) return false;

  // 2. Test the stem (no path, no extension) against UUID and long-hex patterns.
  const stem = fileNameWithoutExtension(trimmedName);
  return stemLooksMachineGenerated(stem);
}

/**
 * The label on a file card, for example "Coach photo • Sep 13, 2026".
 * The raw filename is never shown. Photos and videos say who added them. Documents do not.
 * @param {object} item
 * @returns {string}
 */
export function getFriendlyFileTitle(item) {
  // 1. Type drives both the noun ("photo") and which owner prefix applies.
  const fileType = getFileTypeFromItem(item);
  const isTrainerUpload = item?.addedBy === 'trainer';
  const baseTitle = baseTitleForFileType(fileType, isTrainerUpload);

  // 2. Optional date suffix when createdAt parses cleanly.
  const createdAt = readCreatedAtAsDate(item?.createdAt);
  const hasValidDate = Boolean(createdAt && !Number.isNaN(createdAt.getTime()));
  const dateLabel = hasValidDate ? formatDateShort(createdAt) : '';

  return joinLabelWithOptionalDate(baseTitle, dateLabel);
}
