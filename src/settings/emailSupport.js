// Opens the phone's mail app when in-app support cannot send.
// Flow: build a mailto link from the support address → open it, or offer that path after an API failure.
// Used by: Settings support.

import { Alert, Linking } from 'react-native';
import { getSupportEmail } from './supportContact';

// ===== NAMED CONSTANTS =====

const SUPPORT_UNAVAILABLE_TITLE = 'Support';
const SUPPORT_UNAVAILABLE_MESSAGE = 'Support email is not available right now. Try again later or use Help & FAQ in Settings.';
const FALLBACK_ALERT_TITLE = 'Couldn’t send through the app';

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} emailAddress
 * @param {string} subject
 * @param {string} body
 * @returns {string}
 */
function buildMailtoUrl(emailAddress, subject, body) {
  const queryParts = [];
  if (subject) queryParts.push(`subject=${encodeURIComponent(subject)}`);
  if (body) queryParts.push(`body=${encodeURIComponent(body)}`);
  const queryString = queryParts.length ? `?${queryParts.join('&')}` : '';
  return `mailto:${emailAddress}${queryString}`;
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ subject?: string, body?: string }} [options]
 * @returns {boolean}
 */
export function openSupportMailto({ subject = '', body = '' } = {}) {
  const emailAddress = getSupportEmail();
  if (!emailAddress) {
    Alert.alert(SUPPORT_UNAVAILABLE_TITLE, SUPPORT_UNAVAILABLE_MESSAGE);
    return false;
  }
  Linking.openURL(buildMailtoUrl(emailAddress, subject, body));
  return true;
}

/**
 * When the API cannot send, offer the same message through the mail app.
 * @param {{ subject?: string, body?: string, apiError?: string, title?: string }} [options]
 * @returns {void}
 */
export function offerSupportMailtoFallback({ subject, body, apiError, title } = {}) {
  const errorDetail = String(apiError || '').trim();
  const supportAddress = getSupportEmail() || 'support';
  const message = errorDetail
    ? `${errorDetail}\n\nYou can send the same message through your email app to ${supportAddress}.`
    : 'You can send the same message through your email app instead.';
  Alert.alert(
    title || FALLBACK_ALERT_TITLE,
    message,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open email app', onPress: () => openSupportMailto({ subject, body }) },
    ],
  );
}
