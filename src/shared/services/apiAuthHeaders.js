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
