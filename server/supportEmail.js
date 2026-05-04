/**
 * Sends support inquiry emails to the CoachConnect inbox.
 *
 * Configure one of:
 * - RESEND_API_KEY — uses https://api.resend.com (set SUPPORT_EMAIL_FROM to a verified sender, or use Resend onboarding domain)
 * - SMTP_HOST + SMTP_USER + SMTP_PASS — uses nodemailer (optional SMTP_PORT, SMTP_SECURE, SMTP_FROM)
 *
 * Env:
 * - SUPPORT_INBOX_EMAIL — recipient (default: coachconnect@cc.app)
 * - SUPPORT_EMAIL_FROM — Resend "from" (default: CoachConnect <onboarding@resend.dev> for Resend test)
 */

const DEFAULT_INBOX = 'coachconnect@cc.app';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {object} opts
 * @param {string} opts.subject
 * @param {string} opts.text
 * @param {string} [opts.html]
 * @param {string|null} [opts.replyTo]
 */
async function sendSupportInquiryEmail({ subject, text, html, replyTo }) {
  const to = (process.env.SUPPORT_INBOX_EMAIL || DEFAULT_INBOX).trim();

  if (process.env.RESEND_API_KEY) {
    const from =
      process.env.SUPPORT_EMAIL_FROM?.trim() || 'CoachConnect <onboarding@resend.dev>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html: html || undefined,
        reply_to: replyTo && String(replyTo).includes('@') ? replyTo : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.message || data?.error || JSON.stringify(data) || `Resend HTTP ${res.status}`;
      throw new Error(msg);
    }
    return { provider: 'resend', id: data?.id };
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    // eslint-disable-next-line global-require
    const nodemailer = require('nodemailer');
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    await transporter.sendMail({
      from,
      to,
      replyTo: replyTo || undefined,
      subject,
      text,
      html,
    });
    return { provider: 'smtp' };
  }

  throw new Error(
    'Email is not configured on this server. Set RESEND_API_KEY or SMTP_HOST+SMTP_USER+SMTP_PASS in the API .env (see server/supportEmail.js).'
  );
}

function buildBodies({ message, userUid, userEmail }) {
  const header = [`User: ${userEmail || '(no email)'}`, `UID: ${userUid || '(none)'}`, ''].join('\n');
  const text = `${header}\n${message}`;
  const html = `<p><strong>User:</strong> ${escapeHtml(userEmail || '(no email)')}<br/><strong>UID:</strong> ${escapeHtml(userUid || '(none)')}</p><pre style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeHtml(message)}</pre>`;
  return { text, html };
}

module.exports = {
  sendSupportInquiryEmail,
  buildBodies,
  DEFAULT_INBOX,
};
