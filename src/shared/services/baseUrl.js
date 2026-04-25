import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_PORT = 4000;

/**
 * In dev, Metro exposes the machine IP here. Physical devices cannot reach
 * localhost:4000 on your Mac — they need this LAN host for the Express API.
 */
function getDevLanHost() {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;

  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    Constants.manifest?.debuggerHost,
    Constants.manifest2?.extra?.expoGo?.debuggerHost,
  ].filter(Boolean);

  for (const uri of candidates) {
    if (typeof uri !== 'string') continue;
    const host = uri.split(':')[0]?.trim();
    if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
  }
  return null;
}

/**
 * Primary API base (no trailing slash).
 * Set EXPO_PUBLIC_API_BASE_URL or app.config extra.apiBaseUrl to override.
 */
export const getApiBase = () => {
  // iOS Simulator can reach your Mac via localhost; prefer it in dev so we don't
  // accidentally try LAN IPs or other fallbacks that only work on physical devices.
  const isIosSimulator =
    Platform.OS === 'ios' &&
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    Constants?.isDevice === false;
  if (isIosSimulator) return `http://localhost:${DEFAULT_PORT}`;

  const explicit =
    (Constants.expoConfig?.extra?.apiBaseUrl &&
      String(Constants.expoConfig.extra.apiBaseUrl).trim()) ||
    (Constants.expoConfig?.extra?.API_BASE_URL &&
      String(Constants.expoConfig.extra.API_BASE_URL).trim()) ||
    (typeof process !== 'undefined' &&
      process.env?.EXPO_PUBLIC_API_BASE_URL &&
      String(process.env.EXPO_PUBLIC_API_BASE_URL).trim());

  if (explicit) return explicit.replace(/\/$/, '');

  const lan = getDevLanHost();
  if (lan) return `http://${lan}:${DEFAULT_PORT}`;

  return `http://localhost:${DEFAULT_PORT}`;
};

/**
 * Ordered list of bases to try (primary first, then local fallbacks).
 * Use for onboarding and other calls that previously failed on device with "Network request failed".
 */
export const getApiBaseCandidates = () => {
  const primary = getApiBase();
  const fallbacks = [
    `http://localhost:${DEFAULT_PORT}`,
    `http://127.0.0.1:${DEFAULT_PORT}`,
    `http://localhost:${DEFAULT_PORT + 1}`,
    `http://127.0.0.1:${DEFAULT_PORT + 1}`,
    `http://localhost:${DEFAULT_PORT + 2}`,
    `http://127.0.0.1:${DEFAULT_PORT + 2}`,
  ];
  const seen = new Set([primary]);
  const out = [primary];
  for (const b of fallbacks) {
    if (!seen.has(b)) {
      seen.add(b);
      out.push(b);
    }
  }
  return out;
};
