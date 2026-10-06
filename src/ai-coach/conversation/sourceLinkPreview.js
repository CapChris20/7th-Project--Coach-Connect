// Picture and host name for a web source card under a coach reply.
// Flow: prefer the image the API already sent → otherwise build a screenshot url from the page.
// Used by: coach source cards.

// ===== NAMED CONSTANTS =====

const HOST_LABEL_MAX_LENGTH = 48;
const FAVICON_URL_PREFIX = 'https://www.google.com/s2/favicons?domain=';
const FAVICON_SIZE_QUERY = '&sz=128';
const SCREENSHOT_URL_PREFIX = 'https://image.thum.io/get/width/480/crop/600/';

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * @param {string} url
 * @returns {string}
 */
export function hostLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch (_) {
    return String(url || '').slice(0, HOST_LABEL_MAX_LENGTH);
  }
}

/**
 * @param {string} url
 * @returns {string|null}
 */
export function faviconUrl(url) {
  const hostname = hostLabel(url);
  if (!hostname) return null;
  return `${FAVICON_URL_PREFIX}${encodeURIComponent(hostname)}${FAVICON_SIZE_QUERY}`;
}

/**
 * Fallback page image when the API did not send imageUrl.
 * @param {string} url
 * @returns {string|null}
 */
export function screenshotPreviewUrl(url) {
  const pageUrl = String(url || '').trim();
  if (!pageUrl) return null;
  return `${SCREENSHOT_URL_PREFIX}${encodeURIComponent(pageUrl)}`;
}

/**
 * @param {{ imageUrl?: string, image?: string, url?: string }} [source]
 * @returns {string|null}
 */
export function resolveSourcePreviewUri(source = {}) {
  const apiImage = String(source.imageUrl || source.image || '').trim();
  if (apiImage) return apiImage;
  return screenshotPreviewUrl(source.url);
}
