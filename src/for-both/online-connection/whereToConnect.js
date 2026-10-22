// whereToConnect.js
//
// This file answers one question: "which server URL should the app talk to right now?"
// In production the answer is always our Cloud Run server. While developing, it can also be
// your Mac's local Express server (port 4000) reached over your phone's WiFi.
//
// Exports (other files import these — names are fixed):
//   PRODUCTION_API_BASE_URL   -> the live Cloud Run URL, always available as a fallback
//   isCloudHostedApiBase(url) -> true if a URL is Cloud Run / Cloud Functions / App Engine
//   getApiBase()              -> the one best URL to use right now
//   getResilientApiBases()    -> local dev server first, then Cloud Run, as a list to try in order
//   getAICoachApiBases()      -> same idea, but Cloud Run first (local dev may be missing web-search keys)
//   getWorkoutGenerationApiBases() -> same idea for the long workout-plan request
//   getApiBaseCandidates()    -> primary URL, then a few local ports to try next

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ===== NAMED CONSTANTS =====

// Manipulate here: the local Express port. The fallback list below also tries the next two ports.
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

// Tunnel hosts (used by Expo Go to reach Metro over the internet) do not reach the Mac's
// Express server on port 4000 — only Metro listens there. So we skip them for API calls.
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

// Is this a normal home/office WiFi address (or a *.local name)? Those are the only hosts
// where "my phone talks to my Mac on the same network" actually works.
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

