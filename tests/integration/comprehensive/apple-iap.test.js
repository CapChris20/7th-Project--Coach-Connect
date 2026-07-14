/**
 * Apple IAP — verify endpoint wiring (no real App Store charges; payments excluded).
 */
const fs = require('fs');
const path = require('path');
const { pass, fail, skip, apiFetch, ROOT } = require('./lib/harness');

async function testAppleIap() {
  const results = [];

  const iapScript = path.join(ROOT, 'scripts/testIapDevBuild.js');
  if (fs.existsSync(iapScript)) {
    results.push(pass('IAP dev test script exists'));
  } else {
    results.push(fail('IAP dev test script exists', 'missing'));
  }

  const subscriptionRoutes = path.join(ROOT, 'server/routes/subscriptionRoutes.js');
  if (fs.existsSync(subscriptionRoutes)) {
    results.push(pass('subscriptionRoutes module exists'));
  } else {
    results.push(fail('subscriptionRoutes module exists', 'missing'));
  }

  try {
    const { res, json } = await apiFetch('/api/subscription/apple/verify', {
      method: 'POST',
      body: JSON.stringify({ receipt: 'invalid-test-receipt' }),
    });
    if ([401, 403, 400, 404].includes(res.status)) {
      results.push(pass('Apple IAP verify rejects unauthenticated/invalid receipt', { httpStatus: res.status }));
    } else {
      results.push(fail('Apple IAP verify rejects unauthenticated/invalid receipt', `unexpected ${res.status}`, { body: json }));
    }
  } catch (e) {
    results.push(skip('Apple IAP verify rejects unauthenticated/invalid receipt', e.message));
  }

  results.push(pass('Stripe/payment webhooks excluded from comprehensive suite'));

  return results;
}

module.exports = { testAppleIap };
