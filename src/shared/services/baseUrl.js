import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_PORT = 4000;

/** Always-on production API (Google Cloud Run) — no local `npm run server` required. */
export const PRODUCTION_API_BASE_URL =
  'https://coachconnect-api-421005574501.us-central1.run.app';

function isPhysicalDevice() {
  return Constants.isDevice === true;
}

function isLoopbackBase(base) {
  return /localhost|127\.0\.0\.1/i.test(String(base || ''));
}

/** Hostnames that forward Metro (tunnel / ngrok) — they do NOT reach your Mac on :4000. */
function isTunnelOrProxyHost(host) {
  const h = String(host || '').toLowerCase();
  if (!h) return false;
  return (
    h.includes('exp.direct') ||
    h.includes('exp.host') ||
    h.includes('ngrok') ||
    h.includes('ngrok-free') ||
    h.includes('tunnel') ||
    h.endsWith('.trycloudflare.com')
  );
}

/** True when Expo host looks like LAN (Metro bundler IP), not a tunnel edge. */
function isLikelyLanMetroHost(host) {
  const h = String(host || '').trim();
  if (!h || isTunnelOrProxyHost(h)) return false;
  if (h.endsWith('.local')) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function readExplicitApiBaseString() {
  const fromEnv =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL
      ? String(process.env.EXPO_PUBLIC_API_BASE_URL).trim()
      : '';
  const fromExtra =
    (Constants.expoConfig?.extra?.API_BASE_URL && String(Constants.expoConfig.extra.API_BASE_URL).trim()) ||
    (Constants.expoConfig?.extra?.apiBaseUrl && String(Constants.expoConfig.extra.apiBaseUrl).trim());
  const baked = (fromEnv || fromExtra || PRODUCTION_API_BASE_URL).replace(/\/$/, '');
  return baked || null;
}

/**
 * Workout plan generation can take 1–2 minutes — try Cloud Run first, then local fallbacks.
 */
export function getWorkoutGenerationApiBases() {
  const list = [];
  const seen = new Set();
  const push = (u) => {
    const s = String(u || '').trim().replace(/\/$/, '');
    if (!s || seen.has(s)) return;
    if (isPhysicalDevice() && isLoopbackBase(s)) return;
    seen.add(s);
    list.push(s);
  };

  push(PRODUCTION_API_BASE_URL);

  const explicit = readExplicitApiBaseString();
  if (explicit && !isCloudHostedApiBase(explicit)) {
    push(explicit);
  }

  for (const base of getResilientApiBases()) {
    push(base);
  }

  if (explicit && isCloudHostedApiBase(explicit)) {
    push(explicit);
  }

  return list.length ? list : [PRODUCTION_API_BASE_URL.replace(/\/$/, '')];
}

function isTunnelingDevSession() {
  const uris = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    Constants.manifest?.debuggerHost,
    Constants.manifest2?.extra?.expoGo?.debuggerHost,
  ].filter((u) => typeof u === 'string');
  return uris.some((uri) => {
    const host = uri.split(':')[0]?.trim();
    return host && isTunnelOrProxyHost(host);
  });
}

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
    if (host && host !== 'localhost' && host !== '127.0.0.1' && isLikelyLanMetroHost(host)) return host;
  }
  return null;
}

/**
 * Primary API base (no trailing slash).
 * Set EXPO_PUBLIC_API_BASE_URL or app.config extra.apiBaseUrl to override.
 */
export const getApiBase = () => {
  // Explicit env var always wins (e.g. Cloud Run URL in production)
  const explicit =
    (Constants.expoConfig?.extra?.apiBaseUrl &&
      String(Constants.expoConfig.extra.apiBaseUrl).trim()) ||
    (Constants.expoConfig?.extra?.API_BASE_URL &&
      String(Constants.expoConfig.extra.API_BASE_URL).trim()) ||
    (typeof process !== 'undefined' &&
      process.env?.EXPO_PUBLIC_API_BASE_URL &&
      String(process.env.EXPO_PUBLIC_API_BASE_URL).trim());

  if (explicit) return explicit.replace(/\/$/, '');

  // Default to Cloud Run so exercise library, food search, and AI work without a local server.
  if (PRODUCTION_API_BASE_URL) return PRODUCTION_API_BASE_URL.replace(/\/$/, '');

  // iOS Simulator can reach the Mac via localhost in dev
  const isIosSimulator =
    Platform.OS === 'ios' &&
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    Constants?.isDevice === false;
  if (isIosSimulator) return `http://localhost:${DEFAULT_PORT}`;

  const lan = getDevLanHost();
  if (lan) return `http://${lan}:${DEFAULT_PORT}`;

  return `http://localhost:${DEFAULT_PORT}`;
};

/**
 * Ordered API bases for the local Express API (:4000).
 *
 * - **LAN / default Expo:** try Metro’s private-IP host first (fixes stale `EXPO_PUBLIC_API_BASE_URL`).
 * - **Tunnel / ngrok / `*.exp.direct`:** those hosts only reach Metro, **not** port 4000 — we skip them and
 *   prefer `EXPO_PUBLIC_API_BASE_URL` first when tunneling.
 *
 * On a physical device, loopback URLs are skipped.
 */
export function getResilientApiBases() {
  const list = [];
  const push = (u) => {
    const s = String(u || '').trim().replace(/\/$/, '');
    if (!s || list.includes(s)) return;
    if (isPhysicalDevice() && isLoopbackBase(s)) return;
    list.push(s);
  };

  const uriCandidates = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    Constants.manifest?.debuggerHost,
    Constants.manifest2?.extra?.expoGo?.debuggerHost,
  ];

  const explicit = readExplicitApiBaseString();

  // Explicit URL (e.g. Cloud Run) always gets top priority
  if (explicit) {
    push(explicit);
  }

  for (const uri of uriCandidates) {
    if (typeof uri !== 'string') continue;
    const host = uri.split(':')[0]?.trim();
    if (!host || host === 'localhost' || host === '127.0.0.1') continue;
    if (isTunnelOrProxyHost(host)) continue;
    if (!isLikelyLanMetroHost(host)) continue;
    push(`http://${host}:${DEFAULT_PORT}`);
  }

  push(getApiBase());
  getApiBaseCandidates().forEach(push);

  // Last resort: Cloud Run when local server is down or .env points at a stale LAN URL.
  if (PRODUCTION_API_BASE_URL) {
    push(PRODUCTION_API_BASE_URL.replace(/\/$/, ''));
  }

  // Tunnel + no LAN host + physical device can filter out every loopback candidate — still try primary once.
  if (list.length === 0) {
    const b = String(getApiBase() || '').trim().replace(/\/$/, '');
    if (b) list.push(b);
  }
  return list;
}

function isCloudHostedApiBase(base) {
  const b = String(base || '').toLowerCase();
  return b.includes('run.app') || b.includes('cloudfunctions.net') || b.includes('appspot.com');
}

function isLocalDevApiBase(base) {
  if (isCloudHostedApiBase(base)) return false;
  const b = String(base || '').toLowerCase();
  if (/localhost|127\.0\.0\.1/.test(b)) return true;
  try {
    const u = new URL(b.startsWith('http') ? b : `http://${b}`);
    return isLikelyLanMetroHost(u.hostname);
  } catch (_) {
    return false;
  }
}

/**
 * AI Coach API bases — same order as food search / nutrition (`getResilientApiBases`).
 * Uses EXPO_PUBLIC_API_BASE_URL (Cloud Run) when set so the coach works without `npm run server`.
 */
export function getAICoachApiBases() {
  return getResilientApiBases();
}

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
