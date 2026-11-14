// Picks which Coach Connect API host to call (Cloud Run, local Express, or LAN IP from Metro).
// Flow: read overrides → infer dev LAN host → build ordered fallback lists per feature.
// Used across auth, chat, onboarding, workouts, and AI coach — export names are frozen.

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ===== NAMED CONSTANTS =====

// Manipulate here: local Express port. Fallback lists also try the next two ports.
const DEFAULT_PORT = 4000;

/** Always-on production API (Google Cloud Run) — no local `npm run server` required. */
export const PRODUCTION_API_BASE_URL =
  'https://coachconnect-api-421005574501.us-central1.run.app';

const LOOPBACK_HOST_LOCALHOST = 'localhost';
const LOOPBACK_HOST_IPV4 = '127.0.0.1';
const LOOPBACK_HOSTS = [LOOPBACK_HOST_LOCALHOST, LOOPBACK_HOST_IPV4];

const PRIVATE_LAN_FIRST_OCTET_10 = 10;
const PRIVATE_LAN_FIRST_OCTET_192 = 192;
const PRIVATE_LAN_SECOND_OCTET_168 = 168;
const PRIVATE_LAN_FIRST_OCTET_172 = 172;
const PRIVATE_LAN_172_SECOND_MIN = 16;
const PRIVATE_LAN_172_SECOND_MAX = 31;

// ===== HELPER FUNCTIONS =====

/**
 * Strip trailing slash and whitespace so Set membership stays consistent.
 * @param {string} candidateBase
 * @returns {string}
 */
function normalizeApiBase(candidateBase) {
  return String(candidateBase || '')
    .trim()
    .replace(/\/$/, '');
}

/**
 * True when this base points at localhost / 127.0.0.1 (useless on a physical phone).
 * @param {string} base
 * @returns {boolean}
 */
function isLoopbackBase(base) {
  return /localhost|127\.0\.0\.1/i.test(String(base || ''));
}

/**
 * True on a real phone/tablet (not simulator / browser).
 * vocab: Constants.isDevice = Expo flag for physical hardware
 * @returns {boolean}
 */
function isPhysicalDevice() {
  return Constants.isDevice === true;
}

/**
 * True when this base is Cloud Run, Cloud Functions, or App Engine.
 * @param {string} base
 * @returns {boolean}
 */
export function isCloudHostedApiBase(base) {
  const baseText = String(base || '').toLowerCase();
  const isCloudRun = baseText.includes('run.app');
  const isCloudFunctions = baseText.includes('cloudfunctions.net');
  const isAppEngine = baseText.includes('appspot.com');
  return isCloudRun || isCloudFunctions || isAppEngine;
}

/**
 * Push a normalized base once. Physical phones skip loopback addresses.
 * @param {string[]} apiBaseList
 * @param {Set<string>} seenBases
 * @param {string} candidateBase
 */
function addApiBaseOnce(apiBaseList, seenBases, candidateBase) {
  const normalizedBase = normalizeApiBase(candidateBase);
  if (!normalizedBase) {
    return;
  }
  if (seenBases.has(normalizedBase)) {
    return;
  }
  if (isPhysicalDevice() && isLoopbackBase(normalizedBase)) {
    return;
  }
  seenBases.add(normalizedBase);
  apiBaseList.push(normalizedBase);
}

// ===== MAIN FUNCTION =====

/**
 * The single best API base to use right now. No trailing slash.
 * Set EXPO_PUBLIC_API_BASE_URL or app.config extra.apiBaseUrl to force a specific one.
 * @returns {string}
 */
export function getApiBase() {
  // 1. Someone explicitly told us which URL to use — honor that first.
  const explicitBase = readPrimaryApiBaseOverride();
  if (explicitBase) {
    return explicitBase.replace(/\/$/, '');
  }

  // 2. Otherwise, production Cloud Run is the default (always reachable).
  if (PRODUCTION_API_BASE_URL) {
    return PRODUCTION_API_BASE_URL.replace(/\/$/, '');
  }

  // 3. iOS Simulator shares the Mac network stack, so plain "localhost" works.
  if (isIosSimulator()) {
    return `http://localhost:${DEFAULT_PORT}`;
  }

  // 4. A real phone on the same Wi‑Fi needs the Mac's LAN address, not "localhost".
  const lanHost = findMetroLanHostForPhone();
  if (lanHost) {
    return `http://${lanHost}:${DEFAULT_PORT}`;
  }

  // 5. Nothing else matched — fall back to localhost (works on the Mac itself).
  return `http://localhost:${DEFAULT_PORT}`;
}

/**
 * Primary base, then localhost / 127.0.0.1 on this port and the next two ports.
 * @returns {string[]}
 */
