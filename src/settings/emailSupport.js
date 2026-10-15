// Opens the phone's mail app when in-app support cannot send.
// Flow: build a mailto link from the support address → open it, or offer that path after an API failure.
// Used by: Settings support.

import { Alert, Linking } from 'react-native';
import { getSupportEmail } from './supportContact';

// ===== NAMED CONSTANTS =====

const SUPPORT_UNAVAILABLE_TITLE = 'Support';
const SUPPORT_UNAVAILABLE_MESSAGE =
  'Support email is not available right now. Try again later or use Help & FAQ in Settings.';
const FALLBACK_ALERT_TITLE = 'Couldn’t send through the app';
const CANCEL_BUTTON_LABEL = 'Cancel';
const OPEN_EMAIL_BUTTON_LABEL = 'Open email app';

// ===== HELPER FUNCTIONS =====

/**
 * Encode subject/body into a mailto URL for the system mail app.
 * @param {string} emailAddress
 * @param {string} subject
 * @param {string} body
 * @returns {string}
 */
function buildMailtoUrl(emailAddress, subject, body) {
  const queryParts = [];
  if (subject) queryParts.push(`subject=${encodeURIComponent(subject)}`);
  if (body) queryParts.push(`body=${encodeURIComponent(body)}`);
  if (!queryParts.length) return `mailto:${emailAddress}`;
  return `mailto:${emailAddress}?${queryParts.join('&')}`;
}

/**
 * Alert when EXPO_PUBLIC_SUPPORT_EMAIL / config left the inbox blank.
 * @returns {void}
 */
function alertSupportUnavailable() {
  Alert.alert(SUPPORT_UNAVAILABLE_TITLE, SUPPORT_UNAVAILABLE_MESSAGE);
}

/**
 * Copy shown when the in-app support API fails and we offer Mail instead.
 * @param {string} apiError
 * @param {string} supportAddress
 * @returns {string}
 */
function fallbackAlertMessage(apiError, supportAddress) {
  const errorDetail = String(apiError || '').trim();
  if (errorDetail) {
    return `${errorDetail}\n\nYou can send the same message through your email app to ${supportAddress}.`;
  }
  return 'You can send the same message through your email app instead.';
}

/**
 * Buttons for the API-failure alert (Cancel / Open email app).
 * @param {string} subject
 * @param {string} body
 * @returns {Array}
 */
function fallbackAlertButtons(subject, body) {
  return [
    { text: CANCEL_BUTTON_LABEL, style: 'cancel' },
    {
      text: OPEN_EMAIL_BUTTON_LABEL,
      onPress: () => openSupportMailto({ subject, body }),
    },
  ];
}

// ===== MAIN FUNCTION =====

/**
 * Open the system mail app addressed to support.
 * @param {{ subject?: string, body?: string }} [options]
 * @returns {boolean}
 */
export function openSupportMailto({ subject = '', body = '' } = {}) {
  // 1. Need a real inbox address from config.
  const emailAddress = getSupportEmail();
  if (!emailAddress) {
    alertSupportUnavailable();
    return false;
  }

  // 2. Hand the mailto URL to the OS.
  Linking.openURL(buildMailtoUrl(emailAddress, subject, body));
  return true;
}

/**
 * When the API cannot send, offer the same message through the mail app.
 * @param {{ subject?: string, body?: string, apiError?: string, title?: string }} [options]
 * @returns {void}
 */
export function offerSupportMailtoFallback({ subject, body, apiError, title } = {}) {
  // 1. Build the alert copy from the API error + support address.
  const supportAddress = getSupportEmail() || 'support';
  const message = fallbackAlertMessage(apiError, supportAddress);

  // 2. Show Cancel / Open email app.
  Alert.alert(
    title || FALLBACK_ALERT_TITLE,
    message,
    fallbackAlertButtons(subject, body),
  );
}
