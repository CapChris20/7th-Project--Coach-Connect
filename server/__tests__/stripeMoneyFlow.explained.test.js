/**
 * Stripe money-flow tests — written as a story so the payment system is obvious.
 *
 * Run:  npx jest server/__tests__/stripeMoneyFlow.explained.test.js --verbose
 * Or:   npm run test:payments:guide
 *
 * WHAT THIS APP DOES (plain English)
 * ----------------------------------
 * 1) Trainer connects a bank once via Stripe Express (hosted Stripe form).
 * 2) Client pays the trainer in-app with a card.
 * 3) Stripe takes the money, keeps Coach Connect's 10% as application_fee,
 *    and the trainer keeps 90% (Stripe later deposits that to their bank).
 * 4) Trainers do NOT pay clients in this app. Money flows client → trainer.
 *    (Platform fee flows to YOUR Stripe platform account automatically.)
 *
 * TEST MODE vs LIVE
 * -----------------
 * - Keys starting with sk_test_ / pk_test_ = fake money, safe to experiment.
 * - Keys starting with sk_live_ / pk_live_ = real money.
 * - These Jest tests NEVER call Stripe's servers — they mock Stripe and prove
 *   our fee math + security rules. Use the guide script for real test-mode cards.
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
const { PLATFORM_FEE_RATE } = require('../routes/stripePaymentRoutes');

const TRAINER_ID = 'trainer_flow_1';
const CLIENT_ID = 'client_flow_1';
const STRIPE_ACCOUNT_ID = 'acct_test_trainer_flow';

function authHeaders(uid = CLIENT_ID) {
  return { Authorization: 'Bearer test-token' };
}

function seedLinkedPair() {
  seedUser(TRAINER_ID, {
    role: 'trainer',
    name: 'Coach Flow',
    email: 'coach@example.com',
    stripeAccountId: STRIPE_ACCOUNT_ID,
    stripeStatus: 'active',
  });
  seedUser(CLIENT_ID, {
    role: 'client',
    name: 'Client Flow',
    email: 'client@example.com',
    trainerId: TRAINER_ID,
  });
}

function mockSuccessfulCharge(chargeId = 'ch_flow_ok') {
  const chargesCreate = jest.fn().mockResolvedValue({ id: chargeId, status: 'succeeded' });
  getStripe.mockReturnValue({ charges: { create: chargesCreate } });
  return chargesCreate;
}

describe('Coach Connect payments — how money moves', () => {
  let app;

  beforeEach(() => {
    resetFirestoreStore();
    jest.clearAllMocks();
    seedLinkedPair();
    app = buildStripeTestApp({ uid: CLIENT_ID, email: 'client@example.com' });
  });

  test('platform fee is exactly 10% (trainer keeps 90%)', () => {
    expect(PLATFORM_FEE_RATE).toBe(0.1);
  });

  test('STEP: client pays $100 → trainer $90, Coach Connect $10, payment saved', async () => {
    const create = mockSuccessfulCharge('ch_100');

    const res = await postJson(
      app,
      '/api/charges',
      { trainerId: TRAINER_ID, amount: 100, token: 'tok_visa' },
      authHeaders(),
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.trainer_gets).toBe(90);
    expect(res.body.platform_fee).toBe(10);
    expect(res.body.platform_fee_rate).toBe(0.1);

    // Stripe was told: charge $100 on the trainer's Connect account, keep $10 fee
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 10000,
        application_fee_amount: 1000,
      }),
      expect.objectContaining({ stripeAccount: STRIPE_ACCOUNT_ID }),
    );

    const payment = getPayment('ch_100');
    expect(payment.status).toBe('succeeded');
    expect(payment.trainer_payout).toBe(90);
    expect(payment.commission).toBe(10);

    // Client is marked paid; trainer earnings counters move
    expect(getUser(CLIENT_ID).paymentStatus).toBe('active');
    expect(getUser(TRAINER_ID).earningsGrossCents).toBe(10000);
    expect(getUser(TRAINER_ID).earningsPlatformFeesCents).toBe(1000);
    expect(getUser(TRAINER_ID).earningsNetCents).toBe(9000);
  });

  test('STEP: random stranger cannot pay a trainer they are not linked to', async () => {
    resetFirestoreStore();
    seedUser(TRAINER_ID, {
      role: 'trainer',
      stripeAccountId: STRIPE_ACCOUNT_ID,
      stripeStatus: 'active',
    });
    seedUser(CLIENT_ID, {
      role: 'client',
      // no trainerId → not linked
    });
    mockSuccessfulCharge();

    const res = await postJson(
      app,
      '/api/charges',
      { trainerId: TRAINER_ID, amount: 50, token: 'tok_visa' },
      authHeaders(),
    );

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/linked/i);
    expect(countPayments()).toBe(0);
  });

  test('STEP: trainer without finished Stripe bank setup cannot receive payments', async () => {
    seedUser(TRAINER_ID, {
      role: 'trainer',
      stripeAccountId: STRIPE_ACCOUNT_ID,
      stripeStatus: 'pending_verification',
    });
    mockSuccessfulCharge();

    const res = await postJson(
      app,
      '/api/charges',
      { trainerId: TRAINER_ID, amount: 50, token: 'tok_visa' },
      authHeaders(),
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not set up payments/i);
    expect(countPayments()).toBe(0);
  });

  test('STEP: declined card → no payment doc, no earnings bump', async () => {
    const err = new Error('Your card was declined.');
    err.type = 'StripeCardError';
    err.code = 'card_declined';
    getStripe.mockReturnValue({
      charges: { create: jest.fn().mockRejectedValue(err) },
    });

    const res = await postJson(
      app,
      '/api/charges',
      { trainerId: TRAINER_ID, amount: 50, token: 'tok_chargeDeclined' },
      authHeaders(),
    );

    expect(res.status).toBe(400);
    expect(countPayments()).toBe(0);
    expect(getUser(TRAINER_ID).earningsGrossCents).toBeUndefined();
  });

  test('STEP: amount caps — under $1 or over $10,000 blocked', async () => {
    mockSuccessfulCharge();

    const tooSmall = await postJson(
      app,
      '/api/charges',
      { trainerId: TRAINER_ID, amount: 0.5, token: 'tok_visa' },
      authHeaders(),
    );
    expect(tooSmall.status).toBe(400);

    const tooBig = await postJson(
      app,
      '/api/charges',
      { trainerId: TRAINER_ID, amount: 10001, token: 'tok_visa' },
      authHeaders(),
    );
    expect(tooBig.status).toBe(400);
    expect(countPayments()).toBe(0);
  });
});

describe('Coach Connect payments — what trainers do with Stripe Connect', () => {
  test('create-account rejects non-trainers (clients cannot open a payout account)', async () => {
    resetFirestoreStore();
    seedUser(CLIENT_ID, { role: 'client', email: 'client@example.com' });
    getStripe.mockReturnValue({
      accounts: { create: jest.fn() },
      accountLinks: { create: jest.fn() },
    });

    const app = buildStripeTestApp({ uid: CLIENT_ID, email: 'client@example.com' });
    const res = await postJson(
      app,
      '/api/stripe/create-account',
      { email: 'client@example.com' },
      authHeaders(CLIENT_ID),
    );

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/only trainers/i);
  });
});
