// Opens the phone mail app when in-app support cannot send the message.
// Flow: read support inbox → build mailto URL → Linking.openURL, or show a fallback alert after API failure.
// Used by Contact Support, Bug Report, Help FAQ, and block-and-report flows.
// Read order: constants → helpers → mains (openSupportMailto / offerSupportMailtoFallback).

import { Alert, Linking } from 'react-native';
import { getSupportEmail } from './supportContact';

// ===== NAMED CONSTANTS =====

const SUPPORT_UNAVAILABLE_TITLE = 'Support';
const SUPPORT_UNAVAILABLE_MESSAGE =
  'Support email is not available right now. Try again later or use Help & FAQ in Settings.';
// Manipulate here: title when the in-app support API fails and we offer Mail instead
const FALLBACK_ALERT_TITLE = 'Couldn’t send through the app';
const CANCEL_BUTTON_LABEL = 'Cancel';
const OPEN_EMAIL_BUTTON_LABEL = 'Open email app';
// Manipulate here: placeholder shown in the alert if getSupportEmail() is empty
const FALLBACK_INBOX_LABEL_WHEN_MISSING = 'support';

// ===== HELPER FUNCTIONS =====

/**
 * True when Settings config gave us a non-empty support inbox.
 * @param {string} supportInboxAddress
 * @returns {boolean}
 */
function hasSupportInboxAddress(supportInboxAddress) {
  return Boolean(supportInboxAddress);
}

/**
 * Push one mailto query part when the field is non-empty.
 * vocab: encodeURIComponent = escape spaces and punctuation so the mail app reads them safely
 * @param {string[]} queryParts
 * @param {string} fieldName
 * @param {string} fieldValue
 * @returns {void}
 */
function pushMailtoQueryPartIfPresent(queryParts, fieldName, fieldValue) {
  if (!fieldValue) {
    return;
  }
  queryParts.push(`${fieldName}=${encodeURIComponent(fieldValue)}`);
}

/**
 * Turn subject + body into a mailto: URL for the OS mail app.
 * vocab: mailto = OS URL scheme that hands subject/body to the default mail app
 * @param {string} emailAddress
 * @param {string} subject
 * @param {string} body
 * @returns {string}
 */
function buildMailtoLink(emailAddress, subject, body) {
  const queryParts = [];
  pushMailtoQueryPartIfPresent(queryParts, 'subject', subject);
  pushMailtoQueryPartIfPresent(queryParts, 'body', body);

  if (queryParts.length === 0) {
    return `mailto:${emailAddress}`;
  }
  return `mailto:${emailAddress}?${queryParts.join('&')}`;
}

/**
 * Alert when Expo extra left the support inbox blank.
 * @returns {void}
 */
function showSupportUnavailableAlert() {
  Alert.alert(SUPPORT_UNAVAILABLE_TITLE, SUPPORT_UNAVAILABLE_MESSAGE);
}

/**
 * Hand a mailto URL to the OS mail app.
 * vocab: Linking.openURL = React Native bridge that asks the OS to open a URL scheme
 * @param {string} mailtoUrl
 * @returns {void}
 */
function openMailtoInSystemMailApp(mailtoUrl) {
  Linking.openURL(mailtoUrl);
}

/**
 * Copy for the API-failure alert: include the error detail when we have one.
 * @param {string} apiError
 * @param {string} supportInboxAddress
 * @returns {string}
 */
function buildFallbackAlertMessage(apiError, supportInboxAddress) {
  const errorDetail = String(apiError || '').trim();
  if (!errorDetail) {
    return 'You can send the same message through your email app instead.';
  }
  return `${errorDetail}\n\nYou can send the same message through your email app to ${supportInboxAddress}.`;
}

/**
 * Cancel stays on screen; Open email app reuses openSupportMailto with the same subject/body.
 * @param {string} subject
 * @param {string} body
 * @returns {Array<{ text: string, style?: string, onPress?: Function }>}
 */
function buildFallbackAlertButtons(subject, body) {
  return [
    { text: CANCEL_BUTTON_LABEL, style: 'cancel' },
    {
      text: OPEN_EMAIL_BUTTON_LABEL,
      onPress: () => openSupportMailto({ subject, body }),
    },
  ];
}

/**
 * Pick alert title: caller override, or the shipped fallback title.
 * @param {string|undefined} titleFromCaller
 * @returns {string}
 */
function pickFallbackAlertTitle(titleFromCaller) {
  if (titleFromCaller) {
    return titleFromCaller;
  }
  return FALLBACK_ALERT_TITLE;
}

/**
 * Inbox label for fallback copy — real address, or a short placeholder when config is empty.
 * @returns {string}
 */
function supportInboxLabelForFallbackCopy() {
  const configuredInbox = getSupportEmail();
  if (configuredInbox) {
    return configuredInbox;
  }
  return FALLBACK_INBOX_LABEL_WHEN_MISSING;
}

// ===== MAIN FUNCTION =====

/**
 * Open the system mail app addressed to support.
 * @param {{ subject?: string, body?: string }} [options]
 * @returns {boolean} true when Linking was asked to open; false when inbox was missing
 */
export function openSupportMailto({ subject = '', body = '' } = {}) {
  // 1. Refuse when Expo extra left the inbox blank — show Help FAQ tip instead.
  const supportInboxAddress = getSupportEmail();
  if (!hasSupportInboxAddress(supportInboxAddress)) {
    showSupportUnavailableAlert();
    return false;
  }

  // 2. Build mailto with optional subject/body, then hand it to the OS.
  const mailtoUrl = buildMailtoLink(supportInboxAddress, subject, body);
  openMailtoInSystemMailApp(mailtoUrl);
  return true;
}

/**
 * When the in-app support API fails, offer the same message through the mail app.
 * @param {{ subject?: string, body?: string, apiError?: string, title?: string }} [options]
 * @returns {void}
 */
export function offerSupportMailtoFallback({ subject, body, apiError, title } = {}) {
  // 1. Name the inbox even when config is missing so the alert still names somewhere to write.
  const supportInboxAddress = supportInboxLabelForFallbackCopy();
  const alertMessage = buildFallbackAlertMessage(apiError, supportInboxAddress);

  // 2. Cancel keeps them on screen; Open email app reuses openSupportMailto.
  const alertButtons = buildFallbackAlertButtons(subject, body);
  const alertTitle = pickFallbackAlertTitle(title);
  Alert.alert(alertTitle, alertMessage, alertButtons);
}
