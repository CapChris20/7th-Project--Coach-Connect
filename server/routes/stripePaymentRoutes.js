/** Client → trainer coaching charges (Stripe Connect direct charges). */
const admin = require('firebase-admin');
const { getStripe } = require('../lib/stripeClient');

const PLATFORM_FEE_RATE = 0.1;

function dollarsToCents(dollars) {
  const n = Number(dollars);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function registerStripePaymentRoutes(app, deps) {
  const { verifyFirebaseBearerToken } = deps;

  app.post('/api/charges', verifyFirebaseBearerToken, async (req, res) => {
    try {
      const stripe = getStripe();
      if (!stripe) {
        console.error('POST /api/charges: STRIPE_SECRET_KEY missing');
        return res.status(500).json({ error: 'Payments are temporarily unavailable. Please try again later.' });
      }

      if (!admin.apps.length) {
        return res.status(503).json({ error: 'Service unavailable' });
      }

      const clientId = String(req.firebaseAuth?.uid || '').trim();
      if (!clientId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const trainerId = String(req.body?.trainerId || '').trim();
      const amount = Number(req.body?.amount);
      const token = String(req.body?.token || '').trim();

      if (!trainerId) {
        return res.status(400).json({ error: 'trainerId is required' });
      }
      if (!token) {
        return res.status(400).json({ error: 'token is required' });
      }

      const amountCents = dollarsToCents(amount);
      if (!amountCents) {
        return res.status(400).json({ error: 'amount must be a positive number (dollars)' });
      }

      const db = admin.firestore();
      const [trainerSnap, clientSnap] = await Promise.all([
        db.collection('users').doc(trainerId).get(),
        db.collection('users').doc(clientId).get(),
      ]);

      if (!trainerSnap.exists) {
        return res.status(400).json({ error: 'Trainer not found' });
      }

      const trainer = trainerSnap.data() || {};
      if (trainer.role && trainer.role !== 'trainer') {
        return res.status(400).json({ error: 'Trainer not found' });
      }

      const stripeAccountId = String(trainer.stripeAccountId || '').trim();
      const stripeStatus = String(trainer.stripeStatus || '').trim();

      if (!stripeAccountId || stripeStatus !== 'active') {
        return res.status(400).json({ error: 'Trainer has not set up payments' });
      }

      const client = clientSnap.exists ? clientSnap.data() || {} : {};
      const clientName = client.name || client.firstName || client.email || 'Client';
      const trainerName = trainer.name || trainer.firstName || trainer.email || 'Trainer';

      const applicationFeeCents = Math.round(amountCents * PLATFORM_FEE_RATE);
      const commission = amount * PLATFORM_FEE_RATE;
      const trainerPayout = amount * (1 - PLATFORM_FEE_RATE);

      const charge = await stripe.charges.create(
        {
          amount: amountCents,
          currency: 'usd',
          source: token,
          application_fee_amount: applicationFeeCents,
          description: `Coaching payment from ${clientName} to ${trainerName}`,
        },
        { stripeAccount: stripeAccountId },
      );

      const paymentDoc = {
        trainer_id: trainerId,
        client_id: clientId,
        amount,
        commission,
        trainer_payout: trainerPayout,
        status: charge.status === 'succeeded' ? 'succeeded' : String(charge.status || 'pending'),
        stripe_charge_id: charge.id,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection('payments').doc(charge.id).set(paymentDoc);

      return res.json({
        success: true,
        charge_id: charge.id,
        trainer_gets: trainerPayout,
      });
    } catch (e) {
      const isDeclined = e?.type === 'StripeCardError' || e?.code === 'card_declined';
      if (!isDeclined) {
        console.error('POST /api/charges failed:', e?.message || e);
      }
      if (e?.code === 'stripe_not_configured') {
        return res.status(500).json({ error: 'Payments are temporarily unavailable. Please try again later.' });
      }
      if (e?.type === 'StripeCardError' || e?.code === 'card_declined') {
        return res.status(400).json({
          error: e.message || 'Your card was declined. Try a different payment method.',
        });
      }
      if (e?.type === 'StripeInvalidRequestError') {
        return res.status(400).json({
          error: e.message || 'Invalid payment details. Please check your card and try again.',
        });
      }
      return res.status(500).json({
        error: 'Payment could not be processed. Please try again.',
      });
    }
  });
}

module.exports = { registerStripePaymentRoutes };
