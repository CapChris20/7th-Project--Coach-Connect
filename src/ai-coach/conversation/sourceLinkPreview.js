// Web source rows: human host label, favicon, and hero preview image for coach citations.
// Flow: parse hostname from page URL → Google favicon URL → API image if present → else Thum.io screenshot.
// Used by coach source link cards under internet-sourced answers. Pure string logic — no network here.

// ===== NAMED CONSTANTS =====

// Manipulate here: when URL parsing fails, how many characters of the raw string we show as the “host”.
const MAX_HOST_FALLBACK_CHARACTERS = 48;

// Manipulate here: favicon size query — 128 is sharp enough for the small source chip.
const GOOGLE_FAVICON_SERVICE = 'https://www.google.com/s2/favicons?domain=';
const FAVICON_SIZE_QUERY = '&sz=128';

// Manipulate here: Thum.io crop box — width/crop numbers change the hero preview shape.
const THUM_IO_CAPTURE_PREFIX = 'https://image.thum.io/get/width/480/crop/600/';

const WWW_HOST_PREFIX = /^www\./i;

// ===== HELPER FUNCTIONS =====

/**
 * Truncate a bad URL string so the chip still shows something.
 * @param {string} pageUrl
 * @returns {string}
 */
function truncatedRawHostFallback(pageUrl) {
  const fallbackText = String(pageUrl || '');
  return fallbackText.slice(0, MAX_HOST_FALLBACK_CHARACTERS);
}

/**
 * Hostname without www., or a truncated raw string when URL() throws.
 * @param {string} pageUrl
 * @returns {string}
 */
function hostnameFromPageUrl(pageUrl) {
  try {
    // vocab: URL constructor throws on garbage strings — we catch and fall back.
    const parsedUrl = new URL(pageUrl);
    const rawHostname = parsedUrl.hostname;
    const hostWithoutWww = rawHostname.replace(WWW_HOST_PREFIX, '');
    return hostWithoutWww;
  } catch (parseError) {
    void parseError;
    return truncatedRawHostFallback(pageUrl);
  }
}

/**
 * Build a Thum.io capture URL, or null when the page URL is blank.
 * @param {string} pageUrl
 * @returns {string|null}
 */
function thumIoPreviewUrlForPage(pageUrl) {
  const trimmedPageUrl = String(pageUrl || '').trim();
  if (!trimmedPageUrl) {
    return null;
  }

  const encodedPageUrl = encodeURIComponent(trimmedPageUrl);
  const thumIoLink = THUM_IO_CAPTURE_PREFIX + encodedPageUrl;
  return thumIoLink;
}

/**
 * Prefer imageUrl; fall back to legacy `image`. Empty string means “no API image.”
 * Field letters stay frozen — other files write these keys.
 * @param {{ imageUrl?: string, image?: string }} sourceFields
 * @returns {string}
 */
function firstNonEmptyApiImage(sourceFields) {
  const fromImageUrl = sourceFields.imageUrl;
  if (fromImageUrl) {
    return String(fromImageUrl).trim();
  }

  const fromLegacyImage = sourceFields.image;
  if (fromLegacyImage) {
    return String(fromLegacyImage).trim();
  }

  return '';
}

// ===== MAIN FUNCTION =====

/**
 * Short host label for a citation row (strips leading www.).
 * @param {string} pageUrl
 * @returns {string}
 */
export function hostLabel(pageUrl) {
  // 1. Parse hostname; on garbage URLs fall back to a truncated raw slice.
  const hostName = hostnameFromPageUrl(pageUrl);
  return hostName;
}

/**
 * Google favicon URL for the page’s host, or null when we have no host.
 * @param {string} pageUrl
 * @returns {string|null}
 */
export function faviconUrl(pageUrl) {
  // 1. Need a hostname before we can ask Google’s favicon service.
  const hostname = hostnameFromPageUrl(pageUrl);
  if (!hostname) {
    return null;
  }

  // 2. Encode the host so odd characters do not break the query string.
  // vocab: encodeURIComponent = percent-encode so the URL stays one query value
  const encodedHost = encodeURIComponent(hostname);
  const faviconLink = GOOGLE_FAVICON_SERVICE + encodedHost + FAVICON_SIZE_QUERY;
  return faviconLink;
}

/**
 * Thum.io screenshot URL for a page (used when the search API did not send a hero image).
 * @param {string} pageUrl
 * @returns {string|null}
 */
export function screenshotPreviewUrl(pageUrl) {
  // 1. Same builder the resolve path uses for the no-API-image case.
  const previewLink = thumIoPreviewUrlForPage(pageUrl);
  return previewLink;
}

/**
 * Best preview image URI for a source row: API hero first, else Thum.io capture.
 * @param {{ url?: string, imageUrl?: string, image?: string }} [sourceFields]
 * @returns {string|null}
 */
export function resolveSourcePreviewUri(sourceFields = {}) {
  // 1. Trust the search API when it already sent a hero image (imageUrl or legacy image).
  const imageFromApi = firstNonEmptyApiImage(sourceFields);
  if (imageFromApi) {
    return imageFromApi;
  }

  // 2. Otherwise ask Thum.io to capture the page at the citation URL.
  const pageUrl = sourceFields.url;
  const thumIoPreview = thumIoPreviewUrlForPage(pageUrl);
  return thumIoPreview;
}
