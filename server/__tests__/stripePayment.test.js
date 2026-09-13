/**
 * POST /api/charges — real Express route + in-memory Firestore, mocked Stripe SDK.
 * Proves money split, Firestore writes, and error handling without hitting Stripe's servers.
 */
jest.mock('../lib/stripeClient', () => ({
  getStripe: jest.fn(),
}));

jest.mock('firebase-admin', () =>
  require('./helpers/stripeRouteTestHarness').createFirebaseAdminMock(),
);

const { getStripe } = require('../lib/stripeClient');
const {
  buildStripeTestApp,
  postJson,
  seedUser,
  getUser,
  getPayment,
  countPayments,
  resetFirestoreStore,
} = require('./helpers/stripeRouteTestHarness');

const TRAINER_ID = 'trainer123';
const CLIENT_ID = 'client456';
const CLIENT_EMAIL = 'client@example.com';
const STRIPE_ACCOUNT_ID = 'acct_trainer_active';

function authHeaders() {
  return { Authorization: 'Bearer test-token' };
}

function seedActiveTrainer(overrides = {}) {
  seedUser(TRAINER_ID, {
    role: 'trainer',
    name: 'Coach Test',
    stripeAccountId: STRIPE_ACCOUNT_ID,
    stripeStatus: 'active',
    ...overrides,
  });
}

function seedClient() {
  seedUser(CLIENT_ID, {
    role: 'client',
    name: 'Client Test',
    email: CLIENT_EMAIL,
    trainerId: TRAINER_ID,
  });
}

function makeStripePaymentMock({ decline = false, chargeId = 'ch_test_charge_001' } = {}) {
  const chargesCreate = jest.fn().mockImplementation(async () => {
    if (decline) {
      const err = new Error('Your card was declined.');
      err.type = 'StripeCardError';
      err.code = 'card_declined';
      throw err;
    }
    return { id: chargeId, status: 'succeeded' };
  });

  getStripe.mockReturnValue({ charges: { create: chargesCreate } });
  return { chargesCreate };
}

async function postCharge(app, body, headers = authHeaders()) {
  return postJson(app, '/api/charges', body, headers);
}

