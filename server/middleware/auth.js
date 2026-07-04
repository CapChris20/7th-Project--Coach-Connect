const admin = require('firebase-admin');

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' && !!process.env.K_SERVICE;
}

function devOnlyRoute(req, res, next) {
  if (isProductionRuntime() && process.env.ALLOW_DEV_ROUTES !== '1') {
    return res.status(404).json({ error: 'Not found' });
  }
  return next();
}

async function verifyFirebaseBearerToken(req, res, next) {
  let token = '';
  try {
    const headerRaw = req.headers.authorization || '';
    const header = String(headerRaw).trim();
    const match = header.match(/^Bearer\s+(.+)$/i);
    token = match ? match[1] : header;
    token = String(token || '')
      .trim()
      .replace(/^Bearer\s+/i, '')
      .trim();
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))
    ) {
      token = token.slice(1, -1).trim();
    }
    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization: Bearer <token>' });
    }
    if (!admin.apps.length) {
      if (isProductionRuntime()) {
        return res.status(503).json({ error: 'Service unavailable' });
      }
      return res.status(503).json({
        error: 'Firebase Admin not initialized',
        hint: 'Add server/serviceAccountKey.json or FIREBASE_SERVICE_ACCOUNT_PATH, then restart npm run server',
      });
    }
    const decoded = await admin.auth().verifyIdToken(token, true);
    req.firebaseAuth = decoded;
    return next();
  } catch (e) {
    if (!isProductionRuntime()) {
      console.warn('verifyFirebaseBearerToken:', e?.code || e?.message || e);
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = {
  isProductionRuntime,
  devOnlyRoute,
  verifyFirebaseBearerToken,
};
