// Decides which server URL the app should call: Cloud Run in production, the Mac on port 4000 in dev.
// Flow: read an explicit override → otherwise Cloud Run → on a simulator or LAN phone, add local fallbacks.
// Used by workout generation, the AI coach, and any fetch that tries more than one base.

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ===== NAMED CONSTANTS =====

// Manipulate here: local Express port. Fallback lists also try the next two ports.
const DEFAULT_PORT = 4000;

/** Always-on production API (Google Cloud Run) — no local `npm run server` required. */
export const PRODUCTION_API_BASE_URL =
  'https://coachconnect-api-421005574501.us-central1.run.app';

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1'];

// ===== HELPER FUNCTIONS =====

function isPhysicalDevice() {
  return Constants.isDevice === true;
}

function isLoopbackBase(base) {
  return /localhost|127\.0\.0\.1/i.test(String(base || ''));
}

function normalizeApiBase(candidateBase) {
  return String(candidateBase || '').trim().replace(/\/$/, '');
}

// Tunnel hosts only reach Metro. They do not reach the Mac's Express server on port 4000.
function isTunnelOrProxyHost(host) {
  const hostText = String(host || '').toLowerCase();
  if (!hostText) return false;
  return (
    hostText.includes('exp.direct') ||
    hostText.includes('exp.host') ||
    hostText.includes('ngrok') ||
    hostText.includes('ngrok-free') ||
    hostText.includes('tunnel') ||
    hostText.endsWith('.trycloudflare.com')
  );
}

// Private LAN ranges plus *.local. A public IP or a tunnel host is not a Metro LAN address.
function isLikelyLanMetroHost(host) {
  const hostText = String(host || '').trim();
  if (!hostText || isTunnelOrProxyHost(hostText)) return false;
  if (hostText.endsWith('.local')) return true;
  const ipMatch = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostText);
  if (!ipMatch) return false;
  const firstOctet = Number(ipMatch[1]);
  const secondOctet = Number(ipMatch[2]);
  if (firstOctet === 10) return true;
  if (firstOctet === 192 && secondOctet === 168) return true;
  if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) return true;
  return false;
}

function readExpoHostCandidates() {
  return [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    Constants.manifest?.debuggerHost,
    Constants.manifest2?.extra?.expoGo?.debuggerHost,
  ];
}

function isTunnelingDevSession() {
  const hostUris = readExpoHostCandidates().filter((candidate) => typeof candidate === 'string');
  return hostUris.some((hostUri) => {
    const host = hostUri.split(':')[0]?.trim();
    return host && isTunnelOrProxyHost(host);
  });
}

/**
 * True when this base is Cloud Run, Cloud Functions, or App Engine.
 * @param {string} base
 * @returns {boolean}
 */
export function isCloudHostedApiBase(base) {
  const baseText = String(base || '').toLowerCase();
  return baseText.includes('run.app') || baseText.includes('cloudfunctions.net') || baseText.includes('appspot.com');
}

function isLocalDevApiBase(base) {
  if (isCloudHostedApiBase(base)) return false;
  const baseText = String(base || '').toLowerCase();
  if (/localhost|127\.0\.0\.1/.test(baseText)) return true;
  try {
    // vocab: URL = the platform parser. A bare host gets an http:// prefix so hostname can be read.
    const parsedUrl = new URL(baseText.startsWith('http') ? baseText : `http://${baseText}`);
    return isLikelyLanMetroHost(parsedUrl.hostname);
  } catch (_) {
    return false;
  }
}

// Env var first, then app config, then Cloud Run. This order is NOT the same as getApiBase().
function readExplicitApiBaseString() {
  const fromEnvironment =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL
      ? String(process.env.EXPO_PUBLIC_API_BASE_URL).trim()
      : '';
  const fromExpoExtra =
    (Constants.expoConfig?.extra?.API_BASE_URL && String(Constants.expoConfig.extra.API_BASE_URL).trim()) ||
    (Constants.expoConfig?.extra?.apiBaseUrl && String(Constants.expoConfig.extra.apiBaseUrl).trim());
  const resolvedBase = (fromEnvironment || fromExpoExtra || PRODUCTION_API_BASE_URL).replace(/\/$/, '');
  return resolvedBase || null;
}

