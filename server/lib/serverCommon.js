const admin = require('firebase-admin');

function isoDateKey(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

function serverTs() {
  return admin.apps.length
    ? admin.firestore.FieldValue.serverTimestamp()
    : new Date();
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch (_) {
    return null;
  }
}

function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

module.exports = { isoDateKey, serverTs, safeJsonParse, fetchWithTimeout };