describe('POST /api/charges', () => {
  let app;

  beforeEach(() => {
    resetFirestoreStore();
    jest.clearAllMocks();
    seedActiveTrainer();
    seedClient();
    app = buildStripeTestApp({ uid: CLIENT_ID, email: CLIENT_EMAIL });
  });

  describe('successful charges (Stripe mocked, Firestore written)', () => {
    test('$50 → 200, trainer gets $45, platform fee $5, payment doc saved', async () => {
      const stripe = makeStripePaymentMock({ chargeId: 'ch_fifty' });

      const res = await postCharge(app, {
        trainerId: TRAINER_ID,
        amount: 50,
        token: 'tok_visa',
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        charge_id: 'ch_fifty',
        trainer_gets: 45,
        platform_fee: 5,
        platform_fee_rate: 0.1,
      });

      expect(getPayment('ch_fifty')).toEqual({
        trainer_id: TRAINER_ID,
        client_id: CLIENT_ID,
        amount: 50,
        commission: 5,
        trainer_payout: 45,
        platform_fee_rate: 0.1,
        status: 'succeeded',
        stripe_charge_id: 'ch_fifty',
        stripe_account_id: STRIPE_ACCOUNT_ID,
        created_at: 'SERVER_TS',
      });

      expect(getUser(CLIENT_ID).paymentStatus).toBe('active');
      expect(getUser(TRAINER_ID).earningsGrossCents).toBe(5000);
      expect(getUser(TRAINER_ID).earningsPlatformFeesCents).toBe(500);
      expect(getUser(TRAINER_ID).earningsNetCents).toBe(4500);

      expect(stripe.chargesCreate).toHaveBeenCalledTimes(1);
      expect(stripe.chargesCreate).toHaveBeenCalledWith(
        {
          amount: 5000,
          currency: 'usd',
          source: 'tok_visa',
          application_fee_amount: 500,
          description: expect.stringContaining('Coaching payment'),
          metadata: {
            coachconnect_client_id: CLIENT_ID,
            coachconnect_trainer_id: TRAINER_ID,
            platform_fee_rate: '0.1',
          },
        },
        expect.objectContaining({ stripeAccount: STRIPE_ACCOUNT_ID }),
      );
    });

    test('forwards idempotencyKey to Stripe so a double-tap cannot double-charge', async () => {
      const stripe = makeStripePaymentMock({ chargeId: 'ch_idem' });

      const res = await postCharge(app, {
        trainerId: TRAINER_ID,
        amount: 50,
        token: 'tok_visa',
        idempotencyKey: 'pay_client456_abc123',
      });

      expect(res.status).toBe(200);
      expect(stripe.chargesCreate).toHaveBeenCalledWith(
        expect.any(Object),
        {
          stripeAccount: STRIPE_ACCOUNT_ID,
          idempotencyKey: 'pay_client456_abc123',
        },
      );
    });

    test('$100 → trainer gets $90, commission scales to $10', async () => {
      makeStripePaymentMock({ chargeId: 'ch_hundred' });

      const res = await postCharge(app, {
        trainerId: TRAINER_ID,
        amount: 100,
        token: 'tok_visa',
      });

      expect(res.status).toBe(200);
      expect(res.body.trainer_gets).toBe(90);
      expect(getPayment('ch_hundred').commission).toBe(10);
      expect(getPayment('ch_hundred').trainer_payout).toBe(90);
    });

    test('$1 minimum → commission $0.10, trainer $0.90', async () => {
      makeStripePaymentMock({ chargeId: 'ch_one' });

      const res = await postCharge(app, {
        trainerId: TRAINER_ID,
        amount: 1,
        token: 'tok_visa',
      });

      expect(res.status).toBe(200);
      const payment = getPayment('ch_one');
      expect(payment.commission).toBeCloseTo(0.1, 5);
      expect(payment.trainer_payout).toBeCloseTo(0.9, 5);
    });
  });

  describe('rejected charges (no Firestore write)', () => {
    test('declined card → 400, Stripe never persisted', async () => {
      makeStripePaymentMock({ decline: true });

      const res = await postCharge(app, {
        trainerId: TRAINER_ID,
        amount: 50,
        token: 'tok_chargeDeclined',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/declined/i);
      expect(countPayments()).toBe(0);
    });

    test('unknown trainer → 400', async () => {
      makeStripePaymentMock();

      const res = await postCharge(app, {
        trainerId: 'nonexistent123',
        amount: 50,
        token: 'tok_visa',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Trainer not found');
      expect(countPayments()).toBe(0);
    });

    test('trainer stripeStatus pending → 400, payments blocked', async () => {
      resetFirestoreStore();
      seedUser(TRAINER_ID, {
        role: 'trainer',
        stripeAccountId: STRIPE_ACCOUNT_ID,
        stripeStatus: 'pending_verification',
      });
      seedClient();
      makeStripePaymentMock();

      const res = await postCharge(app, {
        trainerId: TRAINER_ID,
        amount: 50,
        token: 'tok_visa',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Trainer has not set up payments');
      expect(countPayments()).toBe(0);
    });

    test('no auth token → 401', async () => {
      makeStripePaymentMock();

      const res = await postCharge(
        app,
        { trainerId: TRAINER_ID, amount: 50, token: 'tok_visa' },
        {},
      );

      expect(res.status).toBe(401);
      expect(countPayments()).toBe(0);
    });

    test('client not linked to trainer → 403', async () => {
      resetFirestoreStore();
      seedActiveTrainer();
      seedUser(CLIENT_ID, {
        role: 'client',
        name: 'Client Test',
        email: CLIENT_EMAIL,
        // no trainerId
      });
      makeStripePaymentMock();

      const res = await postCharge(app, {
        trainerId: TRAINER_ID,
        amount: 50,
        token: 'tok_visa',
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/linked/i);
      expect(countPayments()).toBe(0);
    });

    test('amount 0 → 400', async () => {
      makeStripePaymentMock();

      const res = await postCharge(app, {
        trainerId: TRAINER_ID,
        amount: 0,
        token: 'tok_visa',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/amount/i);
      expect(countPayments()).toBe(0);
    });

    test('amount -50 → 400', async () => {
      makeStripePaymentMock();

      const res = await postCharge(app, {
        trainerId: TRAINER_ID,
        amount: -50,
        token: 'tok_visa',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/amount/i);
      expect(countPayments()).toBe(0);
    });

    test('amount above $10000 → 400', async () => {
      makeStripePaymentMock();

      const res = await postCharge(app, {
        trainerId: TRAINER_ID,
        amount: 10001,
        token: 'tok_visa',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/10000/i);
      expect(countPayments()).toBe(0);
    });

    test('missing token → 400', async () => {
      makeStripePaymentMock();

      const res = await postCharge(app, { trainerId: TRAINER_ID });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('token is required');
      expect(countPayments()).toBe(0);
    });
  });
});
