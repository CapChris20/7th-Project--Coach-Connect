import Constants from 'expo-constants';

export function getSupportEmail() {
  return String(Constants.expoConfig?.extra?.supportEmail || '').trim();
}
