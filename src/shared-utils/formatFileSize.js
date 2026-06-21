/**
 * file Formatting
 *
 * Purpose: file Formatting — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: formatFileSize, formatDateShort, getFileTypeFromItem, isProbablyGeneratedFilename, getFriendlyFileTitle
 *
 * @file-header
 */
export function formatFileSize(bytes) {
  const n = typeof bytes === 'number' ? bytes : Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  const digits = i === 0 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toFixed(digits)} ${units[i]}`;
}

export function formatDateShort(dateLike) {
  if (!dateLike) return '';
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getFileTypeFromItem(item) {
  const name = String(item?.name || item?.title || '');
  const mime = String(item?.mimeType || '');
  const type = String(item?.type || '');

  if (type === 'photo' || mime.startsWith('image/')) return 'image';
  if (type === 'spreadsheet') return 'spreadsheet';
  if (type === 'video' || mime.startsWith('video/')) return 'video';
  if (type === 'pdf' || mime.includes('pdf') || name.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (type === 'document') return 'document';
  if (type === 'doc') return 'document';
  if (type === 'note') return 'note';
  if (type === 'document' || item?.documentId) return 'document';

  const ext = name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return 'image';
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) return 'document';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'spreadsheet';
  return 'file';
}

export function isProbablyGeneratedFilename(name) {
  const n = String(name || '').trim();
  if (!n) return false;
  const base = n.split('/').pop() || n;
  const stem = base.replace(/\.[a-z0-9]+$/i, '');
  // UUID (8-4-4-4-12) or long hex-ish stems are usually not user-friendly.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stem)) return true;
  if (/^[0-9a-f]{24,}$/i.test(stem)) return true;
  return false;
}

export function getFriendlyFileTitle(item) {
  const fileType = getFileTypeFromItem(item);
  const addedBy = item?.addedBy === 'trainer' ? 'trainer' : 'client';

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
  const prefix = addedBy === 'trainer' ? 'Coach' : 'Progress';
  if (fileType === 'image') return `${prefix} photo${dateLabel ? ` • ${dateLabel}` : ''}`;
  if (fileType === 'video') return `${prefix} video${dateLabel ? ` • ${dateLabel}` : ''}`;
  if (fileType === 'pdf') return `PDF${dateLabel ? ` • ${dateLabel}` : ''}`;
  if (fileType === 'spreadsheet') return `Spreadsheet${dateLabel ? ` • ${dateLabel}` : ''}`;
  if (fileType === 'document') return `Document${dateLabel ? ` • ${dateLabel}` : ''}`;
  if (fileType === 'note') return `Coach note${dateLabel ? ` • ${dateLabel}` : ''}`;
  return `File${dateLabel ? ` • ${dateLabel}` : ''}`;
}

