#!/usr/bin/env node
/**
 * Verify support email routing (mock send — does not deliver mail unless --live).
 *
 *   node scripts/testSupportEmail.js           # routing check only
 *   node scripts/testSupportEmail.js --live    # sends one test email via Resend/SMTP
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { sendSupportInquiryEmail, buildBodies, DEFAULT_INBOX } = require('../server/supportEmail');

const live = process.argv.includes('--live');
const expectedInbox = (process.env.SUPPORT_INBOX_EMAIL || DEFAULT_INBOX).trim();

async function main() {
  const providerReady = !!(
    process.env.RESEND_API_KEY ||
    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  );

  console.log('Support email check');
  console.log('  inbox:', expectedInbox);
  console.log('  digit 0 (not "zero"):', expectedInbox.includes('0') && !expectedInbox.includes('zero'));
  console.log('  provider configured:', providerReady ? 'yes' : 'NO — add RESEND_API_KEY or SMTP_* to .env');

  if (!providerReady) {
    console.log('\n⚠️  No email provider — in-app forms still work (Firestore tickets). Add RESEND or SMTP for inbox delivery.');
    console.log('   Fix: add to .env, then run ./scripts/syncCloudRunEnv.sh');
    console.log('   Option A: RESEND_API_KEY=re_...');
    console.log('   Option B: SMTP_HOST=smtp.gmail.com SMTP_USER=coachconnect0@gmail.com SMTP_PASS=<app password>');
    process.exit(1);
  }

  const { text, html } = buildBodies({
    message: 'Support email routing test (scripts/testSupportEmail.js)',
    userUid: 'test-script',
    userEmail: 'test@example.com',
  });

  if (!live) {
    let capturedTo = null;
    const originalFetch = global.fetch;
    global.fetch = async (url, opts) => {
      if (String(url).includes('api.resend.com')) {
        capturedTo = JSON.parse(opts.body).to;
        return { ok: true, json: async () => ({ id: 'mock-id' }) };
      }
      return originalFetch(url, opts);
    };
    try {
      const result = await sendSupportInquiryEmail({
        subject: '[TEST] Support routing verification',
        text,
        html,
        replyTo: 'test@example.com',
      });
      const ok = Array.isArray(capturedTo) && capturedTo[0] === expectedInbox;
      console.log('\n  mock provider:', result.provider);
      console.log('  routed to:', capturedTo?.[0]);
      console.log(ok ? '\n✅ Routing OK (dry run)' : '\n❌ Wrong inbox');
      process.exit(ok ? 0 : 1);
    } finally {
      global.fetch = originalFetch;
    }
  }

  const result = await sendSupportInquiryEmail({
    subject: '[TEST] Coach Connect support email live test',
    text,
    html,
    replyTo: 'test@example.com',
  });
  console.log('\n✅ Live test sent via', result.provider, '→', expectedInbox);
  if (result.id) console.log('   message id:', result.id);
}

main().catch((e) => {
  console.error('\n❌', e.message || e);
  process.exit(1);
});
