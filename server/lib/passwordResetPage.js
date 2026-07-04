/**
 * Branded password-reset web page (served from Cloud Run).
 */
const fs = require('fs');
const path = require('path');

const PAGE_PATH = path.join(__dirname, '..', 'public', 'reset-password', 'index.html');

let cachedTemplate = null;

function readTemplate() {
  if (cachedTemplate) return cachedTemplate;
  cachedTemplate = fs.readFileSync(PAGE_PATH, 'utf8');
  return cachedTemplate;
}

function getPasswordResetPageBaseUrl() {
  const explicit = process.env.PASSWORD_RESET_PAGE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const apiBase =
    process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ||
    'https://coachconnect-api-421005574501.us-central1.run.app';
  return `${apiBase.replace(/\/$/, '')}/reset-password`;
}

/**
 * Rewrite Firebase's default handler URL to our branded page (same oobCode).
 */
function rewriteResetLinkToBrandedPage(firebaseLink) {
  try {
    const src = new URL(String(firebaseLink));
    const dest = new URL(getPasswordResetPageBaseUrl());
    for (const key of ['mode', 'oobCode', 'apiKey', 'lang', 'continueUrl']) {
      const v = src.searchParams.get(key);
      if (v) dest.searchParams.set(key, v);
    }
    if (!dest.searchParams.get('mode')) dest.searchParams.set('mode', 'resetPassword');
    return dest.toString();
  } catch (e) {
    console.warn('[password-reset] Could not rewrite link:', e?.message || e);
    return firebaseLink;
  }
}

function getFirebaseWebApiKey() {
  return (
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim() ||
    process.env.FIREBASE_WEB_API_KEY?.trim() ||
    ''
  );
}

function renderPasswordResetPageHtml() {
  const apiKey = getFirebaseWebApiKey();
  const configJson = JSON.stringify({ apiKey }).replace(/</g, '\\u003c');
  const template = readTemplate();
  const injection = `<script>window.__COACH_CONNECT_RESET__=${configJson};</script>`;
  if (template.includes('</head>')) {
    return template.replace('</head>', `${injection}\n</head>`);
  }
  return injection + template;
}

module.exports = {
  getPasswordResetPageBaseUrl,
  rewriteResetLinkToBrandedPage,
  renderPasswordResetPageHtml,
  getFirebaseWebApiKey,
};
