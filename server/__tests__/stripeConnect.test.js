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
  getUser,
  resetFirestoreStore,
} = require('./helpers/stripeRouteTestHarness');

const TRAINER_UID = 'trainer-test-uid';
const TRAINER_EMAIL = 'trainer@example.com';

function makeStripeConnectMock({ chargesEnabled = false } = {}) {
  const accountId = 'acct_test123456';
  const accountsCreate = jest.fn().mockResolvedValue({ id: accountId });
  const accountsRetrieve = jest.fn().mockResolvedValue({
    id: accountId,
    charges_enabled: chargesEnabled,
  });
  const accountLinksCreate = jest.fn().mockResolvedValue({
    url: 'https://connect.stripe.com/setup/test/onboarding',
  });
  const balanceRetrieve = jest.fn().mockResolvedValue({
    pending: [{ amount: 0, currency: 'usd' }],
    available: [{ amount: 0, currency: 'usd' }],
  });

  getStripe.mockReturnValue({
    accounts: {
      create: accountsCreate,
      retrieve: accountsRetrieve,
    },
    accountLinks: { create: accountLinksCreate },
    balance: { retrieve: balanceRetrieve },
  });

  return { accountId, accountsCreate, accountsRetrieve, accountLinksCreate, balanceRetrieve };
}

describe('Stripe Connect routes', () => {
  beforeEach(() => {
    resetFirestoreStore();
    jest.clearAllMocks();
  });

  test('Test 1: Create Stripe Connect Account', async () => {
    const stripe = makeStripeConnectMock();
    const app = buildStripeTestApp({ uid: TRAINER_UID, email: TRAINER_EMAIL });

    const res = await postJson(
      app,
      '/api/stripe/create-account',
      { email: TRAINER_EMAIL },
      { Authorization: 'Bearer test-token' },
    );

    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^https:\/\/connect\.stripe\.com/);

    const user = getUser(TRAINER_UID);
    expect(user.stripeAccountId).toMatch(/^acct_/);
    expect(user.stripeStatus).toBe('pending_verification');
    expect(stripe.accountsCreate).toHaveBeenCalledTimes(1);
    expect(stripe.accountLinksCreate).toHaveBeenCalledTimes(1);
  });

  test('Test 2: Verify Status (Before Verification)', async () => {
    makeStripeConnectMock({ chargesEnabled: false });
    const app = buildStripeTestApp({ uid: TRAINER_UID, email: TRAINER_EMAIL });

    await postJson(
      app,
      '/api/stripe/create-account',
      { email: TRAINER_EMAIL },
      { Authorization: 'Bearer test-token' },
    );

    const res = await postJson(
      app,
      '/api/stripe/verify-status',
      {},
      { Authorization: 'Bearer test-token' },
    );

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending_verification');
    expect(res.body.account_id).toMatch(/^acct_/);

    const user = getUser(TRAINER_UID);
    expect(user.stripeStatus).toBe('pending_verification');
  });

  test('Test 3: Verify Status (After Verification - Simulate)', async () => {
    const stripe = makeStripeConnectMock({ chargesEnabled: false });
    const app = buildStripeTestApp({ uid: TRAINER_UID, email: TRAINER_EMAIL });

    await postJson(
      app,
      '/api/stripe/create-account',
      { email: TRAINER_EMAIL },
      { Authorization: 'Bearer test-token' },
    );

    stripe.accountsRetrieve.mockResolvedValue({
      id: 'acct_test123456',
      charges_enabled: true,
    });

    const res = await postJson(
      app,
      '/api/stripe/verify-status',
      {},
      { Authorization: 'Bearer test-token' },
    );

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');

    const user = getUser(TRAINER_UID);
    expect(user.stripeStatus).toBe('active');
  });

  test('Test 4: Get Balance', async () => {
    makeStripeConnectMock({ chargesEnabled: true });
    const app = buildStripeTestApp({ uid: TRAINER_UID, email: TRAINER_EMAIL });

    await postJson(
      app,
      '/api/stripe/create-account',
      { email: TRAINER_EMAIL },
      { Authorization: 'Bearer test-token' },
    );

    const verify = await postJson(
      app,
      '/api/stripe/verify-status',
      {},
      { Authorization: 'Bearer test-token' },
    );
    expect(verify.body.status).toBe('active');

    const res = await postJson(
      app,
      '/api/stripe/get-balance',
      {},
      { Authorization: 'Bearer test-token' },
    );

    expect(res.status).toBe(200);
    expect(res.body.pending).toBeGreaterThanOrEqual(0);
    expect(res.body.available).toBeGreaterThanOrEqual(0);
    expect(res.body.pending).toBe(0);
    expect(res.body.available).toBe(0);
  });

  test('Test 5: Error - No Auth Token', async () => {
    makeStripeConnectMock();
    const app = buildStripeTestApp({ uid: TRAINER_UID, email: TRAINER_EMAIL });

    const res = await postJson(app, '/api/stripe/create-account', { email: TRAINER_EMAIL });

    expect(res.status).toBe(401);
  });

  test('Test 6: Account Already Exists — reuses same stripeAccountId', async () => {
    const stripe = makeStripeConnectMock();
    const app = buildStripeTestApp({ uid: TRAINER_UID, email: TRAINER_EMAIL });
    const headers = { Authorization: 'Bearer test-token' };

    const first = await postJson(
      app,
      '/api/stripe/create-account',
      { email: TRAINER_EMAIL },
      headers,
    );
    expect(first.status).toBe(200);

    const userAfterFirst = getUser(TRAINER_UID);
    const firstAccountId = userAfterFirst.stripeAccountId;

    const second = await postJson(
      app,
      '/api/stripe/create-account',
      { email: TRAINER_EMAIL },
      headers,
    );
    expect(second.status).toBe(200);
    expect(second.body.url).toMatch(/^https:\/\/connect\.stripe\.com/);

    const userAfterSecond = getUser(TRAINER_UID);
    expect(userAfterSecond.stripeAccountId).toBe(firstAccountId);
    expect(stripe.accountsCreate).toHaveBeenCalledTimes(1);
    expect(stripe.accountLinksCreate).toHaveBeenCalledTimes(2);
  });
});