// getApiBase() checks extra.apiBaseUrl, then extra.API_BASE_URL, then the env var.
function readPrimaryApiBaseOverride() {
  const fromApiBaseUrl =
    (Constants.expoConfig?.extra?.apiBaseUrl &&
      String(Constants.expoConfig.extra.apiBaseUrl).trim()) ||
    (Constants.expoConfig?.extra?.API_BASE_URL &&
      String(Constants.expoConfig.extra.API_BASE_URL).trim()) ||
    (typeof process !== 'undefined' &&
      process.env?.EXPO_PUBLIC_API_BASE_URL &&
      String(process.env.EXPO_PUBLIC_API_BASE_URL).trim());
  return fromApiBaseUrl || '';
}

function isIosSimulator() {
  return (
    Platform.OS === 'ios' &&
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    Constants?.isDevice === false
  );
}

// Metro prints the computer's LAN address here. A phone cannot use localhost for that computer.
function getDevLanHost() {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;

  const candidates = readExpoHostCandidates().filter(Boolean);
  for (const hostUri of candidates) {
    if (typeof hostUri !== 'string') continue;
    const host = hostUri.split(':')[0]?.trim();
    const isLoopbackHost = host === LOOPBACK_HOSTS[0] || host === LOOPBACK_HOSTS[1];
    if (host && !isLoopbackHost && isLikelyLanMetroHost(host)) return host;
  }
  return null;
}

function appendUniqueReachableApiBase(apiBaseList, seenBases, candidateBase) {
  const normalizedBase = normalizeApiBase(candidateBase);
  if (!normalizedBase || seenBases.has(normalizedBase)) return;
  // A real phone cannot open localhost on the developer's computer.
  if (isPhysicalDevice() && isLoopbackBase(normalizedBase)) return;
  seenBases.add(normalizedBase);
  apiBaseList.push(normalizedBase);
}

function localDevFallbackBases() {
  return [
    `http://localhost:${DEFAULT_PORT}`,
    `http://127.0.0.1:${DEFAULT_PORT}`,
    `http://localhost:${DEFAULT_PORT + 1}`,
    `http://127.0.0.1:${DEFAULT_PORT + 1}`,
    `http://localhost:${DEFAULT_PORT + 2}`,
    `http://127.0.0.1:${DEFAULT_PORT + 2}`,
  ];
}

// ===== MAIN FUNCTION =====

/**
 * Ordered API bases for a long workout-plan request. Cloud Run is first.
 * @returns {string[]}
 */
export function getWorkoutGenerationApiBases() {
  const apiBaseList = [];
  const seenBases = new Set();

  appendUniqueReachableApiBase(apiBaseList, seenBases, PRODUCTION_API_BASE_URL);

  const explicitBase = readExplicitApiBaseString();
  if (explicitBase && !isCloudHostedApiBase(explicitBase)) {
    appendUniqueReachableApiBase(apiBaseList, seenBases, explicitBase);
  }

  for (const base of getResilientApiBases()) {
    appendUniqueReachableApiBase(apiBaseList, seenBases, base);
  }

  if (explicitBase && isCloudHostedApiBase(explicitBase)) {
    appendUniqueReachableApiBase(apiBaseList, seenBases, explicitBase);
  }

  return apiBaseList.length ? apiBaseList : [PRODUCTION_API_BASE_URL.replace(/\/$/, '')];
}

/**
 * Primary API base with no trailing slash.
 * Set EXPO_PUBLIC_API_BASE_URL or app.config extra.apiBaseUrl to override.
 * @returns {string}
 */
