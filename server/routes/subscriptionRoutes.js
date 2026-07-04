/** Apple IAP subscription verification + Firestore sync */
const admin = require('firebase-admin');
const {
  verifyApplePurchaseToken,
  verifyAppleRestoredPurchases,
} = require('../lib/appleSubscriptionVerify');

function registerSubscriptionRoutes(app, deps) {
  const { verifyFirebaseBearerToken } = deps;

  async function persistSubscription(uid, subscription) {
    await admin.firestore().collection('users').doc(uid).set(
      { subscription },
      { merge: true },
    );
    return subscription;
  }

  app.post('/api/subscription/apple/verify', verifyFirebaseBearerToken, async (req, res) => {
    try {
      const uid = req.firebaseAuth?.uid;
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });

      const { purchaseToken, productId, expirationDateIOS } = req.body || {};
      if (!purchaseToken) {
        return res.status(400).json({ error: 'purchaseToken is required', code: 'invalid_token' });
      }

      const { subscription } = verifyApplePurchaseToken(purchaseToken, {
        productId,
        expirationDateIOS,
      });

      await persistSubscription(uid, subscription);
      return res.json({ ok: true, subscription });
    } catch (e) {
      const code = e?.code || 'verification_failed';
      if (code === 'invalid_token') {
        return res.status(400).json({ error: e.message, code });
      }
      if (code === 'verification_failed') {
        return res.status(403).json({
          error: 'Purchase verification failed. Contact support if this continues.',
          code,
        });
      }
      console.error('POST /api/subscription/apple/verify failed:', e?.message || e);
      return res.status(500).json({ error: 'Verification failed', code: 'server_error' });
    }
  });

  app.post('/api/subscription/apple/restore', verifyFirebaseBearerToken, async (req, res) => {
    try {
      const uid = req.firebaseAuth?.uid;
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });

      const purchases = Array.isArray(req.body?.purchases) ? req.body.purchases : [];
      if (!purchases.length) {
        return res.status(400).json({ error: 'No purchases to restore', code: 'not_found' });
      }

      const subscription = verifyAppleRestoredPurchases(purchases);
      await persistSubscription(uid, subscription);
      return res.json({ ok: true, subscription });
    } catch (e) {
      const code = e?.code || 'restore_failed';
      if (code === 'not_found') {
        return res.status(404).json({ error: e.message, code });
      }
      if (code === 'verification_failed' || code === 'invalid_token') {
        return res.status(403).json({
          error: 'Could not verify restored purchases. Contact support.',
          code: 'verification_failed',
        });
      }
      console.error('POST /api/subscription/apple/restore failed:', e?.message || e);
      return res.status(500).json({ error: 'Restore failed', code: 'server_error' });
    }
  });
}

module.exports = { registerSubscriptionRoutes };