// Expo stores "where is Metro running" in a few different places depending on the Expo
// version and whether we're in Expo Go or a dev build. Check every place it could be.
function readExpoHostCandidates() {
  return [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    Constants.manifest?.debuggerHost,
    Constants.manifest2?.extra?.expoGo?.debuggerHost,
  ];
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

// Env var first, then app config, then Cloud Run. Used by getWorkoutGenerationApiBases and
// getAICoachApiBases — note this check order is NOT the same as getApiBase() below.
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

// getApiBase() checks extra.apiBaseUrl, then extra.API_BASE_URL, then the env var —
// a different priority than readExplicitApiBaseString above, on purpose.
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

// Metro prints the computer's WiFi address in its "host URI". A real phone cannot use
// "localhost" to mean "the computer running Metro" — it needs that WiFi address instead.
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

// Adds one URL to the list, but only once, and never a "localhost" URL on a real phone
// (a real phone cannot open "localhost" and reach the developer's computer).
function appendUniqueReachableApiBase(apiBaseList, seenBases, candidateBase) {
  const normalizedBase = normalizeApiBase(candidateBase);
  if (!normalizedBase || seenBases.has(normalizedBase)) return;
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
 * Ordered API bases for a long workout-plan request. Cloud Run is tried first.
 * @returns {string[]}
 */
export function getWorkoutGenerationApiBases() {
  const apiBaseList = [];
  const seenBases = new Set();

  // Step 1: Cloud Run always goes first — it's the one that's always up.
  appendUniqueReachableApiBase(apiBaseList, seenBases, PRODUCTION_API_BASE_URL);

  // Step 2: If someone set a non-Cloud-Run override (e.g. a local test server), try it next.
  const explicitBase = readExplicitApiBaseString();
  if (explicitBase && !isCloudHostedApiBase(explicitBase)) {
    appendUniqueReachableApiBase(apiBaseList, seenBases, explicitBase);
  }

  // Step 3: Then everything from the general-purpose resilient list (local dev, LAN, etc.).
  for (const base of getResilientApiBases()) {
    appendUniqueReachableApiBase(apiBaseList, seenBases, base);
  }

  // Step 4: If the override was Cloud Run-flavored, make sure it's included too.
  if (explicitBase && isCloudHostedApiBase(explicitBase)) {
    appendUniqueReachableApiBase(apiBaseList, seenBases, explicitBase);
  }

  // Step 5: Never return an empty list — fall back to production as a last resort.
  return apiBaseList.length ? apiBaseList : [PRODUCTION_API_BASE_URL.replace(/\/$/, '')];
}

/**
 * The single best API base to use right now. No trailing slash.
 * Set EXPO_PUBLIC_API_BASE_URL or app.config extra.apiBaseUrl to force a specific one.
 * @returns {string}
 */
export function getApiBase() {
  // Step 1: Someone explicitly told us which URL to use — honor that first.
  const explicitBase = readPrimaryApiBaseOverride();
  if (explicitBase) return explicitBase.replace(/\/$/, '');

  // Step 2: Otherwise, production Cloud Run is the default (it's always reachable).
  if (PRODUCTION_API_BASE_URL) return PRODUCTION_API_BASE_URL.replace(/\/$/, '');

  // Step 3: An iOS Simulator shares the Mac's network stack, so plain "localhost" works.
  if (isIosSimulator()) return `http://localhost:${DEFAULT_PORT}`;

  // Step 4: A real phone on the same WiFi needs the Mac's WiFi address, not "localhost".
  const lanHost = getDevLanHost();
  if (lanHost) return `http://${lanHost}:${DEFAULT_PORT}`;

  // Step 5: Nothing else matched — fall back to localhost (works on the Mac itself).
  return `http://localhost:${DEFAULT_PORT}`;
}

/**
 * Ordered bases for the local Express API, then Cloud Run.
 * Physical phones skip "localhost" addresses. Tunnel hosts are skipped — they only reach Metro.
 * @returns {string[]}
 */
export function getResilientApiBases() {
  const apiBaseList = [];
  const seenBases = new Set();

  // Step 1: An explicit override (env var or app config) always goes first.
  const explicitBase = readExplicitApiBaseString();
  if (explicitBase) {
    appendUniqueReachableApiBase(apiBaseList, seenBases, explicitBase);
  }

  // Step 2: Any WiFi address Metro reported — this is how a phone reaches the dev Mac.
  for (const hostUri of readExpoHostCandidates()) {
    if (typeof hostUri !== 'string') continue;
    const host = hostUri.split(':')[0]?.trim();
    if (!host || host === LOOPBACK_HOSTS[0] || host === LOOPBACK_HOSTS[1]) continue;
    if (isTunnelOrProxyHost(host)) continue;
    if (!isLikelyLanMetroHost(host)) continue;
    appendUniqueReachableApiBase(apiBaseList, seenBases, `http://${host}:${DEFAULT_PORT}`);
  }

  // Step 3: The normal "best single URL" from getApiBase(), plus the local port fallbacks.
  appendUniqueReachableApiBase(apiBaseList, seenBases, getApiBase());
  getApiBaseCandidates().forEach((candidate) => {
    appendUniqueReachableApiBase(apiBaseList, seenBases, candidate);
  });

  // Step 4: Cloud Run is always a safety net at the end of the list.
  if (PRODUCTION_API_BASE_URL) {
    appendUniqueReachableApiBase(apiBaseList, seenBases, PRODUCTION_API_BASE_URL.replace(/\/$/, ''));
  }

  // Step 5: If every candidate got filtered out (e.g. tunnel host + phone + only localhost left),
  // still try the primary URL once — this one case ignores the "no localhost on a phone" rule.
  if (apiBaseList.length === 0) {
    const primaryBase = normalizeApiBase(getApiBase());
    if (primaryBase) apiBaseList.push(primaryBase);
  }
  return apiBaseList;
}

/**
 * AI Coach bases. Cloud Run is tried first because local dev servers often don't have
 * the web-search API keys configured.
 * @returns {string[]}
 */
export function getAICoachApiBases() {
  const apiBaseList = [];
  const seenBases = new Set();

  // Step 1: Cloud Run first — it's the one guaranteed to have the web-search keys.
  apiBaseList.push(PRODUCTION_API_BASE_URL);
  seenBases.add(PRODUCTION_API_BASE_URL.replace(/\/$/, ''));

  // Step 2: A non-Cloud-Run override (e.g. testing against a local server) comes next.
  const explicitBase = readExplicitApiBaseString();
  if (explicitBase && !isCloudHostedApiBase(explicitBase)) {
    appendUniqueReachableApiBase(apiBaseList, seenBases, explicitBase);
  }

  // Step 3: Add the rest of the resilient list, skipping anything already Cloud Run flavored.
  for (const base of getResilientApiBases()) {
    if (!isCloudHostedApiBase(base)) {
      appendUniqueReachableApiBase(apiBaseList, seenBases, base);
    }
  }

  // Step 4: If the override itself was Cloud Run, make sure it's in the list too.
  if (explicitBase && isCloudHostedApiBase(explicitBase)) {
    appendUniqueReachableApiBase(apiBaseList, seenBases, explicitBase);
  }

  // Step 5: Never return an empty list.
  return apiBaseList.length ? apiBaseList : [PRODUCTION_API_BASE_URL.replace(/\/$/, '')];
}

/**
 * Primary base, then localhost / 127.0.0.1 on this port and the next two ports.
 * @returns {string[]}
 */
export function getApiBaseCandidates() {
  // Step 1: Start with whatever getApiBase() picked as the single best URL.
  const primaryBase = getApiBase();
  const seenBases = new Set([primaryBase]);
  const candidates = [primaryBase];

  // Step 2: Add a few more local ports in case the server is running on one of those instead.
  for (const fallbackBase of localDevFallbackBases()) {
    if (!seenBases.has(fallbackBase)) {
      seenBases.add(fallbackBase);
      candidates.push(fallbackBase);
    }
  }
  return candidates;
}
