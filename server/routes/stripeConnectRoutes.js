/** Trainer Stripe Connect Express onboarding + status + balance. */
const admin = require('firebase-admin');
const { getStripe } = require('../lib/stripeClient');

const DEEP_LINK_RETURN = 'coachconnect://stripe/complete';
const DEEP_LINK_REFRESH = 'coachconnect://stripe/reauth';
const RETURN_PATH = '/api/stripe/connect/return';
const REFRESH_PATH = '/api/stripe/connect/refresh';

function resolveStripeConnectPublicBase() {
  const raw =
    process.env.STRIPE_CONNECT_PUBLIC_BASE_URL ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    'https://coachconnect-api-421005574501.us-central1.run.app';
  return String(raw).trim().replace(/\/$/, '');
}

/** Stripe Account Links require https:// URLs — deep links are handled via redirect pages. */
function resolveConnectUrl(envKey, pathSuffix) {
  const raw = String(process.env[envKey] || '').trim();
  if (raw && /^https?:\/\//i.test(raw)) return raw;
  return `${resolveStripeConnectPublicBase()}${pathSuffix}`;
}

function stripeConnectRedirectHtml(deepLink, title) {
  const safeLink = String(deepLink || '').replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <script>window.location.replace(${JSON.stringify(deepLink)});</script>
  <meta http-equiv="refresh" content="0;url=${safeLink}" />
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 48px 24px;">
  <p>Returning to Coach Connect…</p>
  <p><a href="${safeLink}">Tap here</a> if you are not redirected automatically.</p>
</body>
</html>`;
}

function centsToDollars(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n / 100) * 100) / 100;
}

function sumBalanceAmount(balanceList, currency = 'usd') {
  if (!Array.isArray(balanceList)) return 0;
  return balanceList
    .filter((entry) => String(entry?.currency || '').toLowerCase() === currency)
    .reduce((sum, entry) => sum + Number(entry?.amount || 0), 0);
}

function registerStripeConnectRoutes(app, deps) {
  const { verifyFirebaseBearerToken } = deps;

  app.get(RETURN_PATH, (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(stripeConnectRedirectHtml(DEEP_LINK_RETURN, 'Coach Connect — Stripe complete'));
  });

  app.get(REFRESH_PATH, (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(stripeConnectRedirectHtml(DEEP_LINK_REFRESH, 'Coach Connect — Stripe refresh'));
  });

  app.post('/api/stripe/create-account', verifyFirebaseBearerToken, async (req, res) => {
    try {
      const stripe = getStripe();
      if (!stripe) {
        console.error('POST /api/stripe/create-account: STRIPE_SECRET_KEY missing');
        return res.status(500).json({ error: 'Stripe is not configured. Contact support.' });
      }

      if (!admin.apps.length) {
        return res.status(503).json({ error: 'Service unavailable' });
      }

      const uid = String(req.firebaseAuth?.uid || '').trim();
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const db = admin.firestore();
      const userRef = db.collection('users').doc(uid);
      const userSnap = await userRef.get();
      const user = userSnap.exists ? userSnap.data() || {} : {};
      const role = String(user.role || '').trim().toLowerCase();
      if (role && role !== 'trainer') {
        return res.status(403).json({ error: 'Only trainers can connect payouts' });
      }

      const email = String(req.body?.email || user.email || req.firebaseAuth?.email || '').trim();
      if (!email) {
        return res.status(400).json({ error: 'email is required' });
      }

      let accountId = String(user.stripeAccountId || '').trim();

      if (!accountId) {
        const account = await stripe.accounts.create({
          type: 'express',
          country: 'US',
          email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
        });
        accountId = account.id;

        await userRef.set(
          {
            stripeAccountId: accountId,
            stripeStatus: 'pending_verification',
            stripeConnectStatus: 'pending',
            stripeCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }

      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        type: 'account_onboarding',
        refresh_url: resolveConnectUrl('STRIPE_CONNECT_REFRESH_URL', REFRESH_PATH),
        return_url: resolveConnectUrl('STRIPE_CONNECT_RETURN_URL', RETURN_PATH),
      });

      return res.json({ url: accountLink.url });
    } catch (e) {
      console.error('POST /api/stripe/create-account failed:', e?.message || e);
      if (e?.code === 'stripe_not_configured') {
        return res.status(500).json({ error: 'Stripe is not configured. Contact support.' });
      }
      const stripeMsg = String(e?.raw?.message || e?.message || '');
      if (/signed up for Connect|connect\.stripe\.com\/connect/i.test(stripeMsg)) {
        return res.status(503).json({
          error:
            'Stripe Connect is not enabled on this Stripe account yet. Enable Connect at dashboard.stripe.com/connect, then retry.',
          code: 'stripe_connect_not_enabled',
        });
      }
      return res.status(500).json({
        error: stripeMsg || 'Could not start payout setup. Please try again.',
      });
    }
  });

  app.post('/api/stripe/verify-status', verifyFirebaseBearerToken, async (req, res) => {
    try {
      const stripe = getStripe();
      if (!stripe) {
        console.error('POST /api/stripe/verify-status: STRIPE_SECRET_KEY missing');
        return res.status(500).json({ error: 'Stripe is not configured. Contact support.' });
      }

      if (!admin.apps.length) {
        return res.status(503).json({ error: 'Service unavailable' });
      }

      const uid = String(req.firebaseAuth?.uid || '').trim();
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const db = admin.firestore();
      const userRef = db.collection('users').doc(uid);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        return res.status(400).json({ error: 'Account not found' });
      }

      const user = userSnap.data() || {};
      const accountId = String(user.stripeAccountId || '').trim();
      if (!accountId) {
        return res.status(400).json({ error: 'Stripe account not found. Set up payouts first.' });
      }

      const account = await stripe.accounts.retrieve(accountId);
      const status = account.charges_enabled ? 'active' : 'pending_verification';
      const legacyStatus = account.charges_enabled ? 'active' : 'pending';

      await userRef.set({ stripeStatus: status, stripeConnectStatus: legacyStatus }, { merge: true });

      return res.json({
        status,
        account_id: accountId,
      });
    } catch (e) {
      console.error('POST /api/stripe/verify-status failed:', e?.message || e);
      if (e?.code === 'stripe_not_configured') {
        return res.status(500).json({ error: 'Stripe is not configured. Contact support.' });
      }
      return res.status(500).json({
        error: 'Could not verify payout status. Please try again.',
      });
    }
  });

  app.post('/api/stripe/get-balance', verifyFirebaseBearerToken, async (req, res) => {
    try {
      const stripe = getStripe();
      if (!stripe) {
        console.error('POST /api/stripe/get-balance: STRIPE_SECRET_KEY missing');
        return res.status(500).json({ error: 'Stripe is not configured. Contact support.' });
      }

      if (!admin.apps.length) {
        return res.status(503).json({ error: 'Service unavailable' });
      }

      const uid = String(req.firebaseAuth?.uid || '').trim();
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const db = admin.firestore();
      const userSnap = await db.collection('users').doc(uid).get();

      if (!userSnap.exists) {
        return res.status(400).json({ error: 'Account not found' });
      }

      const user = userSnap.data() || {};
      const accountId = String(user.stripeAccountId || '').trim();
      if (!accountId) {
        return res.status(400).json({ error: 'Stripe account not found. Set up payouts first.' });
      }

      const balance = await stripe.balance.retrieve({ stripeAccount: accountId });
      const pendingCents = sumBalanceAmount(balance.pending);
      const availableCents = sumBalanceAmount(balance.available);

      return res.json({
        pending: centsToDollars(pendingCents),
        available: centsToDollars(availableCents),
      });
    } catch (e) {
      console.error('POST /api/stripe/get-balance failed:', e?.message || e);
      if (e?.code === 'stripe_not_configured') {
        return res.status(500).json({ error: 'Stripe is not configured. Contact support.' });
      }
      return res.status(500).json({
        error: 'Could not load balance. Please try again.',
      });
    }
  });
}

module.exports = { registerStripeConnectRoutes };
