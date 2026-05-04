/**
 * Helpers for opening notes & files in-app (images, video, embeds) instead of Safari.
 */

export function isImageFile(file) {
  if (!file) return false;
  if (file.type === 'photo') return true;
  if (file.mimeType && String(file.mimeType).startsWith('image/')) return true;
  return false;
}

export function isVideoFile(file) {
  if (!file) return false;
  if (file.type === 'video') return true;
  if (file.mimeType && String(file.mimeType).startsWith('video/')) return true;
  return false;
}

export function isPdfFile(file, url) {
  const name = (file?.name || file?.title || '').toLowerCase();
  const mime = (file?.mimeType && String(file.mimeType).toLowerCase()) || '';
  if (file?.type === 'pdf') return true;
  if (name.endsWith('.pdf')) return true;
  if (mime.includes('pdf')) return true;
  if (url && /\.pdf(\?|$)/i.test(String(url))) return true;
  return false;
}

export function googleEmbedUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
}

export function officeEmbedUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

/** Stable dedupe key for notes_and_files items (avoids Timestamp collisions). */
export function notesFileDedupeKey(x) {
  if (x?.id) return `id:${String(x.id)}`;
  let t = 0;
  try {
    const c = x?.createdAt;
    if (c && typeof c.toDate === 'function') t = c.toDate().getTime();
    else if (c instanceof Date) t = c.getTime();
    else t = new Date(c || 0).getTime();
  } catch (_) {
    t = 0;
  }
  return `leg:${x?.type || ''}|${x?.url || ''}|${t}|${x?.name || x?.title || ''}`;
}

/**
 * First fullscreen WebView URI for generic docs (Office → Google).
 * PDFs should use PdfViewerModal with raw URL.
 */
export function getEmbedViewerUri(file, url) {
  if (!url) return '';
  const name = (file?.name || file?.title || '').toLowerCase();
  const mime = (file?.mimeType && String(file.mimeType).toLowerCase()) || '';
  const isOffice =
    /\.(doc|docx|ppt|pptx|xls|xlsx|csv)$/i.test(name) ||
    file?.type === 'spreadsheet' ||
    mime.includes('spreadsheet') ||
    mime.includes('word') ||
    mime.includes('officedocument') ||
    mime.includes('msword');
  if (isOffice) return officeEmbedUrl(url);
  return googleEmbedUrl(url);
}
