/**
 * Stripe webhook — account + charge reconciliation (idempotent Firestore writes).
 *
 * External API: Stripe webhooks (signed with STRIPE_WEBHOOK_SECRET).
 * Must receive raw body — register before express.json().
 */
const admin = require('firebase-admin');
const { getStripe } = require('../lib/stripeClient');

function registerStripeWebhookRoutes(app) {
  // Caller must mount with express.raw before express.json.
  app.post('/api/stripe/webhook', handleStripeWebhook);
}

async function handleStripeWebhook(req, res) {
    const stripe = getStripe();
    const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();

    if (!stripe) {
      console.error('POST /api/stripe/webhook: STRIPE_SECRET_KEY missing');
      return res.status(500).json({ error: 'Stripe not configured' });
    }
    if (!webhookSecret) {
      console.error('POST /api/stripe/webhook: STRIPE_WEBHOOK_SECRET missing');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    if (!admin.apps.length) {
      return res.status(503).json({ error: 'Service unavailable' });
    }

    const signature = req.headers['stripe-signature'];
    let event;
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (e) {
      console.error('Stripe webhook signature verify failed:', e?.message || e);
      return res.status(400).send(`Webhook Error: ${e?.message || 'invalid signature'}`);
    }

    const db = admin.firestore();
    const eventRef = db.collection('stripe_webhook_events').doc(event.id);

    try {
      const existing = await eventRef.get();
      if (existing.exists) {
        return res.json({ received: true, duplicate: true });
      }

      switch (event.type) {
        case 'account.updated': {
          const account = event.data.object;
          const accountId = String(account.id || '');
          if (accountId) {
            const snap = await db
              .collection('users')
              .where('stripeAccountId', '==', accountId)
              .limit(1)
              .get();
            if (!snap.empty) {
              const status = account.charges_enabled ? 'active' : 'pending_verification';
              await snap.docs[0].ref.set(
                {
                  stripeStatus: status,
                  stripeConnectStatus: status,
                  stripeChargesEnabled: !!account.charges_enabled,
                  stripePayoutsEnabled: !!account.payouts_enabled,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true },
              );
            }
          }
          break;
        }
        case 'charge.succeeded':
        case 'charge.failed':
        case 'charge.refunded': {
          const charge = event.data.object;
          const chargeId = String(charge.id || '');
          if (chargeId) {
            const paymentRef = db.collection('payments').doc(chargeId);
            const paymentSnap = await paymentRef.get();
            const status =
              event.type === 'charge.refunded'
                ? 'refunded'
                : event.type === 'charge.failed'
                  ? 'failed'
                  : charge.status === 'succeeded'
                    ? 'succeeded'
                    : String(charge.status || 'pending');
            if (paymentSnap.exists) {
              await paymentRef.set(
                {
                  status,
                  stripe_webhook_updated_at: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true },
              );
            } else {
              // Direct charge may land with metadata from our create call
              const meta = charge.metadata || {};
              await paymentRef.set(
                {
                  trainer_id: meta.coachconnect_trainer_id || null,
                  client_id: meta.coachconnect_client_id || null,
                  amount: typeof charge.amount === 'number' ? charge.amount / 100 : null,
                  status,
                  stripe_charge_id: chargeId,
                  source: 'webhook',
                  created_at: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true },
              );
            }
          }
          break;
        }
        default:
          break;
      }

      await eventRef.set({
        type: event.type,
        created: event.created || null,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.json({ received: true });
    } catch (e) {
      console.error('Stripe webhook handler failed:', e?.message || e);
      return res.status(500).json({ error: 'Webhook handler failed' });
    }
}

module.exports = { registerStripeWebhookRoutes, handleStripeWebhook };
