// Display helpers for the notes & files lists (sizes, dates, type icons, human titles).
// Flow: a raw Firestore attachment record goes in → out comes something safe to render
//       ("2.4 MB", "Sep 13, 2026", 'pdf', "Coach photo • Sep 13, 2026").
// Used by the file gallery / notes-files cards. Deliberately never shows raw filenames to users.

// Bytes → "2.4 MB". Returns an em dash for missing/zero sizes so cards never print "0 B" or "NaN".
export function formatFileSize(bytes) {
  const n = typeof bytes === 'number' ? bytes : Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '—';
  // Manipulate here: unit labels. Note these are 1024-based (KiB math, KB labels) — the
  //                  same convention Finder/Explorer use, so numbers match what users expect.
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  // Which unit? log(n)/log(1024) is "how many times can 1024 divide into n", i.e. the index
  // into `units`. Math.min caps it so a hypothetical petabyte still prints as TB
  // instead of reading past the end of the array.
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  // Precision scales down as the number gets bigger: raw bytes need no decimals ("512 B"),
  // small values get 2 for detail ("1.25 MB"), and 10+ gets 1 to stay narrow ("24.3 MB").
  const digits = i === 0 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toFixed(digits)} ${units[i]}`;
}

// "Sep 13, 2026". Accepts a Date or anything Date can parse; bad input yields '' so the
// caller can simply omit the label instead of rendering "Invalid Date".
export function formatDateShort(dateLike) {
  if (!dateLike) return '';
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  // Manipulate here: switch month to 'long' or drop year for a shorter label
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Classifies an attachment into one of our viewer categories: 'image' | 'video' | 'pdf' |
// 'spreadsheet' | 'document' | 'note' | 'file'. The return value drives which icon and
// which viewer modal the UI opens.
export function getFileTypeFromItem(item) {
  // Three independent signals, because records come from several eras/sources and any
  // one of them may be missing: our own `type` tag, the upload's MIME type, the filename.
  const name = String(item?.name || item?.title || '');
  const mime = String(item?.mimeType || '');
  const type = String(item?.type || '');

  // Pass 1 — trust the explicit tag and MIME type. Ordered most-specific first; PDF is
  // checked before the generic 'document' so PDFs get the dedicated PDF viewer.
  if (type === 'photo' || mime.startsWith('image/')) return 'image';
  if (type === 'spreadsheet') return 'spreadsheet';
  if (type === 'video' || mime.startsWith('video/')) return 'video';
  if (type === 'pdf' || mime.includes('pdf') || name.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (type === 'document') return 'document';
  if (type === 'doc') return 'document';  // legacy tag spelling
  if (type === 'note') return 'note';
  if (type === 'document' || item?.documentId) return 'document';

  // Pass 2 — nothing matched, so fall back to guessing from the file extension.
  // vocab/symbol: ?. after pop() covers a name with no dot at all (pop returns undefined)
  // Manipulate here: add extensions here to route new file types to an existing viewer
  const ext = name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return 'image';
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) return 'document';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'spreadsheet';
  // Unknown → generic 'file', which renders a neutral icon and a download action.
  return 'file';
}

// Detects machine-generated filenames (camera roll UUIDs, storage hashes) so the UI can
// swap them for a friendly label instead of showing "a3f1c2...e9.jpg" to the user.
export function isProbablyGeneratedFilename(name) {
  const n = String(name || '').trim();
  if (!n) return false;
  // Reduce a possible path to just the filename, then drop the extension, so the test
  // below looks only at the "stem" (the meaningful part of the name).
  const base = n.split('/').pop() || n;
  const stem = base.replace(/\.[a-z0-9]+$/i, '');
  // UUID (8-4-4-4-12) or long hex-ish stems are usually not user-friendly.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stem)) return true;
  // Manipulate here: 24 is the "long enough to be a hash, not a word" threshold.
  //                  Lower it and real names like "deadbeefcafe" start matching.
  if (/^[0-9a-f]{24,}$/i.test(stem)) return true;
  return false;
}

// Builds the label actually shown on a file card, e.g. "Coach photo • Sep 13, 2026".
// Policy: raw filenames are never displayed — the label is derived from who uploaded it,
// what kind of file it is, and when.
export function getFriendlyFileTitle(item) {
  const fileType = getFileTypeFromItem(item);
  // Anything not explicitly 'trainer' is treated as client-uploaded.
  const addedBy = item?.addedBy === 'trainer' ? 'trainer' : 'client';

  // `createdAt` arrives in three shapes depending on where the record came from:
  // a real Date, a Firestore Timestamp (has .toDate()), or a string/number.
  // vocab: Firestore Timestamp = Firebase's own time type; .toDate() converts it to a JS Date
  // vocab/symbol: ?.toDate?.() = call toDate only if both the field and the method exist
  const createdAt =
    item?.createdAt instanceof Date
      ? item.createdAt
      : item?.createdAt?.toDate?.()
        ? item.createdAt.toDate()
        : item?.createdAt
          ? new Date(item.createdAt)
          : null;
  const dateLabel = createdAt && !Number.isNaN(createdAt.getTime()) ? formatDateShort(createdAt) : '';

  // Always hide raw filenames (jpg/png/etc). Show a clean, descriptive label instead.
  // The prefix only applies to photos/videos, where ownership is the useful distinction
  // ("Coach photo" vs "Progress photo"); documents read fine without it.
  // Manipulate here: all user-facing file labels live in this block —
  //                  the `dateLabel ? ... : ''` pattern just drops the " • date" when there's no date
  const prefix = addedBy === 'trainer' ? 'Coach' : 'Progress';
  if (fileType === 'image') return `${prefix} photo${dateLabel ? ` • ${dateLabel}` : ''}`;
  if (fileType === 'video') return `${prefix} video${dateLabel ? ` • ${dateLabel}` : ''}`;
  if (fileType === 'pdf') return `PDF${dateLabel ? ` • ${dateLabel}` : ''}`;
  if (fileType === 'spreadsheet') return `Spreadsheet${dateLabel ? ` • ${dateLabel}` : ''}`;
  if (fileType === 'document') return `Document${dateLabel ? ` • ${dateLabel}` : ''}`;
  if (fileType === 'note') return `Coach note${dateLabel ? ` • ${dateLabel}` : ''}`;
  return `File${dateLabel ? ` • ${dateLabel}` : ''}`;
}

