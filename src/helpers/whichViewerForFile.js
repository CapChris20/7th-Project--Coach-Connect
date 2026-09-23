// Decides HOW to open a notes-and-files attachment inside the app instead of kicking out to Safari.
// Flow: is/isX predicates pick the viewer (image → MediaViewer, pdf → PdfViewer, else → WebView embed)
//       and the *EmbedUrl builders wrap unsupported docs in a third-party HTML preview.
// Used by the file gallery and the viewer modals. Companion to getFileTypeFromItem, which picks the icon.

// Two signals per check, because older records have a `type` tag while newer uploads
// carry a real MIME type — either is enough to identify the file.
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

// PDFs get a fourth signal — the URL itself — because Firebase Storage download links
// often carry the extension when the stored record's metadata is incomplete.
export function isPdfFile(file, url) {
  const name = (file?.name || file?.title || '').toLowerCase();
  const mime = (file?.mimeType && String(file.mimeType).toLowerCase()) || '';
  if (file?.type === 'pdf') return true;
  if (name.endsWith('.pdf')) return true;
  if (mime.includes('pdf')) return true;
  // vocab: /\.pdf(\?|$)/i = ".pdf" followed by a query string or the end of the URL —
  //        the (\?|$) part is what stops "/pdfs/report.docx" from matching.
  if (url && /\.pdf(\?|$)/i.test(String(url))) return true;
  return false;
}

// Google Docs Viewer — renders almost any public file as HTML we can show in a WebView.
// vocab: encodeURIComponent = escape the inner URL so its ?/& don't break the outer URL
// Manipulate here: these two services are third-party and require the file URL to be
//                  publicly reachable; a signed/expiring URL will render as an error page
export function googleEmbedUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
}

// Microsoft's Office Web Viewer — noticeably better than Google's at Word/Excel layout,
// which is why Office cellFormattings are routed here in getEmbedViewerUri below.
export function officeEmbedUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

/** Stable dedupe key for notes_and_files items (avoids Timestamp collisions). */
// Why this exists: the list merges live Firestore results with cached/optimistic entries, so
// the same file can appear twice. A real doc id is authoritative; without one we synthesize
// a fingerprint from type + url + time + name.
export function notesFileDedupeKey(x) {
  if (x?.id) return `id:${String(x.id)}`;
  // Normalize createdAt (Firestore Timestamp | Date | string) down to a plain number.
  // Using the raw Timestamp object in the key would compare by reference and never match,
  // which is the "Timestamp collision" the note above refers to.
  let t = 0;
  try {
    const c = x?.createdAt;
    if (c && typeof c.toDate === 'function') t = c.toDate().getTime();
    else if (c instanceof Date) t = c.getTime();
    else t = new Date(c || 0).getTime();
  } catch (_) {
    // Unparseable date → 0. Still deterministic, so two copies of the same broken
    // record collapse together instead of both surviving.
    t = 0;
  }
  // 'leg:' marks this as the legacy/fingerprint form so it can never be confused with an id key.
  return `leg:${x?.type || ''}|${x?.url || ''}|${t}|${x?.name || x?.title || ''}`;
}

/**
 * First fullscreen WebView URI for generic docs (Office → Google).
 * PDFs should use PdfViewer with raw URL.
 */
// The router for everything that isn't an image, video, or PDF: Office cellFormattings go to
// Microsoft's viewer, everything else falls back to Google's.
export function getEmbedViewerUri(file, url) {
  if (!url) return '';
  const name = (file?.name || file?.title || '').toLowerCase();
  const mime = (file?.mimeType && String(file.mimeType).toLowerCase()) || '';
  // Wide net on purpose — Office MIME spreadsheetConstants are numerous and inconsistent across
  // uploaders, so extension, our own tag, and several MIME fragments are all accepted.
  // Manipulate here: add an extension to the regex or a MIME fragment to send more
  //                  cellFormattings to the Office viewer instead of Google's
  const isOffice =
    /\.(doc|docx|ppt|pptx|xls|spreadsheetReader|csv)$/i.test(name) ||
    file?.type === 'spreadsheet' ||
    mime.includes('spreadsheet') ||
    mime.includes('word') ||
    mime.includes('officedocument') ||
    mime.includes('msword');
  if (isOffice) return officeEmbedUrl(url);
  return googleEmbedUrl(url);
}
