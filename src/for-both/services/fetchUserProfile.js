/**
 * User profile fetch — Firestore-first (production project anatrox-auth).
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../app-start/config';

/**
 * Load users/{uid} from Firestore.
 * @param {string} uid
 * @returns {Promise<object|null>}
 */
export async function fetchUserProfileFromFirestore(uid) {
  if (!uid || !db) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return { uid, ...(snap.data() || {}) };
  } catch (_) {
    return null;
  }
}

/**
 * Optional server fallback when Firestore read fails (legacy /api/me).
 * @param {import('firebase/auth').User} user
 * @returns {Promise<object|null>}
 */
export async function fetchUserProfileFromApi(user) {
  if (!user?.uid) return null;
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const fallbackBaseUrls = [
    'http://localhost:4002',
    'http://127.0.0.1:4002',
    'http://localhost:4001',
    'http://127.0.0.1:4001',
  ];
  const baseUrls = apiBaseUrl ? [apiBaseUrl, ...fallbackBaseUrls] : fallbackBaseUrls;

  await user.reload();
  const idToken = await user.getIdToken(true);

  for (const baseUrl of baseUrls) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    try {
      const resp = await fetch(`${baseUrl}/api/me`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}`, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error(`/api/me failed (${resp.status})`);
      const json = await resp.json();
      return json?.user || json || null;
    } catch (_) {
      /* try next base */
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return null;
}

/** Firestore first, then /api/me. */
export async function fetchUserProfile(user) {
  const uid = user?.uid;
  const fromFs = await fetchUserProfileFromFirestore(uid);
  if (fromFs) return fromFs;
  return fetchUserProfileFromApi(user);
}
