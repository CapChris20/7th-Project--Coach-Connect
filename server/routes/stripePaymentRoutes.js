/** Client → trainer coaching charges (Stripe Connect direct charges + 10% platform fee). */
const admin = require('firebase-admin');
const { getStripe } = require('../lib/stripeClient');
const { isTrainerOfClient } = require('../lib/pushNotificationAuth');

const PLATFORM_FEE_RATE = 0.1;
const MIN_CHARGE_DOLLARS = 1;
const MAX_CHARGE_DOLLARS = 10000;
const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

function sanitizeIdempotencyKey(raw) {
  const key = String(raw || '').trim();
  if (!key) return null;
  if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(key)) return null;
  return key;
}

function dollarsToCents(dollars) {
  const n = Number(dollars);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

async function assertClientLinkedToTrainer(db, clientId, trainerId, clientData = {}) {
  const linkedOnUser =
    String(clientData.trainerId || clientData.trainer_id || '').trim() === String(trainerId);
  if (linkedOnUser) return true;
  return isTrainerOfClient(db, trainerId, clientId);
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
      const idempotencyKey = sanitizeIdempotencyKey(req.body?.idempotencyKey);

      if (!trainerId) {
        return res.status(400).json({ error: 'trainerId is required' });
      }
      if (trainerId === clientId) {
        return res.status(400).json({ error: 'Cannot charge yourself' });
      }
      if (!token) {
        return res.status(400).json({ error: 'token is required' });
      }

      if (!Number.isFinite(amount) || amount < MIN_CHARGE_DOLLARS) {
        return res.status(400).json({ error: `amount must be at least $${MIN_CHARGE_DOLLARS}` });
      }
      if (amount > MAX_CHARGE_DOLLARS) {
        return res.status(400).json({ error: `amount cannot exceed $${MAX_CHARGE_DOLLARS}` });
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

      const client = clientSnap.exists ? clientSnap.data() || {} : {};
      const linked = await assertClientLinkedToTrainer(db, clientId, trainerId, client);
      if (!linked) {
        console.warn('POST /api/charges blocked — client not linked to trainer', {
          clientId: clientId.slice(0, 8),
          trainerId: trainerId.slice(0, 8),
        });
        return res.status(403).json({
          error: 'You can only pay a trainer you are linked with.',
        });
      }

      const stripeAccountId = String(trainer.stripeAccountId || '').trim();
      const stripeStatus = String(trainer.stripeStatus || '').trim();

      if (!stripeAccountId || stripeStatus !== 'active') {
        return res.status(400).json({ error: 'Trainer has not set up payments' });
      }

      const clientName = client.name || client.firstName || client.email || 'Client';
      const trainerName = trainer.name || trainer.firstName || trainer.email || 'Trainer';

      const applicationFeeCents = Math.round(amountCents * PLATFORM_FEE_RATE);
      const commission = Math.round(amount * PLATFORM_FEE_RATE * 100) / 100;
      const trainerPayout = Math.round(amount * (1 - PLATFORM_FEE_RATE) * 100) / 100;

      const chargeOptions = { stripeAccount: stripeAccountId };
      if (idempotencyKey) {
        chargeOptions.idempotencyKey = idempotencyKey;
      }

      const charge = await stripe.charges.create(
        {
          amount: amountCents,
          currency: 'usd',
          source: token,
          application_fee_amount: applicationFeeCents,
          description: `Coaching payment from ${clientName} to ${trainerName}`,
          metadata: {
            coachconnect_client_id: clientId,
            coachconnect_trainer_id: trainerId,
            platform_fee_rate: String(PLATFORM_FEE_RATE),
          },
        },
        chargeOptions,
      );

      const succeeded = charge.status === 'succeeded';
      const paymentDoc = {
        trainer_id: trainerId,
        client_id: clientId,
        amount,
        commission,
        trainer_payout: trainerPayout,
        platform_fee_rate: PLATFORM_FEE_RATE,
        status: succeeded ? 'succeeded' : String(charge.status || 'pending'),
        stripe_charge_id: charge.id,
        stripe_account_id: stripeAccountId,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      };

      const batch = db.batch();
      batch.set(db.collection('payments').doc(charge.id), paymentDoc);

      if (succeeded) {
        batch.set(
          db.collection('users').doc(clientId),
          {
            paymentStatus: 'active',
            lastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
            lastPaymentAmount: amount,
            lastPaymentId: charge.id,
          },
          { merge: true },
        );

        const crmRef = db.collection('trainer_clients').doc(trainerId).collection('clients').doc(clientId);
        batch.set(
          crmRef,
          {
            paymentStatus: 'active',
            lastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
            lastPaymentAmount: amount,
          },
          { merge: true },
        );

        batch.set(
          db.collection('users').doc(trainerId),
          {
            earningsGrossCents: admin.firestore.FieldValue.increment(amountCents),
            earningsPlatformFeesCents: admin.firestore.FieldValue.increment(applicationFeeCents),
            earningsNetCents: admin.firestore.FieldValue.increment(amountCents - applicationFeeCents),
            lastPayoutReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }

      await batch.commit();

      return res.json({
        success: true,
        charge_id: charge.id,
        trainer_gets: trainerPayout,
        platform_fee: commission,
        platform_fee_rate: PLATFORM_FEE_RATE,
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

module.exports = {
  registerStripePaymentRoutes,
  PLATFORM_FEE_RATE,
  MIN_CHARGE_DOLLARS,
  MAX_CHARGE_DOLLARS,
};