export function getApiBaseCandidates() {
  const primaryBase = getApiBase();
  const seenBases = new Set([primaryBase]);
  const candidates = [primaryBase];

  // 1. Append local Express port fallbacks the primary did not already include.
  for (const fallbackBase of localDevPortFallbackBases()) {
    if (seenBases.has(fallbackBase)) {
      continue;
    }
    seenBases.add(fallbackBase);
    candidates.push(fallbackBase);
  }
  return candidates;
}

/**
 * Ordered bases for the local Express API, then Cloud Run.
 * Physical phones skip "localhost". Tunnel hosts are skipped — they only reach Metro.
 * @returns {string[]}
 */
export function getResilientApiBases() {
  const apiBaseList = [];
  const seenBases = new Set();

  // 1. Explicit override from env / app.config, if any.
  const explicitBase = readExplicitApiBaseString();
  if (explicitBase) {
    addApiBaseOnce(apiBaseList, seenBases, explicitBase);
  }

  // 2. LAN hosts Expo reports for Metro (skip loopback + tunnels).
  for (const hostUri of readExpoHostCandidates()) {
    if (typeof hostUri !== 'string') {
      continue;
    }
    const host = hostUri.split(':')[0]?.trim();
    if (!host) {
      continue;
    }
    const isLoopbackHost =
      host === LOOPBACK_HOST_LOCALHOST || host === LOOPBACK_HOST_IPV4;
    if (isLoopbackHost) {
      continue;
    }
    if (isTunnelOrProxyHost(host)) {
      continue;
    }
    if (!isLikelyLanMetroHost(host)) {
      continue;
    }
    addApiBaseOnce(apiBaseList, seenBases, `http://${host}:${DEFAULT_PORT}`);
  }

  // 3. Primary getApiBase + short local-port candidates + production Cloud Run.
  addApiBaseOnce(apiBaseList, seenBases, getApiBase());
  for (const candidate of getApiBaseCandidates()) {
    addApiBaseOnce(apiBaseList, seenBases, candidate);
  }
  if (PRODUCTION_API_BASE_URL) {
    addApiBaseOnce(apiBaseList, seenBases, PRODUCTION_API_BASE_URL.replace(/\/$/, ''));
  }

  // 4. Empty list is not useful — push the normalized primary as a last resort.
  if (apiBaseList.length === 0) {
    const primaryBase = normalizeApiBase(getApiBase());
    if (primaryBase) {
      apiBaseList.push(primaryBase);
    }
  }
  return apiBaseList;
}

/**
 * AI Coach bases. Cloud Run first — local Express often lacks web-search API keys.
 * @returns {string[]}
 */
export function getAICoachApiBases() {
  const apiBaseList = [];
  const seenBases = new Set();

  // 1. Production Cloud Run always leads for AI coach.
  apiBaseList.push(PRODUCTION_API_BASE_URL);
  seenBases.add(PRODUCTION_API_BASE_URL.replace(/\/$/, ''));

  // 2. Non-cloud explicit override (local Express) next.
  const explicitBase = readExplicitApiBaseString();
  if (explicitBase && !isCloudHostedApiBase(explicitBase)) {
    addApiBaseOnce(apiBaseList, seenBases, explicitBase);
  }

  // 3. Other resilient non-cloud bases, then a cloud explicit override if set.
  for (const base of getResilientApiBases()) {
    if (!isCloudHostedApiBase(base)) {
      addApiBaseOnce(apiBaseList, seenBases, base);
    }
  }
  if (explicitBase && isCloudHostedApiBase(explicitBase)) {
    addApiBaseOnce(apiBaseList, seenBases, explicitBase);
  }

  if (apiBaseList.length) {
    return apiBaseList;
  }
  return [PRODUCTION_API_BASE_URL.replace(/\/$/, '')];
}

/**
 * Ordered API bases for a long workout-plan request. Cloud Run is tried first.
 * @returns {string[]}
 */
export function getWorkoutGenerationApiBases() {
  const apiBaseList = [];
  const seenBases = new Set();

  // 1. Production Cloud Run first (long-running plan generation).
  addApiBaseOnce(apiBaseList, seenBases, PRODUCTION_API_BASE_URL);

  // 2. Non-cloud explicit override, then every resilient base, then cloud override.
  const explicitBase = readExplicitApiBaseString();
  if (explicitBase && !isCloudHostedApiBase(explicitBase)) {
    addApiBaseOnce(apiBaseList, seenBases, explicitBase);
  }
  for (const base of getResilientApiBases()) {
    addApiBaseOnce(apiBaseList, seenBases, base);
  }
  if (explicitBase && isCloudHostedApiBase(explicitBase)) {
    addApiBaseOnce(apiBaseList, seenBases, explicitBase);
  }

  if (apiBaseList.length) {
    return apiBaseList;
  }
  return [PRODUCTION_API_BASE_URL.replace(/\/$/, '')];
}

// ===== PLUMBING — skip unless debugging =====

