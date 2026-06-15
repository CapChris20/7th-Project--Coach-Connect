/**
 * api Auth Headers
 *
 * Purpose: Data/service layer: api Auth Headers. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: getApiAuthHeaders
 *
 * @file-header
 */
import { auth } from '../../app/config';

/**
 * Bearer token headers for Coach Connect API routes (Firebase ID token).
 */
export async function getApiAuthHeaders(extraHeaders = {}) {
  const headers = {
    Accept: 'application/json',
    ...extraHeaders,
  };
  const user = auth?.currentUser;
  if (user?.getIdToken) {
    const token = await user.getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
