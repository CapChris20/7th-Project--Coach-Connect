/**
 * Shared fetch helpers for Coach Connect API calls.
 */
import logger from './logger';

export async function fetchWithTimeout(url, init = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') {
      const timeoutErr = new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
      timeoutErr.code = 'timeout';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function postJsonWithTimeout(url, body, headers, timeoutMs) {
  return fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
}

export function logApiAttempt(label, url, err) {
  if (!__DEV__) return;
  logger.warn(`[api] ${label} failed`, {
    url,
    message: err?.message || String(err),
    code: err?.code,
  });
}