// Tunnel hosts (Expo Go over the internet) reach Metro only — not Express on port 4000.
function isTunnelOrProxyHost(host) {
  const hostText = String(host || '').toLowerCase();
  if (!hostText) {
    return false;
  }
  if (hostText.includes('exp.direct')) return true;
  if (hostText.includes('exp.host')) return true;
  if (hostText.includes('ngrok')) return true;
  if (hostText.includes('ngrok-free')) return true;
  if (hostText.includes('tunnel')) return true;
  if (hostText.endsWith('.trycloudflare.com')) return true;
  return false;
}

function isLikelyLanMetroHost(host) {
  const hostText = String(host || '').trim();
  if (!hostText || isTunnelOrProxyHost(hostText)) {
    return false;
  }
  // Bonjour-style ".local" names on the same Wi‑Fi.
  if (hostText.endsWith('.local')) {
    return true;
  }

  const ipMatch = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostText);
  if (!ipMatch) {
    return false;
  }

  const firstOctet = Number(ipMatch[1]);
  const secondOctet = Number(ipMatch[2]);
  if (firstOctet === PRIVATE_LAN_FIRST_OCTET_10) {
    return true;
  }
  if (firstOctet === PRIVATE_LAN_FIRST_OCTET_192 && secondOctet === PRIVATE_LAN_SECOND_OCTET_168) {
    return true;
  }
  if (
    firstOctet === PRIVATE_LAN_FIRST_OCTET_172 &&
    secondOctet >= PRIVATE_LAN_172_SECOND_MIN &&
    secondOctet <= PRIVATE_LAN_172_SECOND_MAX
  ) {
    return true;
  }
  return false;
}

function readExpoHostCandidates() {
  // vocab: hostUri / debuggerHost = where Expo Metro thinks the packager lives
  return [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    Constants.manifest?.debuggerHost,
    Constants.manifest2?.extra?.expoGo?.debuggerHost,
  ];
}

function readEnvApiBaseOverride() {
  const envExists = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL;
  if (!envExists) return '';
  return String(process.env.EXPO_PUBLIC_API_BASE_URL).trim();
}

function readExpoExtraApiBaseOverride() {
  const upperExtra = Constants.expoConfig?.extra?.API_BASE_URL;
  if (upperExtra) return String(upperExtra).trim();
  const camelExtra = Constants.expoConfig?.extra?.apiBaseUrl;
  if (camelExtra) return String(camelExtra).trim();
  return '';
}

// Env first, then app.config extra, then Cloud Run. Used by AI / workout base lists.
function readExplicitApiBaseString() {
  const fromEnvironment = readEnvApiBaseOverride();
  const fromExpoExtra = readExpoExtraApiBaseOverride();
  const pickedBase = fromEnvironment || fromExpoExtra || PRODUCTION_API_BASE_URL;
  const withoutTrailingSlash = String(pickedBase).replace(/\/$/, '');
  if (!withoutTrailingSlash) return null;
  return withoutTrailingSlash;
}

// getApiBase checks camel extra, then UPPER extra, then env — different order on purpose.
function readPrimaryApiBaseOverride() {
  const camelExtra = Constants.expoConfig?.extra?.apiBaseUrl;
  if (camelExtra) return String(camelExtra).trim();
  const upperExtra = Constants.expoConfig?.extra?.API_BASE_URL;
  if (upperExtra) return String(upperExtra).trim();
  return readEnvApiBaseOverride();
}

function isIosSimulator() {
  // vocab: __DEV__ = Metro development build (false in production binaries)
  const isIos = Platform.OS === 'ios';
  const isDevBuild = typeof __DEV__ !== 'undefined' && __DEV__;
  const isNotPhysicalDevice = Constants?.isDevice === false;
  return isIos && isDevBuild && isNotPhysicalDevice;
}

function findMetroLanHostForPhone() {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return null;
  }

  const candidates = readExpoHostCandidates().filter(Boolean);
  for (const hostUri of candidates) {
    if (typeof hostUri !== 'string') {
      continue;
    }
    const host = hostUri.split(':')[0]?.trim();
    const isLoopbackHost =
      host === LOOPBACK_HOST_LOCALHOST || host === LOOPBACK_HOST_IPV4;
    if (host && !isLoopbackHost && isLikelyLanMetroHost(host)) {
      return host;
    }
  }
  return null;
}

function localDevPortFallbackBases() {
  return [
    `http://localhost:${DEFAULT_PORT}`,
    `http://127.0.0.1:${DEFAULT_PORT}`,
    `http://localhost:${DEFAULT_PORT + 1}`,
    `http://127.0.0.1:${DEFAULT_PORT + 1}`,
    `http://localhost:${DEFAULT_PORT + 2}`,
    `http://127.0.0.1:${DEFAULT_PORT + 2}`,
  ];
}
