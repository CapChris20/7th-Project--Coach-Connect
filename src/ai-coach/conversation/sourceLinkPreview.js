// Host label and preview image for a coach web-source card.
// Flow: read hostname for favicon → prefer API image → else screenshot service URL.
// Used by coach source link cards under internet answers.

// ===== NAMED CONSTANTS =====

const HOSTNAME_FALLBACK_MAX_CHARS = 48;
const GOOGLE_FAVICON_BASE = 'https://www.google.com/s2/favicons?domain=';
const FAVICON_PIXEL_SIZE = '&sz=128';
const THUM_IO_SCREENSHOT_BASE = 'https://image.thum.io/get/width/480/crop/600/';

// ===== MAIN FUNCTION =====

/**
 * Short host name for the source chip.
 * @param {string} url
 * @returns {string}
 */
export function hostLabel(url) {
  return hostnameFromUrl(url);
}

/**
 * Google favicon service — small icon when we have no hero image.
 * @param {string} url
 * @returns {string|null}
 */
export function faviconUrl(url) {
  const hostname = hostnameFromUrl(url);
  if (!hostname) return null;
  return `${GOOGLE_FAVICON_BASE}${encodeURIComponent(hostname)}${FAVICON_PIXEL_SIZE}`;
}

/**
 * Thum.io page capture when the search API did not send imageUrl.
 * @param {string} url
 * @returns {string|null}
 */
export function screenshotPreviewUrl(url) {
  return buildScreenshotServiceUrl(url);
}

/**
 * Pick the best preview URI for one web source row.
 * @param {{ imageUrl?: string, image?: string, url?: string }} [source]
 * @returns {string|null}
 */
export function resolveSourcePreviewUri(source = {}) {
  const fromApi = apiProvidedImageUrl(source);
  if (fromApi) return fromApi;
  return buildScreenshotServiceUrl(source.url);
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function hostnameFromUrl(pageUrl) {
  try {
    const hostname = new URL(pageUrl).hostname;
    return hostname.replace(/^www\./i, '');
  } catch (_) {
    const fallback = String(pageUrl || '');
    return fallback.slice(0, HOSTNAME_FALLBACK_MAX_CHARS);
  }
}

function buildScreenshotServiceUrl(pageUrl) {
  const trimmedUrl = String(pageUrl || '').trim();
  if (!trimmedUrl) return null;
  return `${THUM_IO_SCREENSHOT_BASE}${encodeURIComponent(trimmedUrl)}`;
}

function apiProvidedImageUrl(sourceFields) {
  return String(sourceFields.imageUrl || sourceFields.image || '').trim();
}
