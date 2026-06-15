import { Alert, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

/** Strip lightweight markdown so coach replies render as one selectable Text block. */
export function coachPlainText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '• ')
    .replace(/^\d+\.\s+/gm, '• ')
    .replace(/(?:\s*\[\d+\])+/g, '')
    .trim();
}

export async function copyCoachText(text, { announce = true } = {}) {
  const raw = coachPlainText(text) || String(text || '').trim();
  if (!raw) {
    Alert.alert('Nothing to copy', 'This message has no text to copy.');
    return false;
  }

  try {
    await Clipboard.setStringAsync(raw);
    let verified = Platform.OS !== 'ios';
    if (Platform.OS === 'ios') {
      const verify = await Clipboard.getStringAsync();
      verified = !!(verify && verify.trim() === raw.trim());
    }
    if (verified) {
      if (announce) Alert.alert('Copied', 'Message copied to clipboard.');
      return true;
    }
  } catch (_) {
    /* try share fallback */
  }

  try {
    await Share.share({ message: raw });
    return true;
  } catch (e) {
    Alert.alert(
      'Copy failed',
      e?.message || 'Could not copy. Long-press the message text and use the system Copy menu.',
    );
    return false;
  }
}
