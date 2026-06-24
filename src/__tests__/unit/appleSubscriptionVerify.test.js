const {
  buildSubscriptionFromTransaction,
  decodeJwsPayload,
} = require('../../../server/lib/appleSubscriptionVerify');

function makeJws(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

describe('appleSubscriptionVerify', () => {
  it('maps trial offer to free_trial status', () => {
    const now = new Date('2026-06-24T12:00:00.000Z');
    const sub = buildSubscriptionFromTransaction(
      {
        productId: 'com.coachconnect.pro.monthly',
        bundleId: 'com.coachconnect',
        transactionId: 'tx1',
        originalTransactionId: 'tx1',
        purchaseDateMs: now.getTime(),
        expiresDateMs: now.getTime() + 3 * 24 * 60 * 60 * 1000,
        offerType: 1,
        environment: 'Sandbox',
      },
      now,
    );
    expect(sub.status).toBe('free_trial');
    expect(sub.platform).toBe('ios');
    expect(sub.trialEndsAt).toBeTruthy();
  });

  it('decodes JWS payload', () => {
    const jws = makeJws({
      productId: 'com.coachconnect.pro.monthly',
      bundleId: 'com.coachconnect',
      expiresDate: Date.now() + 10000,
    });
    const payload = decodeJwsPayload(jws);
    expect(payload.productId).toBe('com.coachconnect.pro.monthly');
  });
});