export function getApiBase() {
  const explicitBase = readPrimaryApiBaseOverride();
  if (explicitBase) return explicitBase.replace(/\/$/, '');

  if (PRODUCTION_API_BASE_URL) return PRODUCTION_API_BASE_URL.replace(/\/$/, '');

  if (isIosSimulator()) return `http://localhost:${DEFAULT_PORT}`;

  const lanHost = getDevLanHost();
  if (lanHost) return `http://${lanHost}:${DEFAULT_PORT}`;

  return `http://localhost:${DEFAULT_PORT}`;
}

/**
 * Ordered bases for the local Express API, then Cloud Run.
 * Physical devices skip loopback. Tunnel hosts are skipped because they only reach Metro.
 * @returns {string[]}
 */
export function getResilientApiBases() {
  const apiBaseList = [];
  const seenBases = new Set();

  const explicitBase = readExplicitApiBaseString();
  if (explicitBase) {
    appendUniqueReachableApiBase(apiBaseList, seenBases, explicitBase);
  }

  for (const hostUri of readExpoHostCandidates()) {
    if (typeof hostUri !== 'string') continue;
    const host = hostUri.split(':')[0]?.trim();
    if (!host || host === LOOPBACK_HOSTS[0] || host === LOOPBACK_HOSTS[1]) continue;
    if (isTunnelOrProxyHost(host)) continue;
    if (!isLikelyLanMetroHost(host)) continue;
    appendUniqueReachableApiBase(apiBaseList, seenBases, `http://${host}:${DEFAULT_PORT}`);
  }

  appendUniqueReachableApiBase(apiBaseList, seenBases, getApiBase());
  getApiBaseCandidates().forEach((candidate) => {
    appendUniqueReachableApiBase(apiBaseList, seenBases, candidate);
  });

  if (PRODUCTION_API_BASE_URL) {
    appendUniqueReachableApiBase(apiBaseList, seenBases, PRODUCTION_API_BASE_URL.replace(/\/$/, ''));
  }

  // Every candidate was filtered (tunnel + phone + only loopback). Still try the primary once,
  // even when that primary is loopback — this branch does not use the physical-device filter.
  if (apiBaseList.length === 0) {
    const primaryBase = normalizeApiBase(getApiBase());
    if (primaryBase) apiBaseList.push(primaryBase);
  }
  return apiBaseList;
}

/**
 * AI coach bases. Cloud Run is first because local servers often lack the web-search keys.
 * @returns {string[]}
 */
export function getAICoachApiBases() {
  const apiBaseList = [];
  const seenBases = new Set();

  appendUniqueReachableApiBase(apiBaseList, seenBases, PRODUCTION_API_BASE_URL);

  const explicitBase = readExplicitApiBaseString();
  if (explicitBase && !isCloudHostedApiBase(explicitBase)) {
    appendUniqueReachableApiBase(apiBaseList, seenBases, explicitBase);
  }

  for (const base of getResilientApiBases()) {
    if (!isCloudHostedApiBase(base)) {
      appendUniqueReachableApiBase(apiBaseList, seenBases, base);
    }
  }

  if (explicitBase && isCloudHostedApiBase(explicitBase)) {
    appendUniqueReachableApiBase(apiBaseList, seenBases, explicitBase);
  }

  return apiBaseList.length ? apiBaseList : [PRODUCTION_API_BASE_URL.replace(/\/$/, '')];
}

/**
 * Primary base, then localhost / 127.0.0.1 on this port and the next two.
 * @returns {string[]}
 */
export function getApiBaseCandidates() {
  const primaryBase = getApiBase();
  const seenBases = new Set([primaryBase]);
  const candidates = [primaryBase];
  for (const fallbackBase of localDevFallbackBases()) {
    if (!seenBases.has(fallbackBase)) {
      seenBases.add(fallbackBase);
      candidates.push(fallbackBase);
    }
  }
  return candidates;
}
