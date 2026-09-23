/**
 * coach Source Preview
 *
 * Purpose: coach Source Preview — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: hostLabel, faviconUrl, screenshotPreviewUrl, resolveSourcePreviewUri
 *
 * @file-header
 */
/** Visual helpers for AI Coach web source cards. */

export function hostLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch (_) {
    return String(url || '').slice(0, 48);
  }
}

export function faviconUrl(url) {
  const host = hostLabel(url);
  if (!host) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}

/** Direct image URL for a page screenshot preview (fallback when API has no imageUrl). */
export function screenshotPreviewUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;
  return `https://image.thum.io/get/width/480/crop/600/${encodeURIComponent(raw)}`;
}

export function resolveSourcePreviewUri(source = {}) {
  const apiImage = String(source.imageUrl || source.image || '').trim();
  if (apiImage) return apiImage;
  return screenshotPreviewUrl(source.url);
}
