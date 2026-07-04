import { Alert, Linking } from 'react-native';
import { getSupportEmail } from './supportConfig';

/** Opens the device mail app to coachconnect0@gmail.com (or configured support inbox). */
export function openSupportMailto({ subject = '', body = '' } = {}) {
  const email = getSupportEmail();
  if (!email) {
    Alert.alert('Support', 'Support email is not available right now. Try again later or use Help & FAQ in Settings.');
    return false;
  }
  const params = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  const qs = params.length ? `?${params.join('&')}` : '';
  Linking.openURL(`mailto:${email}${qs}`);
  return true;
}

/** When the API cannot send (no Resend/SMTP on server), offer the same content via mailto. */
export function offerSupportMailtoFallback({ subject, body, apiError }) {
  const detail = String(apiError || '').trim();
  Alert.alert(
    'Couldn’t send through the app',
    detail
      ? `${detail}\n\nYou can send the same message through your email app to ${getSupportEmail() || 'support'}.`
      : 'You can send the same message through your email app instead.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open email app', onPress: () => openSupportMailto({ subject, body }) },
    ]
  );
}
