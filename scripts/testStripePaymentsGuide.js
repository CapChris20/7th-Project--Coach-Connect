#!/usr/bin/env node
/**
 * Explains Coach Connect payments + runs the money-flow Jest suite.
 *
 * Usage:
 *   npm run test:payments:guide
 *   node scripts/testStripePaymentsGuide.js
 *   node scripts/testStripePaymentsGuide.js --live-ping   # optional: ping Stripe test API if sk_test_ is set
 */
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ROOT = path.join(__dirname, '..');
const wantLivePing = process.argv.includes('--live-ping');

function section(title) {
  console.log('\n═══════════════════════════════════════════════════');
  console.log(title);
  console.log('═══════════════════════════════════════════════════');
}

function main() {
  section('1) How money works in Coach Connect');
  console.log(`
WHO PAYS WHOM
  • Client pays trainer (in-app card charge).
  • Trainer does NOT pay the client.
  • Coach Connect automatically keeps 10% (application fee).
  • Trainer keeps 90%. Stripe later deposits that to the trainer's bank.

IS BANK SETUP EASY FOR TRAINERS?
  • Yes — they tap "Connect Bank Account" → Stripe's hosted form (Express).
  • They enter legal name / bank / tax basics once. You do not store bank numbers.
  • When Stripe finishes verifying, stripeStatus becomes "active".

IS IT EASY FOR YOU (THE PLATFORM) TO GET THE 10%?
  • Yes — automatic. On every charge we set application_fee_amount = 10%.
  • That fee lands in YOUR Stripe platform balance. No manual transfer step.
  • Trainer never "sends you" the fee; Stripe splits it at charge time.

IS IT EASY FOR TRAINERS TO GET PAID OUT?
  • Yes — Stripe Express payouts (usually every couple business days).
  • They manage bank details inside Stripe's portal / our Manage Payout Account.
`);

  section('2) How to test in Stripe TEST mode (fake money)');
  console.log(`
A) KEYS
  • In Stripe Dashboard, toggle "Test mode" ON.
  • Copy sk_test_... → STRIPE_SECRET_KEY in .env
  • Copy pk_test_... → EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env
  • Sync: ./scripts/syncCloudRunEnv.sh  (and EAS env if needed)
  • Restart the app / API after changing keys.

B) TRAINER SETUP (in the app)
  1. Log in as a trainer account.
  2. Open Payments → Connect Bank Account.
  3. In Stripe test onboarding, use Stripe's test data
     (they provide fake SSN / routing numbers in the form help).
  4. Finish → Refresh status until it says Active.

C) CLIENT PAYMENT (in the app)
  1. Client must be LINKED to that trainer (accepted client request / CRM).
  2. Open pay / billing → enter amount.
  3. Use Stripe test cards:
       Success:  4242 4242 4242 4242
       Decline:  4000 0000 0000 0002
     Any future expiry, any CVC, any ZIP.
  4. Confirm: payment appears in trainer Payment History,
     client paymentStatus becomes active,
     your Stripe Dashboard → Payments shows the charge + application fee.

D) WHAT YOU SHOULD SEE IN STRIPE DASHBOARD (test mode)
  • Payments: charge for $X
  • Application fee: ~10% of X
  • Connected account: the trainer's Express account
`);

  section('3) Automated tests (no real Stripe calls)');
  const jestResult = spawnSync(
    'npx',
    ['jest', '--runInBand', '--verbose', 'server/__tests__/stripeMoneyFlow.explained.test.js'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  const out = `${jestResult.stdout || ''}\n${jestResult.stderr || ''}`;
  const lines = out.split('\n').filter((l) => /^\s*(✓|✕|PASS|FAIL|Tests:)/.test(l) || /STEP:|platform fee|rejects non-trainers/.test(l));
  console.log(lines.join('\n') || out.slice(-2000));
  if (jestResult.status !== 0) {
    console.error('\n❌ Money-flow Jest suite failed.');
    process.exit(jestResult.status || 1);
  }
  console.log('\n✅ Money-flow Jest suite passed.');

  if (wantLivePing) {
    section('4) Live ping (Stripe test API)');
    const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
    if (!key) {
      console.log('No STRIPE_SECRET_KEY in .env — skip.');
    } else if (!key.startsWith('sk_test_')) {
      console.log('STRIPE_SECRET_KEY is not sk_test_ — refusing live ping (safety).');
      console.log('Switch Dashboard to Test mode and use a test secret key.');
    } else {
      // eslint-disable-next-line global-require
      const Stripe = require('stripe');
      const stripe = new Stripe(key, { apiVersion: '2024-06-20' });
      stripe.balance
        .retrieve()
        .then((bal) => {
          console.log('✅ Stripe test API reachable.');
          console.log('   available:', bal.available);
          console.log('   pending:', bal.pending);
          console.log('\nNext: run through the in-app steps in section 2.');
        })
        .catch((e) => {
          console.error('❌ Stripe test API error:', e?.message || e);
          process.exit(1);
        });
      return; // async exit
    }
  }

  section('Done');
  console.log(`
Quick commands:
  npm run test:payments:guide
  npm run test:payments:guide -- --live-ping
  npm run test:payments
`);
}

main();
